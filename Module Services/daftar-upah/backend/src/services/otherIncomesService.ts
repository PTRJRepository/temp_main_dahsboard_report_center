import { Database } from "../db/client";
import { HistoryDatabaseService } from "./historyDatabaseService";
import { divisionConfigService } from "./config/DivisionConfigService";
import { employeeHrDataService } from "./employeeHrDataService";
import { debug, info, warn, error as logError } from "../utils/logger";
import type { OtherIncome } from "./payroll/otherIncomes/otherIncomesHelpers";
import {
    deduplicateIncomeRows as _deduplicateIncomeRows,
    chunkArray,
    parseDate,
    getLatestValidDate,
    isValidBankAccNo,
    normalizeName
} from "./payroll/otherIncomes/otherIncomesHelpers";
import * as Q from "./payroll/otherIncomes/otherIncomesQueries";
import { OtherIncomesThrService } from "./otherIncomesThrService";

const CATEGORY = "OtherIncomes";

// Re-export for backward compat — consumers import OtherIncome from this module.
export type { OtherIncome };

export class OtherIncomesService {
    private static instance: OtherIncomesService;

    private constructor() {}

    public static getInstance(): OtherIncomesService {
        if (!OtherIncomesService.instance) {
            OtherIncomesService.instance = new OtherIncomesService();
        }
        return OtherIncomesService.instance;
    }

    // ── Pure helpers re-exported — imported directly via ./payroll/otherIncomes/otherIncomesHelpers
    //   by code that needs them. These passthroughs remain for backward compat.
    public static deduplicateIncomeRows = _deduplicateIncomeRows as typeof _deduplicateIncomeRows;
    private static chunkArray = chunkArray as typeof chunkArray;
    private static parseDate = parseDate as typeof parseDate;
    private static getLatestValidDate = getLatestValidDate as typeof getLatestValidDate;
    private static isValidBankAccNo = isValidBankAccNo as typeof isValidBankAccNo;

    /**
     * Backfill new_nik for existing records that don't have it.
     * nik is NEVER changed — this only populates new_nik as the correct KTP NIK.
     * Strategy:
     *   1. If emp_code exists → lookup HR_EMPLOYEE.NewICNo by emp_code
     *   2. If only nik exists → use nik as-is (it's already the correct NIK for legacy records)
     *
     * This is safe to run multiple times — uses UPDATE only for NULL values.
     */
    static async backfillNewNik(): Promise<{ updated: number; skipped: number; errors: number }> {
        const db = Database.getExtendedInstance();
        const mainDb = Database.getInstance();
        const stats = { updated: 0, skipped: 0, errors: 0 };

        try {
            const records = await Q.selectRecordsNeedingNikBackfill(db);

            if (records.length === 0) {
                console.log('[backfillNewNik] No records need backfill');
                return stats;
            }

            console.log(`[backfillNewNik] Found ${records.length} records needing new_nik backfill`);

            const empCodes = [...new Set(
                records
                    .map(r => (r.emp_code || '').trim().toUpperCase())
                    .filter(Boolean)
            )];

            const newIcNoMap = new Map<string, string>();
            if (empCodes.length > 0) {
                const CHUNK = 500;
                for (let i = 0; i < empCodes.length; i += CHUNK) {
                    const chunk = empCodes.slice(i, i + CHUNK);
                    const rows = await Q.selectHrEmployeeForBackfill(mainDb, chunk);
                    for (const row of rows) {
                        const ec = (row.EmpCode || '').trim().toUpperCase();
                        const nikVal = (row.NewICNo || '').trim();
                        if (ec && nikVal) {
                            newIcNoMap.set(ec, nikVal);
                        }
                    }
                }
            }

            for (const record of records) {
                try {
                    const empCodeKey = (record.emp_code || '').trim().toUpperCase();
                    let resolvedNewNik: string | null = null;

                    if (empCodeKey && newIcNoMap.has(empCodeKey)) {
                        resolvedNewNik = newIcNoMap.get(empCodeKey) || null;
                    } else if (record.nik) {
                        resolvedNewNik = (record.nik || '').trim() || null;
                    }

                    if (resolvedNewNik) {
                        await Q.updateBackfillNewNikById(db, record.id, resolvedNewNik);
                        stats.updated++;
                    } else {
                        stats.skipped++;
                    }
                } catch (e) {
                    stats.errors++;
                    console.error(`[backfillNewNik] Error updating record ${record.id}:`, e);
                }
            }

            console.log(`[backfillNewNik] Done: updated=${stats.updated}, skipped=${stats.skipped}, errors=${stats.errors}`);
            return stats;
        } catch (e) {
            console.error('[backfillNewNik] Fatal error:', e);
            return stats;
        }
    }

    static async initTable() {
        const db = Database.getExtendedInstance();
        try {
            await Q.ensureOtherIncomesTables(db);
        } catch (e) { logError(CATEGORY, "Init table error:", e); }
    }

    static async addToBlacklist(nik: string, name: string, year: number, month: number, type: string, reason: string = 'User deleted'): Promise<boolean> {
        const db = Database.getExtendedInstance();
        try {
            const cleanNik = (nik || '').trim();
            const cleanName = (name || '').trim();
            const cleanType = (type || '').trim();
            const cleanReason = (reason || '').trim();
            if (!cleanNik) return false;
            const existing = await Q.selectBlacklistExisting(db, cleanNik, year, month, cleanType);
            if (existing && existing.length > 0) return true;
            await Q.insertBlacklistRow(db, cleanNik, cleanName, year, month, cleanType, cleanReason);
            return true;
        } catch (e) { return false; }
    }

    static async removeFromBlacklist(id: number): Promise<boolean> {
        const db = Database.getExtendedInstance();
        try {
            await Q.deleteBlacklistRowById(db, id);
            return true;
        } catch (e) { return false; }
    }

    static async getBlacklist(year: number, month: number, type: string): Promise<any[]> {
        const db = Database.getExtendedInstance();
        try {
            return await Q.selectBlacklistByPeriodAndType(db, year, month, type);
        } catch (e) { return []; }
    }

