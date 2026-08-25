/**
 * Tax Report Service
 * 
 * Mengagregasi data pajak dari history tables untuk Report Pajak.
 * - Pajak Bulanan (PPH21 per bulan)
 * - Pajak Tahunan (akumulasi setahun + perhitungan PTKP, Biaya Jabatan, PKP)
 * - ASTEK & BPJS Tahunan (akumulasi per bulan)
 */

import { ptkpTaxService, mapPTKPToTER } from './ptkpTaxService';
import { divisionDefinition } from './divisionDefinition';
import { OtherIncomesService } from './otherIncomesService';
import { getCarumanForPph21 } from './carumanDefinitions';
import { Config } from "../config";
import { DataExtractorService, normalizePayrollValuePriorityMode } from './dataExtractorService';
import { currentPeriodService } from './currentPeriodService';
import { EmployeeEstateService } from './employeeEstateService';
import { cacheService } from './cacheService';
import { filterTaxReportRows, resolveTaxReportDivisionScope } from '../utils/taxReportDivisionScope';
import { sortAndRenumberByEmpCode } from '../utils/employeeSort';
import { collectNikLookupKeys, resolveReportIdentity } from '../utils/taxReportIdentity';
import {
    attachPayrollPeriodAdjustmentNotes,
    resolveAdjustedJabatanJumlah,
    shouldForcePotPph21ToTer
} from '../utils/payrollPeriodAdjustments';
import {
    getCanonicalOtherIncomeType,
    sumOtherIncomeByCanonicalType
} from '../utils/otherIncomeCanonical';
import { TaxReportAnnualService } from "./taxReportAnnualService";

/**
 * Auto-derive jabatan (job title) from the last character of gang code.
 * Rules:
 *   H → Karyawan Panen (harvest)
 *   P → Karyawan Perawatan (maintenance)
 *   T → Operator (transport/tractor)
 *   N → Karyawan Nursery
 *   G → Kerani Gudang
 *   Other → Karyawan
 */
export function deriveJabatanFromGang(gangCode: string): string {
    if (!gangCode || gangCode.trim().length === 0) return 'Karyawan';
    const lastChar = gangCode.trim().slice(-1).toUpperCase();
    switch (lastChar) {
        case 'H': return 'Karyawan Panen';
        case 'P': return 'Karyawan Percobaan';
        case 'T': return 'Operator';
        case 'N': return 'Karyawan Nursery';
        case 'G': return 'Kerani Gudang';
        case 'M': return 'Karyawan Perawatan';
        default: return 'Karyawan';
    }
}

// ============================================================
// GL and TaskCode Metadata for Tax Report
// ============================================================
export const TAX_COMPONENT_METADATA: Record<string, TaskCodeMetadata> = {
    "masa_kerja": { task_code: "PT9129", dr_acct: "GA9127", cr_acct: "CL3310" },
    "gaji_pokok": { task_code: "AL0013", dr_acct: "GA9110", cr_acct: "CL3310" },
    "tunjangan_jabatan": { task_code: "GA9128", dr_acct: "GA9128", cr_acct: "CL3310" },
    "tunjangan_lembur": { task_code: "AL0019", dr_acct: "GA9112", cr_acct: "CL3310" },
    "tunjangan_beras": { task_code: "AL0014", dr_acct: "GA9131", cr_acct: "CL3310" },
    "premi": { task_code: "AL3PM2207", dr_acct: "PM2201", cr_acct: "CL3310" },
    "brondol": { task_code: "AL3PM2207", dr_acct: "PM2201", cr_acct: "CL3310" }, // Premi Brondol
    "pph21": { task_code: "DEPH21", dr_acct: "CL3310", cr_acct: "CL3710" },
    "bpjs_kes_pekerja": { task_code: "DEBPJS", dr_acct: "CL3310", cr_acct: "CL3314" },
    "bpjs_kes_majikan": { task_code: "ALBPJS", dr_acct: "GA9120", cr_acct: "CL3314" },
    "astek_jht_majikan": { task_code: "ALASTK", dr_acct: "GA9121", cr_acct: "CL3313" },
    "pot_spsi": { task_code: "DE0005", dr_acct: "CL3310", cr_acct: "CL3315" },
    "thr": { task_code: "GA9116", dr_acct: "GA9116", cr_acct: "CL3310" },
    "bonus": { task_code: "AL0005", dr_acct: "GA9117", cr_acct: "CL3310" }
};

// ============================================================
// Interfaces
// ============================================================

/**
 * Extract parent name from parentheses in employee name
 * Example: "JOHN DOE (JANE DOE)" → { empName: "JOHN DOE", parentName: "JANE DOE" }
 */
export function extractParentName(fullName: string): { empName: string; parentName: string } {
    const match = fullName.match(/\(([^)]+)\)/);
    const parentName = match ? match[1].trim() : '';
    const empName = fullName.replace(/\s*\([^)]*\)\s*/g, '').trim();
    return { empName, parentName };
}

export interface TaskCodeMetadata {
    task_code: string;
    dr_acct: string;
    cr_acct: string;
}

