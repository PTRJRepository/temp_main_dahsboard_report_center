/**
 * @module backend/src/services/payroll/manualAdjustments/manualAdjustmentQueries.ts
 * @purpose CRUD SQL for payroll_manual_adjustments + employee_other_incomes as (db, args) functions.
 * @input Database + filter/upsert args (month/year, divisionCodes, identity, amounts, names).
 * @output ManualAdjustment rows, inserted/existing ids, deleted counts, other-income ids.
 * @depends ../../../db/client#Database, ../../manualAdjustmentService (types only)
 * @sideeffect Reads/writes dbo.payroll_manual_adjustments and dbo.employee_other_incomes (extend_db_ptrj);
 *             reads dbo.employee_estate (extend_db_ptrj) for jabatan guard.
 * @tests backend/src/services/manualAdjustmentService.test.ts
 */

import { Database } from "../../../db/client";
import type { ManualAdjustment, ManualAdjustmentNameOption } from "../../manualAdjustmentService";

export function buildNormalizedSqlNameExpression(columnName: string): string {
    let expression = `UPPER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(REPLACE(${columnName}, CHAR(9), ' '), CHAR(10), ' '), CHAR(13), ' '), CHAR(160), ' '))))`;

    for (let i = 0; i < 4; i += 1) {
        expression = `REPLACE(${expression}, '  ', ' ')`;
    }

    return expression;
}

export type AdjustmentLookupIdentity = {
    empCode: string | null;
    nik: string | null;
    originalIdentifier: string;
};

// ═══════════════════════════════════════════════════════════════════════
// SECTION: SELECT Queries (getAdjustments, listNameOptions, getById, existing, conversion/comparison sources, other-income lookups, estate jabatan)
// ═══════════════════════════════════════════════════════════════════════

export type SelectAdjustmentsArgs = {
    month: number;
    year: number;
    divisionCodes?: string[];
    gangCode?: string;
    empLookup?: AdjustmentLookupIdentity;
    adjustmentTypes?: string[];
    adjustmentName?: string;
    metadataOnly?: boolean;
};

/**
 * @query selectAdjustments
 * @table payroll_manual_adjustments (extend_db_ptrj)
 * @input db, { month, year, divisionCodes?, gangCode?, empLookup?, adjustmentTypes?, adjustmentName?, metadataOnly? }
 * @output ManualAdjustment[]
 * @sql SELECT * FROM dbo.payroll_manual_adjustments WHERE period_month=? AND period_year=? AND adjustment_type IN (...) AND optional division/gang/emp/type/name/metadata filters
 */
export async function selectAdjustments(db: Database, args: SelectAdjustmentsArgs): Promise<ManualAdjustment[]> {
    let query = `
            SELECT * FROM dbo.payroll_manual_adjustments
            WHERE period_month = ? AND period_year = ?
              AND adjustment_type IN ('PREMI', 'POTONGAN_KOTOR', 'POTONGAN_BERSIH', 'PENDAPATAN_LAINNYA', 'AUTO_BUFFER')
        `;
    const params: any[] = [args.month, args.year];

    if (args.divisionCodes) {
        if (args.divisionCodes.length === 1) {
            query += ` AND (division_code = ? OR division_code IS NULL OR LTRIM(RTRIM(division_code)) = '')`;
            params.push(args.divisionCodes[0]);
        } else if (args.divisionCodes.length > 1) {
            query += ` AND (division_code IN (${args.divisionCodes.map(() => '?').join(', ')}) OR division_code IS NULL OR LTRIM(RTRIM(division_code)) = '')`;
            params.push(...args.divisionCodes);
        }
    }

    if (args.gangCode && args.gangCode !== 'ALL') {
        query += ` AND gang_code = ?`;
        params.push(args.gangCode);
    }

    if (args.empLookup) {
        query += ` AND (emp_code = ? OR nik = ? OR emp_code = ?)`;
        params.push(args.empLookup.empCode, args.empLookup.nik, args.empLookup.originalIdentifier);
    }

    if (args.adjustmentTypes) {
        if (args.adjustmentTypes.length === 1) {
            query += ` AND adjustment_type = ?`;
            params.push(args.adjustmentTypes[0]);
        } else if (args.adjustmentTypes.length > 1) {
            query += ` AND adjustment_type IN (${args.adjustmentTypes.map(() => '?').join(', ')})`;
            params.push(...args.adjustmentTypes);
        }
    }

    if (args.adjustmentName) {
        query += ` AND UPPER(adjustment_name) LIKE ?`;
        params.push(`%${args.adjustmentName.toUpperCase()}%`);
    }

    if (args.metadataOnly) {
        query += ` AND metadata_json IS NOT NULL AND LTRIM(RTRIM(metadata_json)) <> ''`;
    }

    return db.query<ManualAdjustment>(query, params);
}