    static async getFormula(incomeType: string): Promise<{ formula: string; is_paid_in_thp: boolean; is_taxable: boolean }> {
        const db = Database.getExtendedInstance();
        try {
            const rows = await Q.selectFormulaByIncomeType(db, incomeType);
            if (rows && rows.length > 0) {
                const raw = rows[0].formula_string;
                try {
                    const parsed = JSON.parse(raw);
                    return { formula: parsed.formula, is_paid_in_thp: parsed.is_paid_in_thp ?? true, is_taxable: parsed.is_taxable ?? true };
                } catch { return { formula: raw, is_paid_in_thp: true, is_taxable: true }; }
            }
            return { formula: '(UPAH_DASAR * 30) + (BERAS_RATE * 30) + MASA_KERJA_JUMLAH', is_paid_in_thp: true, is_taxable: true };
        } catch (e) { return { formula: '(UPAH_DASAR * 30) + (BERAS_RATE * 30) + MASA_KERJA_JUMLAH', is_paid_in_thp: true, is_taxable: true }; }
    }

    static async saveFormula(incomeType: string, formulaString: string | { formula: string; is_paid_in_thp: boolean; is_taxable: boolean }): Promise<boolean> {
        const db = Database.getExtendedInstance();
        try {
            const configToSave = typeof formulaString === 'string' ? JSON.stringify({ formula: formulaString, is_paid_in_thp: true, is_taxable: true }) : JSON.stringify(formulaString);
            await Q.upsertFormula(db, incomeType, configToSave);
            return true;
        } catch (e) { return false; }
    }

    static async getRawIncomes(year: number, month: number, divisionCode?: string, gangCode?: string): Promise<OtherIncome[]> {
        const db = Database.getExtendedInstance();
        const mainDb = Database.getInstance(); // For HR_PAYROLL bank account lookup
        
        try {
            debug(CATEGORY, `[getRawIncomes] Fetching for ${month}/${year}, divisionCode: ${divisionCode || 'ALL'}, gangCode: ${gangCode || 'ALL'}`);

            // STRATEGY: Fetch ALL other incomes for the period
            // WITHOUT filtering by emp_code, nik, gang_code, or division_code.
            //
            // WHY: Transferred employees (karyawan pindahan) often have:
            //   - Different emp_code (new division assignment)
            //   - Different NIK in HR_EMPLOYEE vs what's stored in employee_other_incomes
            //   - Different gang_code/division_code
            // Filtering by division here would miss employees who transferred across divisions.
            //
            // The dataset is small (~1600 THR records for entire estate per period),
            // so performance is not a concern. The actual per-employee matching is
            // handled downstream by dataExtractorService using multilevel fallback.

            debug(CATEGORY, `[getRawIncomes] Fetching ALL records for period ${month}/${year} (no gang/division filter to support transferred employees)`);

            const rows = await Q.selectAllOtherIncomesByPeriod(db, year, month);
            debug(CATEGORY, `[getRawIncomes] Database returned ${rows.length} rows`);

            // If we have rows but they don't have bank_acc_no, we need to fetch from HR_PAYROLL using emp_code
            if (rows.length > 0) {
                // Collect all emp_codes from the rows
                const empCodesFromRows = [...new Set(rows.map(r => r.emp_code?.trim()).filter(Boolean))];
                
                if (empCodesFromRows.length > 0) {
                    debug(CATEGORY, `[getRawIncomes] Fetching bank accounts for ${empCodesFromRows.length} emp_codes from HR_PAYROLL`);
                    
                    // Batch fetch bank accounts from HR_PAYROLL by emp_code
                    const CHUNK = 500;
                    const bankAccMap = new Map<string, { bank_acc_no: string; bank_code: string }>();
                    
                    for (let i = 0; i < empCodesFromRows.length; i += CHUNK) {
                        const chunk = empCodesFromRows.slice(i, i + CHUNK);
                        
                        const bankRows = await Q.selectPayrollBankWithEmpCode(mainDb, chunk);
                        
                        for (const r of bankRows) {
                            const ec = (r.EmpCode || '').trim().toUpperCase();
                            if (ec) {
                                bankAccMap.set(ec, {
                                    bank_acc_no: (r.BankAccNo || '').trim(),
                                    bank_code: (r.BankCode || '').trim()
                                });
                            }
                        }
                    }
                    
                    // Update rows with bank account data from HR_PAYROLL
                    let updatedCount = 0;
                    rows.forEach(r => {
                        const empCodeKey = (r.emp_code || '').trim().toUpperCase();
                        if (empCodeKey && bankAccMap.has(empCodeKey)) {
                            const bankData = bankAccMap.get(empCodeKey)!;
                            // Only update if current row doesn't have bank_acc_no or it's invalid
                            if (!r.bank_acc_no || !this.isValidBankAccNo(r.bank_acc_no)) {
                                r.bank_acc_no = bankData.bank_acc_no;
                                r.bank_code = bankData.bank_code;
                                updatedCount++;
                            }
                        }
                    });
                    
                    debug(CATEGORY, `[getRawIncomes] Updated ${updatedCount} rows with bank account data from HR_PAYROLL`);
                }
            }

            const uniqueRows = this.deduplicateIncomeRows(rows);
            debug(CATEGORY, `[getRawIncomes] After deduplication: ${uniqueRows.length} unique records`);
            return uniqueRows;
        } catch (e) {
            logError(CATEGORY, `[getRawIncomes] Error:`, e);
            return [];
        }
    }

    static async getIncomes(year: number, month: number, divisionCode?: string, gangCode?: string): Promise<OtherIncome[]> {
        // Lightweight: only fetch from local DB + enrich with HR data (no HistoryDB hit)
        // This keeps the page load fast. Details are fetched separately when needed.
        const raw = await this.getRawIncomes(year, month, divisionCode, gangCode);
        if (raw.length === 0) return [];
        return this.enrichWithHrData(raw, gangCode);
    }

