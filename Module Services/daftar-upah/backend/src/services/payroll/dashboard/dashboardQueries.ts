/**
 * dashboardQueries.ts — Raw SQL query functions for dashboard/analytics/KPI reads.
 *
 * Every function follows the pattern: <code>async (db, args) => raw_rows[]</code>
 * No transformation/business logic. Callers own orchestration.
 *
 * DB instances: extendDb = aggregation history, hrDb = HR master, millDb = mill.
 *
 * @module dashboardQueries
 */

import { Database } from "../../../db/client";

// ═══════════════════════════════════════════════════════════════════════
// SECTION: SQL Builders (CTE, gang scope, period helpers)
// ═══════════════════════════════════════════════════════════════════════

/**
 * @query latestAggregationRowsCte
 * @table daftar_upah_aggregation_history (extend_db_ptrj)
 * @input none
 * @output CTE fragment string
 * @sql WITH latest_rows AS (... ROW_NUMBER() OVER (PARTITION BY period, gang ORDER BY updated_at, id) ...)
 */
/** CTE: single latest row per (period_month, period_year, gang_code). */
export function latestAggregationRowsCte(): string {
    return `
        WITH latest_rows AS (
            SELECT
                h.*,
                ROW_NUMBER() OVER (
                    PARTITION BY h.period_month, h.period_year, h.gang_code
                    ORDER BY COALESCE(h.updated_at, h.created_at) DESC, h.id DESC
                ) as row_rank
            FROM dbo.daftar_upah_aggregation_history h
        )
    `;
}

/**
 * @query gangTypesSql
 * @input gangColumn: string, types: string[] ('harvesting'|'transport'|'maintenance')
 * @output SQL fragment: RIGHT(...last letter...) IN (...)
 * @sql RIGHT(UPPER(LTRIM(RTRIM(<col>))), 1) IN ('H','T','M')
 */
/** SQL fragment: hanya gang suffix tertentu (H=panen, M=maintenance, T=transport). */
export function gangTypesSql(gangColumn: string, types: string[]): string {
    const map: Record<string, string> = { harvesting: "'H'", transport: "'T'", maintenance: "'M'" };
    const letters = types.map(t => map[t]).filter(Boolean);
    if (letters.length === 0) return '1=0';
    if (letters.length === 3) return `RIGHT(UPPER(LTRIM(RTRIM(${gangColumn}))), 1) IN ('H','T','M')`;
    return `RIGHT(UPPER(LTRIM(RTRIM(${gangColumn}))), 1) IN (${letters.join(',')})`;
}

/**
 * @query harvestGangSql
 * @input gangColumn: string
 * @output SQL fragment restricting to suffix 'H' (panen)
 * @sql RIGHT(UPPER(LTRIM(RTRIM(<col>))), 1) = 'H'
 */
/** SQL fragment: hanya gang suffix H (panen). */
export function harvestGangSql(gangColumn: string): string {
    return `RIGHT(UPPER(LTRIM(RTRIM(${gangColumn}))), 1) = 'H'`;
}

/**
 * @query scopeGangSql
 * @input gangColumn: string, gangScope: string ('panen'|'maintenance'|'transport'|other)
 * @output SQL fragment matching gangTypesSql for the scope, or '1=1' when unscoped
 * @sql maps panen→harvesting('H'), maintenance→'M', transport→'T'
 */
/** SQL fragment: scope filter by gang type. */
export function scopeGangSql(gangColumn: string, gangScope: string): string {
    if (gangScope === 'maintenance' || gangScope === 'transport' || gangScope === 'panen') {
        return gangTypesSql(gangColumn, [gangScope === 'panen' ? 'harvesting' : gangScope]);
    }
    return '1=1';
}

/**
 * @query divisionGangSubqueryFilter
 * @table HR_GANG (extend_db_ptrj)
 * @input gangColumn: string (one `?` param bound to division_code)
 * @output SQL fragment: AND <col> IN (SELECT code FROM HR_GANG WHERE division_code = ?)
 * @sql subquery restricting gangs to those belonging to a single division
 */
/** SQL fragment: restrict gangs to those of a division via HR_GANG lookup (1 bound param). */
export function divisionGangSubqueryFilter(gangColumn: string): string {
    return `AND ${gangColumn} IN (SELECT code FROM HR_GANG WHERE division_code = ?)`;
}

/**
 * @query getPeriodKey
 * @input month, year
 * @output "YYYY-MM" zero-padded key string
 */
export function getPeriodKey(month: number, year: number): string {
    return `${year}-${month.toString().padStart(2, '0')}`;
}

/**
 * @query getMonthName
 * @input m (1-12)
 * @output short English month name ('Jan'..'Dec') or '' if out of range
 */
export function getMonthName(m: number): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[m - 1] || '';
}

/**
 * @query getStartPeriod
 * @input endMonth, endYear
 * @output { startMonth, startYear } = 12 months before end period
 */
export function getStartPeriod(endMonth: number, endYear: number): { startMonth: number; startYear: number } {
    let startMonth = endMonth - 11;
    let startYear = endYear;
    if (startMonth <= 0) {
        startMonth += 12;
        startYear -= 1;
    }
    return { startMonth, startYear };
}

export interface TonaseReportPeriod {
    month: number;
    year: number;
    key: string;
    label: string;
}

/**
 * @query getPeriodWindow
 * @input endMonth, endYear, count
 * @output TonaseReportPeriod[] — `count` periods ending at (endMonth, endYear), oldest first
 */