export type SelectAdjustmentNameOptionsArgs = {
    resolvedTypes: string[];
    periodMonth?: number;
    periodYear?: number;
    divisionCodes?: string[];
    gangCode?: string;
    search?: string;
    metadataOnly?: boolean;
    limit: number;
};

/**
 * @query selectAdjustmentNameOptions
 * @table payroll_manual_adjustments (extend_db_ptrj)
 * @input db, { resolvedTypes, periodMonth?, periodYear?, divisionCodes?, gangCode?, search?, metadataOnly?, limit }
 * @output ManualAdjustmentNameOption[]
 * @sql SELECT DISTINCT TOP (limit) adjustment_type, adjustment_name FROM dbo.payroll_manual_adjustments WHERE adjustment_type IN (?) AND name NOT NULL [+optional period/division/gang/search/metadata filters] ORDER BY type,name
 */
export async function selectAdjustmentNameOptions(
    db: Database,
    args: SelectAdjustmentNameOptionsArgs
): Promise<ManualAdjustmentNameOption[]> {
    const params: any[] = [];
    let query = `
            SELECT DISTINCT TOP (${args.limit})
                RTRIM(LTRIM(adjustment_type)) AS adjustment_type,
                RTRIM(LTRIM(adjustment_name)) AS adjustment_name
            FROM dbo.payroll_manual_adjustments
            WHERE adjustment_type IN (${args.resolvedTypes.map(() => "?").join(", ")})
              AND NULLIF(LTRIM(RTRIM(adjustment_name)), '') IS NOT NULL
        `;
    params.push(...args.resolvedTypes);

    if (Number.isInteger(args.periodMonth)) {
        query += ` AND period_month = ?`;
        params.push(args.periodMonth);
    }

    if (Number.isInteger(args.periodYear)) {
        query += ` AND period_year = ?`;
        params.push(args.periodYear);
    }

    if (args.divisionCodes) {
        if (args.divisionCodes.length === 1) {
            query += ` AND division_code = ?`;
            params.push(args.divisionCodes[0]);
        } else if (args.divisionCodes.length > 1) {
            query += ` AND division_code IN (${args.divisionCodes.map(() => "?").join(", ")})`;
            params.push(...args.divisionCodes);
        }
    }

    if (args.gangCode) {
        query += ` AND UPPER(gang_code) = ?`;
        params.push(args.gangCode);
    }

    if (args.search) {
        query += ` AND UPPER(adjustment_name) LIKE ?`;
        params.push(args.search);
    }

    if (args.metadataOnly) {
        query += ` AND metadata_json IS NOT NULL AND LTRIM(RTRIM(metadata_json)) <> ''`;
    }

    query += ` ORDER BY adjustment_type ASC, adjustment_name ASC`;

    return db.query<ManualAdjustmentNameOption>(query, params);
}

export type SelectExistingAdjustmentIdArgs = {
    periodMonth: number;
    periodYear: number;
    empCode: string;
    nik: string | null;
    originalIdentifier: string;
    adjustmentType: string;
    normalizedAdjustmentName: string;
};

/**
 * @query selectExistingAdjustmentId
 * @table payroll_manual_adjustments (extend_db_ptrj)
 * @input db, { periodMonth, periodYear, empCode, nik, originalIdentifier, adjustmentType, normalizedAdjustmentName }
 * @output { id } | null
 * @sql SELECT TOP 1 id ... WHERE period+identity+type+normalized(name) match, ORDER BY identity-preference then id DESC
 */
export async function selectExistingAdjustmentId(
    db: Database,
    args: SelectExistingAdjustmentIdArgs
): Promise<{ id: number } | null> {
    const normalizedAdjustmentNameSql = buildNormalizedSqlNameExpression("adjustment_name");
    return db.queryOne<{ id: number }>(`
            SELECT TOP 1 id FROM dbo.payroll_manual_adjustments
            WHERE period_month = ? AND period_year = ?
            AND (emp_code = ? OR nik = ? OR emp_code = ?)
            AND adjustment_type = ?
            AND ${normalizedAdjustmentNameSql} = ?
            ORDER BY
                CASE
                    WHEN emp_code = ? THEN 0
                    WHEN nik = ? THEN 1
                    WHEN emp_code = ? THEN 2
                    ELSE 3
                END,
                id DESC
        `, [
        args.periodMonth, args.periodYear,
        args.empCode, args.nik, args.originalIdentifier,
        args.adjustmentType, args.normalizedAdjustmentName,
        args.empCode, args.nik, args.originalIdentifier
    ]);
}