    /**
     * Get all taxable other incomes for a specific year.
     * Used by Annual Tax Report (getAnnualTaxReport) to aggregate annual income.
     */
    static async getIncomesForYear(year: number, divisionCode?: string, gangCode?: string): Promise<OtherIncome[]> {
        const db = Database.getExtendedInstance();
        try {
            // Note: getRawIncomes logic intentionally fetches ALL for current month 
            // but for annual report we might want to narrow it down if possible.
            // However, to support transfers, we stay consistent with getRawIncomes.
            
            const rows = await Q.selectIncomesForYear(db, year);
            if (rows.length === 0) return [];

            return this.enrichWithHrData(this.deduplicateIncomeRows(rows), gangCode);
        } catch (e) {
            logError(CATEGORY, `[getIncomesForYear] Error:`, e);
            return [];
        }
    }

    /**
     * Normalize employee name for matching.
     * Removes text in parentheses, extra spaces, and converts to uppercase.
     */
    private static normalizeName = normalizeName as typeof normalizeName;
    private static async enrichWithHrData(incomes: OtherIncome[], gangCode?: string): Promise<OtherIncome[]> {
        if (incomes.length === 0) return incomes;
        try {
            const mainDb = Database.getInstance();
            const nikSet = [...new Set(incomes.map(i => i.nik?.trim()).filter(Boolean))];
            const nikChunks = this.chunkArray(nikSet, 500);
            const religionMap: Record<string, string> = {
                '01': '01 Islam', '02': '02 Katolik', '03': '03 Protestan',
                '04': '04 Hindu', '05': '05 Budha', '06': '06 Konghucu',
                'ISLAM': '01 Islam', 'KATHOLIK': '02 Katolik', 'KATOLIK': '02 Katolik',
                'KRISTEN': '03 Protestan', 'PROTESTAN': '03 Protestan', 'HINDU': '04 Hindu',
                'BUDHA': '05 Budha', 'BUDDHA': '05 Budha', 'KONGHUCU': '06 Konghucu'
            };
            const hrMap = new Map<string, any>();

            for (const chunk of nikChunks) {
                // Get employee data with their gang assignments
                // ORDER BY ensures the last record we process is the most recent
                const hrRows = await Q.selectHrEmployeeForEnrichment(mainDb, chunk);

                // Group by employee and get the LATEST gang
                // Since we ORDER BY AppJoinDate DESC, the FIRST row we see is the most recent
                // So we only set if NOT already set (keep the first/latest, ignore rest)
                const empGangMap = new Map<string, any>();
                hrRows.forEach(r => {
                    const empKey = r.EmpCode?.trim().toUpperCase();
                    if (!empKey) return;
                    // Only set if not already set - this keeps the FIRST (most recent due to ORDER BY DESC)
                    if (!empGangMap.has(empKey)) {
                        empGangMap.set(empKey, { gangCode: r.GangCode, gangMember: r.GangMember });
                    }
                });

                hrRows.forEach(r => {
                    const rawRel = (r.Religion || '').trim().toUpperCase();
                    // Use LATEST join date (most recent) instead of earliest
                    const rawJD = this.getLatestValidDate(r.AppJoinDate, r.AppJoinGrpDate) || r.CreateDate;
                    let joinDateStr = null;
                    if (rawJD) {
                        try {
                            const d = new Date(rawJD);
                            if (!isNaN(d.getTime())) joinDateStr = d.toISOString();
                        } catch (e) { }
                    }

                    // Get the LATEST gang from the map (most recent gang assignment)
                    const empKey = r.EmpCode?.trim().toUpperCase();
                    const latestGang = empKey ? empGangMap.get(empKey) : null;

                    // Save ORIGINAL religion before mapping/defaulting - this is used by frontend to detect "no religion"
                    const originalReligion = r.Religion || '';
                    const data = {
                        religion: religionMap[rawRel] || r.Religion || '01 Islam',
                        original_religion: originalReligion, // Store original for frontend filtering
                        join_date: joinDateStr,
                        // Use latest gang's GangMember as emp_code (most recent assignment)
                        // If there's a latest gang, use its GangMember, otherwise fall back to EmpCode
                        emp_code: (latestGang?.gangMember?.trim()) || (r.EmpCode?.trim() || ''),
                        // Also store the latest gang code for reference
                        latest_gang_code: latestGang?.gangCode?.trim() || '',
                        bank_acc_no: this.isValidBankAccNo(r.BankAccNo) ? r.BankAccNo : '', bank_code: r.BankCode || '',
                        sex: (r.Gender || '').trim().toUpperCase() === 'FEMALE' ? 'P' : 'L',
                        upah_dasar: r.PayRate || 0, beras_rate: r.RiceRation || 0, emp_name: r.EmpName
                    };
                    const empKeyUpper = r.EmpCode.trim().toUpperCase();
                    const nikKey = r.NewICNo?.trim().toUpperCase();
                    const nameKey = this.normalizeName(r.EmpName);
                    
                    if (!hrMap.has(empKeyUpper)) hrMap.set(empKeyUpper, data);
                    
                    // Composite key for NIK + Name lookup (most specific)
                    if (nikKey && nameKey) {
                        const compositeKey = `${nikKey}|||${nameKey}`;
                        if (!hrMap.has(compositeKey)) hrMap.set(compositeKey, data);
                    }
                    
                    // Fallback to NIK only if not already set (legacy support)
                    if (nikKey && !hrMap.has(nikKey)) hrMap.set(nikKey, data);
                });
            }

            // Collect all NIKs/empcodes and emp_names to query HR_EMPLOYEE for empcode history
            const keysForBankLookup = new Set<string>();
            const empNamesForBankLookup = new Set<string>();
            hrMap.forEach((hrData, key) => {
                keysForBankLookup.add(key);
                if (hrData.emp_name) {
                    empNamesForBankLookup.add(hrData.emp_name.trim().toUpperCase());
                }
            });

            // Query HR_EMPLOYEE to find ALL empcodes for each NIK (ordered by CreateDate DESC - newest first)
            const allEmpCodesByKey = new Map<string, string[]>(); // key: original key, value: array of empcodes (newest first)
            if (keysForBankLookup.size > 0 || empNamesForBankLookup.size > 0) {
                try {
                    const keysArray = Array.from(keysForBankLookup);

                    // Get all empcodes ordered by CreateDate DESC (newest first) - by empcode/NIK
                    let empRows: any[] = [];
                    if (keysArray.length > 0) {
                        // CHUNK to avoid SQL 2100 limit (we use 2 params per key)
                        const CHUNK_SIZE = 500;
                        for (let i = 0; i < keysArray.length; i += CHUNK_SIZE) {
                            const chunk = keysArray.slice(i, i + CHUNK_SIZE);
                            const chunkRows = await Q.selectHrEmployeeEmpCodes(mainDb, chunk);
                            empRows.push(...chunkRows);
                        }
                    }
                    // Also query by emp_name to find related empcodes
                    const namesArray = Array.from(empNamesForBankLookup);
                    if (namesArray.length > 0) {
                        // CHUNK to avoid SQL 2100 limit
                        const NAME_CHUNK_SIZE = 1000;
                        const nameRows: any[] = [];
                        for (let i = 0; i < namesArray.length; i += NAME_CHUNK_SIZE) {
                            const chunk = namesArray.slice(i, i + NAME_CHUNK_SIZE);
                            const chunkRows = await Q.selectHrEmployeeByNames(mainDb, chunk);
                            nameRows.push(...chunkRows);
                        }

                        // Combine both results
                        empRows = [...empRows, ...nameRows];
                    }

                    // Build map of empName -> list of empcodes
                    const empNameToCodes = new Map<string, string[]>();
                    for (const row of empRows) {
                        const empCode = row.EmpCode?.trim().toUpperCase();
                        const empName = row.EmpName?.trim().toUpperCase();

                        if (empName && empCode) {
                            if (!empNameToCodes.has(empName)) {
                                empNameToCodes.set(empName, []);
                            }
                            const arr = empNameToCodes.get(empName)!;
                            if (!arr.includes(empCode)) arr.push(empCode);
                        }
                    }

                    // Collect all empcodes for each key (newest first)
                    for (const row of empRows) {
                        const empCode = row.EmpCode?.trim().toUpperCase();
                        const nik = row.NewICNo?.trim().toUpperCase();
                        const empName = row.EmpName?.trim().toUpperCase();

                        if (empCode) {
                            if (!allEmpCodesByKey.has(empCode)) {
                                allEmpCodesByKey.set(empCode, []);
                            }
                            // Add to front if not exists (newer entries come first)
                            const arr = allEmpCodesByKey.get(empCode)!;
                            if (!arr.includes(empCode)) arr.unshift(empCode);
                        }
                        if (nik) {
                            if (!allEmpCodesByKey.has(nik)) {
                                allEmpCodesByKey.set(nik, []);
                            }
                            const arr = allEmpCodesByKey.get(nik)!;
                            if (!arr.includes(empCode)) arr.unshift(empCode);
                        }
                        // Also add by emp_name - try all empcodes with same name
                        if (empName && empNameToCodes.has(empName)) {
                            const relatedCodes = empNameToCodes.get(empName)!;
                            if (!allEmpCodesByKey.has(empName)) {
                                allEmpCodesByKey.set(empName, relatedCodes);
                            }
                        }
                    }
                } catch (e) {
                    logError(CATEGORY, "[OtherIncomesService] Error fetching empcode history from HR_EMPLOYEE:", e);
                }
            }

            // Fetch bank account data for ALL empcodes (we'll try fallback later)
            const hrDataMap = new Map<string, any>();
            const payrollBankMap = new Map<string, any>();
            const payrollBankByNameMap = new Map<string, any>(); // Fallback by name

            // Collect ALL unique empcodes from the history
            const allUniqueEmpCodes = new Set<string>();
            allEmpCodesByKey.forEach((empCodes) => {
                empCodes.forEach(ec => allUniqueEmpCodes.add(ec));
            });

            // Also add emp_codes from hrMap
            hrMap.forEach((hrData) => {
                if (hrData.emp_code) {
                    allUniqueEmpCodes.add(hrData.emp_code.toUpperCase());
                }
            });

            const empCodeArray = Array.from(allUniqueEmpCodes).filter(Boolean);
            if (empCodeArray.length > 0) {
                // Query employee_hr_data table for all empcodes
                try {
                    const hrDataResult = await employeeHrDataService.getHrDataBulk(empCodeArray);
                    hrDataResult.forEach((value, key) => {
                        hrDataMap.set(key, value);
                    });
                } catch (e) {
                    logError(CATEGORY, "[OtherIncomesService] Error fetching HR data for bank accounts:", e);
                }

                // Query HR_PAYROLL table for all empcodes (CHUNKED to avoid SQL 2100 limit)
                try {
                    const PAYROLL_CHUNK = 500;
                    for (let i = 0; i < empCodeArray.length; i += PAYROLL_CHUNK) {
                        const chunk = empCodeArray.slice(i, i + PAYROLL_CHUNK);
                        const payrollRows = await Q.selectPayrollBankByEmpCodes(mainDb, chunk);

                        for (const row of payrollRows) {
                            const empCodeKey = row.EmpCode?.trim().toUpperCase();
                            const bankAccNo = row.BankAccNo?.trim() || '';
                            // Store ALL entries (valid or '0') - prefer valid ones later
                            if (empCodeKey && bankAccNo) {
                                const existing = payrollBankMap.get(empCodeKey);
                                if (!existing) {
                                    payrollBankMap.set(empCodeKey, { bank_acc_no: bankAccNo, bank_code: row.BankCode?.trim() || '' });
                                } else if (this.isValidBankAccNo(bankAccNo) && !this.isValidBankAccNo(existing.bank_acc_no)) {
                                    // Replace '0' with valid if we find one
                                    payrollBankMap.set(empCodeKey, { bank_acc_no: bankAccNo, bank_code: row.BankCode?.trim() || '' });
                                }
                            }
                        }
                    }
                } catch (e) {
                    logError(CATEGORY, "[OtherIncomesService] Error fetching bank from HR_PAYROLL:", e);
                }
            }

            // Also query HR_PAYROLL by emp_name for additional bank account lookup
            const empNamesForQuery = new Set<string>();
            hrMap.forEach((hrData, key) => {
                if (hrData.emp_name) {
                    empNamesForQuery.add(hrData.emp_name.trim().toUpperCase());
                }
            });

            if (empNamesForQuery.size > 0) {
                try {
                    const nameArray = Array.from(empNamesForQuery);

                    // CHUNK to avoid SQL Server 2100 parameter limit
                    const NAME_CHUNK = 500;
                    for (let ni = 0; ni < nameArray.length; ni += NAME_CHUNK) {
                        const nameChunk = nameArray.slice(ni, ni + NAME_CHUNK);

                        // Query HR_PAYROLL by emp_name to get bank accounts
                        // Join with HR_EMPLOYEE to get emp_name
                        const payrollByNameRows = await Q.selectPayrollBankByNames(mainDb, nameChunk);

                        for (const row of payrollByNameRows) {
                            const empCode = row.EmpCode?.trim().toUpperCase();
                            const empName = row.EmpName?.trim().toUpperCase();
                            const bankAccNo = row.BankAccNo?.trim() || '';

                            // CRITICAL: Store by emp_code as primary key (most reliable)
                            // This avoids collision when two employees have the same name
                            if (empCode && bankAccNo) {
                                const existing = payrollBankMap.get(empCode);
                                if (!existing) {
                                    payrollBankMap.set(empCode, { bank_acc_no: bankAccNo, bank_code: row.BankCode?.trim() || '' });
                                } else if (this.isValidBankAccNo(bankAccNo) && !this.isValidBankAccNo(existing.bank_acc_no)) {
                                    // Replace '0' with valid if we find one
                                    payrollBankMap.set(empCode, { bank_acc_no: bankAccNo, bank_code: row.BankCode?.trim() || '' });
                                }
                            }

                            // Also store by emp_name + emp_code combo to avoid duplicate name collisions
                            // This is used as fallback when emp_code lookup fails
                            if (empName && empCode && bankAccNo) {
                                const nameCodeKey = `${empName}|||${empCode}`;
                                const existingByName = payrollBankByNameMap.get(nameCodeKey);
                                if (!existingByName) {
                                    payrollBankByNameMap.set(nameCodeKey, { bank_acc_no: bankAccNo, bank_code: row.BankCode?.trim() || '', emp_code: empCode });
                                } else if (this.isValidBankAccNo(bankAccNo) && !this.isValidBankAccNo(existingByName.bank_acc_no)) {
                                    payrollBankByNameMap.set(nameCodeKey, { bank_acc_no: bankAccNo, bank_code: row.BankCode?.trim() || '', emp_code: empCode });
                                }
                            }
                        }
                    }
                } catch (e) {
                    logError(CATEGORY, "[OtherIncomesService] Error fetching bank from HR_PAYROLL by name:", e);
                }
            }

            // Override bank info with FALLBACK mechanism: try each empcode until we find one with bank account
            // DEBUG: Log what we're looking for
            debug(CATEGORY, `[DEBUG BANK] Starting bank resolution for ${hrMap.size} employees...`);
            hrMap.forEach((hrData, key) => {
                // Get all empcodes for this key (newest first)
                const empCodesToTry = allEmpCodesByKey.get(key) || (hrData.emp_code ? [hrData.emp_code.toUpperCase()] : []);

                // DEBUG: Log the lookup
                debug(CATEGORY, `[DEBUG BANK] Resolving bank for key=${key}, name=${hrData.emp_name}, emp_codes=${empCodesToTry.join(',')}`);

                // Try each empcode in order (newest first) until we find bank account
                for (const empCode of empCodesToTry) {
                    if (!empCode) continue;

                    // First try employee_hr_data
                    if (hrDataMap.has(empCode)) {
                        const hrDataEntry = hrDataMap.get(empCode);
                        if (this.isValidBankAccNo(hrDataEntry?.bank_acc_no)) {
                            hrData.bank_acc_no = hrDataEntry.bank_acc_no;
                            hrData.bank_code = hrDataEntry.bank_code;
                            debug(CATEGORY, `[DEBUG BANK] Found in hrDataMap: empCode=${empCode}, bank=${hrData.bank_acc_no}`);
                            break; // Found valid bank account, stop trying
                        }
                    }

                    // Then try HR_PAYROLL
                    if (payrollBankMap.has(empCode)) {
                        const payrollEntry = payrollBankMap.get(empCode);
                        if (this.isValidBankAccNo(payrollEntry?.bank_acc_no)) {
                            hrData.bank_acc_no = payrollEntry.bank_acc_no;
                            hrData.bank_code = payrollEntry.bank_code;
                            debug(CATEGORY, `[DEBUG BANK] Found in payrollBankMap: empCode=${empCode}, bank=${hrData.bank_acc_no}`);
                            break; // Found valid bank account, stop trying
                        }
                    }
                }

                // Last fallback: try by emp_name + emp_code combo in HR_PAYROLL
                // This avoids collision when two employees have the same name
                if (!this.isValidBankAccNo(hrData.bank_acc_no) && hrData.emp_name && hrData.emp_code) {
                    const nameCodeKey = `${hrData.emp_name.trim().toUpperCase()}|||${hrData.emp_code.trim().toUpperCase()}`;
                    if (payrollBankByNameMap.has(nameCodeKey)) {
                        const byNameEntry = payrollBankByNameMap.get(nameCodeKey);
                        if (this.isValidBankAccNo(byNameEntry?.bank_acc_no)) {
                            hrData.bank_acc_no = byNameEntry.bank_acc_no;
                            hrData.bank_code = byNameEntry.bank_code;
                            debug(CATEGORY, `[DEBUG BANK] Found in payrollBankByNameMap: key=${nameCodeKey}, bank=${hrData.bank_acc_no}`);
                        }
                    }
                }

                // DEBUG: Log final result
                debug(CATEGORY, `[DEBUG BANK] Final: key=${key}, name=${hrData.emp_name}, emp_code=${hrData.emp_code}, bank=${hrData.bank_acc_no}`);
            });

            // Only fetch blacklist if we have data to filter
            const periodYear = incomes[0].period_year;
            const periodMonth = incomes[0].period_month;
            const blacklist = await this.getBlacklist(periodYear, periodMonth, 'THR');
            const blacklistedNIKs = new Set(blacklist.map(b => String(b.nik || '').trim().toUpperCase()));

            const filteredIncomes = incomes.filter(inc => {
                const nik = (inc.nik || '').trim().toUpperCase();
                return !blacklistedNIKs.has(nik);
            });

            // DEBUG: Log bank account assignments for verification
            const bankAccountLog: string[] = [];
            filteredIncomes.forEach(inc => {
                const nikKey = (inc.nik || '').trim().toUpperCase();
                const nameKey = this.normalizeName(inc.emp_name);
                const compositeKey = `${nikKey}|||${nameKey}`;
                
                // Try composite key first (most specific), then fall back to NIK only
                const hr = hrMap.get(compositeKey) || hrMap.get(nikKey);

                if (hr) {
                    // IMPORTANT: emp_code comes from HR_GANG (latest gang member assignment).
                    // This is the AUTHORITATIVE source — never use the potentially-spaced emp_code from source data.
                    // NIK is also stored clean from HR_EMPLOYEE.NewICNo.
                    inc.religion = hr.religion;
                    inc.original_religion = hr.original_religion; // Pass original religion to frontend
                    inc.emp_code = hr.emp_code; inc.bank_acc_no = hr.bank_acc_no; inc.bank_code = hr.bank_code;
                    if (!inc.join_date) inc.join_date = hr.join_date;
                    if (!inc.emp_name || inc.emp_name === inc.nik) inc.emp_name = hr.emp_name;
                    (inc as any).upah_dasar = hr.upah_dasar; (inc as any).beras_rate = hr.beras_rate; (inc as any).sex = hr.sex;
                    // CRITICAL: Always overwrite nik with the CLEAN version (nikKey was built from trimmed input).
                    // This ensures inc.nik has no trailing spaces after enrichment, fixing lookup failures downstream.
                    // nikKey is already trimmed/uppered, so use it directly.
                    inc.nik = nikKey;

                    // DEBUG: Track bank account assignments
                    const logKey = `${inc.nik}|||${inc.emp_name || inc.nik}`;
                    if (!bankAccountLog.includes(logKey)) {
                        bankAccountLog.push(logKey);
                        debug(CATEGORY, `[DEBUG BANK] NIK=${inc.nik}, Name=${inc.emp_name || inc.nik}, EmpCode=${hr.emp_code}, BankAcc=${hr.bank_acc_no}, BankCode=${hr.bank_code}`);
                    }
                }

                // PERSISTENCE RULE: Auto-recalculate THR proportion for saved data if needed
                if (inc.income_type === 'THR' && inc.join_date) {
                    const jd = this.parseDate(inc.join_date);
                    if (jd) {
                        const periodDate = new Date(inc.period_year, inc.period_month - 1, 1);
                        const diff = (periodDate.getFullYear() - jd.getFullYear()) * 12 + (periodDate.getMonth() - jd.getMonth());
                        if (diff < 12 && diff >= 0) {
                            const workingMonths = Math.min(12, diff + 1);
                            if (workingMonths < 12) {
                                if (!inc.income_name || !inc.income_name.toLowerCase().includes('proporsi')) {
                                    const fullAmt = inc.amount || 0;
                                    inc.amount = Math.round((fullAmt * workingMonths) / 12);
                                    inc.income_name = `Tunjangan Hari Raya (Proporsi ${workingMonths}/12)`;
                                    if (inc.details && inc.details.variables) {
                                        inc.details.variables.WORKING_MONTHS = workingMonths;
                                        inc.details.variables.PROPORTION_FACTOR = `${workingMonths}/12`;
                                    }
                                }
                            }
                        }
                    }
                }
            });
            return filteredIncomes;
        } catch (e) { logError(CATEGORY, "Enrich error:", e); return incomes; }
    }