export interface MonthlyTaxRow {
    no: number;
    emp_code: string;
    emp_name: string;
    parent_name?: string;
    nik: string;
    new_nik?: string;
    gender: string;
    status_ptkp: string;
    kategori_ter: string;
    gang_code: string;
    npwp: string;
    alamat: string;
    jabatan: string;
    upah_kotor: number;
    penghasilan_bruto: number;
    tarif_pajak_ter: number;
    pph21_ter: number;
    pot_pph21?: number;

    // GL Metadata for Headers
    component_metadata?: Record<string, TaskCodeMetadata>;

    // Breakdown Details
    hk?: number;
    gaji_pokok_aktual?: number;
    koreksi_hk?: number;

    tunjangan_beras?: number;
    tunjangan_jabatan?: number;
    tunjangan_masa_kerja?: number;
    tunjangan_lembur?: number;
    total_tunjangan?: number;

    /** Dynamic premi map: key = premi name (e.g. 'brondol', 'pruning'), value = amount */
    premi_detail?: Record<string, number>;
    premi_brondol?: number;
    premi_pph?: number;
    total_premi?: number;

    pot_spsi?: number;
    pot_koreksi?: number;
    total_potongan_kotor?: number;

    bpjs_kes_majikan?: number;
    astek_jht_majikan?: number;

    // New fields for enriched report
    upah_dasar?: number;
    gaji_pokok_ideal?: number;  // upah_dasar × HK
    thr_amount?: number;
    exgratia_amount?: number;
    other_incomes?: { type: string; name: string; amount: number }[];
    pendapatan_tidak_tetap_thp?: number; // Total non-regular income for display
    pendapatan_lainnya?: number; // Actual pendapatan_lainnya used in tax calculation

    // [ROBUST] Support field names from both DataExtractor (Daftar Upah) and Tax Report
    beras_jumlah?: number;
    jabatan_jumlah?: number;
    masa_kerja_jumlah?: number;
    lembur_jumlah?: number;
    premi_brondol_total?: number;
    res_address?: string;
    premi?: Record<string, number>;
    [key: string]: any;
}

export interface AnnualIncomeRow {
    no: number;
    emp_code: string;
    emp_name: string;
    parent_name?: string;
    nik: string;
    gender: string;
    status_ptkp: string;
    kategori_ter: string;
    // Monthly income (upah kotor / penghasilan bruto per bulan)
    monthly_income: Record<string, number>; // "1" -> Jan, "2" -> Feb, etc.
    monthly_gaji_kotor: Record<string, number>;
    monthly_masa_kerja: Record<string, number>;
    monthly_bpjs_kesehatan: Record<string, number>;
    monthly_astek_ins_084: Record<string, number>;
    monthly_astek_ins_2: Record<string, number>;
    monthly_pensiun_1: Record<string, number>;
    // Monthly actual PPH21 from TER calculation
    monthly_pph21: Record<string, number>; // "1" -> Jan, "2" -> Feb, etc.
    // Monthly actual PPH21 dari history_adtrans (hanya untuk tab Historis PPH21)
    monthly_pph21_adtrans: Record<string, number>;
    total_income: number;
    gaji_jan_nov: number;
    masa_kerja_jan_nov: number;

    // Header-only placeholders / specific columns
    thr: number;
    bonus: number;
    kontanan: number;
    medical_claim: number;
    bpjs_kesehatan_4pct: number;  // Ditanggung majikan
    astek_084pct: number;         // JKK/JKM ditanggung majikan

    total_penghasilan_setahun: number;

    // Potongan & Perhitungan
    astek_ins_2pct: number;       // JHT ditanggung pekerja
    biaya_jabatan: number;        // 5% of total, max 6.000.000
    pensiun_1pct: number;         // BPJS Pensiun pekerja 1%
    total_potongan_tahunan: number;

    penghasilan_netto_setahun: number;
    ptkp: number;
    penghasilan_kena_pajak: number;
    pph21_kena_pajak: number;
}

export interface DecemberTaxRow {
    no: number;
    emp_code: string;
    emp_name: string;
    parent_name?: string;
    nik: string;
    new_nik?: string;
    npwp: string;
    alamat: string;
    jabatan: string;
    gender: string;
    status_ptkp: string;
    kategori_ter: string;
    masa_kerja_tahun: string;
    masa_kerja_bulan: string;
    gaji_pokok_des: number;
    tunjangan_des: number;
    premi_asuransi_des: number;
    tunjangan_pph_des: number;
    bruto_des: number;
    thr: number;
    bonus: number;
    tantiem: number;
    other_incomes?: { type: string; name: string; amount: number }[];
    gaji_pokok_setahun: number;
    tunjangan_lainnya_setahun: number;
    premi_asuransi_setahun: number;
    tunjangan_pph_setahun: number;
    natura_setahun: number;
    thr_bonus_tantiem_setahun: number;
    bruto_setahun: number;
    biaya_jabatan: number;
    iuran_jht_jp_setahun: number;
    netto_setahun: number;
    ptkp: number;
    pkp: number;
    pph21_setahun: number;
    pph21_jan_nov: number;
    pph21_desember: number;

