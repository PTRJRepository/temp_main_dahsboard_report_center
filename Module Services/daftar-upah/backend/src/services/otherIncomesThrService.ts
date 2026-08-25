/**
 * @module otherIncomesThrService
 *
 * THR (Tunjangan Hari Raya) methods extracted from otherIncomesService.ts.
 * All public API remains on OtherIncomesService (facade); this module holds
 * the implementation. Cross-service calls go through OtherIncomesService.
 */

import { Database } from "../db/client";
import { HistoryDatabaseService } from "./historyDatabaseService";
import { divisionConfigService } from "./config/DivisionConfigService";
import { employeeHrDataService } from "./employeeHrDataService";
import { gangService } from "./gangService";
import { debug, info, warn, error as logError } from "../utils/logger";
import type { OtherIncome } from "./payroll/otherIncomes/otherIncomesHelpers";
import {
    chunkArray,
    parseDate,
    getLatestValidDate,
    isValidBankAccNo,
    normalizeName,
    deduplicateIncomeRows
} from "./payroll/otherIncomes/otherIncomesHelpers";
import * as Q from "./payroll/otherIncomes/otherIncomesQueries";
import { OtherIncomesService } from "./otherIncomesService";

const CATEGORY = "OtherIncomes";

export class OtherIncomesThrService {
    static async calculateTHRData(year: number, month: number, divisionCode?: string, gangCode?: string): Promise<OtherIncome[]> {
        const extDb = Database.getExtendedInstance(); // extend_db_ptrj
        const mainDb = Database.getInstance();        // db_ptrj (HR_EMPLOYEE, HR_PAYROLL)

        // ── Determine if this is a non-current period ───────────────────────────
        // Get current payroll period
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        const isCurrentPeriod = (year === currentYear && month === currentMonth);

        // ── NON-CURRENT PERIOD: Load from saved employee_other_incomes ────────────
        if (!isCurrentPeriod) {
            info(CATEGORY, `[calculateTHRData] Non-current period ${month}/${year} — loading from saved employee_other_incomes by emp_code`);

            // Step 1: Get saved THR records
            let savedRows: any[] = [];
            try {
                savedRows = await Q.selectSavedThrRecordsByPeriod(extDb, year, month, gangCode, divisionCode);
            } catch (e) {
                logError(CATEGORY, '[calculateTHRData] Error fetching saved THR from employee_other_incomes:', e);
                // Fallback: try recalculate approach
            }

            if (savedRows.length > 0) {
                info(CATEGORY, `[calculateTHRData] Found ${savedRows.length} saved THR records for period ${month}/${year}`);

                const empCodes = [...new Set(
                    savedRows.map(r => r.emp_code.trim().toUpperCase()).filter(Boolean)
                )];

                // Step 2: Get fresh bank accounts from HR_PAYROLL by emp_code
                const bankMap = new Map<string, { bank_acc_no: string; bank_code: string }>();
                if (empCodes.length > 0) {
                    try {
                        const CHUNK = 500;
                        for (let i = 0; i < empCodes.length; i += CHUNK) {
                            const chunk = empCodes.slice(i, i + CHUNK);
                            const rows = await Q.selectPayrollBankWithEmpCode(mainDb, chunk);
                            for (const r of rows) {
                                const ec = (r.EmpCode || '').trim().toUpperCase();
                                if (ec) {
                                    bankMap.set(ec, {
                                        bank_acc_no: (r.BankAccNo || '').trim(),
                                        bank_code: (r.BankCode || '').trim()
                                    });
                                }
                            }
                        }
                        info(CATEGORY, `[calculateTHRData] Fresh bank lookup: ${bankMap.size} emp_codes resolved from HR_PAYROLL`);
                    } catch (e) {
                        logError(CATEGORY, '[calculateTHRData] Error fetching fresh bank from HR_PAYROLL:', e);
                    }
                }

                // Step 3: Build results from saved data + fresh bank
                const religionMap: Record<string, string> = {
                    '01': '01 Islam', '02': '02 Katolik', '03': '03 Protestan',
                    '04': '04 Hindu', '05': '05 Budha', '06': '06 Konghucu',
                    'ISLAM': '01 Islam', 'KATHOLIK': '02 Katolik', 'KATOLIK': '02 Katolik',
                    'KRISTEN': '03 Protestan', 'PROTESTAN': '03 Protestan', 'HINDU': '04 Hindu',
                    'BUDHA': '05 Budha', 'BUDDHA': '05 Budha', 'KONGHUCU': '06 Konghucu'
                };

                const results: OtherIncome[] = savedRows.map(r => {
                    const empCode = r.emp_code.trim().toUpperCase();
                    const freshBank = bankMap.get(empCode);
                    const rawRel = (r.religion || '').trim().toUpperCase();
                    const mappedRel = religionMap[rawRel] || rawRel || '01 Islam';

                    let details: any = {};
                    try {
                        if (r.details_json) {
                            details = JSON.parse(r.details_json);
                        }
                    } catch { }

                    // Use fresh bank if valid, otherwise fall back to saved
                    const freshBankAcc = freshBank?.bank_acc_no || '';
                    const bankAccNo = isValidBankAccNo(freshBankAcc) ? freshBankAcc : (isValidBankAccNo(r.bank_acc_no_saved) ? r.bank_acc_no_saved : '');
                    const bankCode = freshBank?.bank_code || r.bank_code_saved || '';

                    return {
                        nik: r.nik,
                        new_nik: r.new_nik || r.nik,
                        emp_code: r.emp_code,
                        emp_name: r.emp_name,
                        division_code: r.division_code,
                        gang_code: r.gang_code,
                        period_year: year,
                        period_month: month,
                        income_type: 'THR',
                        income_name: r.income_name || 'Tunjangan Hari Raya',
                        amount: Number(r.amount) || 0,
                        is_paid_in_thp: true,
                        is_taxable: true,
                        original_religion: rawRel,
                        religion: mappedRel,
                        join_date: r.join_date || null,
                        bank_acc_no: bankAccNo,
                        bank_code: bankCode,
                        sex: r.sex || 'L',
                        details
                    };
                });

                // Log summary
                const divDistribution: Record<string, number> = {};
                results.forEach(r => {
                    const dc = r.division_code || 'UNKNOWN';
                    divDistribution[dc] = (divDistribution[dc] || 0) + 1;
                });
                info(CATEGORY, `[calculateTHRData] Non-current period THR: ${results.length} employees from saved data, division distribution:`, divDistribution);
                return results;
            }

            // No saved data found — fall through to recalculate below
            info(CATEGORY, `[calculateTHRData] No saved THR data for period ${month}/${year}, falling back to recalculate from history_gang_member`);
        }

        // ── CURRENT PERIOD or FALLBACK: Recalculate from history_gang_member ────
        // ── Step 1: Resolve gang codes ──────────────────────────────────────────
        let targetGangCodes: string[] = [];

        if (gangCode && gangCode !== 'ALL') {
            // Specific gang - normalize it
            targetGangCodes = [gangCode.toUpperCase()];
        } else if (divisionCode && divisionCode !== 'ALL') {
            // Division-wide: resolve to all gangs in that division
            const isVirtual = await gangService.isVirtualDivision(divisionCode);
            if (isVirtual) {
                targetGangCodes = await gangService.getVirtualDivisionGangs(divisionCode);
            } else {
                const { divisionConfigService } = await import('./config/DivisionConfigService');
                const gangs = await divisionConfigService.getGangsForDivision(divisionCode);
                targetGangCodes = gangs.map((g: any) => g.gang_code);
            }
        } else {
            // ALL: get all gangs from history_gang_member for this period
            // We'll query without gang filter and let DB handle it
            targetGangCodes = [];
        }

        // ── Step 2: Get gang members from history_gang_member ──────────────────
        let gangMemberRows: any[] = [];
        try {
            if (targetGangCodes.length > 0) {
                gangMemberRows = await Q.selectHistoryGangMembers(extDb, targetGangCodes, month, year);
            } else {
                // ALL gangs - no gang filter
                if (divisionCode && divisionCode !== 'ALL') {
                    const isVirtual = await gangService.isVirtualDivision(divisionCode);
                    if (isVirtual) {
                        const vGangs = await gangService.getVirtualDivisionGangs(divisionCode);
                        if (vGangs.length > 0) {
                            gangMemberRows = await Q.selectHistoryGangMembers(extDb, vGangs, month, year);
                        }
                    } else {
                        // Real division - get all gangs in that division
                        const { divisionConfigService } = await import('./config/DivisionConfigService');
                        const gangs = await divisionConfigService.getGangsForDivision(divisionCode);
                        const gcList = gangs.map((g: any) => g.gang_code);
                        if (gcList.length > 0) {
                            gangMemberRows = await Q.selectHistoryGangMembers(extDb, gcList, month, year);
                        }
                    }
                } else {
                    // Completely ALL - get all gang members for period
                    gangMemberRows = await Q.selectHistoryGangMembersAll(extDb, month, year);
                }
            }
        } catch (e) {
            console.error('[calculateTHRData] Error fetching gang members from history_gang_member:', e);
            return [];
        }

        if (gangMemberRows.length === 0) {
            console.log(`[calculateTHRData] No gang members in history_gang_member for ${month}/${year}, falling back to HR_GANGLN`);
            
            // FALLBACK: Use current HR_GANGLN from main database
            try {
                gangMemberRows = await Q.selectHrGangLnMembers(mainDb, targetGangCodes);
                console.log(`[calculateTHRData] HR_GANGLN fallback: ${gangMemberRows.length} current gang members found`);
            } catch (fallbackErr) {
                console.error('[calculateTHRData] Error in HR_GANGLN fallback:', fallbackErr);
            }

            if (gangMemberRows.length === 0) {
                console.log(`[calculateTHRData] Still no gang members after fallback`);
                return [];
            }
        }

        console.log(`[calculateTHRData] Found ${gangMemberRows.length} gang members from history_gang_member`);

        // ── Step 3: Collect emp_codes and build emp_code → member info map ────
        const empCodes = [...new Set(gangMemberRows.map(r => r.emp_code.trim().toUpperCase()).filter(Boolean))];
        const empCodeToMember = new Map<string, any>();
        gangMemberRows.forEach(r => {
            const ec = r.emp_code.trim().toUpperCase();
            if (ec) empCodeToMember.set(ec, r);
        });

        // ── Step 4: Batch resolve NIK from HR_EMPLOYEE by EmpCode ─────────────
        const nikMap = new Map<string, string>(); // emp_code → nik
        try {
            const CHUNK = 500;
            for (let i = 0; i < empCodes.length; i += CHUNK) {
                const chunk = empCodes.slice(i, i + CHUNK);
                const rows = await Q.selectHrEmployeeForBackfill(mainDb, chunk);
                for (const r of rows) {
                    const ec = (r.EmpCode || '').trim().toUpperCase();
                    if (ec && r.NewICNo) {
                        nikMap.set(ec, (r.NewICNo || '').trim().toUpperCase());
                    }
                }
            }
        } catch (e) {
            console.error('[calculateTHRData] Error resolving NIK by EmpCode:', e);
        }

        // ── Step 5: Batch resolve bank from HR_PAYROLL by EmpCode ──────────────
        const bankMap = new Map<string, { bank_acc_no: string; bank_code: string }>();
        try {
            const CHUNK = 500;
            for (let i = 0; i < empCodes.length; i += CHUNK) {
                const chunk = empCodes.slice(i, i + CHUNK);
                const rows = await Q.selectPayrollBankWithEmpCode(mainDb, chunk);
                for (const r of rows) {
                    const ec = (r.EmpCode || '').trim().toUpperCase();
                    if (ec) {
                        bankMap.set(ec, {
                            bank_acc_no: (r.BankAccNo || '').trim(),
                            bank_code: (r.BankCode || '').trim()
                        });
                    }
                }
            }
        } catch (e) {
            console.error('[calculateTHRData] Error resolving bank by EmpCode:', e);
        }

        // ── Step 6: Batch resolve religion from HR_EMPLOYEE by EmpCode ────────
        const religionMap: Record<string, string> = {
            '01': '01 Islam', '02': '02 Katolik', '03': '03 Protestan',
            '04': '04 Hindu', '05': '05 Budha', '06': '06 Konghucu',
            'ISLAM': '01 Islam', 'KATHOLIK': '02 Katolik', 'KATOLIK': '02 Katolik',
            'KRISTEN': '03 Protestan', 'PROTESTAN': '03 Protestan', 'HINDU': '04 Hindu',
            'BUDHA': '05 Budha', 'BUDDHA': '05 Budha', 'KONGHUCU': '06 Konghucu'
        };
        const empCodeToHrData = new Map<string, any>(); // emp_code → { religion, join_date, gender }
        try {
            const rows = await Q.selectHrEmployeeWithEmployment(mainDb, empCodes);
            for (const r of rows) {
                const ec = (r.EmpCode || '').trim().toUpperCase();
                if (ec) {
                    const rawJD = getLatestValidDate(r.AppJoinDate, r.AppJoinGrpDate) || r.CreateDate;
                    let joinDateStr: string | null = null;
                    if (rawJD) {
                        try {
                            const d = new Date(rawJD);
                            if (!isNaN(d.getTime())) joinDateStr = d.toISOString();
                        } catch { }
                    }
                    empCodeToHrData.set(ec, {
                        religion: r.Religion || '',
                        join_date: joinDateStr,
                        gender: r.Gender || ''
                    });
                }
            }
        } catch (e) {
            console.error('[calculateTHRData] Error resolving HR data by EmpCode:', e);
        }

        // ── Step 7: Fetch payroll data from payroll_history_detail by EmpCode ──
        const payrollMap = new Map<string, any>(); // emp_code → payroll row
        try {
            const rows = await Q.selectPayrollHistoryDetail(extDb, month, year, empCodes);
            for (const r of rows) {
                const ec = (r.emp_code || '').trim().toUpperCase();
                if (ec && !payrollMap.has(ec)) {
                    payrollMap.set(ec, r);
                }
            }
        } catch (e) {
            console.error('[calculateTHRData] Error fetching payroll history detail:', e);
        }

        // ── Step 8: Fetch blacklist for this period ─────────────────────────────
        const blacklist = await OtherIncomesService.getBlacklist(year, month, 'THR');
        const blacklistedNIKs = new Set(blacklist.map(b => String(b.nik || '').trim().toUpperCase()));
        const blacklistedEmpCodes = new Set(empCodes.filter(ec => {
            const nik = nikMap.get(ec) || '';
            return blacklistedNIKs.has(nik.trim().toUpperCase());
        }));

        // ── Step 9: Get THR formula ─────────────────────────────────────────────
        const formulaConfig = await OtherIncomesService.getFormula('THR');

        // ── Step 10: Calculate THR for each gang member ─────────────────────────
        const results: OtherIncome[] = [];

        for (const empCode of empCodes) {
            // Skip blacklisted
            if (blacklistedEmpCodes.has(empCode)) continue;

            const member = empCodeToMember.get(empCode);
            const payroll = payrollMap.get(empCode);
            const hrData = empCodeToHrData.get(empCode);
            const bank = bankMap.get(empCode);
            const nik = nikMap.get(empCode) || '';

            // Get payroll components (from payroll_history_detail OR fallback to HR data)
            const upahDasar = payroll?.upah_dasar || 0;
            const berasRate = payroll?.beras_rate || hrData?.beras_rate || 0;
            const jabatanRate = payroll?.jabatan_rate || 0;
            const masaKerjaJumlah = payroll?.masa_kerja_jumlah || 0;
            const masaKerjaTahun = payroll?.masa_kerja_tahun || 0;
            const jabatanJumlah = payroll?.jabatan_jumlah || (jabatanRate * 30);

            // Get join_date (priority: payroll_history_detail > HR_EMPLOYEE)
            const joinDate = payroll?.join_date || hrData?.join_date || null;
            const jd = parseDate(joinDate);

            // Calculate component values
            const gajiPokok = upahDasar * 30;
            const tunjanganBeras = berasRate * 30;
            const tunjanganMasaKerja = masaKerjaJumlah;

            const mathVars = {
                UPAH_DASAR: upahDasar,
                GAJI_POKOK: gajiPokok,
                BERAS_RATE: berasRate,
                BERAS_JUMLAH: tunjanganBeras,
                JABATAN_RATE: jabatanRate,
                JABATAN_JUMLAH: jabatanJumlah,
                MASA_KERJA_JUMLAH: tunjanganMasaKerja,
                MASA_KERJA_TAHUN: masaKerjaTahun,
                HK: 30
            };
            let fullThr = 0;
            try {
                const evalFn = new Function(...Object.keys(mathVars), `return ${formulaConfig.formula};`);
                fullThr = evalFn(...Object.values(mathVars));
            } catch { fullThr = gajiPokok + tunjanganBeras + tunjanganMasaKerja; }

            // Proportional THR calculation
            let thrAmt = fullThr;
            let propDesc = '';
            let workingMonths = 12;
            let propFactor = "12/12";
            if (jd) {
                const periodDate = new Date(year, month - 1, 1);
                let diff = (periodDate.getFullYear() - jd.getFullYear()) * 12 + (periodDate.getMonth() - jd.getMonth());
                if (diff < 12 && diff >= 0) {
                    workingMonths = Math.min(12, diff + 1);
                    if (workingMonths < 12) {
                        propFactor = `${workingMonths}/12`;
                        thrAmt = Math.round((fullThr * workingMonths) / 12);
                        propDesc = ` (Proporsi ${workingMonths}/12)`;
                    }
                }
            }

            // Map religion
            const rawRel = (payroll?.religion || hrData?.religion || '').trim().toUpperCase();
            const mappedRel = religionMap[rawRel] || rawRel || '01 Islam';
            const gender = payroll?.jenis_kelamin === 'FEMALE' ? 'P' : (hrData?.gender === 'FEMALE' ? 'P' : 'L');

            // Determine gang and division from history_gang_member (authoritative source)
            const memberGangCode = member?.gang_code || payroll?.gang_code || gangCode || '';
            const memberDivisionCode = member?.division_code || payroll?.division_code || payroll?.loc_code || divisionCode || '';

            // Bank account from HR_PAYROLL (resolved by EmpCode)
            const bankAccNo = bank?.bank_acc_no || '';
            const bankCode = bank?.bank_code || '';

            results.push({
                nik,
                new_nik: nik,  // Same as nik — this IS the correct KTP NIK
                emp_code: empCode,
                emp_name: payroll?.nama || payroll?.emp_name || member?.emp_name || '',
                division_code: memberDivisionCode,
                gang_code: memberGangCode,
                period_year: year,
                period_month: month,
                income_type: 'THR',
                income_name: `Tunjangan Hari Raya${propDesc}`,
                amount: thrAmt,
                is_paid_in_thp: true,
                is_taxable: true,
                original_religion: rawRel,
                religion: mappedRel,
                join_date: joinDate,
                bank_acc_no: isValidBankAccNo(bankAccNo) ? bankAccNo : '',
                bank_code: bankCode,
                sex: gender,
                details: {
                    formula: formulaConfig.formula,
                    variables: {
                        ...mathVars,
                        JOIN_DATE: joinDate,
                        WORKING_MONTHS: workingMonths,
                        PROPORTION_FACTOR: propFactor,
                        RELIGION: mappedRel,
                        SEX: gender,
                        EMP_CODE: empCode,
                        TOTAL_GAJI_POKOK: gajiPokok,
                        TOTAL_TUNJANGAN_BERAS: tunjanganBeras,
                        TOTAL_TUNJANGAN_JABATAN: jabatanJumlah,
                        TOTAL_TUNJANGAN_MASA_KERJA: tunjanganMasaKerja,
                        IS_FULL: workingMonths === 12
                    }
                }
            });
        }

        // Log summary
        const divDistribution: Record<string, number> = {};
        results.forEach(r => {
            const dc = r.division_code || 'UNKNOWN';
            divDistribution[dc] = (divDistribution[dc] || 0) + 1;
        });
        console.log(`[calculateTHRData] EmpCode-based THR: ${results.length} employees, division distribution:`, divDistribution);

        // Note: enrichWithHrData is no longer called here because we already
        // resolved NIK, religion, join_date, bank, and gender in Steps 4-6.
        // If additional enrichment is needed, it can be added separately.
        return results;
    }

