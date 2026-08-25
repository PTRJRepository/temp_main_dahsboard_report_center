/**
 * @module backend/src/services/payroll/summary/summaryQueries.ts
 * @purpose DB-query free functions for summary/aggregation reports.
 * @input Database + filter args (month/year, divisionCode, gangCode, etc.)
 * @output Promise arrays of raw DB rows.
 * @depends ../../../db/client#Database
 * @sideeffect Reads via SQL Gateway (POST {DB_API_URL}/v1/query); updateGangCell writes.
 * @tests backend/src/services/summaryService.test.ts (indirect via facade)
 */

import type { Database } from "../../../db/client";

// ═══════════════════════════════════════════════════════════════════════
// SECTION: Metadata Queries (division descriptions, gang descriptions)
// ═══════════════════════════════════════════════════════════════════════

/**
 * @query selectDivisiDescriptions
 * @table Divisi_Description (extend_db_ptrj)
 * @input db
 * @output { Divisi, Description, Luas_Hektar }[]
 * @sql SELECT [Divisi], [Description], [Luas_Hektar] FROM [dbo].[Divisi_Description]
 */
export async function selectDivisiDescriptions(db: Database): Promise<any[]> {
    return await db.query<any>(
        `SELECT [Divisi], [Description], [Luas_Hektar] FROM [dbo].[Divisi_Description]`
    );
}

/**
 * @query selectHistoryGangRows
 * @table history_hr_gang (extend_db_ptrj)
 * @input db
 * @output { gang_code, loc_code, gang_description }[] distinct
 * @sql SELECT DISTINCT gang_code, loc_code, gang_description FROM dbo.history_hr_gang
 */
export async function selectHistoryGangRows(db: Database): Promise<any[]> {
    return await db.query<any>(
        `SELECT DISTINCT gang_code, loc_code, gang_description FROM dbo.history_hr_gang`
    );
}

/**
 * @query selectGangDescriptions
 * @table history_hr_gang (extend_db_ptrj)
 * @input db
 * @output { gang_code, gang_description }[] distinct, gang_code NOT NULL
 * @sql SELECT DISTINCT gang_code, gang_description FROM dbo.history_hr_gang WHERE gang_code IS NOT NULL
 */
export async function selectGangDescriptions(db: Database): Promise<{ gang_code: string; gang_description: string }[]> {
    return await db.query<{ gang_code: string; gang_description: string }>(
        `SELECT DISTINCT gang_code, gang_description FROM dbo.history_hr_gang WHERE gang_code IS NOT NULL`
    );
}

/**
 * @query selectLuasHektarFromDb
 * @table Divisi_Description (extend_db_ptrj)
 * @input db
 * @output { Divisi, Luas_Hektar }[] where Divisi IS NOT NULL
 * @sql SELECT [Divisi], [Luas_Hektar] FROM [dbo].[Divisi_Description] WHERE [Divisi] IS NOT NULL
 */
export async function selectLuasHektarFromDb(db: Database): Promise<any[]> {
    return await db.query<any>(
        `SELECT [Divisi], [Luas_Hektar] FROM [dbo].[Divisi_Description] WHERE [Divisi] IS NOT NULL`
    );
}

/**
 * @query selectDistinctPeriods
 * @table daftar_upah_aggregation_history (extend_db_ptrj)
 * @input db
 * @output { period_year, period_month }[] distinct, DESC ordered
 * @sql SELECT DISTINCT period_year, period_month FROM dbo.daftar_upah_aggregation_history ORDER BY period_year DESC, period_month DESC
 */
export async function selectDistinctPeriods(db: Database): Promise<{ period_year: number; period_month: number }[]> {
    return await db.query<{ period_year: number; period_month: number }>(
        `SELECT DISTINCT period_year, period_month FROM dbo.daftar_upah_aggregation_history ORDER BY period_year DESC, period_month DESC`
    );
}

/**
 * @query selectDistinctPeriodsByGangCodes
 * @table daftar_upah_aggregation_history (extend_db_ptrj)
 * @input db, gangCodes[]
 * @output { period_year, period_month }[] distinct filtered by gang_code IN(...), DESC ordered
 * @sql SELECT DISTINCT period_year, period_month FROM ... WHERE gang_code IN(?,?,...) ORDER BY period_year DESC, period_month DESC
 */