    // Details for interactive popup
    monthly_breakdown: {
        gaji_pokok: Record<string, number>;
        tunjangan: Record<string, number>;
        premi_asuransi: Record<string, number>;
        iuran_pensiun: Record<string, number>;
        pph21: Record<string, number>;
    };
}

export interface AstekBpjsMonthlyRow {
    no: number;
    emp_code: string;
    emp_name: string;
    nik: string;
    monthly_data: Record<string, {
        upah_dasar: number;
        gaji_pokok: number;  // upah_dasar × 30
        astek_pekerja: number;
        astek_majikan: number;
        bpjs_kes_pekerja: number;
        bpjs_kes_majikan: number;
        bpjs_pensiun_pekerja: number;
        bpjs_pensiun_majikan: number;
        masa_kerja?: number;
    }>;
    total: {
        upah_dasar: number;
        gaji_pokok: number;
        astek_pekerja: number;
        astek_majikan: number;
        bpjs_kes_pekerja: number;
        bpjs_kes_majikan: number;
        bpjs_pensiun_pekerja: number;
        bpjs_pensiun_majikan: number;
        masa_kerja?: number;
    };
}

// ============================================================
// Service
// ============================================================

class TaxReportService {
    private static instance: TaxReportService;
    private constructor() { }

    public static getInstance(): TaxReportService {
        if (!TaxReportService.instance) {
            TaxReportService.instance = new TaxReportService();
        }
        return TaxReportService.instance;
    }

    /**
     * Check if the given period matches the current server month/year
     */
    private async isCurrentPeriod(month: number, year: number): Promise<boolean> {
        const currentPeriod = await currentPeriodService.getCurrentPeriod();
        return month === currentPeriod.month && year === currentPeriod.year;
    }

    /**
     * Fetch payroll data — HISTORY data as primary source for past months, with fallback to LIVE data
     * when history is not available. This ensures seeded data is always preferred for archived periods.
     * @param useHistoryDb - Explicit override to use history database (from UI state)
     */
    public async fetchPayrollData(month: number, year: number, divisionCode: string, gangCode?: string, gangPrefix?: string, useHistoryDb?: boolean, snapshotVersion?: number | null, valuePriorityMode?: string | null): Promise<{
        data: Awaited<ReturnType<DataExtractorService['extractPayrollData']>>;
        isSourceCurrent: boolean;
    }> {
        const normalizedValuePriorityMode = normalizePayrollValuePriorityMode(valuePriorityMode);
        console.log(`[TaxReportService] Fetching payroll data via DataExtractorService: div=${divisionCode} m=${month} y=${year} useHistory=${useHistoryDb} snapshotVersion=${snapshotVersion ?? 'latest'} valuePriorityMode=${normalizedValuePriorityMode}`);

        try {
            // [ALIGNMENT] Trust DataExtractorService as the Single Source of Truth
            const result = await DataExtractorService.getInstance().extractPayrollData(
                month, 
                year, 
                gangCode || "ALL", 
                divisionCode, 
                null, 
                Config.DB_PROFILE, // Match payroll.ts
                false, 
                useHistoryDb, 
                gangPrefix, 
                true, // skipHarvest (Match payroll.ts)
                false, // skipHeavyDetails (Match payroll.ts default)
                snapshotVersion,
                normalizedValuePriorityMode
            );

            if (result && result.data_rows.length > 0) {
                // We'll mark isSourceCurrent based on whether it's the current period or or explicitly requested live
                const now = new Date();
                const currentPeriod = { month: now.getMonth() + 1, year: now.getFullYear() };
                const isSourceCurrent = (month === currentPeriod.month && year === currentPeriod.year) || (useHistoryDb === false);
                
                return { data: result, isSourceCurrent };
            }
        } catch (error: any) {
            console.error(`[TaxReportService] Data fetch failed:`, error.message);
        }

        return { data: { data_rows: [], dynamic_premi_headers: [], dynamic_potongan_headers: [], premi_title_map: {}, potongan_title_map: {}, meta: { execution_time_ms: 0, row_count: 0 } }, isSourceCurrent: true };
    }

