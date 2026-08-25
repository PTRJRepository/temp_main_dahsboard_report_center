/**
 * @module backend/src/services/payroll/manualAdjustments/manualAdjustmentSync.ts
 * @purpose ADTRANS fetch (db_ptrj) for manual-adjustment sync, direct check, and forward/reverse compare.
 * @input db_ptrj Database + period + locCodes/empCodes/filters + optional gang scope.
 * @output sync detail rows, direct-check totals+detail+duplicates, compare totals+detail rows.
 * @depends ../../../db/client#Database
 * @sideeffect Reads PR_ADTRANS / PR_ADTRANS_ARC / PR_ADTRANSLN(_ARC) / HR_EMPLOYEE / HR_GANGLN (db_ptrj). No writes.
 * @tests backend/src/services/manualAdjustmentService.test.ts
 */

import { Database } from "../../../db/client";

// ── shared row types ───────────────────────────────────────────────────────

export type AdtransSyncDetailRow = {
    emp_code: string;
    doc_id: string | null;
    doc_desc: string;
    amount: number;
};

export type AdtransCheckTotalsRow = Record<string, any> & { emp_code: string };

export type AdtransDuplicateSourceRow = {
    id: number;
    doc_id: string;
    doc_date: string;
    doc_desc: string;
    emp_code: string;
    emp_name: string;
    amount: number;
};

export type AdtransCompareTotalsRow = Record<string, any> & {
    emp_code: string;
    nik: string;
};

export type AdtransCompareDetailRow = {
    emp_code: string;
    doc_id: string;
    doc_desc: string;
    amount: number;
};

// ── shared SQL builders ──────────────────────────────────────────────────────

function buildLocScopeClause(locCodes: string[]): { sql: string; params: any[] } {
    if (locCodes.length === 1) {
        return { sql: "UPPER(RTRIM(t.LocCode)) = ?", params: [locCodes[0]] };
    }
    return {
        sql: `UPPER(RTRIM(t.LocCode)) IN (${locCodes.map(() => "?").join(", ")})`,
        params: [...locCodes]
    };
}

function buildEmpScopeClause(empCodes: string[]): { sql: string; params: any[] } {
    if (empCodes.length === 1) {
        return { sql: "RTRIM(t.EmpCode) = ?", params: [empCodes[0]] };
    }
    return {
        sql: `RTRIM(t.EmpCode) IN (${empCodes.map(() => "?").join(", ")})`,
        params: [...empCodes]
    };
}

// ── single-purpose query functions ──────────────────────────────────────────

export type FetchAdtransSyncDetailsArgs = {
    periodMonth: number;
    periodYear: number;
    locCodes: string[];
    empCodes: string[];
};

/**
 * @query fetchAdtransSyncDetails
 * @table PR_ADTRANS / PR_ADTRANS_ARC / PR_ADTRANSLN / PR_ADTRANSLN_ARC (db_ptrj)
 * @input dbPtrj, { periodMonth, periodYear, locCodes, empCodes }
 * @output AdtransSyncDetailRow[]  ({ emp_code, doc_id, doc_desc, amount })
 * @sql LIVE (Status IN 1,3) UNION ALL ARC (Status=3), grouped by EmpCode+DocID+DocDesc; filtered by LocCode+EmpCode scope
 */
export async function fetchAdtransSyncDetails(
    dbPtrj: Database,
    args: FetchAdtransSyncDetailsArgs
): Promise<AdtransSyncDetailRow[]> {
    if (args.empCodes.length === 0 || args.locCodes.length === 0) return [];

    const locSql = args.locCodes.length === 1
        ? "UPPER(RTRIM(t.LocCode)) = ?"
        : `UPPER(RTRIM(t.LocCode)) IN (${args.locCodes.map(() => "?").join(", ")})`;
    const empSql = args.empCodes.length === 1
        ? "RTRIM(t.EmpCode) = ?"
        : `RTRIM(t.EmpCode) IN (${args.empCodes.map(() => "?").join(", ")})`;
    const selectSql = (headerTable: string, lineTable: string, statusFilter: string) => `
            SELECT
                RTRIM(t.EmpCode) as emp_code,
                RTRIM(t.DocID) as doc_id,
                RTRIM(t.DocDesc) as doc_desc,
                SUM(ln.Amount) as amount
            FROM ${headerTable} t
            JOIN ${lineTable} ln ON t.ID = ln.MasterID
            WHERE ${locSql}
              AND t.PhyMonth = ?
              AND t.PhyYear = ?
              AND ${empSql}
              AND t.Status IN (${statusFilter})
            GROUP BY t.EmpCode, t.DocID, t.DocDesc
        `;

    const params = [
        ...args.locCodes,
        args.periodMonth,
        args.periodYear,
        ...args.empCodes,
        ...args.locCodes,
        args.periodMonth,
        args.periodYear,
        ...args.empCodes
    ];

    return dbPtrj.query<AdtransSyncDetailRow>(`
            ${selectSql("PR_ADTRANS", "PR_ADTRANSLN", "1, 3")}
            UNION ALL
            ${selectSql("PR_ADTRANS_ARC", "PR_ADTRANSLN_ARC", "3")}
        `, params);
}