    static async getIncomesWithDetails(year: number, month: number, divisionCode?: string, gangCode?: string, incomeType?: string): Promise<OtherIncome[]> {
        // BUG FIX: Call getRawIncomes directly (not getIncomes) to avoid infinite loop.
        // getIncomes used to call getIncomesWithDetails → infinite recursion.
        const raw = await this.getRawIncomes(year, month, divisionCode, gangCode);
        if (raw.length === 0) return [];
        const enriched = await this.enrichWithHrData(raw, gangCode);
        const filtered = incomeType && incomeType !== 'ALL' ? enriched.filter(inc => inc.income_type === incomeType) : enriched;
        if (filtered.length === 0) return [];

        // Only fetch heavy HistoryDB data when we specifically need details
        // EMP-CODE BASIS: Key by EmpCode (authoritative), fallback to NIK
        const historyDict: Record<string, any> = {};
        const historyNikDict: Record<string, any> = {}; // Fallback by NIK
        try {
            const historyService = HistoryDatabaseService.getInstance();
            const historyData = await historyService.getHistoricalPayrollDataAsExtractorFormat(month, year, gangCode || 'ALL', divisionCode || undefined);
            if (historyData?.data_rows) {
                historyData.data_rows.forEach((row: any) => {
                    const empCode = String(row.emp_code || '').trim().toUpperCase();
                    const nik = String(row.nik || '').trim().toUpperCase();
                    if (empCode) historyDict[empCode] = row;
                    if (nik) historyNikDict[nik] = row;
                });
            }
        } catch (e) { logError(CATEGORY, "History fetch error:", e); }
        const thrFormula = await this.getFormula('THR');
        return filtered.map(inc => {
            // EMP-CODE BASIS: Try EmpCode first, then fall back to NIK
            const empCodeKey = inc.emp_code?.trim().toUpperCase();
            const nikKey = inc.nik?.trim().toUpperCase();
            // Priority: emp_code > nik
            const h = (empCodeKey && historyDict[empCodeKey])
                ? historyDict[empCodeKey]
                : (nikKey && historyNikDict[nikKey])
                    ? historyNikDict[nikKey]
                    : null;
            const upahDasar = h?.upah_dasar || (inc as any).upah_dasar || 0;
            const recalcVars: any = {
                UPAH_DASAR: upahDasar,
                GAJI_POKOK: upahDasar * 30,
                BERAS_RATE: h?.beras_rate || (inc as any).beras_rate || 0,
                MASA_KERJA_JUMLAH: h?.masa_kerja_jumlah || 0,
                MASA_KERJA_TAHUN: h?.masa_kerja_tahun || 0,
                JOIN_DATE: inc.join_date || h?.join_date,
                PROPORTION_FACTOR: "12/12",
                SEX: (inc as any).sex || (h?.gender === 'FEMALE' ? 'P' : 'L'),
                BANK_ACC_NO: this.isValidBankAccNo(inc.bank_acc_no) ? inc.bank_acc_no : (this.isValidBankAccNo(h?.bank_acc_no) ? h.bank_acc_no : ''),
                BANK_CODE: inc.bank_code || h?.bank_code,
                EMP_CODE: inc.emp_code || h?.emp_code
            };
            const jd = this.parseDate(recalcVars.JOIN_DATE);
            if (jd) {
                const periodDate = new Date(year, month - 1, 1);
                const diff = (periodDate.getFullYear() - jd.getFullYear()) * 12 + (periodDate.getMonth() - jd.getMonth());
                if (diff < 12 && diff >= 0) { recalcVars.PROPORTION_FACTOR = `${Math.min(12, diff + 1)}/12`; }
            }
            // Merge: saved details_json variables (from calculateTHRData) take precedence
            // This preserves JABATAN_JUMLAH, TOTAL_TUNJANGAN_JABATAN, TOTAL_TUNJANGAN_BERAS, IS_FULL, etc.
            const savedVars = (inc as any).details?.variables || {};
            const vars = { ...recalcVars, ...savedVars };
            return { ...inc, details: { formula: thrFormula.formula, variables: vars } };
        });
    }