/**
 * @query selectAdjustmentById
 * @table payroll_manual_adjustments (extend_db_ptrj)
 * @input db, id
 * @output ManualAdjustment | undefined
 * @sql SELECT TOP 1 full row WHERE id = ?
 */
export async function selectAdjustmentById(db: Database, id: number): Promise<ManualAdjustment | undefined> {
    const rows = await db.query<ManualAdjustment>(`
                SELECT TOP 1 id, period_month, period_year, emp_code, nik, emp_name, gang_code,
                       division_code, adjustment_type, adjustment_name, amount, remarks, metadata_json
                FROM dbo.payroll_manual_adjustments
                WHERE id = ?
            `, [id]);
    return rows[0];
}

export type AdjustmentColumnFilterArgs = {
    periodMonth: number;
    periodYear: number;
    adjustmentType: string;
    normalizedAdjustmentName: string;
    divisionCode?: string;
};

function buildAdjustmentColumnFilter(args: AdjustmentColumnFilterArgs): { sql: string; params: any[] } {
    const normalizedAdjustmentNameSql = buildNormalizedSqlNameExpression("adjustment_name");
    const params: any[] = [
        args.periodMonth,
        args.periodYear,
        args.adjustmentType,
        args.normalizedAdjustmentName
    ];
    let divisionFilter = "";

    if (args.divisionCode) {
        divisionFilter = " AND division_code = ?";
        params.push(args.divisionCode);
    }

    return {
        sql: `
            WHERE period_month = ? AND period_year = ?
              AND adjustment_type = ?
              AND ${normalizedAdjustmentNameSql} = ?
              ${divisionFilter}
        `,
        params
    };
}

/**
 * @query selectAdjustmentColumnIds
 * @table payroll_manual_adjustments (extend_db_ptrj)
 * @input db, AdjustmentColumnFilterArgs
 * @output { id }[]
 * @sql SELECT id ... WHERE period+type+normalized(name)+optional division
 */
export async function selectAdjustmentColumnIds(
    db: Database,
    args: AdjustmentColumnFilterArgs
): Promise<{ id: number }[]> {
    const filter = buildAdjustmentColumnFilter(args);
    return db.query<{ id: number }>(`
            SELECT id FROM dbo.payroll_manual_adjustments
            ${filter.sql}
        `, filter.params);
}

export type SelectConversionSourceRowsArgs = {
    periodMonth: number;
    periodYear: number;
    adjustmentType: string;
    fromAdjustmentName: string;
    divisionCodes?: string[];
};

/**
 * @query selectConversionSourceRows
 * @table payroll_manual_adjustments (extend_db_ptrj)
 * @input db, { periodMonth, periodYear, adjustmentType, fromAdjustmentName, divisionCodes? }
 * @output ManualAdjustment[]
 * @sql SELECT full row WHERE period+type+normalized(name)=from [+optional division variants] ORDER BY id ASC
 */
export async function selectConversionSourceRows(
    db: Database,
    args: SelectConversionSourceRowsArgs
): Promise<ManualAdjustment[]> {
    const normalizedFromNameSql = buildNormalizedSqlNameExpression("adjustment_name");
    const params: any[] = [args.periodMonth, args.periodYear, args.adjustmentType, args.fromAdjustmentName];
    let divisionFilter = "";
    if (args.divisionCodes) {
        if (args.divisionCodes.length === 1) {
            divisionFilter = " AND (division_code = ? OR division_code IS NULL OR LTRIM(RTRIM(division_code)) = '')";
            params.push(args.divisionCodes[0]);
        } else if (args.divisionCodes.length > 1) {
            divisionFilter = ` AND (division_code IN (${args.divisionCodes.map(() => '?').join(', ')}) OR division_code IS NULL OR LTRIM(RTRIM(division_code)) = '')`;
            params.push(...args.divisionCodes);
        }
    }

    return db.query<ManualAdjustment>(`
            SELECT id, period_month, period_year, emp_code, nik, emp_name, gang_code, division_code,
                   adjustment_type, adjustment_name, amount, remarks, metadata_json
            FROM dbo.payroll_manual_adjustments
            WHERE period_month = ? AND period_year = ?
              AND adjustment_type = ?
              AND ${normalizedFromNameSql} = ?
              ${divisionFilter}
            ORDER BY id ASC
        `, params);
}