// ── checkAdtransDirectly SQL ─────────────────────────────────────────────────

export type CheckAdtransDirectlyArgs = {
    periodMonth: number;
    periodYear: number;
    empCodes: string[];
    normalizedDivisionCode: string;
    caseStatements: string;
    specificDocDescWhereSql: string;
    specificDocDescPatterns: string[];
    duplicateDocDescConditions: string;
    patternParams: string[];
};

/**
 * @query selectAdtransDirectlyTotals
 * @table PR_ADTRANS / PR_ADTRANS_ARC / PR_ADTRANSLN(_ARC) (db_ptrj)
 * @input dbPtrj, CheckAdtransDirectlyArgs
 * @output AdtransCheckTotalsRow[]  (emp_code + per-filter SUM columns)
 * @sql UNION of LIVE+ARC base rows -> GROUP BY emp_code with per-category SUM(CASE WHEN DocDesc pattern THEN Amount)
 */
export async function selectAdtransDirectlyTotals(
    dbPtrj: Database,
    args: CheckAdtransDirectlyArgs
): Promise<AdtransCheckTotalsRow[]> {
    const scopeClauses: string[] = [];
    const scopeParams: any[] = [];
    if (args.empCodes.length > 0) {
        scopeClauses.push(`RTRIM(t.EmpCode) IN (${args.empCodes.map(() => '?').join(',')})`);
        scopeParams.push(...args.empCodes);
    }
    if (args.normalizedDivisionCode) {
        scopeClauses.push(`UPPER(RTRIM(t.LocCode)) = ?`);
        scopeParams.push(args.normalizedDivisionCode);
    }
    if (scopeClauses.length === 0) return [];
    const scopeSql = `(${scopeClauses.join(' OR ')})`;

    const adtransQuery = `
            SELECT 
                emp_code, 
                ${args.caseStatements}
            FROM (
                SELECT 
                    RTRIM(t.EmpCode) as emp_code,
                    t.DocDesc,
                    ln.Amount
                FROM PR_ADTRANS t
                JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
                WHERE ${scopeSql}
                  AND t.PhyMonth = ?
                  AND t.PhyYear = ?
                  AND t.Status IN (1, 3)
                  ${args.specificDocDescWhereSql}

                UNION ALL

                SELECT
                    RTRIM(t.EmpCode) as emp_code,
                    t.DocDesc,
                    ln.Amount
                FROM PR_ADTRANS_ARC t
                JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
                WHERE ${scopeSql}
                  AND t.PhyMonth = ?
                  AND t.PhyYear = ?
                  AND t.Status = 3
                  ${args.specificDocDescWhereSql}
            ) src
            GROUP BY emp_code
        `;

    return dbPtrj.query<AdtransCheckTotalsRow>(adtransQuery, [
        ...scopeParams,
        args.periodMonth,
        args.periodYear,
        ...args.specificDocDescPatterns,
        ...scopeParams,
        args.periodMonth,
        args.periodYear,
        ...args.specificDocDescPatterns
    ]);
}

/**
 * @query selectAdtransDirectlyDuplicates
 * @table PR_ADTRANS / PR_ADTRANS_ARC / PR_ADTRANSLN(_ARC) (db_ptrj)
 * @input dbPtrj, CheckAdtransDirectlyArgs (+ duplicateDocDescConditions, patternParams)
 * @output AdtransDuplicateSourceRow[]  (full duplicate-detail rows for dedup report)
 * @sql UNION of LIVE+ARC grouped by ID+DocID+DocDate+DocDesc+EmpCode+EmpName HAVING SUM(|Amount|) > 0.01
 */