export function getPeriodWindow(endMonth: number, endYear: number, count: number): TonaseReportPeriod[] {
    const periods: TonaseReportPeriod[] = [];
    for (let offset = count - 1; offset >= 0; offset -= 1) {
        const date = new Date(endYear, endMonth - 1 - offset, 1);
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        periods.push({
            month,
            year,
            key: getPeriodKey(month, year),
            label: `${getMonthName(month)} ${year}`
        });
    }
    return periods;
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION: Trend Queries (12-month payroll, productivity, cost/HK)
// ═══════════════════════════════════════════════════════════════════════

/**
 * @query selectPayrollTrend
 * @table daftar_upah_aggregation_history (extend_db_ptrj), division_tonase
 * @input db, { endMonth, endYear, startMonth, startYear, gangScope }
 * @output trend row[] per period (total_wage, total_ot, total_premi, total_headcount, total_hk, total_hari_kerja, total_tonase)
 * @sql WITH latest_rows AS (... ROW_NUMBER() ...) + tonase_periode CTE; WHERE row_rank=1 AND scope AND period BETWEEN start AND end; GROUP BY period
 */
export async function selectPayrollTrend(
    db: Database,
    args: { endMonth: number; endYear: number; startMonth: number; startYear: number; gangScope: string }
): Promise<any[]> {
    const query = `
        ${latestAggregationRowsCte()},
        tonase_periode AS (
            SELECT period_year, period_month, SUM(tonase) AS periode_tonase
            FROM dbo.division_tonase
            GROUP BY period_year, period_month
        )
        SELECT
            h.period_year,
            h.period_month,
            SUM(ISNULL(h.total_upah_kotor, 0)) as total_wage,
            SUM(ISNULL(h.total_lembur, 0)) as total_ot,
            SUM(ISNULL(h.total_premi, 0)) as total_premi,
            SUM(ISNULL(h.total_employees, 0)) as total_headcount,
            SUM(ISNULL(h.total_hk, 0)) as total_hk,
            SUM(ISNULL(h.total_hari_kerja, 0)) as total_hari_kerja,
            SUM(ISNULL(h.total_cuti_minggu, 0)) as total_cuti_minggu,
            SUM(ISNULL(h.total_cuti_nasional, 0)) as total_cuti_nasional,
            ISNULL(MAX(tp.periode_tonase), 0) as total_tonase
        FROM latest_rows h
        LEFT JOIN tonase_periode tp
            ON tp.period_year = h.period_year AND tp.period_month = h.period_month
        WHERE
            h.row_rank = 1
            AND ${scopeGangSql('h.gang_code', args.gangScope)}
            AND
            (h.period_year > ? OR (h.period_year = ? AND h.period_month >= ?))
            AND (h.period_year < ? OR (h.period_year = ? AND h.period_month <= ?))
        GROUP BY h.period_year, h.period_month
        ORDER BY h.period_year, h.period_month
    `;
    return db.query<any>(query, [
        args.startYear, args.startYear, args.startMonth,
        args.endYear, args.endYear, args.endMonth
    ]);
}

/**
 * @query selectProductivityTrend
 * @table daftar_upah_aggregation_history (extend_db_ptrj), division_tonase
 * @input db, { startMonth, startYear, endMonth, endYear, gangScope }
 * @output row[] per period (total_wage, total_hk, total_hari_kerja, total_tonase) for cost/HK & cost/ton
 * @sql WITH latest_rows + tonase_periode; WHERE row_rank=1 AND scope AND period BETWEEN; GROUP BY period
 */
export async function selectProductivityTrend(
    db: Database,
    args: { startMonth: number; startYear: number; endMonth: number; endYear: number; gangScope: string }
): Promise<any[]> {
    const query = `
        ${latestAggregationRowsCte()},
        tonase_periode AS (
            SELECT period_year, period_month, SUM(tonase) AS periode_tonase
            FROM dbo.division_tonase
            GROUP BY period_year, period_month
        )
        SELECT
            h.period_month,
            h.period_year,
            SUM(ISNULL(h.total_upah_kotor, 0)) as total_wage,
            SUM(ISNULL(h.total_hk, 0)) as total_hk,
            SUM(ISNULL(h.total_hari_kerja, 0)) as total_hari_kerja,
            SUM(ISNULL(h.total_cuti_minggu, 0)) as total_cuti_minggu,
            SUM(ISNULL(h.total_cuti_nasional, 0)) as total_cuti_nasional,
            ISNULL(MAX(tp.periode_tonase), 0) as total_tonase
        FROM latest_rows h
        LEFT JOIN tonase_periode tp
            ON tp.period_year = h.period_year AND tp.period_month = h.period_month
        WHERE
            h.row_rank = 1
            AND ${scopeGangSql('h.gang_code', args.gangScope)}
            AND
            (h.period_year > ? OR (h.period_year = ? AND h.period_month >= ?))
            AND (h.period_year < ? OR (h.period_year = ? AND h.period_month <= ?))
        GROUP BY h.period_year, h.period_month
        ORDER BY h.period_year, h.period_month
    `;
    return db.query<any>(query, [
        args.startYear, args.startYear, args.startMonth,
        args.endYear, args.endYear, args.endMonth
    ]);
}

/**
 * @query selectAllGangsTrend
 * @table daftar_upah_aggregation_history (extend_db_ptrj)
 * @input db, { startYear, startMonth, endYear, endMonth, scopeFilter, divisionFilter, params }
 * @output row[] per (gang, period) with wage/ot/premi/headcount/tonase/cost_per_hk/cost_per_ton
 * @sql WITH latest_rows; WHERE row_rank=1 AND scopeFilter AND period BETWEEN AND divisionFilter; GROUP BY gang, period
 */
export async function selectAllGangsTrend(
    db: Database,
    args: {
        startYear: number;
        startMonth: number;
        endYear: number;
        endMonth: number;
        scopeFilter: string;
        divisionFilter: string;
        params: any[];
    }
): Promise<any[]> {
    const query = `
        ${latestAggregationRowsCte()}
        SELECT
            h.gang_code,
            h.period_month as month,
            h.period_year as year,
            SUM(h.total_upah_kotor) as total_wage,
            SUM(h.total_lembur) as total_ot,
            SUM(h.total_premi) as total_premi,
            MAX(h.total_employees) as headcount,
            MAX(ISNULL(h.total_ffb_weight, 0)) as tonase,
            CAST(SUM(h.total_upah_kotor) AS FLOAT) / NULLIF(SUM(h.total_hk), 0) as cost_per_hk,
            CAST(SUM(h.total_upah_kotor) AS FLOAT) / NULLIF(MAX(ISNULL(h.total_ffb_weight, 0)), 0) as cost_per_ton
        FROM latest_rows h
        WHERE
            h.row_rank = 1 AND
            ${args.scopeFilter}
            (h.period_year > ? OR (h.period_year = ? AND h.period_month >= ?)) AND
            (h.period_year < ? OR (h.period_year = ? AND h.period_month <= ?))
            ${args.divisionFilter}
        GROUP BY h.gang_code, h.period_month, h.period_year
        ORDER BY h.gang_code, h.period_year, h.period_month
    `;
    return db.query<any>(query, [
        args.startYear, args.startYear, args.startMonth,
        args.endYear, args.endYear, args.endMonth,
        ...args.params
    ]);
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION: Breakdown Queries (division, gang, efficiency)
// ═══════════════════════════════════════════════════════════════════════

/**
 * @query selectDivisionBreakdown
 * @table daftar_upah_aggregation_history (extend_db_ptrj), division_tonase
 * @input db, { month, year, gangScope }
 * @output division row[] (total_wage, total_ot, total_premi, headcount, total_hk, total_hari_kerja, total_potongan, total_spsi, total_pph21, total_bpjs_pekerja, total_koreksi, total_tonase, upah_available)
 * @sql latest_rows + period_tonase + agg_div CTEs; FULL OUTER JOIN tonase vs agg; upah_available via EXISTS
 */
export async function selectDivisionBreakdown(
    db: Database,
    args: { month: number; year: number; gangScope: string }
): Promise<any[]> {
    const query = `
        ${latestAggregationRowsCte()},
        period_tonase AS (
            SELECT LTRIM(RTRIM(division_code)) AS division_code, SUM(tonase) AS tonase
            FROM dbo.division_tonase
            WHERE period_month = ? AND period_year = ?
            GROUP BY LTRIM(RTRIM(division_code))
        ),
        agg_div AS (
            SELECT
                LTRIM(RTRIM(h.division_code)) AS division_code,
                SUM(ISNULL(h.total_upah_kotor, 0)) as total_wage,
                SUM(ISNULL(h.total_lembur, 0)) as total_ot,
                SUM(ISNULL(h.total_premi, 0)) as total_premi,
                SUM(ISNULL(h.total_employees, 0)) as headcount,
                SUM(ISNULL(h.total_hk, 0)) as total_hk,
                SUM(ISNULL(h.total_hari_kerja, 0)) as total_hari_kerja,
                SUM(ISNULL(h.total_cuti_minggu, 0)) as total_cuti_minggu,
                SUM(ISNULL(h.total_cuti_nasional, 0)) as total_cuti_nasional,
                SUM(ISNULL(h.total_potongan, 0)) as total_potongan,
                SUM(ISNULL(h.total_spsi, 0)) as total_spsi,
                SUM(ISNULL(h.total_pph21, 0)) as total_pph21,
                SUM(ISNULL(h.total_bpjs_pekerja, 0)) as total_bpjs_pekerja,
                SUM(ISNULL(h.total_koreksi, 0)) as total_koreksi
            FROM latest_rows h
            WHERE h.row_rank = 1 AND ${scopeGangSql('h.gang_code', args.gangScope)} AND h.period_month = ? AND h.period_year = ?
            GROUP BY LTRIM(RTRIM(h.division_code))
        )
        SELECT
            COALESCE(t.division_code, a.division_code) AS division_code,
            ISNULL(a.total_wage, 0) as total_wage,
            ISNULL(a.total_ot, 0) as total_ot,
            ISNULL(a.total_premi, 0) as total_premi,
            ISNULL(a.headcount, 0) as headcount,
            ISNULL(a.total_hk, 0) as total_hk,
            ISNULL(a.total_hari_kerja, 0) as total_hari_kerja,
            ISNULL(a.total_cuti_minggu, 0) as total_cuti_minggu,
            ISNULL(a.total_cuti_nasional, 0) as total_cuti_nasional,
            ISNULL(a.total_potongan, 0) as total_potongan,
            ISNULL(a.total_spsi, 0) as total_spsi,
            ISNULL(a.total_pph21, 0) as total_pph21,
            ISNULL(a.total_bpjs_pekerja, 0) as total_bpjs_pekerja,
            ISNULL(a.total_koreksi, 0) as total_koreksi,
            ISNULL(t.tonase, 0) as total_tonase,
            CASE WHEN EXISTS (
                SELECT 1 FROM dbo.daftar_upah_aggregation_history x
                WHERE x.period_month = ? AND x.period_year = ?
                  AND LTRIM(RTRIM(x.division_code)) = LTRIM(RTRIM(COALESCE(t.division_code, a.division_code)))
            ) THEN 1 ELSE 0 END as upah_available
        FROM period_tonase t
        FULL OUTER JOIN agg_div a ON a.division_code = t.division_code
        ORDER BY ISNULL(a.total_wage, 0) DESC
    `;
    return db.query<any>(query, [args.month, args.year, args.month, args.year, args.month, args.year]);
}

/**
 * @query selectGangBreakdown
 * @table daftar_upah_aggregation_history (extend_db_ptrj)
 * @input db, { month, year, limit, gangScope }
 * @output TOP N gang rows by total_wage (gang_code, total_wage, total_ot, headcount, total_tonase)
 * @sql WITH latest_rows; SELECT TOP N ... WHERE row_rank=1 AND scope AND period; GROUP BY gang; ORDER BY total_wage DESC
 */
export async function selectGangBreakdown(
    db: Database,
    args: { month: number; year: number; limit: number; gangScope: string }
): Promise<any[]> {
    const query = `
        ${latestAggregationRowsCte()}
        SELECT TOP ${args.limit}
            h.gang_code,
            SUM(ISNULL(h.total_upah_kotor, 0)) as total_wage,
            SUM(ISNULL(h.total_lembur, 0)) as total_ot,
            SUM(ISNULL(h.total_employees, 0)) as headcount,
            SUM(ISNULL(h.total_ffb_weight, 0)) as total_tonase
        FROM latest_rows h
        WHERE h.row_rank = 1 AND ${scopeGangSql('h.gang_code', args.gangScope)} AND h.period_month = ? AND h.period_year = ?
        GROUP BY h.gang_code
        ORDER BY total_wage DESC
    `;
    return db.query<any>(query, [args.month, args.year]);
}

/**
 * @query selectDivisionEfficiency
 * @table daftar_upah_aggregation_history (extend_db_ptrj), division_tonase
 * @input db, { month, year, gangScope }
 * @output division row[] (total_cost, headcount, total_man_days, total_hari_kerja, total_tonase)
 * @sql WITH latest_rows LEFT JOIN division_tonase; HAVING SUM(total_employees) > 0; GROUP BY division, tonase
 */
export async function selectDivisionEfficiency(
    db: Database,
    args: { month: number; year: number; gangScope: string }
): Promise<any[]> {
    const query = `
        ${latestAggregationRowsCte()}
        SELECT
            h.division_code,
            SUM(ISNULL(h.total_upah_kotor, 0)) as total_cost,
            SUM(ISNULL(h.total_employees, 0)) as headcount,
            SUM(ISNULL(h.total_hk, 0)) as total_man_days,
            SUM(ISNULL(h.total_hari_kerja, 0)) as total_hari_kerja,
            ISNULL(dt.tonase, 0) as total_tonase
        FROM latest_rows h
        LEFT JOIN dbo.division_tonase dt
            ON dt.period_month = h.period_month AND dt.period_year = h.period_year
            AND LTRIM(RTRIM(dt.division_code)) = LTRIM(RTRIM(h.division_code))
        WHERE h.row_rank = 1 AND ${scopeGangSql('h.gang_code', args.gangScope)} AND h.period_month = ? AND h.period_year = ?
        GROUP BY h.division_code, dt.tonase
        HAVING SUM(ISNULL(h.total_employees, 0)) > 0
        ORDER BY total_cost DESC
    `;
    return db.query<any>(query, [args.month, args.year]);
}

/**
 * @query selectGangHistory
 * @table daftar_upah_aggregation_history (extend_db_ptrj)
 * @input db, { gangCode, endMonth, endYear }
 * @output TOP 6 period rows for one gang (month, year, total_wage, total_ot, total_premi, total_hk, headcount, cost_per_hk)
 * @sql WITH latest_rows; SELECT TOP 6 ... WHERE row_rank=1 AND gang_code=? AND (year*100+month) <= end; GROUP BY period DESC
 */
export async function selectGangHistory(
    db: Database,
    args: { gangCode: string; endMonth: number; endYear: number }
): Promise<any[]> {
    const query = `
        ${latestAggregationRowsCte()}
        SELECT TOP 6
        h.period_month as month,
        h.period_year as year,
        SUM(h.total_upah_kotor) as total_wage,
        SUM(h.total_lembur) as total_ot,
        SUM(h.total_premi) as total_premi,
        SUM(h.total_hk) as total_hk,
        MAX(h.total_employees) as headcount,
        CAST(SUM(h.total_upah_kotor) AS FLOAT) / NULLIF(SUM(h.total_hk), 0) as cost_per_hk
        FROM latest_rows h
        WHERE h.row_rank = 1
        AND h.gang_code = ?
        AND (h.period_year * 100 + h.period_month) <= (? * 100 + ?)
        GROUP BY h.period_month, h.period_year
        ORDER BY h.period_year DESC, h.period_month DESC
    `;
    return db.query<any>(query, [args.gangCode, args.endYear, args.endMonth]);
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION: Filter Queries (available periods, divisions, gangs, headcount)
// ═══════════════════════════════════════════════════════════════════════

/**
 * @query selectHeadcountFromHr
 * @table HR_EMPLOYEE, HR_GANGLN, HR_EMPLOYMENT (hrDb / VenusHR14)
 * @input db
 * @output row[] (loc_code, hr_emp_type, gender, join_date) — deduped by EmpCode (rn=1)
 * @sql ROW_NUMBER() OVER (PARTITION BY EmpCode) inside subquery; JOIN HR_GANGLN + HR_EMPLOYMENT; WHERE rn=1
 */
export async function selectHeadcountFromHr(db: Database): Promise<any[]> {
    const query = `
        SELECT loc_code, hr_emp_type, gender, join_date
        FROM (
            SELECT
                RTRIM(e.LocCode) as loc_code,
                NULLIF(RTRIM(e.HREmpType), '') as hr_emp_type,
                e.Gender as gender,
                em.AppJoinGrpDate as join_date,
                ROW_NUMBER() OVER(PARTITION BY e.EmpCode ORDER BY e.EmpCode DESC) as rn
            FROM HR_EMPLOYEE e
            INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
            LEFT JOIN HR_EMPLOYMENT em ON RTRIM(em.EmpCode) = RTRIM(e.EmpCode)
        ) t WHERE rn = 1
    `;
    return db.query<any>(query);
}

/**
 * @query selectCostHKComparison
 * @table daftar_upah_aggregation_history (extend_db_ptrj)
 * @input db, { month, year, whereClause, params } — whereClause built by caller (period + optional gang filters)
 * @output gang row[] (gang_code, division_code, gang_description, total_cost, total_lembur, total_premi, total_hk, total_hari_kerja, headcount)
 * @sql WITH latest_rows; WHERE row_rank=1 AND <whereClause>; GROUP BY gang, division, description
 */
export async function selectCostHKComparison(
    db: Database,
    args: { month: number; year: number; whereClause: string; params: any[] }
): Promise<any[]> {
    const query = `
        ${latestAggregationRowsCte()}
        SELECT
            agg.gang_code,
            agg.division_code,
            agg.gang_description,
            SUM(ISNULL(agg.total_upah_kotor, 0)) as total_cost,
            SUM(ISNULL(agg.total_lembur, 0)) as total_lembur,
            SUM(ISNULL(agg.total_premi, 0)) as total_premi,
            SUM(ISNULL(agg.total_hk, 0)) as total_hk,
            SUM(ISNULL(agg.total_hari_kerja, 0)) as total_hari_kerja,
            SUM(ISNULL(agg.total_cuti_minggu, 0)) as total_cuti_minggu,
            SUM(ISNULL(agg.total_cuti_nasional, 0)) as total_cuti_nasional,
            SUM(ISNULL(agg.total_employees, 0)) as headcount
        FROM latest_rows agg
        WHERE agg.row_rank = 1 AND ${args.whereClause}
        GROUP BY agg.gang_code, agg.division_code, agg.gang_description
        ORDER BY agg.division_code, agg.gang_code
    `;
    return db.query<any>(query, args.params);
}

/**
 * @query selectAvailableGangs
 * @table daftar_upah_aggregation_history (extend_db_ptrj)
 * @input db, { month, year }
 * @output distinct gang row[] (gang_code, division_code, gang_description) for a period
 * @sql WITH latest_rows; SELECT DISTINCT ... WHERE row_rank=1 AND period AND gang_code IS NOT NULL/<> ''
 */
export async function selectAvailableGangs(
    db: Database,
    args: { month: number; year: number }
): Promise<any[]> {
    const query = `
        ${latestAggregationRowsCte()}
        SELECT DISTINCT
            agg.gang_code,
            agg.division_code,
            agg.gang_description
        FROM latest_rows agg
        WHERE agg.row_rank = 1
        AND agg.period_month = ? AND agg.period_year = ?
        AND agg.gang_code IS NOT NULL
        AND agg.gang_code != ''
        ORDER BY agg.gang_code
    `;
    return db.query<any>(query, [args.month, args.year]);
}

/**
 * @query selectLatestPeriod
 * @table daftar_upah_aggregation_history (extend_db_ptrj)
 * @input db
 * @output single row { period_month, period_year } = latest available period
 * @sql SELECT TOP 1 period_month, period_year ORDER BY period_year DESC, period_month DESC
 */
export async function selectLatestPeriod(db: Database): Promise<any[]> {
    const query = `
        SELECT TOP 1 period_month, period_year
        FROM dbo.daftar_upah_aggregation_history
        ORDER BY period_year DESC, period_month DESC
    `;
    return db.query<any>(query);
}

/**
 * @query selectAvailablePeriods
 * @table daftar_upah_aggregation_history (extend_db_ptrj)
 * @input db
 * @output distinct period row[] (period_month, period_year) sorted newest first
 * @sql SELECT DISTINCT period_month, period_year ORDER BY period_year DESC, period_month DESC
 */
export async function selectAvailablePeriods(db: Database): Promise<any[]> {
    const query = `
        SELECT DISTINCT period_month, period_year
        FROM dbo.daftar_upah_aggregation_history
        ORDER BY period_year DESC, period_month DESC
    `;
    return db.query<any>(query);
}

/**
 * @query selectDivisionsForFilter
 * @table daftar_upah_aggregation_history (extend_db_ptrj)
 * @input db, { month, year }
 * @output distinct division_code row[] for a period
 * @sql WITH latest_rows; SELECT DISTINCT division_code WHERE row_rank=1 AND period
 */
export async function selectDivisionsForFilter(
    db: Database,
    args: { month: number; year: number }
): Promise<any[]> {
    const query = `
        ${latestAggregationRowsCte()}
        SELECT DISTINCT h.division_code
        FROM latest_rows h
        WHERE h.row_rank = 1 AND h.period_month = ? AND h.period_year = ?
        ORDER BY h.division_code
    `;
    return db.query<any>(query, [args.month, args.year]);
}

/**
 * @query selectGangsForFilter
 * @table daftar_upah_aggregation_history (extend_db_ptrj)
 * @input db, { month, year }
 * @output distinct gang_code row[] for a period
 * @sql WITH latest_rows; SELECT DISTINCT gang_code WHERE row_rank=1 AND period
 */
export async function selectGangsForFilter(
    db: Database,
    args: { month: number; year: number }
): Promise<any[]> {
    const query = `
        ${latestAggregationRowsCte()}
        SELECT DISTINCT h.gang_code
        FROM latest_rows h
        WHERE h.row_rank = 1 AND h.period_month = ? AND h.period_year = ?
        ORDER BY h.gang_code
    `;
    return db.query<any>(query, [args.month, args.year]);
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION: Analysis Queries (premi, overtime, gang comparison)
// ═══════════════════════════════════════════════════════════════════════

/**
 * @query selectComparisonData
 * @table daftar_upah_aggregation_history (extend_db_ptrj)
 * @input db, { column: 'division_code'|'gang_code', codes: string[], month, year }
 * @output row[] per selected code (name, total_wage, total_ot, total_hk, total_hari_kerja, headcount)
 * @sql WITH latest_rows; WHERE row_rank=1 AND period AND <column> IN (?,...); GROUP BY <column>
 */
export async function selectComparisonData(
    db: Database,
    args: { column: string; codes: string[]; month: number; year: number }
): Promise<any[]> {
    const placeholders = args.codes.map(() => '?').join(',');
    const query = `
        ${latestAggregationRowsCte()}
        SELECT
            h.${args.column} as name,
            SUM(ISNULL(h.total_upah_kotor, 0)) as total_wage,
            SUM(ISNULL(h.total_lembur, 0)) as total_ot,
            SUM(ISNULL(h.total_hk, 0)) as total_hk,
            SUM(ISNULL(h.total_hari_kerja, 0)) as total_hari_kerja,
            SUM(ISNULL(h.total_cuti_minggu, 0)) as total_cuti_minggu,
            SUM(ISNULL(h.total_cuti_nasional, 0)) as total_cuti_nasional,
            SUM(ISNULL(h.total_employees, 0)) as headcount
        FROM latest_rows h
        WHERE h.row_rank = 1
          AND h.period_month = ?
          AND h.period_year = ?
          AND h.${args.column} IN (${placeholders})
        GROUP BY h.${args.column}
    `;
    return db.query<any>(query, [args.month, args.year, ...args.codes]);
}

/**
 * @query selectAggregatedGangData
 * @table daftar_upah_aggregation_history (extend_db_ptrj)
 * @input db, { month, year, divisionFilter, divisionParams }
 * @output gang row[] (gang_code, gang_description, total_wage, total_ot, total_premi, total_hk, headcount)
 * @sql WITH latest_rows; WHERE row_rank=1 AND period AND <divisionFilter>; GROUP BY gang, description
 */
export async function selectAggregatedGangData(
    db: Database,
    args: { month: number; year: number; divisionFilter: string; divisionParams: any[] }
): Promise<any[]> {
    const query = `
        ${latestAggregationRowsCte()}
        SELECT
            agg.gang_code,
            agg.gang_description,
            SUM(ISNULL(agg.total_upah_kotor, 0)) as total_wage,
            SUM(ISNULL(agg.total_lembur, 0)) as total_ot,
            SUM(ISNULL(agg.total_premi, 0)) as total_premi,
            SUM(ISNULL(agg.total_hk, 0)) as total_hk,
            SUM(ISNULL(agg.total_employees, 0)) as headcount
        FROM latest_rows agg
        WHERE agg.row_rank = 1 AND agg.period_month = ? AND agg.period_year = ?
        ${args.divisionFilter}
        GROUP BY agg.gang_code, agg.gang_description
        ORDER BY agg.gang_code
    `;
    return db.query<any>(query, [args.month, args.year, ...args.divisionParams]);
}

/**
 * @query selectPremiAnalysis
 * @table daftar_upah_aggregation_history (extend_db_ptrj)
 * @input db, { month, year, divisionFilter, divisionParams }
 * @output row[] (brondol, pruning, insentif, kinerja, total, dynamic_premi_data)
 * @sql WITH latest_rows; WHERE row_rank=1 AND period AND <divisionFilter>; GROUP BY dynamic_premi_data
 */
export async function selectPremiAnalysis(
    db: Database,
    args: { month: number; year: number; divisionFilter: string; divisionParams: any[] }
): Promise<any[]> {
    const query = `
        ${latestAggregationRowsCte()}
        SELECT
            SUM(ISNULL(h.total_premi_brondol, 0)) as brondol,
            SUM(ISNULL(h.total_premi_prunning, 0)) as pruning,
            SUM(ISNULL(h.total_premi_insentif, 0)) as insentif,
            SUM(ISNULL(h.total_premi_kinerja, 0)) as kinerja,
            SUM(ISNULL(h.total_premi, 0)) as total,
            h.dynamic_premi_data
        FROM latest_rows h
        WHERE h.row_rank = 1 AND h.period_month = ? AND h.period_year = ?
        ${args.divisionFilter}
        GROUP BY h.dynamic_premi_data
    `;
    return db.query<any>(query, [args.month, args.year, ...args.divisionParams]);
}

/**
 * @query selectPremiByDivision
 * @table daftar_upah_aggregation_history (extend_db_ptrj)
 * @input db, { month, year }
 * @output division row[] (division_code, brondol, pruning, insentif, kinerja, total)
 * @sql WITH latest_rows; WHERE row_rank=1 AND period; GROUP BY division; ORDER BY total DESC
 */
export async function selectPremiByDivision(
    db: Database,
    args: { month: number; year: number }
): Promise<any[]> {
    const query = `
        ${latestAggregationRowsCte()}
        SELECT
            h.division_code,
            SUM(ISNULL(h.total_premi_brondol, 0)) as brondol,
            SUM(ISNULL(h.total_premi_prunning, 0)) as pruning,
            SUM(ISNULL(h.total_premi_insentif, 0)) as insentif,
            SUM(ISNULL(h.total_premi_kinerja, 0)) as kinerja,
            SUM(ISNULL(h.total_premi, 0)) as total
        FROM latest_rows h
        WHERE h.row_rank = 1 AND h.period_month = ? AND h.period_year = ?
        GROUP BY h.division_code
        ORDER BY total DESC
    `;
    return db.query<any>(query, [args.month, args.year]);
}

/**
 * @query selectOvertimeAnalysis
 * @table daftar_upah_aggregation_history (extend_db_ptrj)
 * @input db, { month, year, divisionFilter, divisionParams }
 * @output division row[] (division_code, total_lembur)
 * @sql WITH latest_rows; WHERE row_rank=1 AND period AND <divisionFilter>; GROUP BY division; ORDER BY total_lembur DESC
 */
export async function selectOvertimeAnalysis(
    db: Database,
    args: { month: number; year: number; divisionFilter: string; divisionParams: any[] }
): Promise<any[]> {
    const query = `
        ${latestAggregationRowsCte()}
        SELECT
            h.division_code,
            SUM(ISNULL(h.total_lembur, 0)) as total_lembur
        FROM latest_rows h
        WHERE h.row_rank = 1 AND h.period_month = ? AND h.period_year = ?
        ${args.divisionFilter}
        GROUP BY h.division_code
        ORDER BY total_lembur DESC
    `;
    return db.query<any>(query, [args.month, args.year, ...args.divisionParams]);
}

/**
 * @query selectGangComparison
 * @table daftar_upah_aggregation_history (extend_db_ptrj)
 * @input db, { month, year, scopeFilter, divisionFilter, params }
 * @output gang row[] (gang_code, gang_description, total_wage, total_hk, headcount, total_ot, total_premi, total_production_db)
 * @sql WITH latest_rows; WHERE row_rank=1 AND period AND <scopeFilter> <divisionFilter>; GROUP BY gang, description; HAVING SUM(employees) >= 0
 */
export async function selectGangComparison(
    db: Database,
    args: { month: number; year: number; scopeFilter: string; divisionFilter: string; params: any[] }
): Promise<any[]> {
    const query = `
        ${latestAggregationRowsCte()}
        SELECT
            agg.gang_code,
            agg.gang_description,
            SUM(ISNULL(agg.total_upah_kotor, 0)) as total_wage,
            SUM(ISNULL(agg.total_hk, 0)) as total_hk,
            SUM(ISNULL(agg.total_employees, 0)) as headcount,
            SUM(ISNULL(agg.total_lembur, 0)) as total_ot,
            SUM(ISNULL(agg.total_premi, 0)) as total_premi,
            SUM(ISNULL(agg.total_ffb_weight, 0)) as total_production_db
        FROM latest_rows agg
        WHERE agg.row_rank = 1 AND agg.period_month = ? AND agg.period_year = ?
        ${args.scopeFilter}
        ${args.divisionFilter}
        GROUP BY agg.gang_code, agg.gang_description
        HAVING SUM(ISNULL(agg.total_employees, 0)) >= 0
        ORDER BY total_wage DESC
    `;
    return db.query<any>(query, [args.month, args.year, ...args.params]);
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION: Driver & Harvester Queries (weights, bunches)
// ═══════════════════════════════════════════════════════════════════════

/**
 * @query selectDriverWeights
 * @table WM_TICKET (db_ptrj_mill)
 * @input db (millDb), { month, year }
 * @output row[] (DriverCode, TotalWeight) — SUM(NetWeight) per driver for period
 * @sql SELECT DriverCode, SUM(CAST(NetWeight AS BIGINT)) WHERE MONTH/YEAR(DateReceived) AND DriverCode NOT NULL; GROUP BY DriverCode
 */
export async function selectDriverWeights(
    db: Database,
    args: { month: number; year: number }
): Promise<any[]> {
    const query = `
        SELECT
            DriverCode,
            SUM(CAST(NetWeight AS BIGINT)) as TotalWeight
        FROM [dbo].[WM_TICKET]
        WHERE MONTH(DateReceived) = ? AND YEAR(DateReceived) = ?
          AND DriverCode IS NOT NULL AND DriverCode <> ''
        GROUP BY DriverCode
    `;
    return db.query<any>(query, [args.month, args.year]);
}

/**
 * @query selectDriverGangMapping
 * @table HR_GANGLN (hrDb)
 * @input db (hrDb), { driverCodes: string[] } — interpolated (escaped) literal list
 * @output row[] (EmpCode, GangCode) mapping drivers to their gang
 * @sql SELECT TRIM(GangMember) EmpCode, TRIM(GangCode) GangCode WHERE GangMember IN (escaped list)
 */
export async function selectDriverGangMapping(
    db: Database,
    args: { driverCodes: string[] }
): Promise<any[]> {
    const codeList = args.driverCodes.map(c => `'${c.replace("'", "''")}'`).join(',');
    const query = `
        SELECT TRIM(GangMember) as EmpCode, TRIM(GangCode) as GangCode
        FROM HR_GANGLN
        WHERE GangMember IN (${codeList})
    `;
    return db.query<any>(query);
}

/**
 * @query selectHarvesterBunches
 * @table PR_HARVESTERLN_ARC, PR_HARVESTER_ARC (hrDb)
 * @input db (hrDb), { month, year }
 * @output row[] (GangCode, EmpCount, TotalBunches) per harvesting gang
 * @sql JOIN PR_HARVESTER_ARC; WHERE AccYear=? AND AccMonth=?; GROUP BY GangCode
 */
export async function selectHarvesterBunches(
    db: Database,
    args: { month: number; year: number }
): Promise<any[]> {
    const query = `
        SELECT
            h.GangCode,
            COUNT(DISTINCT hl.EmpCode) as EmpCount,
            SUM(ISNULL(hl.TotalBunches, 0)) as TotalBunches
        FROM PR_HARVESTERLN_ARC hl
        JOIN PR_HARVESTER_ARC h ON hl.MasterID = h.ID
        WHERE h.AccYear = ? AND h.AccMonth = ?
        GROUP BY h.GangCode
    `;
    return db.query<any>(query, [args.year.toString(), args.month.toString()]);
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION: Tonase Analysis Queries
// ═══════════════════════════════════════════════════════════════════════

/**
 * @query selectTonaseAnalysisRows
 * @table daftar_upah_aggregation_history (extend_db_ptrj)
 * @input db, { startYear, startMonth, endYear, endMonth, divisionFilter, params }
 * @output row[] per (period, gang, division) with wage/hk/premi breakdown + ffb_weight/weight_tbs/employees
 * @sql WITH latest_rows; WHERE row_rank=1 AND period BETWEEN AND <divisionFilter>; GROUP BY period, gang, division, description
 */
export async function selectTonaseAnalysisRows(
    db: Database,
    args: {
        startYear: number;
        startMonth: number;
        endYear: number;
        endMonth: number;
        divisionFilter: string;
        params: any[];
    }
): Promise<any[]> {
    const query = `
        ${latestAggregationRowsCte()}
        SELECT
            agg.period_month,
            agg.period_year,
            agg.gang_code,
            agg.division_code,
            agg.gang_description,
            SUM(ISNULL(agg.total_upah_bersih, 0)) as total_upah_bersih,
            SUM(ISNULL(agg.total_upah_kotor, 0)) as total_upah_kotor,
            SUM(ISNULL(agg.total_hk, 0)) as total_hk,
            SUM(ISNULL(agg.total_premi, 0)) as total_premi,
            SUM(ISNULL(agg.total_premi_brondol, 0)) as total_premi_brondol,
            SUM(ISNULL(agg.total_premi_prunning, 0)) as total_premi_prunning,
            SUM(ISNULL(agg.total_premi_insentif, 0)) as total_premi_insentif,
            SUM(ISNULL(agg.total_premi_kinerja, 0)) as total_premi_kinerja,
            SUM(ISNULL(agg.total_ffb_weight, 0)) as total_ffb_weight,
            SUM(ISNULL(agg.total_weight_tbs, 0)) as total_weight_tbs,
            SUM(ISNULL(agg.total_employees, 0)) as total_employees
        FROM latest_rows agg
        WHERE
            agg.row_rank = 1
            AND (agg.period_year > ? OR (agg.period_year = ? AND agg.period_month >= ?))
            AND (agg.period_year < ? OR (agg.period_year = ? AND agg.period_month <= ?))
            ${args.divisionFilter}
        GROUP BY
            agg.period_month,
            agg.period_year,
            agg.gang_code,
            agg.division_code,
            agg.gang_description
        ORDER BY agg.period_year, agg.period_month, agg.gang_code
    `;
    return db.query<any>(query, [
        args.startYear, args.startYear, args.startMonth,
        args.endYear, args.endYear, args.endMonth,
        ...args.params
    ]);
}

/**
 * @query selectDivisionTonase
 * @table division_tonase (extend_db_ptrj)
 * @input db
 * @output row[] (period_month, period_year, division_code, tonase) — authoritative per-division tonase
 * @sql SELECT period, LTRIM(RTRIM(division_code)), SUM(tonase); GROUP BY period, division
 */
export async function selectDivisionTonase(db: Database): Promise<any[]> {
    const query = `
        SELECT period_month, period_year, LTRIM(RTRIM(division_code)) AS division_code, SUM(tonase) AS tonase
        FROM dbo.division_tonase
        GROUP BY period_month, period_year, LTRIM(RTRIM(division_code))
    `;
    return db.query<any>(query);
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION: Wage Spike & Cost Trend Queries
// ═══════════════════════════════════════════════════════════════════════

/**
 * @query selectWageSpikeCurrent
 * @table daftar_upah_aggregation_history (extend_db_ptrj)
 * @input db, { month, year, gangScope }
 * @output gang row[] (gang_code, total_wage, total_hk, total_hari_kerja, total_cuti_minggu, total_cuti_nasional)
 * @sql WITH latest_rows; WHERE row_rank=1 AND scope AND period; GROUP BY gang
 */
export async function selectWageSpikeCurrent(
    db: Database,
    args: { month: number; year: number; gangScope: string }
): Promise<any[]> {
    const query = `
        ${latestAggregationRowsCte()}
        SELECT
            h.gang_code,
            SUM(ISNULL(h.total_upah_kotor, 0)) as total_wage,
            SUM(ISNULL(h.total_hk, 0)) as total_hk,
            SUM(ISNULL(h.total_hari_kerja, 0)) as total_hari_kerja,
            SUM(ISNULL(h.total_cuti_minggu, 0)) as total_cuti_minggu,
            SUM(ISNULL(h.total_cuti_nasional, 0)) as total_cuti_nasional
        FROM latest_rows h
        WHERE h.row_rank = 1 AND ${scopeGangSql('h.gang_code', args.gangScope)} AND h.period_month = ? AND h.period_year = ?
        GROUP BY h.gang_code
    `;
    return db.query<any>(query, [args.month, args.year]);
}

/**
 * @query selectDivisionCostTrend
 * @table daftar_upah_aggregation_history (extend_db_ptrj), division_tonase
 * @input db, { startYear, startMonth, endYear, endMonth, gangTypes: string[] }
 * @output row[] per (division, period) (division_code, period, total_wage, total_hk, total_hari_kerja, total_tonase)
 * @sql WITH latest_rows + tonase_per_div CTE; WHERE row_rank=1 AND gangTypes AND division NOT NULL AND period BETWEEN; GROUP BY division, period
 */
export async function selectDivisionCostTrend(
    db: Database,
    args: {
        startYear: number;
        startMonth: number;
        endYear: number;
        endMonth: number;
        gangTypes: string[];
    }
): Promise<any[]> {
    const query = `
        ${latestAggregationRowsCte()},
        tonase_per_div AS (
            SELECT period_year, period_month, division_code, tonase
            FROM dbo.division_tonase
        )
        SELECT
            h.period_year,
            h.period_month,
            LTRIM(RTRIM(h.division_code)) AS division_code,
            SUM(ISNULL(h.total_upah_kotor, 0)) AS total_wage,
            SUM(ISNULL(h.total_hk, 0)) AS total_hk,
            SUM(ISNULL(h.total_hari_kerja, 0)) AS total_hari_kerja,
            SUM(ISNULL(h.total_cuti_minggu, 0)) AS total_cuti_minggu,
            SUM(ISNULL(h.total_cuti_nasional, 0)) AS total_cuti_nasional,
            ISNULL(MAX(tpd.tonase), 0) AS total_tonase
        FROM latest_rows h
        LEFT JOIN tonase_per_div tpd
            ON tpd.period_year = h.period_year AND tpd.period_month = h.period_month
            AND LTRIM(RTRIM(tpd.division_code)) = LTRIM(RTRIM(h.division_code))
        WHERE
            h.row_rank = 1
            AND ${gangTypesSql('h.gang_code', args.gangTypes)}
            AND h.division_code IS NOT NULL
            AND LTRIM(RTRIM(h.division_code)) <> ''
            AND (h.period_year > ? OR (h.period_year = ? AND h.period_month >= ?))
            AND (h.period_year < ? OR (h.period_year = ? AND h.period_month <= ?))
        GROUP BY h.period_year, h.period_month, LTRIM(RTRIM(h.division_code))
        ORDER BY LTRIM(RTRIM(h.division_code)), h.period_year, h.period_month
    `;
    return db.query<any>(query, [
        args.startYear, args.startYear, args.startMonth,
        args.endYear, args.endYear, args.endMonth
    ]);
}
