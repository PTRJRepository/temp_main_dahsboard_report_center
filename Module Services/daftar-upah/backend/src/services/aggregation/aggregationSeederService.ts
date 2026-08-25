/**
 * AggregationSeederService - business logic for seeding/validating
 * daftar_upah_aggregation_history (extend_db_ptrj).
 *
 * Extracted from api/aggregationSeederRoutes.ts + api/parallelAggregationSeeder.ts:
 * routes now only parse params/auth and delegate here.
 */

import { Database } from "../../db/client";
import { info, warn, error as logError } from "../../utils/logger";
import { Config } from "../../config";
import { divisionConfigService } from "../config/DivisionConfigService";
import { dataExtractorService } from "../dataExtractorService";
import {
    PayrollDataService,
    AggregationRecord
} from "../payrollDataService";

const CATEGORY = "AggregationSeederService";

export interface SeedResult {
    division: string;
    gang: string;
    employees_processed: number;
    status: string;
}

// ---------------------------------------------------------------------------
// Progress tracker (single shared instance for sequential + parallel seeders)
// ---------------------------------------------------------------------------

export interface SeederProgressState {
    is_running: boolean;
    current_division: string;
    current_gang: string;
    divisions_total: number;
    divisions_done: number;
    current_batch: number;
    total_batches: number;
    started_at: string | null;
    last_update: string;
    message: string;
}

export const seederProgress: SeederProgressState = {
    is_running: false,
    current_division: '',
    current_gang: '',
    divisions_total: 0,
    divisions_done: 0,
    current_batch: 0,
    total_batches: 0,
    started_at: null,
    last_update: '',
    message: 'Idle'
};

export function updateProgress(update: Partial<SeederProgressState>) {
    Object.assign(seederProgress, update, { last_update: new Date().toISOString() });
    info(CATEGORY, `[SeederProgress] ${update.message || update.current_division || 'Updating...'}`);
}

export function getProgress(): SeederProgressState {
    return { ...seederProgress };
}

// ---------------------------------------------------------------------------
// Division code mapping: internal payroll code -> DB standardized code
// ---------------------------------------------------------------------------

const DIVISION_CODE_MAP: Record<string, string> = {
    "PG1A": "P1A", "PG1B": "P1B", "PG2A": "P2A", "PG2B": "P2B",
    "ARB1": "AB1", "ARB2": "AB2",
    "INFRA": "INF", "ARC": "ARC",
    // Ensure 3-letter codes map to themselves or remain as is if not in list
    "DME": "DME", "ARA": "ARA", "IJL": "IJL", "MILL": "MILL"
};

export function toDbDivisionCode(division: string): string {
    return DIVISION_CODE_MAP[division] || division;
}

// ---------------------------------------------------------------------------
// Aggregation persistence (DELETE-then-INSERT, idempotent)
// ---------------------------------------------------------------------------

/**
 * APPEND-STYLE: replace the aggregation row for one gang/period.
 *
 * IMPORTANT: Data Append-Only Pattern (Immutable History)
 * - Selalu INSERT record baru setelah DELETE targeted per gang.
 * - Kenapa: agar idempotent — seeding berulang menghasilkan state yang sama,
 *   dan riwayat periode lain tidak tersentuh.
 */
