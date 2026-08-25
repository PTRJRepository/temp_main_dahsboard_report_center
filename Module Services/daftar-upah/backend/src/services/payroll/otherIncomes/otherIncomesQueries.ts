/**
 * OtherIncomes Queries — SQL query wrappers
 *
 * Each function takes a Database instance (db) + arguments and returns
 * query results. No orchestration or business logic — pure data access.
 *
 * Organization:
 *   1. Table DDL / Migration
 *   2. Blacklist CRUD
 *   3. Formula CRUD
 *   4. Income CRUD (select, insert, update, delete)
 *   5. HR Employee Lookup (enrichment, backfill)
 *   6. Payroll Bank Lookup
 *   7. Gang Members / History
 *   8. THR Calculation Queries
 *
 * @module payroll/otherIncomes/otherIncomesQueries
 */

import type { Database } from "../../../db/client";

// ═══════════════════════════════════════════════════════════════════════
// SECTION: Table DDL / Migration
// ═══════════════════════════════════════════════════════════════════════

/**
 * @query ensureOtherIncomesTables
 * @table employee_other_incomes, employee_other_incomes_formulas, employee_other_incomes_blacklist (extend_db_ptrj)
 * @input db
 * @output void (idempotent DDL)
 * @sql CREATE TABLE IF NOT EXISTS ... + ALTER TABLE ADD COLUMN IF NOT EXISTS for details_json, emp_code, new_nik, religion, join_date, bank_acc_no, bank_code, sex
 */