export type SelectConversionCollisionArgs = {
    periodMonth: number;
    periodYear: number;
    adjustmentType: string;
    toAdjustmentName: string;
    empCode: string;
    nik: string;
};

/**
 * @query selectConversionCollision
 * @table payroll_manual_adjustments (extend_db_ptrj)
 * @input db, { periodMonth, periodYear, adjustmentType, toAdjustmentName, empCode, nik }
 * @output { id } | null
 * @sql SELECT TOP 1 id WHERE period+type+normalized(name)=to AND identity match (collision guard for conversion)
 */
export async function selectConversionCollision(
    db: Database,
    args: SelectConversionCollisionArgs
): Promise<{ id: number } | null> {
    const normalizedToNameSql = buildNormalizedSqlNameExpression("adjustment_name");
    return db.queryOne<{ id: number }>(`
            SELECT TOP 1 id FROM dbo.payroll_manual_adjustments
            WHERE period_month = ? AND period_year = ?
              AND adjustment_type = ?
              AND ${normalizedToNameSql} = ?
              AND (emp_code = ? OR nik = ? OR emp_code = ?)
        `, [
        args.periodMonth, args.periodYear, args.adjustmentType, args.toAdjustmentName,
        args.empCode, args.nik, args.empCode
    ]);
}

export type SelectComparisonAdjustmentsArgs = {
    periodMonth: number;
    periodYear: number;
    divisionCodes: string[];
};

/**
 * @query selectComparisonAdjustments
 * @table payroll_manual_adjustments (extend_db_ptrj)
 * @input db, { periodMonth, periodYear, divisionCodes }
 * @output rows { emp_code, nik, adjustment_type, adjustment_name, amount, remarks, gang_code, division_code }
 * @sql SELECT identity+type+name+amount+remarks+gang+division WHERE period + division IN (?) (forward compare source)
 */
export async function selectComparisonAdjustments(
    db: Database,
    args: SelectComparisonAdjustmentsArgs
): Promise<any[]> {
    return db.query<any>(`
            SELECT
                emp_code,
                nik,
                adjustment_type,
                adjustment_name,
                amount,
                remarks,
                gang_code,
                division_code
            FROM dbo.payroll_manual_adjustments
            WHERE period_month = ? AND period_year = ?
              AND UPPER(RTRIM(division_code)) IN (${args.divisionCodes.map(() => '?').join(',')})
        `, [args.periodMonth, args.periodYear, ...args.divisionCodes]);
}

export type SelectReverseComparisonAdjustmentsArgs = {
    periodMonth: number;
    periodYear: number;
    divisionCodes: string[];
    autoBufferAdjustmentNames: string[];
    includesManualCategories: boolean;
};

/**
 * @query selectReverseComparisonAdjustments
 * @table payroll_manual_adjustments (extend_db_ptrj)
 * @input db, { periodMonth, periodYear, divisionCodes, autoBufferAdjustmentNames, includesManualCategories }
 * @output rows { emp_code, nik, adjustment_type, adjustment_name, amount, remarks, gang_code, division_code }
 * @sql SELECT ... WHERE period + division IN (?) AND (AUTO_BUFFER name IN (?) [+ manual categories]) ORDER BY emp_code, adjustment_name
 */
export async function selectReverseComparisonAdjustments(
    db: Database,
    args: SelectReverseComparisonAdjustmentsArgs
): Promise<any[]> {
    return db.query<any>(`
            SELECT
                emp_code,
                nik,
                adjustment_type,
                adjustment_name,
                amount,
                remarks,
                gang_code,
                division_code
            FROM dbo.payroll_manual_adjustments
            WHERE period_month = ? AND period_year = ?
              AND UPPER(RTRIM(division_code)) IN (${args.divisionCodes.map(() => '?').join(',')})
              AND (
                  (adjustment_type = 'AUTO_BUFFER' AND UPPER(RTRIM(adjustment_name)) IN (${args.autoBufferAdjustmentNames.length ? args.autoBufferAdjustmentNames.map(() => '?').join(',') : "''"}))
                  ${args.includesManualCategories ? "OR adjustment_type IN ('PREMI', 'POTONGAN_KOTOR', 'POTONGAN_BERSIH')" : ""}
              )
            ORDER BY emp_code, adjustment_name
        `, [args.periodMonth, args.periodYear, ...args.divisionCodes, ...args.autoBufferAdjustmentNames]);
}