async function insertOrUpdateAggregation(
    division: string,
    month: number,
    year: number,
    aggregation: AggregationRecord,
    sourceEndpoint: string
) {
    const db = Database.getExtendedInstance();

    const dbDivisionCode = toDbDivisionCode(division);

    try {
        await db.query(`
            DELETE FROM dbo.daftar_upah_aggregation_history
            WHERE period_month = ? AND period_year = ? AND division_code = ? AND gang_code = ?
        `, [month, year, dbDivisionCode, aggregation.gang_code]);

        await db.query(`
            INSERT INTO dbo.daftar_upah_aggregation_history (
                period_month, period_year, division_code, gang_code, gang_description,
                total_employees, total_hk, total_hari_kerja,
                total_cuti_tahunan, total_cuti_sakit, total_cuti_minggu, total_cuti_nasional,
                total_upah_dasar, total_upah_pokok, total_gaji_pokok,
                total_beras, total_jabatan, total_masa_kerja, total_lembur, total_tunjangan,
                total_premi_brondol, total_premi_prunning, total_premi_insentif, total_premi_kinerja, total_premi,
                total_potongan, total_pph21, total_bpjs_pekerja, total_bpjs_majikan, total_spsi,
                total_upah_kotor, total_upah_bersih, total_ffb_weight, total_weight_tbs,
                dynamic_premi_data, informasi_tambahan, total_koreksi,
                created_at, updated_at, source_endpoint
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, GETDATE(), GETDATE(), ?
            )
        `, [
            month,
            year,
            dbDivisionCode,
            aggregation.gang_code,
            aggregation.gang_description,
            aggregation.total_employees,
            aggregation.total_hk,
            aggregation.total_hari_kerja,
            aggregation.total_cuti_tahunan,
            aggregation.total_cuti_sakit,
            aggregation.total_cuti_minggu,
            aggregation.total_cuti_nasional,
            aggregation.total_upah_dasar,
            aggregation.total_upah_pokok,
            aggregation.total_gaji_pokok,
            aggregation.total_beras,
            aggregation.total_jabatan,
            aggregation.total_masa_kerja,
            aggregation.total_lembur,
            aggregation.total_tunjangan,
            aggregation.total_premi_brondol,
            aggregation.total_premi_prunning,
            aggregation.total_premi_insentif,
            aggregation.total_premi_kinerja,
            aggregation.total_premi,
            aggregation.total_potongan,
            aggregation.total_pph21,
            aggregation.total_bpjs_pekerja,
            aggregation.total_bpjs_majikan,
            aggregation.total_spsi,
            aggregation.total_upah_kotor,
            aggregation.total_upah_bersih,
            aggregation.total_ffb_weight,
            aggregation.total_weight_tbs,
            aggregation.dynamic_premi_data,
            aggregation.informasi_tambahan,
            aggregation.total_koreksi,
            sourceEndpoint
        ]);
    } catch (error) {
        logError(CATEGORY, "[InsertAggregation] Error:", error);
        throw error;
    }
}

/**
 * Cleanup existing aggregation rows for the given divisions/period.
 */
export async function cleanupAggregations(divisions: string[], month: number, year: number): Promise<void> {
    const db = Database.getExtendedInstance();
    for (const div of divisions) {
        const dbDivisionCode = toDbDivisionCode(div);
        info(CATEGORY, `[AggregationSeeder] Cleaning existing data for ${dbDivisionCode} (${month}/${year})...`);
        try {
            const deleteResult = await db.query(`
                DELETE FROM dbo.daftar_upah_aggregation_history
                WHERE period_month = ? AND period_year = ? AND division_code = ?
            `, [month, year, dbDivisionCode]);

            const deletedCount = (deleteResult as any)?.rowsAffected ?? 0;
            if (deletedCount > 0) {
                info(CATEGORY, `[AggregationSeeder] ✅ Deleted ${deletedCount} existing record(s) for ${dbDivisionCode}`);
            }
        } catch (deleteError: any) {
            warn(CATEGORY, `[AggregationSeeder] ⚠️ Failed to cleanup ${dbDivisionCode}:`, deleteError.message);
        }
    }
}

// ---------------------------------------------------------------------------
// MILL data (VenusHR, SERVER_PROFILE_3)
// ---------------------------------------------------------------------------

/**
 * Fetch Mill Data from VenusHR database (SERVER_PROFILE_3).
 * Returns a complete AggregationRecord for the MILL_GENERAL pseudo-gang.
 */