    // ── THR methods delegated to OtherIncomesThrService ──
    static async calculateTHRData(year: number, month: number, divisionCode?: string, gangCode?: string): Promise<OtherIncome[]> {
        return OtherIncomesThrService.calculateTHRData(year, month, divisionCode, gangCode);
    }

    static async bulkSaveIncomes(incomes: OtherIncome[]): Promise<{ success: boolean; count: number }> {
        if (!incomes.length) return { success: true, count: 0 };
        const db = Database.getExtendedInstance(); let count = 0;
        try {
            // [NIK RESOLVE] Resolve NIK from HR_EMPLOYEE.NewICNo by emp_code for any
            // income record with empty nik. Prevents legacy "nik kosong" records that
            // break NIK-based lookup and cause cross-employee contamination.
            const empCodesToResolve = [...new Set(
                incomes.filter(inc => !(inc.nik || '').trim() && (inc.emp_code || '').trim())
                       .map(inc => (inc.emp_code || '').trim().toUpperCase())
            )];
            const resolvedNikByEmpCode = new Map<string, string>();
            if (empCodesToResolve.length) {
                const mainDb = Database.getInstance();
                const rows = await Q.selectHrEmployeeNewIcNos(mainDb, empCodesToResolve);
                for (const r of rows) {
                    const nik = (r.NewICNo || '').trim();
                    if (nik) resolvedNikByEmpCode.set((r.EmpCode || '').trim().toUpperCase(), nik);
                }
            }
            // Process in smaller batches to avoid connection timeouts for large datasets
            const batchSize = 50;
            for (let i = 0; i < incomes.length; i += batchSize) {
                const batch = incomes.slice(i, i + batchSize);
                for (const inc of batch) {
                    // 1. Delete existing record for this EmpCode + Period + Type
                    // EMP-CODE BASIS: Use emp_code for primary uniqueness.
                    // Try emp_code first, fall back to nik for legacy records without emp_code.
                    const empCodeForDelete = (inc.emp_code || '').trim().toUpperCase();
                    if (empCodeForDelete) {
                        // Primary: delete by emp_code (new records)
                        await Q.deleteOtherIncomeByEmpCodeAndType(db, inc.period_year, inc.period_month, empCodeForDelete, inc.income_type);
                    } else {
                        // Legacy fallback: delete by nik (old records without emp_code)
                        await Q.deleteOtherIncomeByNikAndType(db, inc.period_year, inc.period_month, (inc.nik || '').trim(), inc.income_type);
                    }

                    // 2. Insert new calculated record (including new EmpCode-basis columns)
                    // ALWAYS trim all string fields before INSERT to prevent spaces from causing
                    // lookup mismatches. This is the PRIMARY source of the NIK/emp_code mismatch bug.
                    const detailsJson = inc.details ? JSON.stringify(inc.details) : null;
                    // Convert join_date string to SQL date format
                    let joinDateSql: string | null = null;
                    if (inc.join_date) {
                        try {
                            const d = new Date(inc.join_date);
                            if (!isNaN(d.getTime())) {
                                joinDateSql = d.toISOString().split('T')[0]; // 'YYYY-MM-DD'
                            }
                        } catch { }
                    }
                    // IMPORTANT: nik column is NEVER updated (append-only). Only new_nik changes.
                    // new_nik defaults to nik if not provided (backward compat for legacy records).
                    // CRITICAL: Trim ALL fields before storage to prevent lookup failures.
                    const cleanEmpCode = (inc.emp_code || '').trim();
                    // [NIK RESOLVE] Fill empty nik from HR_EMPLOYEE.NewICNo via emp_code.
                    const cleanNik = (inc.nik || '').trim()
                        || (cleanEmpCode ? (resolvedNikByEmpCode.get(cleanEmpCode.toUpperCase()) || '') : '');
                    const cleanIncomeType = (inc.income_type || '').trim();
                    const resolvedNewNik = ((inc as any).new_nik || cleanNik || '').trim() || null;
                    const cleanReligion = ((inc as any).religion || '').trim() || null;
                    const cleanBankAccNo = ((inc as any).bank_acc_no || '').trim() || null;
                    const cleanBankCode = ((inc as any).bank_code || '').trim() || null;
                    const cleanSex = ((inc as any).sex || '').trim() || null;
                    await Q.insertOtherIncomeRow(db, {
                        nik: cleanNik,
                        emp_name: (inc.emp_name || '').trim(),
                        division_code: (inc.division_code || '').trim(),
                        gang_code: (inc.gang_code || '').trim(),
                        period_year: inc.period_year,
                        period_month: inc.period_month,
                        income_type: cleanIncomeType,
                        income_name: (inc.income_name || '').trim(),
                        amount: inc.amount,
                        is_paid_in_thp: inc.is_paid_in_thp,
                        is_taxable: inc.is_taxable,
                        emp_code: cleanEmpCode,
                        new_nik: resolvedNewNik,
                        religion: cleanReligion,
                        bank_acc_no: cleanBankAccNo,
                        bank_code: cleanBankCode,
                        sex: cleanSex
                    }, detailsJson, joinDateSql);
                    count++;
                }
            }
            console.log(`[bulkSaveIncomes] Successfully saved ${count} records`);
            return { success: true, count };
        } catch (e) {
            console.error(`[bulkSaveIncomes] Error after saving ${count} records:`, e);
            return { success: false, count };
        }
    }