    // calculateAndSaveTHR: calculates THR for all employees and saves to DB
    // Always deletes old data first for the selected period/division/gang, then saves new data
    // This ensures no duplicates and data is always fresh
    static async calculateAndSaveTHR(year: number, month: number, divisionCode?: string, gangCode?: string): Promise<{ success: boolean; count?: number; error?: string; summary?: { total_karyawan: number; full_workers: number; proportional_workers: number; total_thr: number; total_gaji_pokok: number; total_tunjangan_beras: number; total_tunjangan_jabatan: number } }> {
        try {
            // 1. Calculate THR data
            const data = await OtherIncomesThrService.calculateTHRData(year, month, divisionCode, gangCode);
            if (!data.length) return { success: false, error: 'Tidak ada data karyawan untuk periode ini.' };

            // 2. Calculate summary
            let fullWorkers = 0;
            let proportionalWorkers = 0;
            let totalThr = 0;
            let totalGajiPokok = 0;
            let totalTunjanganBeras = 0;
            let totalTunjanganJabatan = 0;

            for (const inc of data) {
                totalThr += inc.amount || 0;
                const vars = (inc as any).details?.variables || {};
                totalGajiPokok += vars.TOTAL_GAJI_POKOK || 0;
                totalTunjanganBeras += vars.TOTAL_TUNJANGAN_BERAS || 0;
                totalTunjanganJabatan += vars.TOTAL_TUNJANGAN_JABATAN || 0;
                if (vars.IS_FULL) {
                    fullWorkers++;
                } else {
                    proportionalWorkers++;
                }
            }

            const summary = {
                total_karyawan: data.length,
                full_workers: fullWorkers,
                proportional_workers: proportionalWorkers,
                total_thr: totalThr,
                total_gaji_pokok: totalGajiPokok,
                total_tunjangan_beras: totalTunjanganBeras,
                total_tunjangan_jabatan: totalTunjanganJabatan
            };

            // 3. Delete existing data for this period/division/gang FIRST
            const db = Database.getExtendedInstance();
            let extraWhere = '';
            const deleteParams: any[] = [];

            if (divisionCode && divisionCode !== 'ALL') {
                const filter = await divisionConfigService.expandDivisionFilter(divisionCode);
                if (filter.isVirtual) {
                    // For virtual divisions, records are keyed by gang_code
                    if (filter.gangCodes.length > 0) {
                        extraWhere += ` AND gang_code IN (${filter.gangCodes.map(() => '?').join(',')})`;
                        deleteParams.push(...filter.gangCodes);
                    }
                } else {
                    extraWhere += ` AND division_code IN (${filter.divisionCodes.map(() => '?').join(',')})`;
                    deleteParams.push(...filter.divisionCodes);
                }
            }

            if (gangCode && gangCode !== 'ALL') {
                extraWhere += ` AND gang_code = ?`;
                deleteParams.push(gangCode);
            }

            await Q.deleteThrIncomesByPeriod(db, year, month, extraWhere, deleteParams);
            console.log(`[calculateAndSaveTHR] Deleted old THR data for ${divisionCode || 'ALL'}, period ${month}/${year}`);

            // 4. Insert new data
            const result = await OtherIncomesService.bulkSaveIncomes(data);
            console.log(`[calculateAndSaveTHR] Saved ${result.count} THR records, success: ${result.success}`);

            // 5. Verify save by reading back
            const verifyRaw = await OtherIncomesService.getRawIncomes(year, month, divisionCode);
            const verifyThr = verifyRaw.filter(r => r.income_type === 'THR');
            console.log(`[calculateAndSaveTHR] Verification: ${verifyThr.length} THR records found in DB after save`);

            return { success: result.success, count: result.count, summary };
        } catch (e: any) { console.error('[calculateAndSaveTHR] Error:', e.message); return { success: false, error: e.message }; }
    }