export async function fetchMillData(month: number, year: number): Promise<AggregationRecord> {
    const db = Database.getVenusInstance();
    const monthStr = month.toString().padStart(2, '0');
    const pyNumberPattern = `PYW/PTRJ/${year}${monthStr}%`;

    info(CATEGORY, `[AggregationSeeder] Fetching MILL data for pattern: ${pyNumberPattern}`);

    // 1. Get Total HK and Employees
    // Using provided logic: (Total_Data_Karyawan * DaysInMonth) - (Total_Mangkir + Total_Unpaid_Leave + Total_Sakit_With_Note)
    const hkQuery = `
        SELECT
            (Total_Data_Karyawan * DaysInMonth) - (Total_Mangkir + Total_Unpaid_Leave + Total_Sakit_With_Note) AS total_HK,
            Total_Data_Karyawan AS total_employees
        FROM (
            SELECT
                COUNT([EmployeeID]) AS Total_Data_Karyawan,
                SUM(ISNULL([TAAbsence], 0)) AS Total_Mangkir,
                SUM(ISNULL([UnpaidLeave], 0)) AS Total_Unpaid_Leave,
                SUM(ISNULL([TASick], 0)) AS Total_Sakit_With_Note,
                DAY(EOMONTH(CAST(SUBSTRING(MAX([PYNumber]), 10, 6) + '01' AS DATE))) AS DaysInMonth
            FROM [dbo].[HR_T_PYWeekly_M]
            WHERE [PYNumber] LIKE ?
        ) AS Subquery;
    `;

    const hkResult = await db.queryOne<{ total_HK: number; total_employees: number }>(hkQuery, [pyNumberPattern]);

    // 2. Get Gaji Bersih (Net Salary) - IsTakeHomePay = 1
    const salaryQuery = `
        SELECT CAST(ROUND(SUM(CAST([CompAmount] AS DECIMAL(18,2))), 0) AS BIGINT) AS TotalCompAmount
        FROM [dbo].[HR_T_PYWeekly_DComponent]
        WHERE [PYNumber] LIKE ?
          AND [IsTakeHomePay] = 1
    `;
    const salaryResult = await db.queryOne<{ TotalCompAmount: number }>(salaryQuery, [pyNumberPattern]);

    // 3. PPh21 / 4. SPSI / 5. Overtime / 6. Gaji Pokok
    const compQuery = (compFilter: string) => `
        SELECT CAST(ROUND(SUM(ABS(CAST([CompAmount] AS DECIMAL(18,2)))), 0) AS BIGINT) AS totalCount
        FROM [dbo].[HR_T_PYWeekly_DComponent]
        WHERE [PYNumber] LIKE ?
          AND ${compFilter}
    `;
    const pphResult = await db.queryOne<{ totalCount: number }>(compQuery(`[PYCompCode] LIKE '#PPH21%'`), [pyNumberPattern]);
    const spsiResult = await db.queryOne<{ totalCount: number }>(compQuery(`[PYCompCode] LIKE '#POT_spsi%'`), [pyNumberPattern]);
    const otResult = await db.queryOne<{ totalCount: number }>(compQuery(`[PYCompCode] LIKE '%#OT%'`), [pyNumberPattern]);

    const gpQuery = compQuery(`[PYCompCode] = '#GP#'`);
    const gpResult = await db.queryOne<{ totalCount: number }>(gpQuery, [pyNumberPattern]);

    // 7. Total Deductions (negative components with IsTakeHomePay=1)
    const dedQuery = `
        SELECT CAST(ROUND(SUM(CASE WHEN TRY_CAST([CompAmount] AS DECIMAL(18,2)) < 0
                              THEN ABS(TRY_CAST([CompAmount] AS DECIMAL(18,2)))
                              ELSE 0 END), 0) AS BIGINT) AS totalCount
        FROM [dbo].[HR_T_PYWeekly_DComponent]
        WHERE [PYNumber] LIKE ?
          AND [IsTakeHomePay] = 1
    `;
    const dedResult = await db.queryOne<{ totalCount: number }>(dedQuery, [pyNumberPattern]);

    // Ensure all values are proper numbers (not BigInt or strings from gateway)
    const bersih = Number(salaryResult?.TotalCompAmount) || 0;
    const pph21 = Math.abs(Number(pphResult?.totalCount) || 0);
    const spsi = Math.abs(Number(spsiResult?.totalCount) || 0);
    const lembur = Math.abs(Number(otResult?.totalCount) || 0);
    const gp = Number(gpResult?.totalCount) || 0;
    const deductions = Math.abs(Number(dedResult?.totalCount) || 0);

    info(CATEGORY, `[fetchMillData] Processed values:`, { bersih, pph21, spsi, lembur, gp, deductions });

    return {
        total_hk: Number(hkResult?.total_HK) || 0,
        total_employees: Number(hkResult?.total_employees) || 0,
        total_upah_bersih: bersih,  // net/gaji bersih (from IsTakeHomePay=1)
        total_upah_kotor: bersih + deductions,  // gross = net + deductions
        total_pph21: pph21,
        total_spsi: spsi,
        total_lembur: lembur,
        total_gaji_pokok: gp,
        total_potongan: deductions,  // total deductions
        total_tunjangan: 0,  // Not available separately in MILL data
        total_upah_dasar: gp,
        total_upah_pokok: gp,
        gang_code: "MILL_GENERAL",
        gang_description: "General Mill Operations",
        total_hari_kerja: Number(hkResult?.total_HK) || 0,
        total_cuti_tahunan: 0, total_cuti_sakit: 0, total_cuti_minggu: 0, total_cuti_nasional: 0,
        total_beras: 0, total_jabatan: 0, total_masa_kerja: 0,
        total_premi_brondol: 0, total_premi_prunning: 0, total_premi_insentif: 0, total_premi_kinerja: 0, total_premi: 0,
        total_bpjs_pekerja: 0, total_bpjs_majikan: 0,
        total_ffb_weight: 0, total_weight_tbs: 0,
        dynamic_premi_data: "[]", informasi_tambahan: "Source: VenusHR", total_koreksi: 0
    };
}