    static async addIncome(data: any): Promise<OtherIncome | null> {
        const db = Database.getExtendedInstance();
        try {
            // nik is NEVER updated — stored as-is for backward compat
            // new_nik: correct KTP NIK (defaults to nik if not provided)
            const result = await Q.insertOtherIncomeWithOutput(db, data);
            return result[0];
        } catch (e) { return null; }
    }

    static async updateIncome(id: number, data: Partial<OtherIncome>): Promise<boolean> {
        const db = Database.getExtendedInstance();
        try {
            const fields: string[] = [];
            const values: any[] = [];
            if (data.amount !== undefined) { fields.push('amount = ?'); values.push(data.amount); }
            if (data.income_name !== undefined) { fields.push('income_name = ?'); values.push(data.income_name); }
            if (data.is_paid_in_thp !== undefined) { fields.push('is_paid_in_thp = ?'); values.push(data.is_paid_in_thp ? 1 : 0); }
            if (data.is_taxable !== undefined) { fields.push('is_taxable = ?'); values.push(data.is_taxable ? 1 : 0); }
            if (data.gang_code !== undefined) { fields.push('gang_code = ?'); values.push(data.gang_code); }
            if (data.division_code !== undefined) { fields.push('division_code = ?'); values.push(data.division_code); }
            // CRITICAL: nik is NEVER updated — this is the immutable primary key
            // new_nik can be updated if a correct KTP NIK is provided
            if (data.new_nik !== undefined) { fields.push('new_nik = ?'); values.push(data.new_nik); }
            if (data.emp_code !== undefined) { fields.push('emp_code = ?'); values.push(data.emp_code); }
            if (fields.length === 0) return true;
            fields.push('updated_at = GETDATE()');
            await Q.updateOtherIncomeById(db, id, fields, values);
            return true;
        } catch (e) { console.error('updateIncome error:', e); return false; }
    }