export async function selectAdtransDirectlyDuplicates(
    dbPtrj: Database,
    args: CheckAdtransDirectlyArgs
): Promise<AdtransDuplicateSourceRow[]> {
    const scopeClauses: string[] = [];
    const scopeParams: any[] = [];
    if (args.empCodes.length > 0) {
        scopeClauses.push(`RTRIM(t.EmpCode) IN (${args.empCodes.map(() => '?').join(',')})`);
        scopeParams.push(...args.empCodes);
    }
    if (args.normalizedDivisionCode) {
        scopeClauses.push(`UPPER(RTRIM(t.LocCode)) = ?`);
        scopeParams.push(args.normalizedDivisionCode);
    }
    if (scopeClauses.length === 0) return [];
    const scopeSql = `(${scopeClauses.join(' OR ')})`;

    const duplicateQuery = `
            SELECT
                t.ID as id,
                RTRIM(t.DocID) as doc_id,
                CONVERT(varchar(10), t.DocDate, 23) as doc_date,
                RTRIM(t.DocDesc) as doc_desc,
                RTRIM(t.EmpCode) as emp_code,
                RTRIM(t.EmpName) as emp_name,
                SUM(ln.Amount) as amount
            FROM PR_ADTRANS t
            JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
            WHERE ${scopeSql}
              AND t.PhyMonth = ?
              AND t.PhyYear = ?
              AND t.Status IN (1, 3)
              AND (${args.duplicateDocDescConditions})
              ${args.specificDocDescWhereSql}
            GROUP BY t.ID, t.DocID, t.DocDate, t.DocDesc, t.EmpCode, t.EmpName
            HAVING SUM(ABS(ISNULL(ln.Amount, 0))) > 0.01

            UNION ALL

            SELECT
                t.ID as id,
                RTRIM(t.DocID) as doc_id,
                CONVERT(varchar(10), t.DocDate, 23) as doc_date,
                RTRIM(t.DocDesc) as doc_desc,
                RTRIM(t.EmpCode) as emp_code,
                RTRIM(t.EmpName) as emp_name,
                SUM(ln.Amount) as amount
            FROM PR_ADTRANS_ARC t
            JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
            WHERE ${scopeSql}
              AND t.PhyMonth = ?
              AND t.PhyYear = ?
              AND t.Status = 3
              AND (${args.duplicateDocDescConditions})
              ${args.specificDocDescWhereSql}
            GROUP BY t.ID, t.DocID, t.DocDate, t.DocDesc, t.EmpCode, t.EmpName
            HAVING SUM(ABS(ISNULL(ln.Amount, 0))) > 0.01
        `;

    return dbPtrj.query<AdtransDuplicateSourceRow>(duplicateQuery, [
        ...scopeParams,
        args.periodMonth,
        args.periodYear,
        ...args.patternParams,
        ...args.specificDocDescPatterns,
        ...scopeParams,
        args.periodMonth,
        args.periodYear,
        ...args.patternParams,
        ...args.specificDocDescPatterns
    ]);
}

// ── compareAdtransWithAdjustments SQL ──────────────────────────────────────

export type SelectAdtransCompareRowsArgs = {
    periodMonth: number;
    periodYear: number;
    normalizedDivisionCode: string;
    caseStatements: string;
    uniqueVirtualGangCodes: string[];
    gangJoin: string;
    gangWhere: string;
};

/**
 * @query selectAdtransCompareTotals
 * @table PR_ADTRANS / PR_ADTRANS_ARC / PR_ADTRANSLN(_ARC) / HR_EMPLOYEE (db_ptrj)
 * @input dbPtrj, { periodMonth, periodYear, normalizedDivisionCode, caseStatements, uniqueVirtualGangCodes, gangJoin, gangWhere }
 * @output AdtransCompareTotalsRow[]  (emp_code, nik, per-category SUM columns)
 * @sql LIVE+ARC UNION joined to HR_EMPLOYEE for NIK + optional virtual-division gang join, grouped by emp_code with MAX(nik)
 */