    /**
     * Get monthly tax report (PPH21) for a specific period
     */
    public async getMonthlyTaxReport(
        year: number,
        month: number,
        divisionCode?: string,
        gangCode?: string,
        gangPrefix?: string,
        useHistoryDb?: boolean,
        snapshotVersion?: number | null,
        valuePriorityMode?: string | null
    ): Promise<any> {
        const normalizedValuePriorityMode = normalizePayrollValuePriorityMode(valuePriorityMode);
        console.log(`[TaxReportService] getMonthlyTaxReport: year=${year}, month=${month}, division=${divisionCode || 'ALL'}, gang=${gangCode || 'ALL'}, gangPrefix=${gangPrefix || 'none'}, useHistory=${useHistoryDb}, snapshotVersion=${snapshotVersion ?? 'latest'}, valuePriorityMode=${normalizedValuePriorityMode}`);

        const currentPeriod = await currentPeriodService.getCurrentPeriod();
        const snapshotCacheScope = useHistoryDb ? `SNAP_${snapshotVersion ?? 'LATEST'}` : 'LIVE';
        const cacheKey = cacheService.buildPayrollKey(`TAX_M_${gangCode || 'ALL'}_${gangPrefix || 'ALL'}_${snapshotCacheScope}_${normalizedValuePriorityMode}`, month, year, divisionCode, useHistoryDb);
        const shouldCache = cacheService.shouldCache(month, year, currentPeriod.month, currentPeriod.year);

        if (shouldCache) {
            const cachedData = cacheService.get(cacheKey);
            if (cachedData) {
                console.log(`[TaxReportService] Returning cached monthly tax report from memory.`);
                return cachedData;
            }
        }

        // Tax reports must preserve the requested virtual division scope.
        // The shared helper keeps fetch/filter behavior identical across report variants.
        const divisionScope = resolveTaxReportDivisionScope({ divisionCode, gangPrefix });
        const sourceDivisions = [divisionScope.fetchDivisionCode];

        console.log(`[TaxReportService] Source divisions for ${divisionCode || 'ALL'}: ${sourceDivisions.join(', ')}`);

        // Aggregated data from all sources
        const allHistoryRows: any[] = [];
        const dynamicPremiHeaders = new Set<string>();
        const dynamicPotonganHeaders = new Set<string>();
        let finalMeta: any = null;
        let finalIsSourceCurrent = false;

        for (const sourceDiv of sourceDivisions) {
            const { data: chunk, isSourceCurrent: chunkIsSourceCurrent } = await this.fetchPayrollData(
                month, year, sourceDiv, gangCode || 'ALL', gangPrefix, useHistoryDb, snapshotVersion, normalizedValuePriorityMode
            );

            if (chunk?.data_rows) {
                const filteredRows = filterTaxReportRows(chunk.data_rows, divisionScope);

                if (divisionScope.isVirtualDivision && divisionCode) {
                    console.log(`[TaxReportService] Virtual filter (${divisionCode}) on ${sourceDiv}: ${chunk.data_rows.length} -> ${filteredRows.length} rows.`);
                }

                allHistoryRows.push(...filteredRows);
                finalMeta = chunk.meta || finalMeta;
                
                // Merge dynamic headers
                if (chunk.dynamic_premi_headers) chunk.dynamic_premi_headers.forEach((h: string) => dynamicPremiHeaders.add(h));
                if (chunk.dynamic_potongan_headers) chunk.dynamic_potongan_headers.forEach((h: string) => dynamicPotonganHeaders.add(h));
            }
            
            if (chunkIsSourceCurrent) finalIsSourceCurrent = true;
        }

        console.log(`[TaxReportService] Total aggregated rows: ${allHistoryRows.length}, isSourceCurrent=${finalIsSourceCurrent}`);

        if (allHistoryRows.length === 0) {
            return { employees: [], period: { month, year }, total_pph21: 0, premiKeys: [], data_source: finalIsSourceCurrent ? 'current' : 'history', value_priority_mode: normalizedValuePriorityMode };
        }

        const historyData = {
            data_rows: allHistoryRows,
            dynamic_premi_headers: Array.from(dynamicPremiHeaders),
            dynamic_potongan_headers: Array.from(dynamicPotonganHeaders),
            meta: finalMeta || {}
        };

        const effectiveDivisionCode = divisionScope.fetchDivisionCode;

        const ptkpMaster = await ptkpTaxService.getPtkpByYear(year);
        const ptkpMap = new Map<string, string>();
        for (const p of ptkpMaster) {
            ptkpMap.set(p.emp_code.trim(), p.ptkp_status);
        }

        // Fetch jabatan from employee_estate database
        const jabatanMap = await EmployeeEstateService.getEmployeeJobs();
        const newJabatansToSave: any[] = [];

        // Fetch Other Incomes (THR, Bonus, Custom, KONTAN) for the year to get monthly breakdown
        const dbOtherIncomesYear = await OtherIncomesService.getIncomesForYear(year, effectiveDivisionCode, gangCode);
        const dbIncomeByMonthNik = new Map<string, { thr: number, bonus: number, kontan: number, custom: number }>();

        for (const inc of dbOtherIncomesYear) {
            if (inc.is_taxable) {
                const nikKeys = collectNikLookupKeys(inc);
                const type = getCanonicalOtherIncomeType(inc);
                const amt = Number(inc.amount) || 0;

                for (const nik of nikKeys) {
                    const monthKey = `${inc.period_month}_${nik}`;
                    if (!dbIncomeByMonthNik.has(monthKey)) dbIncomeByMonthNik.set(monthKey, { thr: 0, bonus: 0, kontan: 0, custom: 0 });
                    const mData = dbIncomeByMonthNik.get(monthKey)!;

                    // Map income types correctly: THR, KONTAN/KONTANAN, BONUS/EXGRATIA, CUSTOM
                    if (type === 'THR') { mData.thr += amt; }
                    else if (type === 'KONTAN') { mData.kontan += amt; }
                    else if (type === 'BONUS') { mData.bonus += amt; }
                    else { mData.custom += amt; }
                }
            }
        }

        let totalPph21 = 0;
        
        // [DE-DUPLICATION] Use a Map to ensure each employee is counted only once
        // This prevents doubled totals if history data contains overlapping master headers.
        const employeeMap = new Map<string, any>();
        for (const r of historyData.data_rows) {
            const hk = Number(r.jumlah_hk || r.hk || 0);
            const hasIncome = Number(r.jumlah_upah_kotor || 0) > 0;
            
            if (hk > 0 || hasIncome) {
                // Prefer stable person identity so old/new emp_code rows do not double-count one employee.
                const identity = resolveReportIdentity(r);
                const key = String(identity.new_nik || identity.nik || r.actual_nik || r.nik || r.emp_code || '').trim().toUpperCase();
                if (key) {
                    // If multiple records exist, we keep the latest one (or first one found)
                    // In history database, rows are usually sorted by ID, so last one is most recent.
                    employeeMap.set(key, r);
                }
            }
        }

        const activeRows = Array.from(employeeMap.values());
        console.log(`[TaxReportService] De-duplicated ${historyData.data_rows.length} rows down to ${activeRows.length} unique employees.`);

        const mappedEmployees: MonthlyTaxRow[] = activeRows.map((row: any, idx: number) => {
            const empCodeTrimmed = row.emp_code?.trim() || '';
            const masterPtkp = ptkpMap.get(empCodeTrimmed) || row.status_ptkp || 'TK/0';
            const kategoriTer = mapPTKPToTER(masterPtkp);

            // [DEBUG] Log first row's available fields to understand data structure
            if (idx === 0) {
                console.log(`[TAX_REPORT_DEBUG] First row keys:`, Object.keys(row).filter(k => k.includes('pph') || k.includes('ptkp') || k.includes('beras') || k.includes('status')));
                console.log(`[TAX_REPORT_DEBUG] First row pph21_ter=${row.pph21_ter}, status_ptkp=${row.status_ptkp}, beras_rate=${row.beras_rate}`);
            }

            // Fetch breakdown for pure calculation
            const gajiPokokAktual = row.gaji_pokok_aktual || row.gaji_pokok || 0;
            const upahDasar = row.upah_dasar || 0;
            const tunjanganBeras = row.beras_jumlah || 0;
            const tunjanganJabatan = resolveAdjustedJabatanJumlah(
                row,
                { month, year, divisionCode: effectiveDivisionCode },
                row.jabatan_jumlah || 0
            );
            const tunjanganMasaKerja = row.masa_kerja_jumlah || 0;
            const tunjanganLembur = row.lembur_jumlah || 0;
            const totalPremi = row.total_premi || 0;

            // [CENTRALIZED] Calculate ASTEK 0.84% and BPJS Kes 4% from carumanDefinitions
            const pph21Caruman = getCarumanForPph21(upahDasar, tunjanganMasaKerja);
            const astek084 = pph21Caruman.astek_majikan_084;
            const bpjsKesehatanMajikan4Pct = pph21Caruman.bpjs_kes_majikan_4;
            const carumanBase = pph21Caruman.base;

            // [CRITICAL ALIGNMENT] Use values EXACTLY from UI Daftar Upah (DataExtractorService / History)
            // pph21_ter = recalculated PPh21 via TER method (What the UI shows in the PPh21 cell)
            // pot_pph21 = actual PPh21 deduction from PR_ADTRANS (synchronized deduction)
            // penghasilan_bruto = calculated in DataExtractor Phase 4b (same as UI)
            const penghasilanBruto = Number(row.penghasilan_bruto) || 0;
            // [FIXED 2026-04-08] Prioritize pph21_ter to match UI "Pajak" column exactly
            const pph21 = Number(row.pph21_ter) || Number(row.pot_pph21) || 0;
            const potPph21Input = shouldForcePotPph21ToTer(row, { month, year, divisionCode: effectiveDivisionCode })
                ? pph21
                : Number(row.pot_pph21) || 0;
            const tarifPajakTer = Number(row.tarif_pajak_ter) || 0;
            const storedStatusPtkp = row.status_ptkp || masterPtkp;
            attachPayrollPeriodAdjustmentNotes(row, { month, year, divisionCode: effectiveDivisionCode });

            totalPph21 += pph21;

            const reportIdentity = resolveReportIdentity(row);
            const rawEmpNikForBonus = String(reportIdentity.new_nik || reportIdentity.nik || row.nik_ktp || row.nik || '').trim().toUpperCase();

            // [DEBUG] Always log every employee's pph21 for comparison
            if (idx < 5) {
                console.log(`[TAX_REPORT_DEBUG] [${idx}] ${row.emp_code || row.nik}: pot_pph21=${row.pot_pph21 || 'N/A'}, pph21_ter=${row.pph21_ter || 'N/A'}, USED=${pph21}, bruto=${penghasilanBruto}, PTKP=${storedStatusPtkp}, tarif=${tarifPajakTer}`);
            }

            // [ALIGNMENT] Use other_incomes already attached to the row if available
            // If not available (e.g. from history which might have stripped it), fallback to DB fetch
            let empOtherIncomes = row.other_incomes || [];
            
            if (empOtherIncomes.length === 0) {
                // Fetch other incomes from the yearly map if not already in the row
                for (const inc of dbOtherIncomesYear) {
                    const incNikKeys = collectNikLookupKeys(inc);
                    if (incNikKeys.includes(rawEmpNikForBonus) && inc.period_month === month) {
                        empOtherIncomes.push({
                            type: inc.income_type || '',
                            name: inc.income_name || inc.income_type || '',
                            amount: Number(inc.amount) || 0
                        });
                    }
                }
            }

            const empThrAmount = sumOtherIncomeByCanonicalType(empOtherIncomes, 'THR')
                || Number(row.pendapatan_thr || row.taxable_pendapatan_thr || row.thr_amount || 0);
            const empKontanAmount = sumOtherIncomeByCanonicalType(empOtherIncomes, 'KONTAN')
                || Number(row.pendapatan_kontan || row.taxable_pendapatan_kontan || row.kontanan_amount || 0);
            const bonusDirect = Number(row.pendapatan_bonus || row.taxable_pendapatan_bonus || row.bonus || row.bonus_amount || 0);
            const exgratiaSeparate = Number(row.pendapatan_exgratia || row.taxable_pendapatan_exgratia || 0);
            const exgratiaAlias = bonusDirect === 0 ? Number(row.exgratia_amount || 0) : 0;
            const empBonusAmount = sumOtherIncomeByCanonicalType(empOtherIncomes, 'BONUS')
                || (bonusDirect + exgratiaSeparate + exgratiaAlias);
            const empOtherIncomeAmount = empOtherIncomes
                .filter((i: any) => {
                    const type = getCanonicalOtherIncomeType(i);
                    return !['THR', 'KONTAN', 'BONUS'].includes(type);
                })
                .reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);

            // ============================================================
            // Build premiDetail: extract ALL individual premi items
            // Sources: row.premi (nested object from DataExtractor), 
            //          row.premi_detail (from history DB), 
            //          row.premi_* (flattened top-level fields)
            // BRONDOL sub-keys are consolidated into single BRONDOL.
            // NO "LAINNYA" catch-all — every premi gets its own column.
            // ============================================================
            const premiDetail: Record<string, number> = {};

            // Keys that should be consolidated into single BRONDOL
            const brondolSubKeys = ['BRONDOL LOOSEFRUIT', 'BRONDOL TOTAL', 'BRONDOL ADTRANS',
                                     'BRONDOL_LOOSEFRUIT', 'BRONDOL_TOTAL', 'BRONDOL_ADTRANS',
                                     'brondol_loosefruit', 'brondol_total', 'brondol_adtrans',
                                     'brondol loosefruit', 'brondol total', 'brondol adtrans'];
            // Keys to skip entirely (internal/meta)
            const skipKeys = ['koreksi', 'KOREKSI', 'total', 'TOTAL'];
            let consolidatedBrondol = 0;
            let hasBrondolFromDetail = false;

            // Helper: normalize a premi key to uppercase label
            const normalizePremiKey = (key: string): string => {
                return String(key).toUpperCase().replace(/_/g, ' ').trim();
            };

            // Helper: check if a key is a brondol sub-key
            const isBrondolSubKey = (key: string): boolean => {
                const upper = normalizePremiKey(key);
                return brondolSubKeys.some(bk => upper === bk.toUpperCase());
            };

            // SOURCE 1: row.premi (nested object from DataExtractor Phase 3)
            // Contains keys like 'pruning', 'angkut_material', 'harvesting', 'brondol', etc.
            if (row.premi && typeof row.premi === 'object' && !Array.isArray(row.premi)) {
                for (const [key, value] of Object.entries(row.premi)) {
                    const val = Number(value) || 0;
                    if (val <= 0) continue;
                    if (skipKeys.includes(key)) continue;

                    const upperKey = normalizePremiKey(key);

                    // Consolidate brondol sub-keys
                    if (isBrondolSubKey(key)) {
                        consolidatedBrondol += val;
                        continue;
                    }
                    // 'brondol' key itself → add to consolidatedBrondol
                    if (upperKey === 'BRONDOL') {
                        consolidatedBrondol += val;
                        hasBrondolFromDetail = true;
                        continue;
                    }

                    premiDetail[upperKey] = (premiDetail[upperKey] || 0) + val;
                }
            }

            // SOURCE 2: row.premi_detail (from history database — object or JSON string)
            // Contains keys like 'BRONDOL', 'PRUNING', 'HARVESTING', etc.
            const rawPremiDetail = row.premi_detail;
            let parsedPremiDetail: Record<string, any> | null = null;

            if (rawPremiDetail && typeof rawPremiDetail === 'object' && !Array.isArray(rawPremiDetail)) {
                parsedPremiDetail = rawPremiDetail;
            } else if (rawPremiDetail && typeof rawPremiDetail === 'string') {
                try { parsedPremiDetail = JSON.parse(rawPremiDetail); } catch (_) {}
            }

            if (parsedPremiDetail) {
                for (const [key, value] of Object.entries(parsedPremiDetail)) {
                    const val = Number(value) || 0;
                    if (val <= 0) continue;
                    if (skipKeys.includes(key)) continue;

                    const upperKey = normalizePremiKey(key);

                    if (isBrondolSubKey(key)) {
                        consolidatedBrondol += val;
                        continue;
                    }
                    if (upperKey === 'BRONDOL') {
                        // Only add if not already counted from row.premi
                        if (!hasBrondolFromDetail) {
                            consolidatedBrondol += val;
                            hasBrondolFromDetail = true;
                        }
                        continue;
                    }

                    // Only add if not already set from row.premi (avoid double-counting)
                    if (!premiDetail[upperKey]) {
                        premiDetail[upperKey] = val;
                    }
                }
            }

            // SOURCE 3: row.premi_* flattened top-level fields (fallback for live data)
            // e.g. row.premi_pruning, row.premi_harvesting, row.premi_angkut_material, etc.
            if (Object.keys(premiDetail).length === 0) {
                // Only use flattened fields if we got nothing from nested sources
                for (const [key, value] of Object.entries(row)) {
                    if (!key.startsWith('premi_')) continue;
                    if (key === 'premi_brondol' || key === 'premi_pph' || key === 'premi_detail' || key === 'premi_koreksi') continue;
                    const val = Number(value) || 0;
                    if (val <= 0) continue;

                    const label = normalizePremiKey(key.replace(/^premi_/, ''));
                    if (isBrondolSubKey(label)) {
                        consolidatedBrondol += val;
                        continue;
                    }
                    if (label === 'BRONDOL') {
                        if (!hasBrondolFromDetail) consolidatedBrondol += val;
                        continue;
                    }
                    if (!premiDetail[label]) {
                        premiDetail[label] = val;
                    }
                }
            }

            // BRONDOL: use consolidated value, fallback to row.premi_brondol
            const brondolFinal = consolidatedBrondol > 0 ? consolidatedBrondol : (row.premi_brondol || 0);
            if (brondolFinal > 0) {
                premiDetail['BRONDOL'] = brondolFinal;
            }

            // Resolve jabatan: DB first → auto-derive from gang code
            const empCodeTrimmedJabatan = (row.emp_code || '').trim();
            let resolvedJabatan = jabatanMap[empCodeTrimmedJabatan] || '';
            if (!resolvedJabatan) {
                resolvedJabatan = deriveJabatanFromGang(row.gang_code || '');
                // Store in map so it can be saved later
                jabatanMap[empCodeTrimmedJabatan] = resolvedJabatan;
                newJabatansToSave.push({
                    empcode: empCodeTrimmedJabatan,
                    employee_name: row.nama || row.emp_name || '',
                    gang: row.gang_code || '',
                    divisi_id: effectiveDivisionCode,
                    jabatan: resolvedJabatan
                });
            }

            // Extract parent name from parentheses (e.g., "JOHN DOE (JANE DOE)")
            const rawName = row.nama || row.emp_name || '';
            const { empName, parentName } = extractParentName(rawName);

            return {
                no: idx + 1,
                emp_code: row.emp_code,
                emp_name: empName,
                parent_name: parentName,
                nik: reportIdentity.nik,
                new_nik: reportIdentity.new_nik,
                npwp: reportIdentity.npwp,
                alamat: reportIdentity.alamat,
                jabatan: resolvedJabatan,
                gender: String(row.jenis_kelamin || row.gender || '1'),
                status_ptkp: masterPtkp,
                kategori_ter: kategoriTer,
                gang_code: row.gang_code || '',
                upah_kotor: row.upah_kotor || row.jumlah_upah_kotor || 0,
                penghasilan_bruto: row.penghasilan_bruto || penghasilanBruto,
                tarif_pajak_ter: row.tarif_pajak_ter || tarifPajakTer,
                pph21_ter: pph21,
                // pot_pph21 is the actual PPh21 deduction from PR_ADTRANS (matches Daftar Upah column)
                pot_pph21: potPph21Input,
                component_metadata: TAX_COMPONENT_METADATA,

                // Detailed breakdowns
                hk: row.jumlah_hk || row.hk || 0,
                gaji_pokok_aktual: gajiPokokAktual,
                koreksi_hk: row.koreksi_hk || 0,

                tunjangan_beras: tunjanganBeras,
                tunjangan_jabatan: tunjanganJabatan,
                tunjangan_masa_kerja: tunjanganMasaKerja,
                tunjangan_lembur: tunjanganLembur,
                total_tunjangan: row.total_tunjangan || 0,

                premi_detail: premiDetail,
                premi_brondol: row.premi_brondol || 0,
                premi_pph: row.premi_pph || 0,
                total_premi: totalPremi,

                pot_spsi: row.pot_spsi || 0,
                pot_koreksi: row.pot_koreksi || 0,
                total_potongan_kotor: row.pot_koreksi || 0,

                bpjs_kes_majikan: bpjsKesehatanMajikan4Pct,
                astek_jht_majikan: astek084,

                other_incomes: empOtherIncomes,
                thr_amount: empThrAmount,
                exgratia_amount: empBonusAmount,
                bonus_amount: empBonusAmount,
                kontanan_amount: empKontanAmount,
                pendapatan_thr: empThrAmount,
                pendapatan_bonus: empBonusAmount,
                pendapatan_kontan: empKontanAmount,
                taxable_pendapatan_lainnya: empThrAmount + empBonusAmount + empKontanAmount + empOtherIncomeAmount,
                other_income_amount: empOtherIncomeAmount,
                pendapatan_tidak_tetap_thp: empThrAmount + empBonusAmount + empKontanAmount + empOtherIncomeAmount,
                upah_dasar: upahDasar,
                gaji_pokok_ideal: row.gaji_pokok_ideal || 0,
                carumanBase: carumanBase,
                period_adjustments: row.period_adjustments
            };
        });