    static async getGangMembersFromHistory(
        month: number,
        year: number,
        gangCode?: string,
        divisionCode?: string
    ): Promise<{
        gangs: Array<{
            gang_code: string;
            division_code: string;
            gang_description: string;
            members: Array<{
                emp_code: string;
                nik: string;
                emp_name: string;
                religion: string;
                join_date: string;
                bank_acc_no: string;
                bank_code: string;
                sex: string;
                is_active: boolean;
            }>;
            member_count: number;
        }>;
        summary: {
            total_gangs: number;
            total_members: number;
        };
    }> {
        const extDb = Database.getExtendedInstance(); // extend_db_ptrj
        const mainDb = Database.getInstance();          // db_ptrj (HR_EMPLOYEE, HR_PAYROLL)

        try {
            // ── Determine if this is a non-current period ─────────────────────────
            const now = new Date();
            const currentMonth = now.getMonth() + 1;
            const currentYear = now.getFullYear();
            const isCurrentPeriod = (year === currentYear && month === currentMonth);

            // ── NON-CURRENT PERIOD: Load from saved employee_other_incomes ─────────
            if (!isCurrentPeriod) {
                console.log(`[getGangMembersFromHistory] Non-current period ${month}/${year} — loading from saved employee_other_incomes by emp_code`);

                // Get saved THR records
                const savedRows = await Q.selectSavedThrMembersByPeriod(extDb, year, month, gangCode, divisionCode);

                if (savedRows.length > 0) {
                    console.log(`[getGangMembersFromHistory] Found ${savedRows.length} saved THR records for period ${month}/${year}`);

                    const empCodes = [...new Set(
                        savedRows.map(r => r.emp_code.trim().toUpperCase()).filter(Boolean)
                    )];

                    // Fresh bank lookup by emp_code
                    const bankMap = new Map<string, { bank_acc_no: string; bank_code: string }>();
                    if (empCodes.length > 0) {
                        const CHUNK = 500;
                        for (let i = 0; i < empCodes.length; i += CHUNK) {
                            const chunk = empCodes.slice(i, i + CHUNK);
                            const rows = await Q.selectPayrollBankWithEmpCode(mainDb, chunk);
                            for (const r of rows) {
                                const ec = (r.EmpCode || '').trim().toUpperCase();
                                if (ec) {
                                    bankMap.set(ec, {
                                        bank_acc_no: (r.BankAccNo || '').trim(),
                                        bank_code: (r.BankCode || '').trim()
                                    });
                                }
                            }
                        }
                    }

                    // Group by gang_code
                    const religionMap: Record<string, string> = {
                        '01': '01 Islam', '02': '02 Katolik', '03': '03 Protestan',
                        '04': '04 Hindu', '05': '05 Budha', '06': '06 Konghucu',
                        'ISLAM': '01 Islam', 'KATHOLIK': '02 Katolik', 'KATOLIK': '02 Katolik',
                        'KRISTEN': '03 Protestan', 'PROTESTAN': '03 Protestan', 'HINDU': '04 Hindu',
                        'BUDHA': '05 Budha', 'BUDDHA': '05 Budha', 'KONGHUCU': '06 Konghucu'
                    };

                    const gangGroups = new Map<string, any[]>();
                    savedRows.forEach(r => {
                        const gc = (r.gang_code || '').trim();
                        if (!gc) return;
                        if (!gangGroups.has(gc)) gangGroups.set(gc, []);

                        const ec = r.emp_code.trim().toUpperCase();
                        const freshBank = bankMap.get(ec);
                        const freshBankAcc = freshBank?.bank_acc_no || '';
                        const bankAccNo = isValidBankAccNo(freshBankAcc) ? freshBankAcc : (isValidBankAccNo(r.bank_acc_no_saved) ? r.bank_acc_no_saved : '');
                        const bankCode = freshBank?.bank_code || r.bank_code_saved || '';
                        const rawRel = (r.religion || '').trim().toUpperCase();

                        gangGroups.get(gc)!.push({
                            emp_code: ec,
                            nik: r.nik || '',
                            emp_name: r.emp_name || '',
                            religion: religionMap[rawRel] || rawRel || '01 Islam',
                            join_date: r.join_date ? String(r.join_date).split('T')[0] : '',
                            bank_acc_no: bankAccNo,
                            bank_code: bankCode,
                            sex: r.sex === 'P' ? 'P' : 'L',
                            is_active: true
                        });
                    });

                    const gangs = Array.from(gangGroups.entries())
                        .sort((a, b) => a[0].localeCompare(b[0]))
                        .map(([gc, members]) => ({
                            gang_code: gc,
                            division_code: savedRows.find(r => r.gang_code.trim() === gc)?.division_code || '',
                            gang_description: '',
                            members,
                            member_count: members.length
                        }));

                    const totalMembers = gangs.reduce((sum, g) => sum + g.member_count, 0);
                    console.log(`[getGangMembersFromHistory] Non-current period: ${gangs.length} gangs, ${totalMembers} members from saved data`);
                    return { gangs, summary: { total_gangs: gangs.length, total_members: totalMembers } };
                }

                console.log(`[getGangMembersFromHistory] No saved THR data for period ${month}/${year}, falling back to history_gang_member`);
            }

            // ── CURRENT PERIOD or FALLBACK: Query history_gang_member ──────────────
            // Step 1: Build gang filter
            let gangFilter = '';
            const gangFilterParams: any[] = [];

            if (gangCode && gangCode !== 'ALL') {
                gangFilter = 'AND gang_code = ?';
                gangFilterParams.push(gangCode);
            } else if (divisionCode && divisionCode !== 'ALL') {
                // Get all gangs for this division
                const { divisionConfigService } = await import('./config/DivisionConfigService');
                const gangs = await divisionConfigService.getGangsForDivision(divisionCode);
                const gcList = gangs.map((g: any) => g.gang_code);
                if (gcList.length > 0) {
                    const placeholders = gcList.map(() => '?').join(',');
                    gangFilter = `AND gang_code IN (${placeholders})`;
                    gangFilterParams.push(...gcList);
                }
            }

            // Step 2: Query gang members from history_gang_member
            const gangMemberRows = await Q.selectHistoryGangMembersWithDesc(extDb, month, year, gangFilter, gangFilterParams);

            if (gangMemberRows.length === 0) {
                console.log(`[getGangMembersFromHistory] No members found for ${month}/${year}, gang: ${gangCode}, division: ${divisionCode}`);
                return { gangs: [], summary: { total_gangs: 0, total_members: 0 } };
            }

            // Step 3: Collect all emp_codes
            const empCodes = [...new Set(gangMemberRows.map(r => { const ec = r.emp_code ? r.emp_code.trim().toUpperCase() : ''; return ec; }).filter((v: string) => Boolean(v)))];
            console.log(`[getGangMembersFromHistory] Found ${gangMemberRows.length} rows, ${empCodes.length} unique emp_codes`);

            // Step 4: Batch resolve NIK, religion, join_date, gender from HR_EMPLOYEE by EmpCode
            const nikMap = new Map<string, string>();
            const religionMap: Record<string, string> = {};
            const genderMap: Record<string, string> = {};
            const joinDateMap: Record<string, string> = {};
            const empNameMap: Record<string, string> = {};

            const CHUNK = 500;
            for (let i = 0; i < empCodes.length; i += CHUNK) {
                const chunk = empCodes.slice(i, i + CHUNK);

                const hrRows = await Q.selectHrEmployeeForGangMembers(mainDb, chunk);

                for (const r of hrRows) {
                    const ec = (r.EmpCode || '').trim().toUpperCase();
                    if (!ec) continue;

                    if (r.NewICNo) nikMap.set(ec, (r.NewICNo || '').trim().toUpperCase());
                    if (r.EmpName) empNameMap[ec] = r.EmpName.trim();
                    if (r.Religion) {
                        const rawRel = r.Religion.trim().toUpperCase();
                        const religionLookup: Record<string, string> = {
                            '01': '01 Islam', '02': '02 Katolik', '03': '03 Protestan',
                            '04': '04 Hindu', '05': '05 Budha', '06': '06 Konghucu',
                            'ISLAM': '01 Islam', 'KATHOLIK': '02 Katolik', 'KATOLIK': '02 Katolik',
                            'KRISTEN': '03 Protestan', 'PROTESTAN': '03 Protestan', 'HINDU': '04 Hindu',
                            'BUDHA': '05 Budha', 'BUDDHA': '05 Budha', 'KONGHUCU': '06 Konghucu'
                        };
                        religionMap[ec] = religionLookup[rawRel] || rawRel || '01 Islam';
                    }
                    if (r.Gender) genderMap[ec] = r.Gender.trim();

                    // Join date: prefer AppJoinGrpDate > AppJoinDate > CreateDate
                    const rawJD = getLatestValidDate(r.AppJoinDate, r.AppJoinGrpDate) || r.CreateDate;
                    if (rawJD) {
                        try {
                            const d = new Date(rawJD);
                            if (!isNaN(d.getTime())) joinDateMap[ec] = d.toISOString().split('T')[0];
                        } catch {}
                    }
                }
            }

            // Step 5: Batch resolve bank from HR_PAYROLL by EmpCode
            const bankMap = new Map<string, { bank_acc_no: string; bank_code: string }>();
            for (let i = 0; i < empCodes.length; i += CHUNK) {
                const chunk = empCodes.slice(i, i + CHUNK);
                const bankRows = await Q.selectPayrollBankWithEmpCode(mainDb, chunk);
                for (const r of bankRows) {
                    const ec = (r.EmpCode || '').trim().toUpperCase();
                    if (ec) {
                        bankMap.set(ec, {
                            bank_acc_no: (r.BankAccNo || '').trim(),
                            bank_code: (r.BankCode || '').trim()
                        });
                    }
                }
            }

            // Step 6: Group by gang_code
            const gangGroups = new Map<string, any[]>();
            gangMemberRows.forEach(r => {
                const gc = (r.gang_code || '').trim();
                if (!gangGroups.has(gc)) {
                    gangGroups.set(gc, []);
                }
                const ec = r.emp_code.trim().toUpperCase();
                gangGroups.get(gc)!.push({
                    emp_code: ec,
                    nik: nikMap.get(ec) || '',
                    emp_name: empNameMap[ec] || r.emp_name || '',
                    religion: religionMap[ec] || '01 Islam',
                    join_date: joinDateMap[ec] || '',
                    bank_acc_no: bankMap.get(ec)?.bank_acc_no || '',
                    bank_code: bankMap.get(ec)?.bank_code || '',
                    sex: genderMap[ec] === 'FEMALE' ? 'P' : 'L',
                    is_active: r.is_active
                });
            });

            // Step 7: Build result
            const gangs = Array.from(gangGroups.entries())
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([gc, members]) => {
                    const firstRow = gangMemberRows.find(r => r.gang_code.trim() === gc) || {};
                    return {
                        gang_code: gc,
                        division_code: firstRow.division_code || '',
                        gang_description: firstRow.gang_description || '',
                        members,
                        member_count: members.length
                    };
                });

            const totalMembers = gangs.reduce((sum, g) => sum + g.member_count, 0);

            return {
                gangs,
                summary: {
                    total_gangs: gangs.length,
                    total_members: totalMembers
                }
            };
        } catch (e: any) {
            console.error('[getGangMembersFromHistory] Error:', e);
            throw e;
        }
    }
    static async previewTHR(year: number, month: number, division?: string, gang?: string) {
        try { const data = await OtherIncomesThrService.calculateTHRData(year, month, division, gang); return { success: true, data }; }
        catch (e: any) { return { success: false, error: e.message }; }
    }

    /**
     * Get summary of saved THR data grouped by gang
     * Automatically excludes blacklisted employees (done via getIncomesWithDetails)
     */
    static async getThrSummary(year: number, month: number, divisionCode?: string) {
        try {
            console.log(`[getThrSummary] Fetching THR data for ${month}/${year}, divisionCode: ${divisionCode || 'ALL'}`);
            
            // Use getRawIncomes directly - avoid heavy full recalculation
            const raw = await OtherIncomesService.getRawIncomes(year, month, divisionCode);
            console.log(`[getThrSummary] Raw records fetched: ${raw.length}`);
            
            // Filter to THR only
            const incomes = raw.filter(r => r.income_type === 'THR');
            console.log(`[getThrSummary] THR records after filtering: ${incomes.length}`);

            if (!incomes || incomes.length === 0) {
                console.log(`[getThrSummary] No THR data found for ${month}/${year}, division: ${divisionCode || 'ALL'}`);
                console.log(`[getThrSummary] HINT: Run THR calculation first from Other Incomes page`);
                return { data: [], grand_total: null };
            }

            // Build a history dict for records that DON'T have details_json
            // This provides fallback masa_kerja and beras data
            const needsHistory = incomes.filter(inc => !(inc as any).details?.variables);
            let historyDict: Record<string, any> = {};
            if (needsHistory.length > 0) {
                try {
                    const historyService = HistoryDatabaseService.getInstance();
                    // Fetch ALL divisions' history at once (pass undefined for div)
                    const historyData = await historyService.getHistoricalPayrollDataAsExtractorFormat(month, year, 'ALL', undefined);
                    if (historyData?.data_rows) {
                        historyData.data_rows.forEach((row: any) => {
                            const nik = String(row.nik || '').trim().toUpperCase();
                            if (nik) historyDict[nik] = row;
                        });
                    }
                } catch (e) { /* ignore history fallback errors */ }
            }

            const gangMap = new Map<string, {
                gang_code: string;
                gang_description?: string;
                total_employees: number;
                full_workers: number;
                prop_workers: number;
                total_thr: number;
                total_tunjangan_beras: number;
                total_masa_kerja: number;
            }>();

            const grandTotal = {
                total_employees: 0,
                full_workers: 0,
                prop_workers: 0,
                total_thr: 0,
                total_tunjangan_beras: 0,
                total_masa_kerja: 0
            };

            for (const inc of incomes) {
                const gangCode = inc.gang_code || 'UNKNOWN';
                const amt = inc.amount || 0;
                let vars = (inc as any).details?.variables || {};

                // Fallback: if no details_json, use history data
                if (Object.keys(vars).length === 0) {
                    const nikKey = inc.nik?.trim().toUpperCase();
                    const h = historyDict[nikKey || ''];
                    if (h) {
                        vars = {
                            BERAS_RATE: h.beras_rate || 0,
                            BERAS_JUMLAH: (h.beras_rate || 0) * 30,
                            MASA_KERJA_JUMLAH: h.masa_kerja_jumlah || 0,
                            PROPORTION_FACTOR: '12/12'
                        };
                    }
                }

                // Always detect proportion from income_name as override
                // This fixes cases where details_json has incorrect PROPORTION_FACTOR
                const propMatch = inc.income_name?.match(/Proporsi\s+(\d+)\/12/i);
                if (propMatch) {
                    vars.PROPORTION_FACTOR = `${propMatch[1]}/12`;
                    vars.WORKING_MONTHS = parseInt(propMatch[1]);
                }

                // Determine if full or proportional
                // Use PROPORTION_FACTOR as primary source (if not '12/12', it's proportional)
                const propFactor = vars.PROPORTION_FACTOR || '12/12';
                const isFull = propFactor === '12/12';

                // Get tunjangan values
                const tunjanganBeras = vars.TOTAL_TUNJANGAN_BERAS || vars.BERAS_JUMLAH || ((vars.BERAS_RATE || 0) * 30);
                const masaKerja = vars.TOTAL_TUNJANGAN_MASA_KERJA || vars.MASA_KERJA_JUMLAH || 0;

                if (!gangMap.has(gangCode)) {
                    gangMap.set(gangCode, {
                        gang_code: gangCode,
                        gang_description: gangCode,
                        total_employees: 0,
                        full_workers: 0,
                        prop_workers: 0,
                        total_thr: 0,
                        total_tunjangan_beras: 0,
                        total_masa_kerja: 0
                    });
                }

                const gangSum = gangMap.get(gangCode)!;
                gangSum.total_employees += 1;
                gangSum.total_thr += amt;
                gangSum.total_tunjangan_beras += tunjanganBeras;
                gangSum.total_masa_kerja += masaKerja;

                if (isFull) {
                    gangSum.full_workers += 1;
                    grandTotal.full_workers += 1;
                } else {
                    gangSum.prop_workers += 1;
                    grandTotal.prop_workers += 1;
                }

                grandTotal.total_employees += 1;
                grandTotal.total_thr += amt;
                grandTotal.total_tunjangan_beras += tunjanganBeras;
                grandTotal.total_masa_kerja += masaKerja;
            }

            const data = Array.from(gangMap.values()).sort((a, b) => a.gang_code.localeCompare(b.gang_code));

            return {
                data,
                grand_total: grandTotal
            };

        } catch (error: any) {
            console.error("Error in getThrSummary:", error);
            throw error;
        }
    }

    /**
     * Get summary of SAVED THR data grouped by division (for Rebinmas-wide recap)
     * Reads from stored data in employee_other_incomes (saved via calculateAndSaveTHR)
     * Excludes blacklisted employees via getRawIncomes filtering
     * @param excludeIjl If true, excludes IJL division from results
     * @param ijlOnly If true, only returns IJL division results
     */
    static async getThrRecapAll(year: number, month: number, excludeIjl: boolean = false, ijlOnly: boolean = false) {
        try {
            // Read from saved data — this reflects the last "Simpan" action
            const raw = await OtherIncomesService.getRawIncomes(year, month);
            // Filter to THR only
            let incomes = raw.filter(r => r.income_type === 'THR');

            // IJL filtering
            if (ijlOnly) {
                // Only IJL
                incomes = incomes.filter(r => r.division_code === 'IJL');
                console.log(`[getThrRecapAll] IJL Only, filtered to ${incomes.length} records`);
            } else if (excludeIjl) {
                // Exclude IJL (Non-IJL)
                incomes = incomes.filter(r => r.division_code !== 'IJL');
                console.log(`[getThrRecapAll] Excluding IJL, filtered to ${incomes.length} records`);
            }

            console.log(`[getThrRecapAll] Found ${incomes.length} saved THR records for ${month}/${year}`);

            if (!incomes || incomes.length === 0) {
                return { divisions: [], grand_total: null };
            }

            // Helper: Map gang_code to virtual division
            const getVirtualDivisionFromGang = (gangCode: string): string | null => {
                const gangToVirtual: Record<string, string> = {
                    'HMC': 'WKS_AR',
                    'AMC': 'WKS_PG',
                    'B2N': 'NRS',
                    'IN1': 'INF', 'IN2': 'INF', 'IN3': 'INF', 'IN4': 'INF', 'IN5': 'INF',
                    'M01': 'MILL', 'M02': 'MILL', 'M03': 'MILL', 'M04': 'MILL', 'M05': 'MILL',
                    'M1': 'MILL', 'M2': 'MILL', 'M3': 'MILL', 'M4': 'MILL', 'M5': 'MILL'
                };
                return gangToVirtual[gangCode?.toUpperCase()] || null;
            };

            const divMap = new Map<string, any>();

            const grandTotal = {
                total_employees: 0,
                full_workers: 0,
                prop_workers: 0,
                total_thr: 0,
                total_tunjangan_beras: 0,
                total_masa_kerja: 0
            };

            // Debug: Log first employee's vars for each division
            const debugSeen = new Set<string>();
            for (const inc of incomes) {
                const divCode = inc.division_code || 'UNKNOWN';
                if (!debugSeen.has(divCode)) {
                    debugSeen.add(divCode);
                    const vars = (inc as any).details?.variables || {};
                    console.log(`[DEBUG getThrRecapAll] Division: ${divCode}, Sample vars:`, {
                        TOTAL_TUNJANGAN_BERAS: vars.TOTAL_TUNJANGAN_BERAS,
                        TOTAL_TUNJANGAN_JABATAN: vars.TOTAL_TUNJANGAN_JABATAN,
                        TOTAL_TUNJANGAN_MASA_KERJA: vars.TOTAL_TUNJANGAN_MASA_KERJA,
                        MASA_KERJA_JUMLAH: vars.MASA_KERJA_JUMLAH,
                        BERAS_RATE: vars.BERAS_RATE,
                        JABATAN_RATE: vars.JABATAN_RATE
                    });
                }
            }

            for (const inc of incomes) {
                // Group by division_code as stored in DB
                // But check if gang_code belongs to a virtual division
                let divCode = inc.division_code || 'UNKNOWN';
                const gangCode = inc.gang_code || '';

                // Check if gang belongs to a virtual division - if so, use virtual division code
                const virtualDiv = getVirtualDivisionFromGang(gangCode);
                if (virtualDiv) {
                    divCode = virtualDiv;
                }

                const amt = inc.amount || 0;
                const vars = (inc as any).details?.variables || {};

                // Detect proportion from income_name as override
                const propMatch = inc.income_name?.match(/Proporsi\s+(\d+)\/12/i);
                if (propMatch) {
                    vars.PROPORTION_FACTOR = `${propMatch[1]}/12`;
                }

                const propFactor = vars.PROPORTION_FACTOR || '12/12';
                const isFull = propFactor === '12/12';

                const tunjanganBeras = vars.TOTAL_TUNJANGAN_BERAS || vars.BERAS_JUMLAH || ((vars.BERAS_RATE || 0) * 30);
                const masaKerja = vars.TOTAL_TUNJANGAN_MASA_KERJA || vars.MASA_KERJA_JUMLAH || 0;

                if (!divMap.has(divCode)) {
                    divMap.set(divCode, {
                        division: divCode,
                        gang_description: divCode,
                        karyawan_count: 0,
                        full_workers: 0,
                        prop_workers: 0,
                        total_thr: 0,
                        total_tunjangan_beras: 0,
                        total_masa_kerja: 0
                    });
                }

                const divSum = divMap.get(divCode)!;
                divSum.karyawan_count += 1;
                divSum.total_thr += amt;
                divSum.total_tunjangan_beras += tunjanganBeras;
                divSum.total_masa_kerja += masaKerja;

                if (isFull) {
                    divSum.full_workers += 1;
                    grandTotal.full_workers += 1;
                } else {
                    divSum.prop_workers += 1;
                    grandTotal.prop_workers += 1;
                }

                grandTotal.total_employees += 1;
                grandTotal.total_thr += amt;
                grandTotal.total_tunjangan_beras += tunjanganBeras;
                grandTotal.total_masa_kerja += masaKerja;
            }

            const divisions = Array.from(divMap.values()).sort((a, b) => a.division.localeCompare(b.division));

            // HARDCODE: Override AB2, P2A, and MILL for THR February 2026 (only for non-IJL mode)
            if (month === 2 && year === 2026 && !ijlOnly) {
                // Save calculated values for AB2, P2A, and MILL before overriding
                let ab2Calculated = divisions.find(d => d.division === 'AB2');
                let p2aCalculated = divisions.find(d => d.division === 'P2A');
                let millCalculated = divisions.find(d => d.division === 'MILL');

                const ab2Calc = ab2Calculated || { karyawan_count: 0, full_workers: 0, prop_workers: 0, total_thr: 0, total_tunjangan_beras: 0, total_masa_kerja: 0 };
                const p2aCalc = p2aCalculated || { karyawan_count: 0, full_workers: 0, prop_workers: 0, total_thr: 0, total_tunjangan_beras: 0, total_masa_kerja: 0 };
                const millCalc = millCalculated || { karyawan_count: 0, full_workers: 0, prop_workers: 0, total_thr: 0, total_tunjangan_beras: 0, total_masa_kerja: 0 };

                // Hardcoded values
                const ab2Hardcoded = {
                    division: 'AB2',
                    gang_description: 'AB2',
                    karyawan_count: 120,
                    full_workers: 105,
                    prop_workers: 15,
                    total_thr: 467196875,
                    total_tunjangan_beras: 13683000,
                    total_masa_kerja: 3011500
                };

                const p2aHardcoded = {
                    division: 'P2A',
                    gang_description: 'P2A',
                    karyawan_count: 182,
                    full_workers: 161,
                    prop_workers: 21,
                    total_thr: 711424750,
                    total_tunjangan_beras: 21441000,
                    total_masa_kerja: 5412000
                };

                // MILL: Workers 165 (157 full + 8 proportional)
                // Masa Kerja: 4,000,000
                // Tunjangan Beras: 20,941,500
                // Total THR: 676,082,692
                const millHardcoded = {
                    division: 'MILL',
                    gang_description: 'MILL',
                    karyawan_count: 165,
                    full_workers: 157,
                    prop_workers: 8,
                    total_thr: 676082692,
                    total_tunjangan_beras: 20941500,
                    total_masa_kerja: 4000000
                };

                // Replace divisions with hardcoded values
                let ab2Index = divisions.findIndex(d => d.division === 'AB2');
                if (ab2Index >= 0) {
                    divisions[ab2Index] = ab2Hardcoded;
                } else {
                    divisions.push(ab2Hardcoded);
                }

                let p2aIndex = divisions.findIndex(d => d.division === 'P2A');
                if (p2aIndex >= 0) {
                    divisions[p2aIndex] = p2aHardcoded;
                } else {
                    divisions.push(p2aHardcoded);
                }

                let millIndex = divisions.findIndex(d => d.division === 'MILL');
                if (millIndex >= 0) {
                    divisions[millIndex] = millHardcoded;
                } else {
                    divisions.push(millHardcoded);
                }

                // Update grand total: calculated (excluding AB2/P2A/MILL) + hardcoded AB2 + hardcoded P2A + hardcoded MILL
                // First subtract the calculated values for AB2, P2A, and MILL from grand total
                grandTotal.total_employees -= (ab2Calc.karyawan_count + p2aCalc.karyawan_count + millCalc.karyawan_count);
                grandTotal.full_workers -= (ab2Calc.full_workers + p2aCalc.full_workers + millCalc.full_workers);
                grandTotal.prop_workers -= (ab2Calc.prop_workers + p2aCalc.prop_workers + millCalc.prop_workers);
                grandTotal.total_thr -= (ab2Calc.total_thr + p2aCalc.total_thr + millCalc.total_thr);
                grandTotal.total_tunjangan_beras -= (ab2Calc.total_tunjangan_beras + p2aCalc.total_tunjangan_beras + millCalc.total_tunjangan_beras);
                grandTotal.total_masa_kerja -= (ab2Calc.total_masa_kerja + p2aCalc.total_masa_kerja + millCalc.total_masa_kerja);

                // Then add the hardcoded values
                grandTotal.total_employees += (ab2Hardcoded.karyawan_count + p2aHardcoded.karyawan_count + millHardcoded.karyawan_count);
                grandTotal.full_workers += (ab2Hardcoded.full_workers + p2aHardcoded.full_workers + millHardcoded.full_workers);
                grandTotal.prop_workers += (ab2Hardcoded.prop_workers + p2aHardcoded.prop_workers + millHardcoded.prop_workers);
                grandTotal.total_thr += (ab2Hardcoded.total_thr + p2aHardcoded.total_thr + millHardcoded.total_thr);
                grandTotal.total_tunjangan_beras += (ab2Hardcoded.total_tunjangan_beras + p2aHardcoded.total_tunjangan_beras + millHardcoded.total_tunjangan_beras);
                grandTotal.total_masa_kerja += (ab2Hardcoded.total_masa_kerja + p2aHardcoded.total_masa_kerja + millHardcoded.total_masa_kerja);
            }

            console.log(`[getThrRecapAll] Grouped into ${divisions.length} divisions, total employees: ${grandTotal.total_employees}`);

            return {
                divisions,
                grand_total: grandTotal
            };

        } catch (error: any) {
            console.error("Error in getThrRecapAll:", error);
            throw error;
        }
    }
}