export async function selectAdtransCompareTotals(
    dbPtrj: Database,
    args: SelectAdtransCompareRowsArgs
): Promise<AdtransCompareTotalsRow[]> {
    const adtransQuery = `
            SELECT
                emp_code,
                MAX(nik) as nik,
                ${args.caseStatements}
            FROM (
                SELECT
                    RTRIM(t.EmpCode) as emp_code,
                    RTRIM(ISNULL(e.NewICNo, '')) as nik,
                    t.DocDesc,
                    ln.Amount
                FROM PR_ADTRANS t
                ${args.gangJoin}
                LEFT JOIN HR_EMPLOYEE e ON RTRIM(e.EmpCode) = RTRIM(t.EmpCode)
                JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
                WHERE UPPER(RTRIM(t.LocCode)) = ?
                  AND t.PhyMonth = ?
                  AND t.PhyYear = ?
                  AND t.Status IN (1, 3)
                  ${args.gangWhere}

                UNION ALL

                SELECT
                    RTRIM(t.EmpCode) as emp_code,
                    RTRIM(ISNULL(e.NewICNo, '')) as nik,
                    t.DocDesc,
                    ln.Amount
                FROM PR_ADTRANS_ARC t
                ${args.gangJoin}
                LEFT JOIN HR_EMPLOYEE e ON RTRIM(e.EmpCode) = RTRIM(t.EmpCode)
                JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
                WHERE UPPER(RTRIM(t.LocCode)) = ?
                  AND t.PhyMonth = ?
                  AND t.PhyYear = ?
                  AND t.Status = 3
                  ${args.gangWhere}
            ) src
            GROUP BY emp_code
        `;

    return dbPtrj.query<AdtransCompareTotalsRow>(adtransQuery, [
        args.normalizedDivisionCode, args.periodMonth, args.periodYear, ...args.uniqueVirtualGangCodes,
        args.normalizedDivisionCode, args.periodMonth, args.periodYear, ...args.uniqueVirtualGangCodes
    ]);
}

/**
 * @query selectAdtransCompareDetails
 * @table PR_ADTRANS / PR_ADTRANS_ARC / PR_ADTRANSLN(_ARC) (db_ptrj)
 * @input dbPtrj, { periodMonth, periodYear, normalizedDivisionCode, uniqueVirtualGangCodes, gangJoin, gangWhere }
 * @output AdtransCompareDetailRow[]  (emp_code, doc_id, doc_desc, amount)
 * @sql LIVE+ARC UNION joined via PR_ADTRANSLN(_ARC) with optional virtual-division gang join, per-row details (no grouping)
 */
export async function selectAdtransCompareDetails(
    dbPtrj: Database,
    args: SelectAdtransCompareRowsArgs
): Promise<AdtransCompareDetailRow[]> {
    return dbPtrj.query<AdtransCompareDetailRow>(`
            SELECT
                RTRIM(t.EmpCode) as emp_code,
                RTRIM(t.DocID) as doc_id,
                RTRIM(t.DocDesc) as doc_desc,
                ln.Amount as amount
            FROM PR_ADTRANS t
            ${args.gangJoin}
            JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
            WHERE UPPER(RTRIM(t.LocCode)) = ?
              AND t.PhyMonth = ?
              AND t.PhyYear = ?
              AND t.Status IN (1, 3)
              ${args.gangWhere}

            UNION ALL

            SELECT
                RTRIM(t.EmpCode) as emp_code,
                RTRIM(t.DocID) as doc_id,
                RTRIM(t.DocDesc) as doc_desc,
                ln.Amount as amount
            FROM PR_ADTRANS_ARC t
            ${args.gangJoin}
            JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
            WHERE UPPER(RTRIM(t.LocCode)) = ?
              AND t.PhyMonth = ?
              AND t.PhyYear = ?
              AND t.Status = 3
              ${args.gangWhere}
        `, [
        args.normalizedDivisionCode, args.periodMonth, args.periodYear, ...args.uniqueVirtualGangCodes,
        args.normalizedDivisionCode, args.periodMonth, args.periodYear, ...args.uniqueVirtualGangCodes
    ]);
}

// ── HR_EMPLOYEE / HR_GANGLN identity lookups (db_ptrj) ───────────────────────