        const employees: MonthlyTaxRow[] = sortAndRenumberByEmpCode(mappedEmployees);

        // Collect all unique premi keys across all employees
        // premiDetail already contains clean, normalized keys (no LAINNYA, no brondol sub-keys)
        const premiKeySet = new Set<string>();
        for (const emp of employees) {
            if (emp.premi_detail) {
                for (const k of Object.keys(emp.premi_detail)) {
                    premiKeySet.add(k);
                }
            }
        }
        // Sort: BRONDOL first, then alphabetical
        const premiKeys = Array.from(premiKeySet).sort((a, b) => {
            if (a === 'BRONDOL') return -1;
            if (b === 'BRONDOL') return 1;
            return a.localeCompare(b);
        });

        // Async save any newly derived jabatans to DB
        if (newJabatansToSave.length > 0) {
            EmployeeEstateService.saveEmployeeJobs(newJabatansToSave).catch(e =>
                console.error('[TaxReport] Failed to auto-save derived jabatans:', e)
            );
        }

        const sumMonthly = (selector: (emp: MonthlyTaxRow) => number): number =>
            Math.round(employees.reduce((s, emp) => s + (selector(emp) || 0), 0));

        const monthlyTableTotals = {
            hk: sumMonthly(emp => Number(emp.hk) || 0),
            upah_dasar: sumMonthly(emp => Number(emp.upah_dasar) || 0),
            gaji_pokok_ideal: sumMonthly(emp => Number(emp.gaji_pokok_ideal) || 0),
            gaji_standar: sumMonthly(emp => (Number(emp.upah_dasar) || 0) * 30),
            gaji_pokok_aktual: sumMonthly(emp => Number(emp.gaji_pokok_aktual) || 0),
            koreksi_hk: 0,
            pendapatan_tidak_tetap_thp: sumMonthly(emp => Number(emp.pendapatan_tidak_tetap_thp) || 0),
            upah_kotor: sumMonthly(emp => Number(emp.upah_kotor) || 0),
            penghasilan_bruto: sumMonthly(emp => Number(emp.penghasilan_bruto) || 0),
            pph21_input: sumMonthly(emp => Number(emp.pot_pph21) || 0),
            pph21_ter: sumMonthly(emp => Number(emp.pph21_ter) || 0)
        };