    static async deleteIncome(id: number): Promise<boolean> {
        const db = Database.getExtendedInstance();
        try {
            const rows = await Q.selectIncomeById(db, id);
            if (rows && rows.length > 0) {
                const r = rows[0];
                await this.addToBlacklist(r.nik, r.emp_name, r.period_year, r.period_month, r.income_type);
            }
            await Q.deleteOtherIncomeById(db, id);
            return true;
        }
        catch (e) { return false; }
    }

    static async deleteIncomesByPeriod(year: number, month: number, divisionCode?: string, gangCode?: string): Promise<{ success: boolean; count: number }> {
        const db = Database.getExtendedInstance();
        try {
            console.log(`[OtherIncomesService] Request DELETE by period: ${month}/${year}, Div: ${divisionCode}, Gang: ${gangCode}`);

            let extraWhere = '';
            const params: any[] = [];

            if (divisionCode && divisionCode !== 'ALL') {
                const filter = await divisionConfigService.expandDivisionFilter(divisionCode);
                if (filter.isVirtual) {
                    // For virtual divisions, records are keyed by gang_code
                    if (filter.gangCodes.length > 0) {
                        extraWhere += ` AND gang_code IN (${filter.gangCodes.map(() => '?').join(',')})`;
                        params.push(...filter.gangCodes);
                        console.log(`[OtherIncomesService] Deleting for virtual division gangs: ${filter.gangCodes.join(', ')}`);
                    }
                } else {
                    const divList = filter.divisionCodes;
                    console.log(`[OtherIncomesService] Deleting for divisions: ${divList.join(', ')}`);
                    extraWhere += ` AND division_code IN (${divList.map(() => '?').join(',')})`;
                    params.push(...divList);
                }
            }

            if (gangCode && gangCode !== 'ALL') {
                extraWhere += ` AND gang_code = ?`;
                params.push(gangCode);
            }

            const result = await Q.deleteOtherIncomesByPeriod(db, year, month, extraWhere, params);
            console.log(`[OtherIncomesService] DELETE successful for ${month}/${year}`);
            return { success: true, count: 0 };
        } catch (e: any) {
            console.error("[OtherIncomesService] deleteIncomesByPeriod error:", e);
            return { success: false, error: e.message, count: 0 } as any;
        }
    }