export type SelectGangScopedEmployeeIdentityArgs = {
    identifier: string;
    gangCode: string;
};

/**
 * @query selectGangScopedEmployeeIdentity
 * @table HR_EMPLOYEE / HR_GANGLN (db_ptrj)
 * @input dbPtrj, { identifier, gangCode }
 * @output { nik, emp_code, emp_name, gang_code } | null
 * @sql SELECT TOP 1 nik/empcode/name/gang WHERE (EmpCode|NewICNo)=? AND gang=? ORDER BY EmpCode DESC
 *        (reverseCompareAdtransWithAdjustments stored->PTRJ EmpCode resolution by gang scope)
 */
export async function selectGangScopedEmployeeIdentity(
    dbPtrj: Database,
    args: SelectGangScopedEmployeeIdentityArgs
): Promise<{ nik: string; emp_code: string; emp_name: string; gang_code: string } | null> {
    return dbPtrj.queryOne<any>(`
            SELECT TOP 1
                RTRIM(ISNULL(e.NewICNo, '')) as nik,
                RTRIM(e.EmpCode) as emp_code,
                RTRIM(e.EmpName) as emp_name,
                RTRIM(gl.GangCode) as gang_code
            FROM HR_EMPLOYEE e
            JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
            WHERE (RTRIM(e.EmpCode) = ? OR RTRIM(ISNULL(e.NewICNo, '')) = ?)
              AND UPPER(RTRIM(gl.GangCode)) = ?
            ORDER BY e.EmpCode DESC
        `, [args.identifier, args.identifier, args.gangCode]);
}

export type SelectEmployeeIdentityByNameAndGangArgs = {
    empName: string;
    gangCode: string;
};

/**
 * @query selectEmployeeIdentityByNameAndGang
 * @table HR_EMPLOYEE / HR_GANGLN (db_ptrj)
 * @input dbPtrj, { empName, gangCode }
 * @output { nik, emp_code, emp_name } | null
 * @sql SELECT TOP 1 NewICNo/EmpCode/EmpName WHERE EmpName=? AND GangCode=? ORDER BY EmpCode DESC
 *        (resolveManualAdjustmentIdentityByContext — name+gang identity fallback)
 */
export async function selectEmployeeIdentityByNameAndGang(
    dbPtrj: Database,
    args: SelectEmployeeIdentityByNameAndGangArgs
): Promise<{ nik: string; emp_code: string; emp_name: string } | null> {
    return dbPtrj.queryOne<any>(`
            SELECT TOP 1
                RTRIM(ISNULL(e.NewICNo, '')) as nik,
                RTRIM(e.EmpCode) as emp_code,
                RTRIM(e.EmpName) as emp_name
            FROM HR_EMPLOYEE e
            JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
            WHERE UPPER(RTRIM(e.EmpName)) = ?
              AND UPPER(RTRIM(gl.GangCode)) = ?
            ORDER BY e.EmpCode DESC
        `, [args.empName, args.gangCode]);
}

export type SelectHistoryEmployeeIdentityArgs = {
    fallbackNik: string;
    periodMonth: number;
    periodYear: number;
    inputEmpCode: string;
    inputNik: string;
    empName: string;
    gangCode: string;
};

/**
 * @query selectHistoryEmployeeIdentity
 * @table history_hr_employee (extend_db_ptrj)
 * @input dbExtend, { fallbackNik, periodMonth, periodYear, inputEmpCode, inputNik, empName, gangCode }
 * @output { emp_code, nik, emp_name } | null
 * @sql Single-history-row uniqueness check (subquery COUNT(DISTINCT emp_code)=1) + identity OR-clause +
 *        ordering by match preference then created_at/id DESC
 *        (resolveManualAdjustmentIdentityByHistory — numeric-NIK/history identity resolution)
 */