        const finalResult = {
            employees,
            period: { month, year },
            total_pph21: totalPph21,
            total_pot_pph21: monthlyTableTotals.pph21_input,
            premiKeys,
            data_source: finalIsSourceCurrent ? 'current' : 'history',
            value_priority_mode: normalizedValuePriorityMode,
            snapshot_version: historyData.meta?.snapshot_version ?? null,
            requested_snapshot_version: historyData.meta?.requested_snapshot_version ?? null,
            available_snapshot_versions: historyData.meta?.available_snapshot_versions ?? [],
            summary: {
                employee_count: employees.length,
                monthly_table_totals: monthlyTableTotals,
                pph21: {
                    input: monthlyTableTotals.pph21_input,
                    ter: monthlyTableTotals.pph21_ter,
                    selisih: monthlyTableTotals.pph21_ter - monthlyTableTotals.pph21_input
                }
            }
        };

        if (shouldCache) {
            const ttl = cacheService.getPayrollCacheTtl(month, year, currentPeriod.month, currentPeriod.year);
            cacheService.set(cacheKey, finalResult, ttl);
        }

        console.log(`[TaxReportService] getMonthlyTaxReport returning: ${employees.length} employees, total_pph21=${totalPph21}, data_source=${finalIsSourceCurrent ? 'current' : 'history'}`);
        return finalResult;
    }

    /**
     * Get annual tax report - aggregate 12 months of income data
     */
    public async getAnnualTaxReport(
        year: number,
        targetMonth?: number,
        divisionCode?: string,
        gangCode?: string,
        gangPrefix?: string
    ): Promise<any> {
        return TaxReportAnnualService.getInstance().getAnnualTaxReport(year, targetMonth, divisionCode, gangCode, gangPrefix);
    }

    /**
     * Get annual ASTEK & BPJS report - per month per employee
     */
    public async getAnnualAstekBpjsReport(
        year: number,
        targetMonth?: number,
        divisionCode?: string,
        gangCode?: string,
        gangPrefix?: string
    ): Promise<any> {
        return TaxReportAnnualService.getInstance().getAnnualAstekBpjsReport(year, targetMonth, divisionCode, gangCode, gangPrefix);
    }

    public async getDecemberTaxReport(
        year: number,
        divisionCode?: string,
        gangCode?: string,
        gangPrefix?: string
    ): Promise<any> {
        return TaxReportAnnualService.getInstance().getDecemberTaxReport(year, divisionCode, gangCode, gangPrefix);
    }
}

export const taxReportService = TaxReportService.getInstance();