export async function selectDistinctPeriodsByGangCodes(
    db: Database,
    gangCodes: string[]
): Promise<{ period_year: number; period_month: number }[]> {
    const placeholders = gangCodes.map(() => '?').join(',');
    return await db.query<{ period_year: number; period_month: number }>(
        `SELECT DISTINCT period_year, period_month FROM dbo.daftar_upah_aggregation_history
         WHERE gang_code IN(${placeholders})
         ORDER BY period_year DESC, period_month DESC`,
        gangCodes
    );
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION: Aggregation Queries (premi totals, division summary)
// ═══════════════════════════════════════════════════════════════════════

/**
 * @query selectLatestAggregationRows
 * @table daftar_upah_aggregation_history (extend_db_ptrj)
 * @input db, month, year
 * @output aggregation row[] with row_rank=1 (premi totals across all divisions)
 * @sql WITH latest_rows AS (SELECT ... ROW_NUMBER() OVER (PARTITION BY period, gang ORDER BY updated_at, id) ...) SELECT ... WHERE row_rank=1
 */
export async function selectLatestAggregationRows(db: Database, month: number, year: number): Promise<any[]> {
    return await db.query<any>(
        `WITH latest_rows AS (
            SELECT
                h.gang_code,
                h.division_code,
                ISNULL(h.total_premi, 0) as total_premi,
                ISNULL(h.total_employees, 0) as total_employees,
                ISNULL(h.total_hk, 0) as total_hk,
                ISNULL(h.total_hari_kerja, 0) as total_hari_kerja,
                ISNULL(h.total_upah_bersih, 0) as total_upah_bersih,
                ISNULL(h.total_upah_kotor, 0) as total_upah_kotor,
                ISNULL(h.total_pph21, 0) as total_pph21,
                ISNULL(h.total_spsi, 0) as total_spsi,
                ISNULL(h.total_lembur, 0) as total_lembur,
                ISNULL(h.total_premi_brondol, 0) as total_premi_brondol,
                ISNULL(h.total_premi_prunning, 0) as total_premi_prunning,
                ISNULL(h.total_premi_insentif, 0) as total_premi_insentif,
                ISNULL(h.total_premi_kinerja, 0) as total_premi_kinerja,
                ISNULL(h.total_koreksi, 0) as total_koreksi,
                ISNULL(h.total_ffb_weight, 0) as total_ffb_weight,
                ISNULL(h.total_weight_tbs, 0) as total_weight_tbs,
                ROW_NUMBER() OVER (
                    PARTITION BY h.period_month, h.period_year, h.gang_code
                    ORDER BY COALESCE(h.updated_at, h.created_at) DESC, h.id DESC
                ) as row_rank
            FROM dbo.daftar_upah_aggregation_history h
            WHERE h.period_month = ? AND h.period_year = ?
        )
        SELECT
            gang_code, division_code,
            total_premi, total_employees, total_hk, total_hari_kerja,
            total_upah_bersih, total_upah_kotor,
            total_pph21, total_spsi, total_lembur,
            total_premi_brondol, total_premi_prunning,
            total_premi_insentif, total_premi_kinerja, total_koreksi,
            total_ffb_weight, total_weight_tbs
        FROM latest_rows
        WHERE row_rank = 1`,
        [month, year]
    );
}

/**
 * @query selectDivisionSummaryRows
 * @table daftar_upah_aggregation_history (extend_db_ptrj)
 * @input db, whereSql (pre-built WHERE around "1 = 1"), params[]
 * @output full aggregation row[] with row_rank=1, ORDER BY division_code, gang_code
 * @sql WITH latest_rows AS (SELECT full cols, ROW_NUMBER() OVER (PARTITION BY period, gang) ... WHERE ${whereSql}) SELECT ... WHERE row_rank=1 ORDER BY division_code, gang_code
 */
export async function selectDivisionSummaryRows(
    db: Database,
    whereSql: string,
    params: any[]
): Promise<any[]> {
    return await db.query<any>(
        `WITH latest_rows AS (
            SELECT
                id, period_month, period_year, division_code, gang_code,
                gang_description, total_employees, total_hk, total_hari_kerja,
                total_cuti_tahunan, total_cuti_sakit, total_cuti_minggu,
                total_cuti_nasional, total_upah_dasar, total_upah_pokok,
                total_gaji_pokok, total_beras, total_jabatan, total_masa_kerja,
                total_lembur, total_tunjangan, total_premi_brondol,
                total_premi_prunning, total_premi_insentif, total_premi_kinerja,
                total_premi, dynamic_premi_data, informasi_tambahan,
                total_koreksi, total_potongan, total_pph21,
                total_bpjs_pekerja, total_bpjs_majikan, total_spsi,
                total_upah_kotor, total_upah_bersih, total_ffb_weight, total_weight_tbs,
                created_at, updated_at, source_endpoint,
                ROW_NUMBER() OVER (
                    PARTITION BY period_month, period_year, gang_code
                    ORDER BY COALESCE(updated_at, created_at) DESC, id DESC
                ) as row_rank
            FROM dbo.daftar_upah_aggregation_history
            WHERE ${whereSql}
        )
        SELECT
            id, period_month, period_year, division_code, gang_code,
            gang_description, total_employees, total_hk, total_hari_kerja,
            total_cuti_tahunan, total_cuti_sakit, total_cuti_minggu,
            total_cuti_nasional, total_upah_dasar, total_upah_pokok,
            total_gaji_pokok, total_beras, total_jabatan, total_masa_kerja,
            total_lembur, total_tunjangan, total_premi_brondol,
            total_premi_prunning, total_premi_insentif, total_premi_kinerja,
            total_premi, dynamic_premi_data, informasi_tambahan,
            total_koreksi, total_potongan, total_pph21,
            total_bpjs_pekerja, total_bpjs_majikan, total_spsi,
            total_upah_kotor, total_upah_bersih, total_ffb_weight, total_weight_tbs,
            created_at, updated_at, source_endpoint
        FROM latest_rows
        WHERE row_rank = 1
        ORDER BY division_code, gang_code`,
        params
    );
}

/**
 * @query selectLatestAggregationDynamicPremi
 * @table daftar_upah_aggregation_history (extend_db_ptrj)
 * @input db, month, year
 * @output { gang_code, division_code, dynamic_premi_data, informasi_tambahan }[] with row_rank=1
 * @sql WITH latest_rows AS (SELECT h.gang_code, h.division_code, h.dynamic_premi_data, h.informasi_tambahan, ROW_NUMBER() OVER (...) ...) SELECT ... WHERE row_rank=1
 */
export async function selectLatestAggregationDynamicPremi(
    db: Database,
    month: number,
    year: number
): Promise<{ gang_code: string; division_code: string; dynamic_premi_data: string | null; informasi_tambahan: string | null }[]> {
    return await db.query<any>(
        `WITH latest_rows AS (
            SELECT
                h.gang_code,
                h.division_code,
                h.dynamic_premi_data,
                h.informasi_tambahan,
                ROW_NUMBER() OVER (
                    PARTITION BY h.period_month, h.period_year, h.gang_code
                    ORDER BY COALESCE(h.updated_at, h.created_at) DESC, h.id DESC
                ) as row_rank
            FROM dbo.daftar_upah_aggregation_history h
            WHERE h.period_month = ? AND h.period_year = ?
        )
        SELECT gang_code, division_code, dynamic_premi_data, informasi_tambahan
        FROM latest_rows
        WHERE row_rank = 1`,
        [month, year]
    );
}

/**
 * @query selectPremiTypesFromHistory
 * @table daftar_upah_aggregation_history (extend_db_ptrj)
 * @input db, month, year, locCode
 * @output { premi_type }[] distinct for division, ordered. NOTE: query selects h.premi_type but caller reads row.DocDesc (preserved behavior).
 * @sql SELECT DISTINCT h.premi_type FROM ... WHERE period_month=? AND period_year=? AND division_code=? ORDER BY h.premi_type
 */
export async function selectPremiTypesFromHistory(
    db: Database,
    month: number,
    year: number,
    locCode: string
): Promise<any[]> {
    return await db.query<any>(
        `SELECT DISTINCT h.premi_type
         FROM dbo.daftar_upah_aggregation_history h
         WHERE h.period_month = ? AND h.period_year = ?
           AND h.division_code = ?
         ORDER BY h.premi_type`,
        [month, year, locCode]
    );
}

/**
 * @query selectGangSummaryRow
 * @table daftar_upah_aggregation_history (extend_db_ptrj)
 * @input db, gangCode, month, year
 * @output single row (TOP 1 *) with row_rank=1 for the gang
 * @sql WITH latest_rows AS (SELECT h.*, ROW_NUMBER() OVER (PARTITION BY period, gang ...) ... WHERE gang_code=? AND period=?) SELECT TOP 1 * WHERE row_rank=1
 */
export async function selectGangSummaryRow(
    db: Database,
    gangCode: string,
    month: number,
    year: number
): Promise<any[]> {
    return await db.query<any>(
        `WITH latest_rows AS (
            SELECT
                h.*,
                ROW_NUMBER() OVER (
                    PARTITION BY h.period_month, h.period_year, h.gang_code
                    ORDER BY COALESCE(h.updated_at, h.created_at) DESC, h.id DESC
                ) as row_rank
            FROM dbo.daftar_upah_aggregation_history h
            WHERE h.gang_code = ? AND h.period_month = ? AND h.period_year = ?
        )
        SELECT TOP 1 *
        FROM latest_rows
        WHERE row_rank = 1`,
        [gangCode, month, year]
    );
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION: Impact Report Queries (payroll history fallback, tonase)
// ═══════════════════════════════════════════════════════════════════════

/**
 * @query selectPayrollHistoryHeaders
 * @table payroll_history_header (extend_db_ptrj)
 * @input db, month, year
 * @output { division_code, gang_code, gang_description, total_employees, total_hk, total_premi_insentif, dynamic_premi_data, informasi_tambahan }[] with row_rank=1
 * @sql WITH latest_headers AS (SELECT ... ROW_NUMBER() OVER (PARTITION BY period, gang ORDER BY snapshot_version, created_at, id) ... WHERE period=?) SELECT ... WHERE row_rank=1
 */
export async function selectPayrollHistoryHeaders(
    db: Database,
    month: number,
    year: number
): Promise<any[]> {
    return await db.query<any>(
        `WITH latest_headers AS (
            SELECT
                h.division_code,
                h.gang_code,
                h.gang_description,
                ISNULL(h.total_employees, 0) as total_employees,
                ISNULL(h.total_hk, 0) as total_hk,
                ISNULL(h.total_premi_insentif, 0) as total_premi_insentif,
                h.dynamic_premi_data,
                h.informasi_tambahan,
                ROW_NUMBER() OVER (
                    PARTITION BY h.period_month, h.period_year, h.gang_code
                    ORDER BY COALESCE(h.snapshot_version, 0) DESC, h.created_at DESC, h.id DESC
                ) as row_rank
            FROM dbo.payroll_history_header h
            WHERE h.period_month = ? AND h.period_year = ?
        )
        SELECT
            division_code, gang_code, gang_description,
            total_employees, total_hk, total_premi_insentif,
            dynamic_premi_data, informasi_tambahan
        FROM latest_headers
        WHERE row_rank = 1`,
        [month, year]
    );
}

/**
 * @query selectAggregationTonaseRows
 * @table daftar_upah_aggregation_history (extend_db_ptrj)
 * @input db, month, year
 * @output { division_code, gang_code, total_ffb_weight, total_weight_tbs }[] with row_rank=1
 * @sql WITH latest_rows AS (SELECT h.division_code, h.gang_code, ISNULL(total_ffb_weight,0), ISNULL(total_weight_tbs,0), ROW_NUMBER() OVER (...) ... WHERE period=?) SELECT ... WHERE row_rank=1
 */
export async function selectAggregationTonaseRows(
    db: Database,
    month: number,
    year: number
): Promise<any[]> {
    return await db.query<any>(
        `WITH latest_rows AS (
            SELECT
                h.division_code,
                h.gang_code,
                ISNULL(h.total_ffb_weight, 0) as total_ffb_weight,
                ISNULL(h.total_weight_tbs, 0) as total_weight_tbs,
                ROW_NUMBER() OVER (
                    PARTITION BY h.period_month, h.period_year, h.gang_code
                    ORDER BY COALESCE(h.updated_at, h.created_at) DESC, h.id DESC
                ) as row_rank
            FROM dbo.daftar_upah_aggregation_history h
            WHERE h.period_month = ? AND h.period_year = ?
        )
        SELECT division_code, gang_code, total_ffb_weight, total_weight_tbs
        FROM latest_rows
        WHERE row_rank = 1`,
        [month, year]
    );
}

/**
 * @query selectGangLemburDetails
 * @table payroll_history_header + payroll_history_detail (extend_db_ptrj)
 * @input db, gangCode, month, year
 * @output { emp_name, lembur_jumlah, lembur_records }[] for latest header where lembur_jumlah > 0 and lembur_records NOT NULL
 * @sql WITH latest_header AS (SELECT h.history_id, ROW_NUMBER() OVER (PARTITION BY period, gang ORDER BY snapshot_version, created_at, id) ... WHERE gang_code=? AND period=?) SELECT d.emp_name, d.lembur_jumlah, d.lembur_records FROM payroll_history_detail d JOIN latest_header h ON d.history_id=h.history_id WHERE h.row_rank=1 AND d.lembur_jumlah>0 AND d.lembur_records IS NOT NULL
 */
export async function selectGangLemburDetails(
    db: Database,
    gangCode: string,
    month: number,
    year: number
): Promise<any[]> {
    return await db.query<any>(
        `WITH latest_header AS (
            SELECT
                h.history_id,
                ROW_NUMBER() OVER (
                    PARTITION BY h.period_month, h.period_year, h.gang_code
                    ORDER BY COALESCE(h.snapshot_version, 0) DESC, h.created_at DESC, h.id DESC
                ) as row_rank
            FROM dbo.payroll_history_header h
            WHERE h.gang_code = ? AND h.period_month = ? AND h.period_year = ?
        )
        SELECT d.emp_name, d.lembur_jumlah, d.lembur_records
        FROM dbo.payroll_history_detail d
        JOIN latest_header h ON d.history_id = h.history_id
        WHERE h.row_rank = 1
          AND d.lembur_jumlah > 0 AND d.lembur_records IS NOT NULL`,
        [gangCode, month, year]
    );
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION: Mill Queries (tonase, FFB weight)
// ═══════════════════════════════════════════════════════════════════════

/**
 * @query selectDivisionTonase
 * @table division_tonase (extend_db_ptrj)
 * @input db, month, year
 * @output { division_code, tonase }[] grouped by trimmed division_code
 * @sql SELECT LTRIM(RTRIM(division_code)) AS division_code, SUM(tonase) AS tonase FROM dbo.division_tonase WHERE period_month=? AND period_year=? GROUP BY LTRIM(RTRIM(division_code))
 */
export async function selectDivisionTonase(
    db: Database,
    month: number,
    year: number
): Promise<{ division_code: string; tonase: number }[]> {
    return await db.query<{ division_code: string; tonase: number }>(
        `SELECT LTRIM(RTRIM(division_code)) AS division_code, SUM(tonase) AS tonase
         FROM dbo.division_tonase
         WHERE period_month = ? AND period_year = ?
         GROUP BY LTRIM(RTRIM(division_code))`,
        [month, year]
    );
}

/**
 * @query selectMillTotalsFromVenus
 * @table HR_EMPLOYEE, HR_PAYROLL, PR_TASKREGLN (VenusHR14)
 * @input db (venus instance), startDate, endDate
 * @output { total_employees, total_upah_dasar, total_hk }[] for LocCode MILL/PKS
 * @sql SELECT COUNT(DISTINCT e.EmpCode) total_employees, SUM(ISNULL(p.PayRate,0)) total_upah_dasar, SUM(ISNULL(trl.Hours,0)) total_hk FROM HR_EMPLOYEE e LEFT JOIN HR_PAYROLL p ... LEFT JOIN PR_TASKREGLN trl ... AND trl.TrxDate>=? AND trl.TrxDate<? AND trl.OT=0 WHERE e.LocCode IN ('MILL','PKS')
 */
export async function selectMillTotalsFromVenus(
    db: Database,
    startDate: string,
    endDate: string
): Promise<any[]> {
    return await db.query<any>(
        `SELECT
            COUNT(DISTINCT e.EmpCode) as total_employees,
            SUM(ISNULL(p.PayRate, 0)) as total_upah_dasar,
            SUM(ISNULL(trl.Hours, 0)) as total_hk
         FROM HR_EMPLOYEE e
         LEFT JOIN HR_PAYROLL p ON p.EmpCode = e.EmpCode
         LEFT JOIN PR_TASKREGLN trl ON trl.EmpCode = e.EmpCode
             AND trl.TrxDate >= ? AND trl.TrxDate < ?
             AND trl.OT = 0
         WHERE e.LocCode = 'MILL' OR e.LocCode = 'PKS'`,
        [startDate, endDate]
    );
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION: Update Queries (thumbprint, gang cell)
// ═══════════════════════════════════════════════════════════════════════

/**
 * @query updateGangCellValue
 * @table daftar_upah_aggregation_history (extend_db_ptrj)
 * @input db, field (caller MUST validate against allow-list), value, month, year, gangCode
 * @output update result (affectedRows on gateway)
 * @sql UPDATE dbo.daftar_upah_aggregation_history SET ${field}=?, updated_at=GETDATE() WHERE period_month=? AND period_year=? AND gang_code=?
 */
export async function updateGangCellValue(
    db: Database,
    field: string,
    value: number,
    month: number,
    year: number,
    gangCode: string
): Promise<any> {
    return await db.query(
        `UPDATE dbo.daftar_upah_aggregation_history
         SET ${field} = ?, updated_at = GETDATE()
         WHERE period_month = ? AND period_year = ? AND gang_code = ?`,
        [value, month, year, gangCode]
    );
}