// ---------------------------------------------------------------------------
// FFB tonase (db_ptrj_mill)
// ---------------------------------------------------------------------------

async function fetchFfbWeightForDivision(divisionCode: string, month: number, year: number): Promise<number> {
    try {
        const db = Database.getMillInstance();

        const searchCode = toDbDivisionCode(divisionCode);
        const matchPattern = `%${searchCode}%`;

        const result = await db.queryOne<{ total_weight: string }>(`
            SELECT SUM(CAST(T.[NetWeight] AS DECIMAL(18,2))) / 1000.0 AS total_weight
            FROM [dbo].[WM_TICKET] T
            LEFT JOIN [dbo].[PU_SUPPLIER] S ON T.[CustomerCode] = S.[SupplierCode]
            WHERE T.[CustomerCode] IN ('PTRJ01','PTRJ02','PTRJ03','PTRJ04','PTRJ05','PTRJ06','PTRJ07','PTRJ08','PTRJ09')
              AND MONTH(T.[DateReceived]) = ?
              AND YEAR(T.[DateReceived]) = ?
              AND T.[ProductCode] = 'FFB'
              AND (S.[Name] LIKE ? OR T.[CustomerCode] LIKE ?)
        `, [month, year, matchPattern, matchPattern]);

        if (result && result.total_weight) {
            const weight = parseFloat(result.total_weight);
            info(CATEGORY, `[FFB] ${divisionCode} (mapped: ${searchCode}): ${weight.toFixed(2)} tons`);
            return weight;
        }

        info(CATEGORY, `[FFB] ${divisionCode}: No data found`);
        return 0;
    } catch (error: any) {
        if (error.message?.includes('Invalid object name') || error.message?.includes('does not exist')) {
            warn(CATEGORY, `[FFB] WM_TICKET/PU_SUPPLIER table not found in db_ptrj_mill, using 0`);
        } else {
            logError(CATEGORY, `[FFB] Failed to fetch weight for ${divisionCode}:`, error.message);
        }
        return 0;
    }
}