export type SelectOtherIncomeByKeyArgs = {
    realNik: string;
    empCode: string;
    periodMonth: number;
    periodYear: number;
    incomeName: string;
};

/**
 * @query selectOtherIncomeByNik
 * @table employee_other_incomes (extend_db_ptrj)
 * @input db, { realNik, periodMonth, periodYear, incomeName }
 * @output { id, nik, emp_code } | null
 * @sql SELECT id,nik,emp_code WHERE nik=? AND period + normalized(income_name)=?
 */
export async function selectOtherIncomeByNik(
    db: Database,
    args: SelectOtherIncomeByKeyArgs
): Promise<{ id: number; nik: string; emp_code: string } | null> {
    const normalizedNameSql = buildNormalizedSqlNameExpression("income_name");
    return db.queryOne<{ id: number; nik: string; emp_code: string }>(`
            SELECT id, nik, emp_code FROM dbo.employee_other_incomes
            WHERE nik = ? AND period_month = ? AND period_year = ?
            AND ${normalizedNameSql} = ?
        `, [args.realNik, args.periodMonth, args.periodYear, args.incomeName]);
}

/**
 * @query selectOtherIncomeByEmpCode
 * @table employee_other_incomes (extend_db_ptrj)
 * @input db, { empCode, periodMonth, periodYear, incomeName }
 * @output { id, nik, emp_code } | null
 * @sql SELECT id,nik,emp_code WHERE emp_code=? AND period + normalized(income_name)=?
 */
export async function selectOtherIncomeByEmpCode(
    db: Database,
    args: SelectOtherIncomeByKeyArgs
): Promise<{ id: number; nik: string; emp_code: string } | null> {
    const normalizedNameSql = buildNormalizedSqlNameExpression("income_name");
    return db.queryOne<{ id: number; nik: string; emp_code: string }>(`
            SELECT id, nik, emp_code FROM dbo.employee_other_incomes
            WHERE emp_code = ? AND period_month = ? AND period_year = ?
            AND ${normalizedNameSql} = ?
        `, [args.empCode, args.periodMonth, args.periodYear, args.incomeName]);
}

/**
 * @query selectEstateJabatanByEmpCode
 * @table employee_estate (extend_db_ptrj)
 * @input db, empCode
 * @output { jabatan: string } | undefined  (first row)
 * @sql SELECT TOP 1 jabatan FROM employee_estate WHERE RTRIM(empcode) = ?
 */