export async function ensureOtherIncomesTables(db: Database): Promise<void> {
    await db.query(`
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'employee_other_incomes' AND TABLE_SCHEMA = 'dbo')
        BEGIN
            CREATE TABLE employee_other_incomes (
                id INT IDENTITY(1,1) PRIMARY KEY,
                nik VARCHAR(50) NOT NULL,
                emp_name VARCHAR(150),
                division_code VARCHAR(50),
                gang_code VARCHAR(50),
                period_year INT NOT NULL,
                period_month INT NOT NULL,
                income_type VARCHAR(50) NOT NULL,
                income_name VARCHAR(150),
                amount DECIMAL(18, 2) DEFAULT 0,
                is_paid_in_thp BIT DEFAULT 0,
                is_taxable BIT DEFAULT 0,
                created_at DATETIME DEFAULT GETDATE(),
                updated_at DATETIME DEFAULT GETDATE()
            );
        END

        -- Add details_json column if it doesn't exist
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'employee_other_incomes' AND COLUMN_NAME = 'details_json')
        BEGIN
            ALTER TABLE employee_other_incomes ADD details_json NVARCHAR(MAX) NULL;
        END

        -- Add EmpCode basis columns (2026-03 refactor)
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'employee_other_incomes' AND COLUMN_NAME = 'emp_code')
        BEGIN
            ALTER TABLE employee_other_incomes ADD emp_code VARCHAR(50) NULL;
        END
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'employee_other_incomes' AND COLUMN_NAME = 'new_nik')
        BEGIN
            ALTER TABLE employee_other_incomes ADD new_nik VARCHAR(50) NULL;
        END
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'employee_other_incomes' AND COLUMN_NAME = 'religion')
        BEGIN
            ALTER TABLE employee_other_incomes ADD religion VARCHAR(100) NULL;
        END
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'employee_other_incomes' AND COLUMN_NAME = 'join_date')
        BEGIN
            ALTER TABLE employee_other_incomes ADD join_date DATE NULL;
        END
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'employee_other_incomes' AND COLUMN_NAME = 'bank_acc_no')
        BEGIN
            ALTER TABLE employee_other_incomes ADD bank_acc_no VARCHAR(100) NULL;
        END
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'employee_other_incomes' AND COLUMN_NAME = 'bank_code')
        BEGIN
            ALTER TABLE employee_other_incomes ADD bank_code VARCHAR(50) NULL;
        END
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'employee_other_incomes' AND COLUMN_NAME = 'sex')
        BEGIN
            ALTER TABLE employee_other_incomes ADD sex VARCHAR(1) NULL;
        END
        
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'employee_other_incomes_formulas' AND TABLE_SCHEMA = 'dbo')
        BEGIN
            CREATE TABLE employee_other_incomes_formulas (
                income_type VARCHAR(50) PRIMARY KEY,
                formula_string VARCHAR(500) NOT NULL,
                updated_at DATETIME DEFAULT GETDATE()
            );
            INSERT INTO employee_other_incomes_formulas (income_type, formula_string) 
            VALUES ('THR', '(UPAH_DASAR * 30) + (BERAS_RATE * 30) + MASA_KERJA_JUMLAH');
        END

        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'employee_other_incomes_blacklist' AND TABLE_SCHEMA = 'dbo')
        BEGIN
            CREATE TABLE employee_other_incomes_blacklist (
                id INT IDENTITY(1,1) PRIMARY KEY,
                nik VARCHAR(50) NOT NULL,
                emp_name VARCHAR(150),
                period_year INT NOT NULL,
                period_month INT NOT NULL,
                income_type VARCHAR(50) NOT NULL,
                reason VARCHAR(255),
                created_at DATETIME DEFAULT GETDATE()
            );
            CREATE INDEX IX_blacklist_nik_period ON employee_other_incomes_blacklist(nik, period_year, period_month);
        END
    `);
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION: Blacklist CRUD
// ═══════════════════════════════════════════════════════════════════════

/**
 * @query selectBlacklistExisting
 * @table employee_other_incomes_blacklist (extend_db_ptrj)
 * @input db, nik, year, month, type
 * @output any[] (matching blacklist ids)
 * @sql SELECT id FROM employee_other_incomes_blacklist WHERE RTRIM(nik)=? AND period_year=? AND period_month=? AND RTRIM(income_type)=?
 */
export async function selectBlacklistExisting(db: Database, nik: string, year: number, month: number, type: string): Promise<any[]> {
    return db.query(`SELECT id FROM employee_other_incomes_blacklist WHERE RTRIM(nik) = ? AND period_year = ? AND period_month = ? AND RTRIM(income_type) = ?`, [nik, year, month, type]) as Promise<any[]>;
}

/**
 * @query insertBlacklistRow
 * @table employee_other_incomes_blacklist (extend_db_ptrj)
 * @input db, nik, name, year, month, type, reason
 * @output void
 * @sql INSERT INTO employee_other_incomes_blacklist (nik, emp_name, period_year, period_month, income_type, reason) VALUES (?,?,?,?,?,?)
 */
export async function insertBlacklistRow(db: Database, nik: string, name: string, year: number, month: number, type: string, reason: string): Promise<void> {
    await db.query(`INSERT INTO employee_other_incomes_blacklist (nik, emp_name, period_year, period_month, income_type, reason) VALUES (?, ?, ?, ?, ?, ?)`, [nik, name, year, month, type, reason]);
}

/**
 * @query deleteBlacklistRowById
 * @table employee_other_incomes_blacklist (extend_db_ptrj)
 * @input db, id
 * @output void
 * @sql DELETE FROM employee_other_incomes_blacklist WHERE id=?
 */
export async function deleteBlacklistRowById(db: Database, id: number): Promise<void> {
    await db.query(`DELETE FROM employee_other_incomes_blacklist WHERE id = ?`, [id]);
}

/**
 * @query selectBlacklistByPeriodAndType
 * @table employee_other_incomes_blacklist (extend_db_ptrj)
 * @input db, year, month, type
 * @output any[] (blacklist rows ordered by emp_name)
 * @sql SELECT * FROM employee_other_incomes_blacklist WHERE period_year=? AND period_month=? AND income_type=? ORDER BY emp_name
 */
export async function selectBlacklistByPeriodAndType(db: Database, year: number, month: number, type: string): Promise<any[]> {
    return db.query(`SELECT * FROM employee_other_incomes_blacklist WHERE period_year = ? AND period_month = ? AND income_type = ? ORDER BY emp_name`, [year, month, type]) as Promise<any[]>;
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION: Formula CRUD
// ═══════════════════════════════════════════════════════════════════════

/**
 * @query selectFormulaByIncomeType
 * @table employee_other_incomes_formulas (extend_db_ptrj)
 * @input db, incomeType
 * @output any[] (rows with formula_string)
 * @sql SELECT formula_string FROM employee_other_incomes_formulas WHERE income_type=?
 */
export async function selectFormulaByIncomeType(db: Database, incomeType: string): Promise<any[]> {
    return db.query(`SELECT formula_string FROM employee_other_incomes_formulas WHERE income_type = ?`, [incomeType]) as Promise<any[]>;
}

/**
 * @query upsertFormula
 * @table employee_other_incomes_formulas (extend_db_ptrj)
 * @input db, incomeType, formulaString
 * @output void (insert or update formula_string)
 * @sql SELECT income_type ... then UPDATE ... / INSERT ... (existence-check upsert)
 */
export async function upsertFormula(db: Database, incomeType: string, formulaString: string): Promise<void> {
    const existing = await db.query(`SELECT income_type FROM employee_other_incomes_formulas WHERE income_type = ?`, [incomeType]) as any[];
    if (existing && existing.length > 0) {
        await db.query(`UPDATE employee_other_incomes_formulas SET formula_string = ?, updated_at = GETDATE() WHERE income_type = ?`, [formulaString, incomeType]);
    } else {
        await db.query(`INSERT INTO employee_other_incomes_formulas (income_type, formula_string, updated_at) VALUES (?, ?, GETDATE())`, [incomeType, formulaString]);
    }
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION: Income CRUD (select, insert, update, delete)
// ═══════════════════════════════════════════════════════════════════════

/**
 * @query selectRecordsNeedingNikBackfill
 * @table employee_other_incomes (extend_db_ptrj)
 * @input db
 * @output any[] (id, nik, emp_code rows with null/empty new_nik)
 * @sql SELECT id, nik, emp_code FROM employee_other_incomes WHERE new_nik IS NULL OR new_nik = ''
 */
export async function selectRecordsNeedingNikBackfill(db: Database): Promise<any[]> {
    return db.query(`
        SELECT id, nik, emp_code
        FROM employee_other_incomes
        WHERE new_nik IS NULL OR new_nik = ''
    `) as Promise<any[]>;
}

/**
 * @query updateBackfillNewNikById
 * @table employee_other_incomes (extend_db_ptrj)
 * @input db, id, nik
 * @output void
 * @sql UPDATE employee_other_incomes SET new_nik=?, updated_at=GETDATE() WHERE id=? AND (new_nik IS NULL OR new_nik='')
 */
export async function updateBackfillNewNikById(db: Database, id: number, nik: string): Promise<void> {
    await db.query(`
        UPDATE employee_other_incomes
        SET new_nik = ?, updated_at = GETDATE()
        WHERE id = ? AND (new_nik IS NULL OR new_nik = '')
    `, [nik, id]);
}

/**
 * @query selectAllOtherIncomesByPeriod
 * @table employee_other_incomes (extend_db_ptrj)
 * @input db, year, month
 * @output any[] (all income rows for period, ordered by id)
 * @sql SELECT * FROM employee_other_incomes WHERE period_year=? AND period_month=? ORDER BY id
 */
export async function selectAllOtherIncomesByPeriod(db: Database, year: number, month: number): Promise<any[]> {
    return db.query(`SELECT * FROM employee_other_incomes WHERE period_year = ? AND period_month = ? ORDER BY id`, [year, month]) as Promise<any[]>;
}

/**
 * @query selectIncomesForYear
 * @table employee_other_incomes (extend_db_ptrj)
 * @input db, year
 * @output any[] (taxable income rows for the year, ordered by id)
 * @sql SELECT * FROM employee_other_incomes WHERE period_year=? AND is_taxable=1 ORDER BY id
 */
export async function selectIncomesForYear(db: Database, year: number): Promise<any[]> {
    return db.query(`SELECT * FROM employee_other_incomes WHERE period_year = ? AND is_taxable = 1 ORDER BY id`, [year]) as Promise<any[]>;
}

/**
 * @query selectIncomeById
 * @table employee_other_incomes (extend_db_ptrj)
 * @input db, id
 * @output any[] (nik, emp_name, period_year, period_month, income_type)
 * @sql SELECT nik, emp_name, period_year, period_month, income_type FROM employee_other_incomes WHERE id=?
 */
export async function selectIncomeById(db: Database, id: number): Promise<any[]> {
    return db.query(`SELECT nik, emp_name, period_year, period_month, income_type FROM employee_other_incomes WHERE id = ?`, [id]) as Promise<any[]>;
}

/**
 * @query insertOtherIncomeWithOutput
 * @table employee_other_incomes (extend_db_ptrj)
 * @input db, data (nik, emp_name, division_code, gang_code, period_year, period_month, income_type, income_name, amount, is_paid_in_thp, is_taxable, emp_code, new_nik)
 * @output any[] (INSERTED.* row)
 * @sql INSERT INTO employee_other_incomes (...) OUTPUT INSERTED.* VALUES (...)
 */
export async function insertOtherIncomeWithOutput(db: Database, data: any): Promise<any[]> {
    const resolvedNewNik = data.new_nik || data.nik || null;
    return db.query(`INSERT INTO employee_other_incomes (nik, emp_name, division_code, gang_code, period_year, period_month, income_type, income_name, amount, is_paid_in_thp, is_taxable, created_at, updated_at, emp_code, new_nik) OUTPUT INSERTED.* VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE(), ?, ?)`,
        [data.nik, data.emp_name, data.division_code, data.gang_code, data.period_year, data.period_month, data.income_type, data.income_name, data.amount, data.is_paid_in_thp ? 1 : 0, data.is_taxable ? 1 : 0, data.emp_code || null, resolvedNewNik]) as Promise<any[]>;
}

/**
 * @query updateOtherIncomeById
 * @table employee_other_incomes (extend_db_ptrj)
 * @input db, id, fields (SET clause fragments), values (bound params)
 * @output void
 * @sql UPDATE employee_other_incomes SET <fields> WHERE id=?
 */
export async function updateOtherIncomeById(db: Database, id: number, fields: string[], values: any[]): Promise<void> {
    const allValues = [...values, id];
    await db.query(`UPDATE employee_other_incomes SET ${fields.join(', ')} WHERE id = ?`, allValues);
}

/**
 * @query deleteOtherIncomeById
 * @table employee_other_incomes (extend_db_ptrj)
 * @input db, id
 * @output void
 * @sql DELETE FROM employee_other_incomes WHERE id=?
 */
export async function deleteOtherIncomeById(db: Database, id: number): Promise<void> {
    await db.query(`DELETE FROM employee_other_incomes WHERE id = ?`, [id]);
}

/**
 * @query deleteOtherIncomesByPeriod
 * @table employee_other_incomes (extend_db_ptrj)
 * @input db, year, month, extraWhere (raw SQL fragment), extraParams (bound params)
 * @output any (delete result)
 * @sql DELETE FROM employee_other_incomes WHERE period_year=? AND period_month=?<extraWhere>
 */
export async function deleteOtherIncomesByPeriod(db: Database, year: number, month: number, extraWhere: string, extraParams: any[]): Promise<any> {
    const sql = `DELETE FROM employee_other_incomes WHERE period_year = ? AND period_month = ?${extraWhere}`;
    return db.query(sql, [year, month, ...extraParams]);
}

/**
 * @query insertOtherIncomeRow
 * @table employee_other_incomes (extend_db_ptrj)
 * @input db, inc (full income row), detailsJson, joinDateSql
 * @output void
 * @sql INSERT INTO employee_other_incomes (21 cols incl. emp_code, new_nik, religion, join_date, bank_acc_no, bank_code, sex) VALUES (...)
 */
export async function insertOtherIncomeRow(db: Database, inc: any, detailsJson: string | null, joinDateSql: string | null): Promise<void> {
    await db.query(`
        INSERT INTO employee_other_incomes (
            nik, emp_name, division_code, gang_code,
            period_year, period_month, income_type,
            income_name, amount, is_paid_in_thp, is_taxable,
            details_json, created_at, updated_at,
            emp_code, new_nik, religion, join_date, bank_acc_no, bank_code, sex
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE(), ?, ?, ?, ?, ?, ?, ?)
    `, [
        inc.nik, inc.emp_name, inc.division_code, inc.gang_code,
        inc.period_year, inc.period_month, inc.income_type,
        inc.income_name, inc.amount,
        inc.is_paid_in_thp ? 1 : 0, inc.is_taxable ? 1 : 0,
        detailsJson,
        inc.emp_code || null,
        inc.new_nik || inc.nik || null,
        inc.religion || null,
        joinDateSql,
        inc.bank_acc_no || null,
        inc.bank_code || null,
        inc.sex || null
    ]);
}

/**
 * @query deleteOtherIncomeByEmpCodeAndType
 * @table employee_other_incomes (extend_db_ptrj)
 * @input db, year, month, empCode, incomeType
 * @output void
 * @sql DELETE FROM employee_other_incomes WHERE period_year=? AND period_month=? AND RTRIM(emp_code)=? AND income_type=?
 */
export async function deleteOtherIncomeByEmpCodeAndType(db: Database, year: number, month: number, empCode: string, incomeType: string): Promise<void> {
    await db.query(`
        DELETE FROM employee_other_incomes
        WHERE period_year = ?
          AND period_month = ?
          AND RTRIM(emp_code) = ?
          AND income_type = ?
    `, [year, month, empCode, incomeType]);
}

/**
 * @query deleteOtherIncomeByNikAndType
 * @table employee_other_incomes (extend_db_ptrj)
 * @input db, year, month, nik, incomeType
 * @output void
 * @sql DELETE FROM employee_other_incomes WHERE period_year=? AND period_month=? AND RTRIM(nik)=? AND income_type=?
 */
export async function deleteOtherIncomeByNikAndType(db: Database, year: number, month: number, nik: string, incomeType: string): Promise<void> {
    await db.query(`
        DELETE FROM employee_other_incomes
        WHERE period_year = ?
          AND period_month = ?
          AND RTRIM(nik) = ?
          AND income_type = ?
    `, [year, month, nik, incomeType]);
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION: HR Employee Lookup (enrichment, backfill)
// ═══════════════════════════════════════════════════════════════════════

/**
 * @query selectHrEmployeeByEmpCodes
 * @table HR_EMPLOYEE (db_ptrj)
 * @input db, empCodes
 * @output any[] (EmpCode, NewICNo) — empty array when input empty
 * @sql SELECT RTRIM(EmpCode), RTRIM(NewICNo) FROM HR_EMPLOYEE WHERE RTRIM(EmpCode) IN (...)
 */
export async function selectHrEmployeeByEmpCodes(db: Database, empCodes: string[]): Promise<any[]> {
    if (empCodes.length === 0) return [];
    const placeholders = empCodes.map(() => '?').join(',');
    return db.query(`
        SELECT RTRIM(EmpCode) as EmpCode,
               RTRIM(NewICNo) as NewICNo
        FROM HR_EMPLOYEE
        WHERE RTRIM(EmpCode) IN (${placeholders})
    `, empCodes) as Promise<any[]>;
}

/**
 * @query selectHrEmployeeForBackfill
 * @table HR_EMPLOYEE (db_ptrj)
 * @input db, empCodes
 * @output any[] (EmpCode, NewICNo with ISNULL) — empty array when input empty
 * @sql SELECT RTRIM(EmpCode), RTRIM(ISNULL(NewICNo,'')) FROM HR_EMPLOYEE WHERE RTRIM(EmpCode) IN (...)
 */
export async function selectHrEmployeeForBackfill(db: Database, empCodes: string[]): Promise<any[]> {
    if (empCodes.length === 0) return [];
    const placeholders = empCodes.map(() => '?').join(',');
    return db.query(`
        SELECT RTRIM(EmpCode) as EmpCode,
               RTRIM(ISNULL(NewICNo, '')) as NewICNo
        FROM HR_EMPLOYEE
        WHERE RTRIM(EmpCode) IN (${placeholders})
    `, empCodes) as Promise<any[]>;
}

/**
 * @query selectHrEmployeeForEnrichment
 * @table HR_EMPLOYEE + HR_EMPLOYMENT + HR_PAYROLL + HR_GANGLN (db_ptrj)
 * @input db, nikChunk (EmpCode/NewICNo keys)
 * @output any[] (EmpCode, NewICNo, EmpName, Religion, Gender, Status, CreateDate, AppJoinDate, AppJoinGrpDate, BankAccNo, BankCode, PayRate, RiceRation, GangCode, GangMember)
 * @sql LEFT JOIN enrichment query ordered by EmpCode DESC, Status=1 first, AppJoinDate DESC
 */
export async function selectHrEmployeeForEnrichment(db: Database, nikChunk: string[]): Promise<any[]> {
    const placeholders = nikChunk.map(() => '?').join(',');
    return db.query<any>(`
        SELECT
            RTRIM(e.EmpCode) as EmpCode,
            RTRIM(e.NewICNo) as NewICNo,
            RTRIM(e.EmpName) as EmpName,
            e.Religion,
            e.Gender,
            e.Status,
            e.CreateDate,
            em.AppJoinDate,
            em.AppJoinGrpDate,
            RTRIM(p.BankAccNo) as BankAccNo,
            RTRIM(p.BankCode) as BankCode,
            COALESCE(p.PayRate, 0) as PayRate,
            CASE 
                WHEN UPPER(CAST(p.RiceRationCode AS VARCHAR)) = 'BERASBHL' THEN 0
                ELSE COALESCE(p.RiceRation, 0)
            END as RiceRation,
            gl.GangCode as GangCode,
            gl.GangMember as GangMember
        FROM HR_EMPLOYEE e
        LEFT JOIN HR_EMPLOYMENT em ON e.EmpCode = em.EmpCode
        LEFT JOIN HR_PAYROLL p ON e.EmpCode = p.EmpCode
        LEFT JOIN HR_GANGLN gl ON e.EmpCode = gl.GangMember
        WHERE RTRIM(e.EmpCode) IN (${placeholders}) OR RTRIM(e.NewICNo) IN (${placeholders})
        ORDER BY
            e.EmpCode DESC,
            CASE WHEN RTRIM(e.Status) = '1' THEN 0 ELSE 1 END,
            em.AppJoinDate DESC
    `, [...nikChunk, ...nikChunk]) as Promise<any[]>;
}

/**
 * @query selectHrEmployeeEmpCodes
 * @table HR_EMPLOYEE (db_ptrj)
 * @input db, keysChunk (EmpCode or NewICNo)
 * @output any[] (EmpCode, NewICNo, EmpName, CreateDate ordered DESC)
 * @sql SELECT ... FROM HR_EMPLOYEE WHERE RTRIM(EmpCode) IN (...) OR RTRIM(NewICNo) IN (...) ORDER BY CreateDate DESC
 */
export async function selectHrEmployeeEmpCodes(db: Database, keysChunk: string[]): Promise<any[]> {
    const placeholders = keysChunk.map(() => '?').join(',');
    return db.query<any>(`
        SELECT 
            RTRIM(e.EmpCode) as EmpCode,
            RTRIM(e.NewICNo) as NewICNo,
            RTRIM(e.EmpName) as EmpName,
            e.CreateDate
        FROM HR_EMPLOYEE e
        WHERE RTRIM(e.EmpCode) IN (${placeholders}) OR RTRIM(e.NewICNo) IN (${placeholders})
        ORDER BY e.CreateDate DESC
    `, [...keysChunk, ...keysChunk]) as Promise<any[]>;
}

/**
 * @query selectHrEmployeeByNames
 * @table HR_EMPLOYEE (db_ptrj)
 * @input db, namesChunk
 * @output any[] (EmpCode, EmpName, CreateDate ordered DESC)
 * @sql SELECT ... FROM HR_EMPLOYEE WHERE RTRIM(EmpName) IN (...) ORDER BY CreateDate DESC
 */
export async function selectHrEmployeeByNames(db: Database, namesChunk: string[]): Promise<any[]> {
    const namePlaceholders = namesChunk.map(() => '?').join(',');
    return db.query<any>(`
        SELECT
            RTRIM(e.EmpCode) as EmpCode,
            RTRIM(e.EmpName) as EmpName,
            e.CreateDate
        FROM HR_EMPLOYEE e
        WHERE RTRIM(e.EmpName) IN (${namePlaceholders})
        ORDER BY e.CreateDate DESC
    `, namesChunk) as Promise<any[]>;
}

/**
 * @query selectHrEmployeeNewIcNos
 * @table HR_EMPLOYEE (db_ptrj)
 * @input db, empCodes
 * @output {EmpCode, NewICNo}[] — empty array when input empty
 * @sql SELECT RTRIM(EmpCode), RTRIM(ISNULL(NewICNo,'')) FROM HR_EMPLOYEE WHERE RTRIM(EmpCode) IN (...)
 */
export async function selectHrEmployeeNewIcNos(db: Database, empCodes: string[]): Promise<any[]> {
    if (empCodes.length === 0) return [];
    const placeholders = empCodes.map(() => '?').join(',');
    return db.query<{ EmpCode: string; NewICNo: string }>(`
        SELECT RTRIM(EmpCode) as EmpCode, RTRIM(ISNULL(NewICNo, '')) as NewICNo
        FROM HR_EMPLOYEE
        WHERE RTRIM(EmpCode) IN (${placeholders})
    `, empCodes) as Promise<any[]>;
}

/**
 * @query selectHrEmployeeWithEmployment
 * @table HR_EMPLOYEE + HR_EMPLOYMENT (db_ptrj)
 * @input db, empCodes (internally chunked by 500)
 * @output any[] (EmpCode, Religion, Gender, CreateDate, AppJoinDate, AppJoinGrpDate)
 * @sql SELECT ... FROM HR_EMPLOYEE e LEFT JOIN HR_EMPLOYMENT em ... WHERE RTRIM(e.EmpCode) IN (...) — chunked
 */
export async function selectHrEmployeeWithEmployment(db: Database, empCodes: string[]): Promise<any[]> {
    if (empCodes.length === 0) return [];
    const CHUNK = 500;
    const allRows: any[] = [];
    for (let i = 0; i < empCodes.length; i += CHUNK) {
        const chunk = empCodes.slice(i, i + CHUNK);
        const placeholders = chunk.map(() => '?').join(',');
        const rows = await db.query<any>(`
            SELECT RTRIM(e.EmpCode) as EmpCode,
                   e.Religion, e.Gender,
                   e.CreateDate,
                   em.AppJoinDate, em.AppJoinGrpDate
            FROM HR_EMPLOYEE e
            LEFT JOIN HR_EMPLOYMENT em ON e.EmpCode = em.EmpCode
            WHERE RTRIM(e.EmpCode) IN (${placeholders})
        `, chunk);
        allRows.push(...rows);
    }
    return allRows;
}

/**
 * @query selectHrEmployeeForGangMembers
 * @table HR_EMPLOYEE + HR_EMPLOYMENT (db_ptrj)
 * @input db, empCodes (internally chunked by 500)
 * @output any[] (EmpCode, NewICNo, EmpName, Religion, Gender, AppJoinDate, AppJoinGrpDate)
 * @sql SELECT ... FROM HR_EMPLOYEE e LEFT JOIN HR_EMPLOYMENT em ... WHERE RTRIM(e.EmpCode) IN (...) — chunked
 */
export async function selectHrEmployeeForGangMembers(db: Database, empCodes: string[]): Promise<any[]> {
    if (empCodes.length === 0) return [];
    const CHUNK = 500;
    const allRows: any[] = [];
    for (let i = 0; i < empCodes.length; i += CHUNK) {
        const chunk = empCodes.slice(i, i + CHUNK);
        const placeholders = chunk.map(() => '?').join(',');
        const rows = await db.query<any>(`
            SELECT RTRIM(e.EmpCode) as EmpCode,
                   RTRIM(ISNULL(e.NewICNo, '')) as NewICNo,
                   RTRIM(e.EmpName) as EmpName,
                   e.Religion, e.Gender,
                   em.AppJoinDate, em.AppJoinGrpDate
            FROM HR_EMPLOYEE e
            LEFT JOIN HR_EMPLOYMENT em ON e.EmpCode = em.EmpCode
            WHERE RTRIM(e.EmpCode) IN (${placeholders})
        `, chunk);
        allRows.push(...rows);
    }
    return allRows;
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION: Payroll Bank Lookup
// ═══════════════════════════════════════════════════════════════════════

/**
 * @query selectPayrollBankByEmpCodes
 * @table HR_PAYROLL (db_ptrj)
 * @input db, empCodes
 * @output any[] (EmpCode, BankAccNo, BankCode) — empty array when input empty
 * @sql SELECT RTRIM(EmpCode), RTRIM(BankAccNo), RTRIM(BankCode) FROM HR_PAYROLL WHERE RTRIM(EmpCode) IN (...)
 */
export async function selectPayrollBankByEmpCodes(db: Database, empCodes: string[]): Promise<any[]> {
    if (empCodes.length === 0) return [];
    const placeholders = empCodes.map(() => '?').join(',');
    return db.query<any>(`
        SELECT
            RTRIM(EmpCode) as EmpCode,
            RTRIM(BankAccNo) as BankAccNo,
            RTRIM(BankCode) as BankCode
        FROM HR_PAYROLL
        WHERE RTRIM(EmpCode) IN (${placeholders})
    `, empCodes) as Promise<any[]>;
}

/**
 * @query selectPayrollBankByNames
 * @table HR_PAYROLL + HR_EMPLOYEE (db_ptrj)
 * @input db, namesChunk
 * @output any[] (EmpCode, EmpName, BankAccNo, BankCode)
 * @sql SELECT ... FROM HR_PAYROLL p LEFT JOIN HR_EMPLOYEE e ... WHERE RTRIM(e.EmpName) IN (...)
 */
export async function selectPayrollBankByNames(db: Database, namesChunk: string[]): Promise<any[]> {
    const namePlaceholders = namesChunk.map(() => '?').join(',');
    return db.query<any>(`
        SELECT
            RTRIM(p.EmpCode) as EmpCode,
            RTRIM(e.EmpName) as EmpName,
            RTRIM(p.BankAccNo) as BankAccNo,
            RTRIM(p.BankCode) as BankCode
        FROM HR_PAYROLL p
        LEFT JOIN HR_EMPLOYEE e ON p.EmpCode = e.EmpCode
        WHERE RTRIM(e.EmpName) IN (${namePlaceholders})
    `, namesChunk) as Promise<any[]>;
}

/**
 * @query selectPayrollBankWithEmpCode
 * @table HR_PAYROLL (db_ptrj)
 * @input db, empCodes
 * @output any[] (EmpCode, BankAccNo with ISNULL, BankCode with ISNULL) — empty array when input empty
 * @sql SELECT RTRIM(EmpCode), RTRIM(ISNULL(BankAccNo,'')), RTRIM(ISNULL(BankCode,'')) FROM HR_PAYROLL WHERE RTRIM(EmpCode) IN (...)
 */
export async function selectPayrollBankWithEmpCode(db: Database, empCodes: string[]): Promise<any[]> {
    if (empCodes.length === 0) return [];
    const placeholders = empCodes.map(() => '?').join(',');
    return db.query<any>(`
        SELECT RTRIM(EmpCode) as EmpCode,
               RTRIM(ISNULL(BankAccNo, '')) as BankAccNo,
               RTRIM(ISNULL(BankCode, '')) as BankCode
        FROM HR_PAYROLL
        WHERE RTRIM(EmpCode) IN (${placeholders})
    `, empCodes) as Promise<any[]>;
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION: Gang Members / History
// ═══════════════════════════════════════════════════════════════════════

/**
 * @query selectHistoryGangMembers
 * @table history_gang_member (extend_db_ptrj)
 * @input db, gangCodes, month, year
 * @output any[] (emp_code, emp_name, gang_code, division_code) — empty array when no gang codes
 * @sql SELECT DISTINCT ... FROM history_gang_member WHERE gang_code IN (...) AND period_month=? AND period_year=? AND is_active=1 ORDER BY gang_code, emp_name
 */
export async function selectHistoryGangMembers(db: Database, gangCodes: string[], month: number, year: number): Promise<any[]> {
    if (gangCodes.length === 0) return [];
    const placeholders = gangCodes.map(() => '?').join(',');
    return db.query<any>(`
        SELECT DISTINCT
            RTRIM(emp_code) as emp_code,
            RTRIM(ISNULL(emp_name, '')) as emp_name,
            RTRIM(gang_code) as gang_code,
            RTRIM(ISNULL(division_code, '')) as division_code
        FROM dbo.history_gang_member
        WHERE gang_code IN (${placeholders})
          AND period_month = ?
          AND period_year = ?
          AND is_active = 1
        ORDER BY gang_code, emp_name
    `, [...gangCodes, month, year]) as Promise<any[]>;
}

/**
 * @query selectHistoryGangMembersAll
 * @table history_gang_member (extend_db_ptrj)
 * @input db, month, year
 * @output any[] (all active members for period)
 * @sql SELECT DISTINCT ... FROM history_gang_member WHERE period_month=? AND period_year=? AND is_active=1 ORDER BY gang_code, emp_name
 */
export async function selectHistoryGangMembersAll(db: Database, month: number, year: number): Promise<any[]> {
    return db.query<any>(`
        SELECT DISTINCT
            RTRIM(emp_code) as emp_code,
            RTRIM(ISNULL(emp_name, '')) as emp_name,
            RTRIM(gang_code) as gang_code,
            RTRIM(ISNULL(division_code, '')) as division_code
        FROM dbo.history_gang_member
        WHERE period_month = ?
          AND period_year = ?
          AND is_active = 1
        ORDER BY gang_code, emp_name
    `, [month, year]) as Promise<any[]>;
}

/**
 * @query selectHrGangLnMembers
 * @table HR_GANGLN + HR_EMPLOYEE (db_ptrj)
 * @input db, gangCodes (empty array = all gangs)
 * @output any[] (emp_code, emp_name, gang_code, division_code='')
 * @sql SELECT DISTINCT ... FROM HR_GANGLN gl JOIN HR_EMPLOYEE e ... WHERE RTRIM(gl.GangCode) IN (...) [or no filter] ORDER BY GangCode, EmpName
 */
export async function selectHrGangLnMembers(db: Database, gangCodes: string[]): Promise<any[]> {
    if (gangCodes.length > 0) {
        const placeholders = gangCodes.map(() => '?').join(',');
        return db.query<any>(`
            SELECT DISTINCT
                RTRIM(gl.GangMember) as emp_code,
                RTRIM(ISNULL(e.EmpName, '')) as emp_name,
                RTRIM(gl.GangCode) as gang_code,
                '' as division_code
            FROM HR_GANGLN gl
            JOIN HR_EMPLOYEE e ON gl.GangMember = e.EmpCode
            WHERE RTRIM(gl.GangCode) IN (${placeholders})
            ORDER BY gl.GangCode, e.EmpName
        `, gangCodes) as Promise<any[]>;
    }
    return db.query<any>(`
        SELECT DISTINCT
            RTRIM(gl.GangMember) as emp_code,
            RTRIM(ISNULL(e.EmpName, '')) as emp_name,
            RTRIM(gl.GangCode) as gang_code,
            '' as division_code
        FROM HR_GANGLN gl
        JOIN HR_EMPLOYEE e ON gl.GangMember = e.EmpCode
        ORDER BY gl.GangCode, e.EmpName
    `) as Promise<any[]>;
}

/**
 * @query selectHistoryGangMembersWithDesc
 * @table history_gang_member (extend_db_ptrj)
 * @input db, month, year, gangFilterSql (raw AND-fragment), gangFilterParams
 * @output any[] (emp_code, emp_name, gang_code, gang_description, division_code, join_date, is_active)
 * @sql SELECT DISTINCT ... FROM history_gang_member WHERE period_month=? AND period_year=? AND is_active=1 <gangFilterSql> ORDER BY gang_code, emp_name
 */
export async function selectHistoryGangMembersWithDesc(db: Database, month: number, year: number, gangFilterSql: string, gangFilterParams: any[]): Promise<any[]> {
    return db.query<any>(`
        SELECT DISTINCT
            RTRIM(emp_code) as emp_code,
            RTRIM(ISNULL(emp_name, '')) as emp_name,
            RTRIM(gang_code) as gang_code,
            RTRIM(ISNULL(gang_description, '')) as gang_description,
            RTRIM(ISNULL(division_code, '')) as division_code,
            join_date,
            is_active
        FROM dbo.history_gang_member
        WHERE period_month = ?
          AND period_year = ?
          AND is_active = 1
          ${gangFilterSql}
        ORDER BY gang_code, emp_name
    `, [month, year, ...gangFilterParams]) as Promise<any[]>;
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION: THR Calculation Queries
// ═══════════════════════════════════════════════════════════════════════

/**
 * @query selectPayrollHistoryDetail
 * @table payroll_history_detail + payroll_history_header (extend_db_ptrj)
 * @input db, month, year, empCodes (internally chunked by 500)
 * @output any[] (emp_code, upah_dasar, beras_rate, jabatan_rate, jabatan_jumlah, masa_kerja_jumlah, masa_kerja_tahun, join_date, religion, jenis_kelamin, nik, nama, gang_code, loc_code, division_code)
 * @sql SELECT ... FROM payroll_history_detail d INNER JOIN payroll_history_header h ON d.master_id=h.id WHERE h.period_month=? AND h.period_year=? AND RTRIM(d.emp_code) IN (...) — chunked
 */
export async function selectPayrollHistoryDetail(db: Database, month: number, year: number, empCodes: string[]): Promise<any[]> {
    if (empCodes.length === 0) return [];
    const CHUNK = 500;
    const allRows: any[] = [];
    for (let i = 0; i < empCodes.length; i += CHUNK) {
        const chunk = empCodes.slice(i, i + CHUNK);
        const placeholders = chunk.map(() => '?').join(',');
        const rows = await db.query<any>(`
            SELECT d.emp_code, d.upah_dasar, d.beras_rate, d.jabatan_rate,
                   d.jabatan_jumlah, d.masa_kerja_jumlah, d.masa_kerja_tahun,
                   d.join_date, d.religion, d.jenis_kelamin, d.nik,
                   d.nama, d.gang_code, d.loc_code, d.division_code
            FROM dbo.payroll_history_detail d
            INNER JOIN dbo.payroll_history_header h ON d.master_id = h.id
            WHERE h.period_month = ? AND h.period_year = ?
              AND RTRIM(d.emp_code) IN (${placeholders})
        `, [month, year, ...chunk]);
        allRows.push(...rows);
    }
    return allRows;
}

/**
 * @query selectSavedThrRecordsByPeriod
 * @table employee_other_incomes (extend_db_ptrj)
 * @input db, year, month, gangCode? (ALL=skip), divisionCode? (ALL=skip)
 * @output any[] (emp_code, nik, emp_name, gang_code, division_code, religion, bank_acc_no_saved, bank_code_saved, sex, income_name, amount, details_json, join_date)
 * @sql SELECT ... FROM employee_other_incomes WHERE income_type='THR' AND period_year=? AND period_month=? [AND gang_code / division_code] ORDER BY gang_code, emp_name
 */
export async function selectSavedThrRecordsByPeriod(
    db: Database,
    year: number,
    month: number,
    gangCode?: string,
    divisionCode?: string
): Promise<any[]> {
    const whereClauses: string[] = ['income_type = ?', 'period_year = ?', 'period_month = ?'];
    const whereParams: any[] = ['THR', year, month];

    if (gangCode && gangCode !== 'ALL') {
        whereClauses.push('RTRIM(gang_code) = ?');
        whereParams.push(gangCode.toUpperCase().trim());
    } else if (divisionCode && divisionCode !== 'ALL') {
        whereClauses.push('RTRIM(division_code) = ?');
        whereParams.push(divisionCode.trim());
    }

    return db.query<any>(`
        SELECT
            RTRIM(ISNULL(emp_code, '')) as emp_code,
            RTRIM(ISNULL(nik, '')) as nik,
            RTRIM(ISNULL(emp_name, '')) as emp_name,
            RTRIM(ISNULL(gang_code, '')) as gang_code,
            RTRIM(ISNULL(division_code, '')) as division_code,
            RTRIM(ISNULL(religion, '')) as religion,
            RTRIM(ISNULL(bank_acc_no, '')) as bank_acc_no_saved,
            RTRIM(ISNULL(bank_code, '')) as bank_code_saved,
            RTRIM(ISNULL(sex, '')) as sex,
            income_name, amount, details_json,
            join_date
        FROM dbo.employee_other_incomes
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY gang_code, emp_name
    `, whereParams) as Promise<any[]>;
}

/**
 * @query deleteThrIncomesByPeriod
 * @table employee_other_incomes (extend_db_ptrj)
 * @input db, year, month, extraWhere (raw AND-fragment), extraParams
 * @output void
 * @sql DELETE FROM employee_other_incomes WHERE period_year=? AND period_month=? AND income_type='THR'<extraWhere>
 */
export async function deleteThrIncomesByPeriod(db: Database, year: number, month: number, extraWhere: string, extraParams: any[]): Promise<void> {
    const sql = `DELETE FROM employee_other_incomes WHERE period_year = ? AND period_month = ? AND income_type = 'THR'${extraWhere}`;
    await db.query(sql, [year, month, ...extraParams]);
}

/**
 * @query selectSavedThrMembersByPeriod
 * @table employee_other_incomes (extend_db_ptrj)
 * @input db, year, month, gangCode? (ALL=skip), divisionCode? (ALL=skip)
 * @output any[] (emp_code, nik, emp_name, gang_code, division_code, religion, bank_acc_no_saved, bank_code_saved, sex, join_date) — member-only columns, no amount/details
 * @sql SELECT ... FROM employee_other_incomes WHERE income_type='THR' AND period_year=? AND period_month=? [AND gang_code / division_code] ORDER BY gang_code, emp_name
 */
export async function selectSavedThrMembersByPeriod(
    db: Database,
    year: number,
    month: number,
    gangCode?: string,
    divisionCode?: string
): Promise<any[]> {
    const whereClauses: string[] = ['income_type = ?', 'period_year = ?', 'period_month = ?'];
    const whereParams: any[] = ['THR', year, month];

    if (gangCode && gangCode !== 'ALL') {
        whereClauses.push('RTRIM(gang_code) = ?');
        whereParams.push(gangCode.toUpperCase().trim());
    } else if (divisionCode && divisionCode !== 'ALL') {
        whereClauses.push('RTRIM(division_code) = ?');
        whereParams.push(divisionCode.trim());
    }

    return db.query<any>(`
        SELECT
            RTRIM(ISNULL(emp_code, '')) as emp_code,
            RTRIM(ISNULL(nik, '')) as nik,
            RTRIM(ISNULL(emp_name, '')) as emp_name,
            RTRIM(ISNULL(gang_code, '')) as gang_code,
            RTRIM(ISNULL(division_code, '')) as division_code,
            RTRIM(ISNULL(religion, '')) as religion,
            RTRIM(ISNULL(bank_acc_no, '')) as bank_acc_no_saved,
            RTRIM(ISNULL(bank_code, '')) as bank_code_saved,
            RTRIM(ISNULL(sex, '')) as sex,
            join_date
        FROM dbo.employee_other_incomes
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY gang_code, emp_name
    `, whereParams) as Promise<any[]>;
}