// ponytail: fetchFfbWeightForDivision currently unused by routes; kept as the
// single FFB-per-division helper — wire in or delete when tonase flow changes.

// ---------------------------------------------------------------------------
// Sequential seeding (legacy fallback path)
// ---------------------------------------------------------------------------

export async function getAvailableDivisions(): Promise<string[]> {
    const allDivisions = divisionConfigService.getAllDivisionCodes(true); // include virtual
    return [...allDivisions, 'MILL']; // MILL is special
}

async function triggerHistorySeeding(div: string, month: number, year: number): Promise<void> {
    if (div === 'MILL') return;
    info(CATEGORY, `[AggregationSeeder] Auto-triggering history seeder for ${div}...`);
    const { historySeederService } = await import("../historySeederService");
    await historySeederService.seedPayrollHistory({
        periodMonth: month,
        periodYear: year,
        divisionCode: div,
        createdBy: 'aggregation-seeder',
        seederMode: 'PAYROLL',
        force: true
    });
    info(CATEGORY, `[AggregationSeeder] History seeding complete for ${div}`);
}

async function processDivisionSequential(
    div: string,
    month: number,
    year: number,
    authToken: string,
    sourceEndpoint: string,
    results: SeedResult[]
): Promise<void> {
    info(CATEGORY, `[AggregationSeeder] Processing division: ${div} (${month}/${year})`);

    // NOTE: MILL must be checked BEFORE virtual division check because
    // DivisionConfigService classifies MILL as type='virtual', but it needs special handling
    if (div === 'MILL') {
        info(CATEGORY, `[AggregationSeeder] Processing MILL division using VenusHR data...`);
        try {
            const millData = await fetchMillData(month, year);
            await insertOrUpdateAggregation(div, month, year, millData, sourceEndpoint);
            results.push({ division: div, gang: millData.gang_code, employees_processed: millData.total_employees, status: "SUCCESS" });
        } catch (e: any) {
            logError(CATEGORY, "[AggregationSeeder] MILL Error:", e);
            results.push({ division: div, gang: "MILL_GENERAL", employees_processed: 0, status: "ERROR: " + e.message });
        }
        return;
    }

    try {
        const payrollData = await PayrollDataService.fetchPayrollData(div, month, year, authToken);

        let allRecords: AggregationRecord[] = [];
        Object.values(payrollData).forEach(records => {
            allRecords = [...allRecords, ...records];
        });

        if (allRecords.length === 0) {
            info(CATEGORY, `[AggregationSeeder] No data found for ${div}`);
            results.push({ division: div, gang: "ALL", employees_processed: 0, status: "SKIPPED: No data" });
            return;
        }

        info(CATEGORY, `[AggregationSeeder] Fetched ${allRecords.length} records for ${div}`);

        let savedCount = 0;
        let totalEmployees = 0;

        for (const record of allRecords) {
            // Virtual divisions keep their own division_code rows; records are
            // mapped to the requested target regardless of source division.
            await insertOrUpdateAggregation(div, month, year, record, sourceEndpoint);
            savedCount++;
            totalEmployees += record.total_employees;
        }

        // Detailed history seeding so pages like Report Pajak have data.
        try {
            await triggerHistorySeeding(div, month, year);
        } catch (historyError: any) {
            logError(CATEGORY, `[AggregationSeeder] History seeding failed for ${div}:`, historyError.message);
        }

        results.push({
            division: div,
            gang: `Count: ${savedCount}`,
            employees_processed: totalEmployees,
            status: "SUCCESS"
        });
    } catch (error: any) {
        logError(CATEGORY, `[AggregationSeeder] Error processing ${div}:`, error);
        results.push({ division: div, gang: "ALL", employees_processed: 0, status: "ERROR: " + error.message });
    }
}

/**
 * Legacy sequential seeding path (parallel is preferred).
 */