export async function selectEstateJabatanByEmpCode(
    db: Database,
    empCode: string
): Promise<{ jabatan: string } | undefined> {
    const rows = await db.query<{ jabatan: string }>(
        "SELECT TOP 1 jabatan FROM employee_estate WHERE RTRIM(empcode) = ?",
        [String(empCode).trim()]
    );
    return rows[0];
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION: INSERT/UPDATE Queries (save, update, conversion update, autoufffer sync upsert, other-income upsert, remarks)
// ═══════════════════════════════════════════════════════════════════════

export type UpdateAdjustmentArgs = {
    id: number;
    empCode: string;
    nik: string | null;
    gangCode: string;
    divisionCode: string | null | undefined;
    amount: number;
    remarks: string | null;
    empName: string | null;
    user: string;
    hasMetadataJsonInput: boolean;
    metadataJsonStr: string | null;
};

/**
 * @query updateAdjustment
 * @table payroll_manual_adjustments (extend_db_ptrj)
 * @input db, UpdateAdjustmentArgs
 * @output void
 * @sql UPDATE ... SET emp_code,nik,gang_code(COALESCE),division_code(COALESCE),amount,remarks,metadata_json(cond),emp_name,touch WHERE id=?
 */
export async function updateAdjustment(db: Database, args: UpdateAdjustmentArgs): Promise<void> {
    await db.query(`
                    UPDATE dbo.payroll_manual_adjustments
                    SET emp_code = ?,
                        nik = ?,
                        gang_code = COALESCE(NULLIF(LTRIM(RTRIM(?)), ''), gang_code),
                        division_code = COALESCE(?, division_code),
                        amount = ?,
                        remarks = ?,
                        metadata_json = ${args.hasMetadataJsonInput ? "?" : "metadata_json"},
                        emp_name = ?,
                        updated_at = GETDATE(),
                        updated_by = ?
                    WHERE id = ?
                `, args.hasMetadataJsonInput
        ? [args.empCode, args.nik, args.gangCode, args.divisionCode, args.amount, args.remarks, args.metadataJsonStr, args.empName, args.user, args.id]
        : [args.empCode, args.nik, args.gangCode, args.divisionCode, args.amount, args.remarks, args.empName, args.user, args.id]);
}

export type InsertAdjustmentArgs = {
    periodMonth: number;
    periodYear: number;
    empCode: string;
    nik: string | null;
    empName: string | null;
    gangCode: string;
    divisionCode: string | null | undefined;
    adjustmentType: string;
    adjustmentName: string;
    amount: number;
    remarks: string | null;
    metadataJsonStr: string | null;
    user: string;
};

/**
 * @query insertAdjustment
 * @table payroll_manual_adjustments (extend_db_ptrj)
 * @input db, InsertAdjustmentArgs
 * @output inserted id | undefined
 * @sql INSERT full row OUTPUT INSERTED.id
 */
export async function insertAdjustment(db: Database, args: InsertAdjustmentArgs): Promise<number | undefined> {
    const result = await db.query<{ id: number }>(`
                INSERT INTO dbo.payroll_manual_adjustments (
                    period_month, period_year, emp_code, nik, emp_name, gang_code, division_code,
                    adjustment_type, adjustment_name, amount, remarks, metadata_json, created_by
                ) OUTPUT INSERTED.id VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                )
            `, [
        args.periodMonth, args.periodYear, args.empCode, args.nik, args.empName, args.gangCode, args.divisionCode,
        args.adjustmentType, args.adjustmentName, args.amount, args.remarks, args.metadataJsonStr, args.user
    ]);
    return result[0]?.id;
}

/**
 * @query updateAdjustmentRemarks
 * @table payroll_manual_adjustments (extend_db_ptrj)
 * @input db, { id, remarks, user }
 * @output void
 * @sql UPDATE SET remarks=?, touch WHERE id=?  (used by sync-status API + writeBackSyncStatusForId)
 */
export async function updateAdjustmentRemarks(
    db: Database,
    args: { id: number; remarks: string; user: string }
): Promise<void> {
    await db.query(`
                UPDATE dbo.payroll_manual_adjustments
                SET remarks = ?, updated_at = GETDATE(), updated_by = ?
                WHERE id = ?
            `, [args.remarks, args.user, args.id]);
}

export type UpdateConvertedAdjustmentArgs = {
    id: number;
    adjustmentName: string;
    remarks: string | null;
    metadataJson: string | null;
    amount: number;
    user: string;
};

/**
 * @query updateConvertedAdjustment
 * @table payroll_manual_adjustments (extend_db_ptrj)
 * @input db, { id, adjustmentName, remarks, metadataJson, amount, user }
 * @output void
 * @sql UPDATE SET adjustment_name,remarks,metadata_json,amount,touch WHERE id=?  (convertAdjustmentType per-row)
 */
export async function updateConvertedAdjustment(db: Database, args: UpdateConvertedAdjustmentArgs): Promise<void> {
    await db.query(`
                UPDATE dbo.payroll_manual_adjustments
                SET adjustment_name = ?,
                    remarks = ?,
                    metadata_json = ?,
                    amount = ?,
                    updated_at = GETDATE(),
                    updated_by = ?
                WHERE id = ?
            `, [args.adjustmentName, args.remarks, args.metadataJson, args.amount, args.user, args.id]);
}

export type InsertAutoBufferAdjustmentArgs = {
    periodMonth: number;
    periodYear: number;
    empCode: string;
    nik: string | null;
    empName: string | null;
    gangCode: string;
    divisionCode: string;
    adjustmentName: string;
    amount: number;
    remarks: string;
    createdBy: string;
};

/**
 * @query insertAutoBufferAdjustment
 * @table payroll_manual_adjustments (extend_db_ptrj)
 * @input db, InsertAutoBufferAdjustmentArgs
 * @output inserted id
 * @sql INSERT AUTO_BUFFER row (type literal) OUTPUT INSERTED.id  (syncAdtransToAdjustments MISSING branch)
 */
export async function insertAutoBufferAdjustment(db: Database, args: InsertAutoBufferAdjustmentArgs): Promise<number | undefined> {
    const result = await db.query<{ id: number }>(`
                INSERT INTO dbo.payroll_manual_adjustments (
                    period_month, period_year, emp_code, nik, emp_name, gang_code, division_code,
                    adjustment_type, adjustment_name, amount, remarks, created_by
                ) OUTPUT INSERTED.id VALUES (
                    ?, ?, ?, ?, ?, ?, ?,
                    'AUTO_BUFFER', ?, ?, ?, ?
                )
            `, [
        args.periodMonth, args.periodYear, args.empCode, args.nik, args.empName, args.gangCode, args.divisionCode,
        args.adjustmentName, args.amount, args.remarks, args.createdBy
    ]);
    return result[0]?.id;
}

export type UpdateAutoBufferAdjustmentAmountArgs = {
    periodMonth: number;
    periodYear: number;
    empCode: string;
    nik: string | null;
    empName: string | null;
    adjustmentName: string;
    amount: number;
    remarks: string;
    updatedBy: string;
};

/**
 * @query updateAutoBufferAdjustmentAmount
 * @table payroll_manual_adjustments (extend_db_ptrj)
 * @input db, UpdateAutoBufferAdjustmentAmountArgs
 * @output void
 * @sql UPDATE SET emp_code,nik,amount,remarks,emp_name,touch WHERE period+identity+AUTO_BUFFER+normalized(name)  (syncAdtransToAdjustments UPDATE branch)
 */
export async function updateAutoBufferAdjustmentAmount(db: Database, args: UpdateAutoBufferAdjustmentAmountArgs): Promise<void> {
    const normalizedAdjNameSql = buildNormalizedSqlNameExpression("adjustment_name");
    await db.query(`
                UPDATE dbo.payroll_manual_adjustments
                SET emp_code = ?, nik = ?, amount = ?, remarks = ?, emp_name = ?, updated_at = GETDATE(), updated_by = ?
                WHERE period_month = ? AND period_year = ?
                  AND (emp_code = ? OR nik = ?)
                  AND adjustment_type = 'AUTO_BUFFER'
                  AND ${normalizedAdjNameSql} = ?
            `, [
        args.empCode, args.nik, args.amount, args.remarks, args.empName, args.updatedBy,
        args.periodMonth, args.periodYear,
        args.empCode, args.nik,
        args.adjustmentName
    ]);
}

export type UpsertOtherIncomeArgs = {
    realNik: string;
    empCode: string;
    periodMonth: number;
    periodYear: number;
    incomeType: string;
    incomeName: string;
    normalizedDivisionCode: string | null;
    gangCode: string;
    amount: number;
};

/**
 * @query updateOtherIncome
 * @table employee_other_incomes (extend_db_ptrj)
 * @input db, { realNik, empCode, amount, existingId }
 * @output void
 * @sql UPDATE SET nik,emp_code,amount,touch WHERE id=?  (saveOtherIncome existing-row branch)
 */
export async function updateOtherIncome(
    db: Database,
    args: UpsertOtherIncomeArgs & { existingId: number }
): Promise<void> {
    await db.query(`
                UPDATE dbo.employee_other_incomes
                SET nik = ?, emp_code = ?, amount = ?, updated_at = GETDATE()
                WHERE id = ?
            `, [args.realNik, args.empCode, args.amount, args.existingId]);
}

/**
 * @query insertOtherIncome
 * @table employee_other_incomes (extend_db_ptrj)
 * @input db, UpsertOtherIncomeArgs
 * @output inserted id
 * @sql INSERT full row (nik,emp_code,emp_name=NULL,division,gang,period,income_type,name,amount,is_paid_in_thp=0,is_taxable=0,timestamps) OUTPUT INSERTED.id
 */
export async function insertOtherIncome(db: Database, args: UpsertOtherIncomeArgs): Promise<number | undefined> {
    const result = await db.query<{ id: number }>(`
                INSERT INTO dbo.employee_other_incomes (
                    nik, emp_code, emp_name, division_code, gang_code,
                    period_year, period_month, income_type, income_name,
                    amount, is_paid_in_thp, is_taxable,
                    created_at, updated_at
                ) OUTPUT INSERTED.id VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE()
                )
            `, [
        args.realNik, args.empCode, null, args.normalizedDivisionCode, args.gangCode,
        args.periodYear, args.periodMonth, args.incomeType, args.incomeName,
        args.amount, 0, 0
    ]);
    return result[0]?.id;
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION: DELETE Queries (deleteById, deleteColumn, deleteOtherIncome)
// ═══════════════════════════════════════════════════════════════════════

/**
 * @query deleteAdjustmentById
 * @table payroll_manual_adjustments (extend_db_ptrj)
 * @input db, id
 * @output void
 * @sql DELETE WHERE id = ?
 */
export async function deleteAdjustmentById(db: Database, id: number): Promise<void> {
    await db.query(`DELETE FROM dbo.payroll_manual_adjustments WHERE id = ?`, [id]);
}

/**
 * @query deleteAdjustmentColumnRows
 * @table payroll_manual_adjustments (extend_db_ptrj)
 * @input db, AdjustmentColumnFilterArgs
 * @output void
 * @sql DELETE WHERE period+type+normalized(name)+optional division
 */
export async function deleteAdjustmentColumnRows(
    db: Database,
    args: AdjustmentColumnFilterArgs
): Promise<void> {
    const filter = buildAdjustmentColumnFilter(args);
    await db.query(`
            DELETE FROM dbo.payroll_manual_adjustments
            ${filter.sql}
        `, filter.params);
}

/**
 * @query deleteOtherIncomeById
 * @table employee_other_incomes (extend_db_ptrj)
 * @input db, id
 * @output void
 * @sql DELETE WHERE id = ?  (saveOtherIncome zero-amount existing-row branch)
 */
export async function deleteOtherIncomeById(db: Database, id: number): Promise<void> {
    await db.query(`DELETE FROM dbo.employee_other_incomes WHERE id = ?`, [id]);
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION: Sync Status Queries (selectSyncStatusCandidates)
// ═══════════════════════════════════════════════════════════════════════

export type SelectSyncStatusCandidatesArgs = {
    periodMonth: number;
    periodYear: number;
    adjustmentTypes: string[];
    limit: number;
    divisionCodes?: string[];
    gangCode?: string;
    empLookup?: AdjustmentLookupIdentity;
    adjustmentName?: string;
    ids?: number[];
};

/**
 * @query selectSyncStatusCandidates
 * @table payroll_manual_adjustments (extend_db_ptrj)
 * @input db, { periodMonth, periodYear, adjustmentTypes, limit, divisionCodes?, gangCode?, empLookup?, adjustmentName?, ids? }
 * @output ManualAdjustment[]
 * @sql SELECT TOP (limit) full row WHERE period+types IN (?) + remarks LIKE '%sync:%' [+optional division/gang/emp/name/ids filters] ORDER BY id ASC
 */
export async function selectSyncStatusCandidates(
    db: Database,
    args: SelectSyncStatusCandidatesArgs
): Promise<ManualAdjustment[]> {
    const params: any[] = [args.periodMonth, args.periodYear, ...args.adjustmentTypes];
    let query = `
            SELECT TOP (${args.limit})
                id,
                period_month,
                period_year,
                emp_code,
                nik,
                emp_name,
                gang_code,
                division_code,
                adjustment_type,
                adjustment_name,
                amount,
                remarks,
                metadata_json
            FROM dbo.payroll_manual_adjustments
            WHERE period_month = ?
              AND period_year = ?
              AND adjustment_type IN (${args.adjustmentTypes.map(() => "?").join(", ")})
              AND remarks IS NOT NULL
              AND remarks LIKE '%sync:%'
        `;

    if (args.divisionCodes) {
        if (args.divisionCodes.length === 1) {
            query += ` AND division_code = ?`;
            params.push(args.divisionCodes[0]);
        } else if (args.divisionCodes.length > 1) {
            query += ` AND division_code IN (${args.divisionCodes.map(() => "?").join(", ")})`;
            params.push(...args.divisionCodes);
        }
    }

    if (args.gangCode) {
        query += ` AND UPPER(gang_code) = ?`;
        params.push(args.gangCode);
    }

    if (args.empLookup) {
        query += ` AND (emp_code = ? OR nik = ? OR emp_code = ?)`;
        params.push(args.empLookup.empCode, args.empLookup.nik, args.empLookup.originalIdentifier);
    }

    if (args.adjustmentName) {
        query += ` AND UPPER(adjustment_name) LIKE ?`;
        params.push(args.adjustmentName);
    }

    if (args.ids && args.ids.length > 0) {
        query += ` AND id IN (${args.ids.map(() => "?").join(", ")})`;
        params.push(...args.ids);
    }

    query += ` ORDER BY id ASC`;
    return db.query<ManualAdjustment>(query, params);
}