    static async calculateAndSaveTHR(year: number, month: number, divisionCode?: string, gangCode?: string) {
        return OtherIncomesThrService.calculateAndSaveTHR(year, month, divisionCode, gangCode);
    }

    // Alias for frontend compatibility if needed
    static async bulkSave(incomes: OtherIncome[]) { return this.bulkSaveIncomes(incomes); }

    static async getGangMembersFromHistory(month: number, year: number, gangCode?: string, divisionCode?: string) {
        return OtherIncomesThrService.getGangMembersFromHistory(month, year, gangCode, divisionCode);
    }
    static async previewTHR(year: number, month: number, division?: string, gang?: string) {
        return OtherIncomesThrService.previewTHR(year, month, division, gang);
    }
    static async getThrSummary(year: number, month: number, divisionCode?: string) {
        return OtherIncomesThrService.getThrSummary(year, month, divisionCode);
    }
    static async getThrRecapAll(year: number, month: number, excludeIjl: boolean = false, ijlOnly: boolean = false) {
        return OtherIncomesThrService.getThrRecapAll(year, month, excludeIjl, ijlOnly);
    }
}

// Singleton instance — convention shared with the rest of the service layer.
// Static-method call sites (OtherIncomesService.x) keep working unchanged.
export const otherIncomesService = OtherIncomesService.getInstance();