export async function seedAggregationToDb(
    division: string | undefined,
    month: number,
    year: number,
    authToken: string,
    force: boolean = false
): Promise<{ total_divisions: number; processed: SeedResult[] }> {
    const divisions = division ? [division] : await getAvailableDivisions();
    const divisionsToProcess = division ? divisions.filter(d => d === division) : divisions;

    if (!division) {
        info(CATEGORY, `[AggregationSeeder] Bulk seeding ${divisionsToProcess.length} divisions (real + virtual): ${divisionsToProcess.join(', ')}`);
    }

    await cleanupAggregations(divisionsToProcess, month, year);

    const results: SeedResult[] = [];
    const sourceEndpoint = "raw-tree-endpoint";

    for (const div of divisionsToProcess) {
        await processDivisionSequential(div, month, year, authToken, sourceEndpoint, results);
    }

    return {
        total_divisions: results.filter(r => r.status === 'SUCCESS').length,
        processed: results
    };
}

// ---------------------------------------------------------------------------
// Validation: stored aggregation vs real-time payroll totals
// ---------------------------------------------------------------------------

export interface ValidationResult {
    success: boolean;
    month?: number;
    year?: number;
    division_code?: string;
    validation_timestamp?: string;
    division_summaries?: any[];
    discrepancies_found?: number;
    discrepancies?: any[];
    total_gangs_checked?: number;
    error?: string;
}