export async function selectHistoryEmployeeIdentity(
    dbExtend: Database,
    args: SelectHistoryEmployeeIdentityArgs
): Promise<{ emp_code: string; nik: string; emp_name: string } | null> {
    return dbExtend.queryOne<any>(`
            SELECT TOP 1
                RTRIM(h.emp_code) as emp_code,
                COALESCE(
                    NULLIF(RTRIM(ISNULL(h.nik, '')), ''),
                    NULLIF(RTRIM(ISNULL(h.new_nik, '')), ''),
                    ?
                ) as nik,
                RTRIM(ISNULL(h.emp_name, '')) as emp_name
            FROM dbo.history_hr_employee h
            WHERE h.period_month = ?
              AND h.period_year = ?
              AND NULLIF(RTRIM(ISNULL(h.emp_code, '')), '') IS NOT NULL
              AND (
                  RTRIM(h.emp_code) = ?
                  OR NULLIF(RTRIM(ISNULL(h.nik, '')), '') = ?
                  OR NULLIF(RTRIM(ISNULL(h.new_nik, '')), '') = ?
                  OR NULLIF(RTRIM(ISNULL(h.nik, '')), '') = ?
                  OR NULLIF(RTRIM(ISNULL(h.new_nik, '')), '') = ?
                  OR (
                      ? <> ''
                      AND ? <> ''
                      AND UPPER(RTRIM(h.emp_name)) = ?
                      AND UPPER(RTRIM(h.gang_code)) = ?
                  )
              )
              AND (
                  SELECT COUNT(DISTINCT RTRIM(h2.emp_code))
                  FROM dbo.history_hr_employee h2
                  WHERE h2.period_month = h.period_month
                    AND h2.period_year = h.period_year
                    AND NULLIF(RTRIM(ISNULL(h2.emp_code, '')), '') IS NOT NULL
                    AND (
                        RTRIM(h2.emp_code) = ?
                        OR NULLIF(RTRIM(ISNULL(h2.nik, '')), '') = ?
                        OR NULLIF(RTRIM(ISNULL(h2.new_nik, '')), '') = ?
                        OR NULLIF(RTRIM(ISNULL(h2.nik, '')), '') = ?
                        OR NULLIF(RTRIM(ISNULL(h2.new_nik, '')), '') = ?
                        OR (
                            ? <> ''
                            AND ? <> ''
                            AND UPPER(RTRIM(h2.emp_name)) = ?
                            AND UPPER(RTRIM(h2.gang_code)) = ?
                        )
                    )
              ) = 1
            ORDER BY
                CASE
                    WHEN RTRIM(h.emp_code) = ? THEN 0
                    WHEN NULLIF(RTRIM(ISNULL(h.nik, '')), '') = ? OR NULLIF(RTRIM(ISNULL(h.new_nik, '')), '') = ? THEN 1
                    WHEN NULLIF(RTRIM(ISNULL(h.nik, '')), '') = ? OR NULLIF(RTRIM(ISNULL(h.new_nik, '')), '') = ? THEN 2
                    ELSE 3
                END,
                h.created_at DESC,
                h.id DESC
        `, [
        args.fallbackNik,
        args.periodMonth, args.periodYear,
        args.inputEmpCode,
        args.inputEmpCode, args.inputEmpCode,
        args.inputNik,
        args.inputNik,
        args.empName, args.gangCode,
        args.empName, args.gangCode,
        args.inputEmpCode,
        args.inputEmpCode, args.inputEmpCode,
        args.inputNik,
        args.inputNik,
        args.empName, args.gangCode,
        args.empName, args.gangCode,
        args.inputEmpCode,
        args.inputEmpCode, args.inputEmpCode,
        args.inputNik, args.inputNik
    ]);
}

/**
 * @query selectGangMemberEmpCodes
 * @table HR_GANGLN / HR_EMPLOYEE (db_ptrj)
 * @input dbPtrj, gangCode
 * @output string[]  (active emp_codes in that gang)
 * @sql SELECT GangMember joined to active employee (Status=1) WHERE GangCode=?  (listAdtransDocIds gang-scope resolver)
 */
export async function selectGangMemberEmpCodes(
    dbPtrj: Database,
    gangCode: string
): Promise<string[]> {
    const rows = await dbPtrj.query<{ emp_code: string }>(`
                SELECT RTRIM(gl.GangMember) as emp_code
                FROM HR_GANGLN gl
                JOIN HR_EMPLOYEE e ON RTRIM(e.EmpCode) = RTRIM(gl.GangMember)
                WHERE UPPER(RTRIM(gl.GangCode)) = ?
                  AND e.Status = 1
            `, [gangCode]);
    return rows.map((r) => r.emp_code);
}