export async function validateAggregation(
    month: number,
    year: number,
    divisionCode: string | undefined,
    authToken: string
): Promise<ValidationResult> {
    try {
        const db = Database.getExtendedInstance();

        const aggWhereClauses = ["period_month = ?", "period_year = ?"];
        const aggParams: any[] = [month, year];
        let latestRowsFilter = "row_rank = 1";

        if (divisionCode) {
            latestRowsFilter += " AND division_code = ?";
            aggParams.push(divisionCode);
        }

        const aggQuery = `
            WITH latest_rows AS (
                SELECT
                    division_code, gang_code, gang_description,
                    total_employees, total_hk, total_upah_bersih, total_premi,
                    total_lembur, total_pph21, total_spsi, total_potongan,
                    total_premi_insentif, total_premi_kinerja, total_premi_prunning, total_koreksi,
                    ROW_NUMBER() OVER (
                        PARTITION BY period_month, period_year, gang_code
                        ORDER BY COALESCE(updated_at, created_at) DESC, id DESC
                    ) as row_rank
                FROM dbo.daftar_upah_aggregation_history
                WHERE ${aggWhereClauses.join(" AND ")}
            )
            SELECT
                division_code, gang_code, gang_description,
                total_employees, total_hk, total_upah_bersih, total_premi,
                total_lembur, total_pph21, total_spsi, total_potongan,
                total_premi_insentif, total_premi_kinerja, total_premi_prunning, total_koreksi
            FROM latest_rows
            WHERE ${latestRowsFilter}
            ORDER BY division_code, gang_code
        `;

        const storedAggregations = await db.query<any>(aggQuery, aggParams);

        // Calculate real-time totals from payroll data
        const realTimeTotals: Record<string, any> = {};
        const divisionsToValidate = divisionCode
            ? [divisionCode]
            : [...new Set(storedAggregations.map((a: any) => a.division_code))];

        for (const div of divisionsToValidate) {
            try {
                const payrollData = await PayrollDataService.fetchPayrollData(div, month, year, authToken);

                let allRecords: AggregationRecord[] = [];
                Object.values(payrollData).forEach(records => {
                    allRecords = [...allRecords, ...records];
                });

                for (const record of allRecords) {
                    const gangCode = record.gang_code;
                    if (!gangCode) continue;

                    realTimeTotals[`${div}_${gangCode}`] = {
                        division_code: div,
                        gang_code: gangCode,
                        total_employees: record.total_employees,
                        total_hk: record.total_hk,
                        total_upah_bersih: record.total_upah_bersih,
                        total_premi: record.total_premi,
                        total_lembur: record.total_lembur,
                        total_pph21: record.total_pph21,
                        total_spsi: record.total_spsi,
                        total_potongan: record.total_potongan
                    };
                }
            } catch (e) {
                logError(CATEGORY, `[Validation] Failed to fetch payroll data for ${div}:`, e);
            }
        }

        info(CATEGORY, `[Validation] Stored aggregations found: ${storedAggregations.length}`);

        const discrepancies: any[] = [];
        const tolerances: Record<string, number> = {
            total_employees: 0,      // Must be exact match
            total_hk: 0.01,          // Small floating point tolerance
            total_upah_bersih: 1,    // 1 rupiah tolerance
            total_premi: 1,
            total_lembur: 1,
            total_pph21: 1,
            total_spsi: 1,
            total_potongan: 1
        };

        for (const stored of storedAggregations) {
            const gangKey = `${stored.division_code}_${stored.gang_code}`;
            const realTime = realTimeTotals[gangKey];

            if (!realTime) {
                discrepancies.push({
                    division_code: stored.division_code,
                    gang_code: stored.gang_code,
                    status: "MISSING_IN_REALTIME",
                    message: "Gang exists in aggregation but not found in real-time payroll data"
                });
                continue;
            }

            const fieldDiscrepancies: any = {};
            for (const [field, tolerance] of Object.entries(tolerances)) {
                const storedValue = parseFloat(stored[field]) || 0;
                const realTimeValue = realTime[field] || 0;
                const diff = Math.abs(storedValue - realTimeValue);

                if (diff > tolerance) {
                    fieldDiscrepancies[field] = {
                        stored: storedValue,
                        real_time: realTimeValue,
                        difference: diff
                    };
                }
            }

            if (Object.keys(fieldDiscrepancies).length > 0) {
                discrepancies.push({
                    division_code: stored.division_code,
                    gang_code: stored.gang_code,
                    status: "DISCREPANCY_FOUND",
                    field_discrepancies: fieldDiscrepancies
                });
            }
        }

        // Gangs in real-time but not in aggregation
        for (const [, realTime] of Object.entries(realTimeTotals) as [string, any][]) {
            const exists = storedAggregations.some((s: any) =>
                s.division_code === realTime.division_code && s.gang_code === realTime.gang_code
            );
            if (!exists) {
                discrepancies.push({
                    division_code: realTime.division_code,
                    gang_code: realTime.gang_code,
                    status: "MISSING_IN_AGGREGATION",
                    message: "Gang found in real-time payroll but not in aggregation table"
                });
            }
        }

        // Division totals summary
        const divisionSummaries: any[] = [];
        for (const div of divisionsToValidate) {
            const divStored = storedAggregations.filter((a: any) => a.division_code === div);
            const divRealTime = Object.values(realTimeTotals).filter((r: any) => r.division_code === div);

            const storedTotal = divStored.reduce((sum: number, r: any) => sum + (parseFloat(r.total_upah_bersih) || 0), 0);
            const realTimeTotal = divRealTime.reduce((sum: number, r: any) => sum + (r.total_upah_bersih || 0), 0);

            divisionSummaries.push({
                division_code: div,
                stored_aggregation_total: storedTotal,
                real_time_payroll_total: realTimeTotal,
                difference: Math.abs(storedTotal - realTimeTotal),
                is_match: Math.abs(storedTotal - realTimeTotal) < 1 // Within 1 rupiah tolerance
            });
        }

        return {
            success: true,
            month,
            year,
            division_code: divisionCode || "ALL",
            validation_timestamp: new Date().toISOString(),
            division_summaries: divisionSummaries,
            discrepancies_found: discrepancies.length,
            discrepancies: discrepancies.slice(0, 100), // Limit to first 100
            total_gangs_checked: storedAggregations.length
        };
    } catch (error: any) {
        logError(CATEGORY, "[AggregationValidation] Error:", error);
        return {
            success: false,
            error: error.message || "Failed to validate aggregation",
            discrepancies: []
        };
    }
}
