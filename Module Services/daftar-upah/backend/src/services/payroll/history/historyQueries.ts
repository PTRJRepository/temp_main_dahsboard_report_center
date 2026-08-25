/**
 * @module backend/src/services/payroll/history/historyQueries.ts
 * @purpose Pure DB-query functions for all history tables: payroll_history_header/detail, history_hr_employee/gang, history_taskreg/adtrans/gang_member, history_metadata.
 * @input Database instance + typed args (period month/year, empCodes, division/gang filters, data payloads).
 * @output Raw DB result rows, inserted IDs, count booleans; no transform/format logic.
 * @depends ../../../db/client#Database (pure query; no config, no logger, no other services)
 * @sideeffect Reads/Writes dbo.payroll_history_header, dbo.payroll_history_detail, dbo.history_hr_employee, dbo.history_hr_gang, dbo.history_taskreg, dbo.history_adtrans, dbo.history_gang_member, dbo.history_metadata (all extend_db_ptrj or transaction DB)
 * @tests backend/src/services/historyDatabaseService.test.ts (indirect via facade)
 */

import { Database } from "../../../db/client";

// ============================================================================
// Interface Types (redefined for self-contained queries module)
// ============================================================================

export interface HistoryQueriesEmployee {
    nik: string;
    actual_nik: string;
    nama: string;
    jenis_kelamin: string;
    loc_code: string;
    gang_code: string;
    religion: string;
    status: string;
    employee_type: string;
    birth_date?: string;
    join_date?: string;
    terminate_date?: string;
}

export interface HistoryQueriesPayrollMaster {
    id?: number;
    history_id: string;
    snapshot_batch_id?: number;
    snapshot_version?: number;
    period_month: number;
    period_year: number;
    division_code: string;
    gang_code: string;
    gang_description?: string;
    total_employees: number;
    total_hk: number;
    total_hari_kerja: number;
    total_cuti_tahunan: number;
    total_cuti_sakit: number;
    total_cuti_minggu: number;
    total_cuti_nasional: number;
    total_upah_dasar: number;
    total_upah_pokok: number;
    total_gaji_pokok: number;
    total_beras: number;
    total_jabatan: number;
    total_masa_kerja: number;
    total_lembur: number;
    total_tunjangan: number;
    total_premi_brondol: number;
    total_premi_prunning: number;
    total_premi_insentif: number;
    total_premi_kinerja: number;
    total_premi: number;
    dynamic_premi_data?: string;
    total_koreksi: number;
    total_potongan: number;
    total_pph21: number;
    total_bpjs_pekerja: number;
    total_bpjs_majikan: number;
    total_spsi: number;
    dynamic_potongan_data?: string;
    total_upah_kotor: number;
    total_upah_bersih: number;
    total_ffb_weight?: number;
    total_weight_tbs?: number;
    informasi_tambahan?: string;
    created_at?: Date;
    created_by?: string;
    source_endpoint?: string;
    is_locked?: boolean;
    lock_reason?: string;
}

export interface HistoryQueriesDetail {
    id?: number;
    history_id: string;
    master_id: number;
    snapshot_batch_id?: number;
    snapshot_version?: number;
    emp_code: string;
    emp_name?: string;
    nik?: string;
    new_nik?: string;
    gender?: string;
    gang_code: string;
    division_code: string;
    loc_code?: string;
    status_ptkp?: string;
    kategori_ter?: string;
    hari_kerja: number;
    cuti_tahunan_hari: number;
    cuti_sakit_haid_hari: number;
    cuti_minggu_hari: number;
    cuti_nasional_hari: number;
    jumlah_hk: number;
    total_jam_kerja: number;
    upah_dasar: number;
    upah_pokok: number;
    gaji_pokok: number;
    gaji_pokok_ideal: number;
    gaji_pokok_aktual: number;
    koreksi_hk: number;
    beras_rate: number;
    beras_jumlah: number;
    jabatan_rate: number;
    jabatan_jumlah: number;
    masa_kerja_tahun: number;
    masa_kerja_rate: number;
    masa_kerja_jumlah: number;
    lembur_jam: number;
    lembur_rate: number;
    lembur_jumlah: number;
    lembur_records?: string;
    total_tunjangan: number;
    premi_brondol: number;
    premi_brondol_loosefruit?: number;
    premi_brondol_adtrans?: number;
    premi_brondol_total?: number;
    premi_pph: number;
    total_premi: number;
    premi_detail?: string;
    pot_spsi: number;
    pot_pph21: number;
    pot_koreksi: number;
    pot_bpjs_kesehatan_pekerja: number;
    pot_bpjs_kesehatan_majikan: number;
    pot_bpjs_pensiun_pekerja: number;
    pot_bpjs_pensiun_majikan: number;
    pot_bpjs_pekerja_total: number;
    pot_astek_pekerja: number;
    pot_astek_majikan: number;
    pot_astek_jumlah: number;
    potongan_detail?: string;
    total_potongan: number;
    total_potongan_bersih: number;
    jumlah_upah_kotor: number;
    upah_kotor_pajak: number;
    penghasilan_bruto: number;
    tarif_pajak_ter?: number;
    pph21_ter: number;
    upah_bersih: number;
    task_code?: string;
    task_desc?: string;
    shortage_details?: string;
    shortage_total_hours?: number;
    jabatan?: string;
    is_spsi_member?: boolean;
    created_at?: Date;
}

export interface HistoryQueriesTaskreg {
    id?: number;
    history_id: string;
    original_master_id?: number;
    reg_no?: string;
    reg_date?: Date;
    emp_code: string;
    gang_code?: string;
    division_code?: string;
    original_line_id?: number;
    line_no?: number;
    trx_date: Date;
    task_code?: string;
    task_desc?: string;
    hours: number;
    ot: boolean;
    rate?: number;
    amount: number;
    tapping_type?: string;
    location_code?: string;
    status?: string;
    is_cuti_tahunan: boolean;
    is_cuti_sakit: boolean;
    is_cuti_minggu: boolean;
    is_cuti_nasional: boolean;
    is_hari_kerja: boolean;
    is_lembur: boolean;
    period_month: number;
    period_year: number;
    source_table: string;
    created_at?: Date;
}

export interface HistoryQueriesAdtrans {
    id?: number;
    history_id: string;
    original_master_id?: number;
    doc_no?: string;
    doc_date: Date;
    doc_desc?: string;
    emp_code: string;
    gang_code?: string;
    division_code?: string;
    original_line_id?: number;
    line_no?: number;
    task_code?: string;
    task_desc?: string;
    amount: number;
    quantity?: number;
    uom?: string;
    category: string;
    sub_category?: string;
    is_dynamic: boolean;
    dynamic_header_name?: string;
    is_premi_pph: boolean;
    is_koreksi: boolean;
    is_potongan: boolean;
    is_premi: boolean;
    period_month: number;
    period_year: number;
    source_table: string;
    created_at?: Date;
}

export interface HistoryQueriesGangMember {
    id?: number;
    history_id: string;
    gang_code: string;
    gang_description?: string;
    division_code: string;
    loc_code?: string;
    emp_code: string;
    emp_name?: string;
    nik?: string;
    jabatan?: string;
    join_date?: Date;
    is_active: boolean;
    period_month: number;
    period_year: number;
    source_table: string;
    created_at?: Date;
}

export interface HistoryQueriesHrEmployee {
    id?: number;
    history_id: string;
    period_month: number;
    period_year: number;
    nik?: string;
    new_nik?: string;
    pajak_npwp?: string;
    res_address?: string;
    emp_code: string;
    emp_name?: string;
    company_code?: string;
    division_code?: string;
    loc_code?: string;
    gang_code?: string;
    job_code?: string;
    position?: string;
    jabatan?: string;
    is_spsi_member?: boolean;
    join_date?: Date;
    terminate_date?: Date;
    status?: string;
    employee_type?: string;
    gender?: string;
    religion?: string;
    birth_place?: string;
    birth_date?: Date;
    marital_status?: string;
    tax_status?: string;
    ptkp_beras?: string;
    ptkp_pajak?: string;
    upah_dasar?: number;
    total_hk?: number;
    source_table: string;
    created_at?: Date;
}

export interface HistoryQueriesHrGang {
    id?: number;
    history_id: string;
    period_month: number;
    period_year: number;
    division_code?: string;
    loc_code?: string;
    gang_code: string;
    gang_description?: string;
    mandor_code?: string;
    mandor_name?: string;
    mandor_1_code?: string;
    mandor_1_name?: string;
    assistant_code?: string;
    assistant_name?: string;
    total_members?: number;
    is_active?: boolean;
    source_table: string;
    created_at?: Date;
}

export interface HistoryQueriesMetadata {
    id?: number;
    history_id: string;
    operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOCK' | 'UNLOCK' | 'ARCHIVE' | 'RESTORE';
    entity_type: 'PAYROLL_MASTER' | 'PAYROLL_DETAIL' | 'TASKREG' | 'ADTRANS' | 'GANG_MEMBER' | 'BATCH';
    entity_id?: number;
    period_month: number;
    period_year: number;
    division_code?: string;
    gang_code?: string;
    description?: string;
    old_values?: string;
    new_values?: string;
    record_count?: number;
    status?: 'SUCCESS' | 'FAILED' | 'PENDING' | 'ROLLBACK';
    error_message?: string;
    performed_by: string;
    performed_at?: Date;
    ip_address?: string;
    user_agent?: string;
    session_id?: string;
}

// ============================================================================
// HR HISTORY FALLBACK QUERIES
// ============================================================================

/**
 * @query selectHistoryDataExists
 * @table history_hr_employee (extend_db_ptrj)
 * @input db, periodMonth?, periodYear?
 * @output boolean (any row exists)
 * @sql SELECT TOP 1 1 FROM dbo.history_hr_employee [WHERE period_month=? AND period_year=?]
 */
export async function selectHistoryDataExists(
    db: Database,
    periodMonth?: number,
    periodYear?: number
): Promise<boolean> {
    let sql = `SELECT TOP 1 1 FROM dbo.history_hr_employee`;
    const params: any[] = [];

    if (periodMonth && periodYear) {
        sql += ` WHERE period_month = ? AND period_year = ?`;
        params.push(periodMonth, periodYear);
    }

    const result = await db.queryOne<{ '': number }>(sql, params);
    return !!result;
}

/**
 * @query getDivisionPrefixMap
 * @table (static lookup, no DB)
 * @input none
 * @output Record<string,string[]> division -> gang_code prefixes
 * @sql (no SQL; in-memory map)
 */
export function getDivisionPrefixMap(): Record<string, string[]> {
    return {
        "PG1A": ["A"], "PG1B": ["B"], "PG2A": ["C"], "PG2B": ["D"],
        "DME": ["E"], "ARA": ["F"], "AB1": ["G"], "AB2": ["H"],
        "INF": ["I"], "ARC": ["J"], "IJL": ["L"],
    };
}

/**
 * @query buildDivisionPrefixFilter
 * @table (helper; composes WHERE on gang_code)
 * @input division?
 * @output { clause: string, params: any[] }
 * @sql (UPPER(RTRIM(gang_code)) LIKE ? [OR ...]) per prefix
 */
export function buildDivisionPrefixFilter(division?: string): { clause: string; params: any[] } {
    if (!division) return { clause: '', params: [] };

    const prefixMap = getDivisionPrefixMap();
    const prefixes = prefixMap[division] || [];
    if (prefixes.length === 0) return { clause: '', params: [] };

    const conditions = prefixes.map(() => `UPPER(RTRIM(gang_code)) LIKE ?`);
    return {
        clause: `(${conditions.join(" OR ")})`,
        params: prefixes.map(p => p + "%"),
    };
}

/**
 * @query selectEmployeesFromHistory
 * @table history_hr_employee (extend_db_ptrj)
 * @input db, { gangCode?, division?, religion?, status? }
 * @output any[] employee rows (latest period per emp_code)
 * @sql SELECT ... FROM dbo.history_hr_employee h [WHERE ...] AND period_year=(max per emp) AND period_month=(max per emp/year) ORDER BY emp_name
 */
export async function selectEmployeesFromHistory(
    db: Database,
    options: {
        gangCode?: string;
        division?: string;
        religion?: string;
        status?: string;
    }
): Promise<any[]> {
    let params: any[] = [];
    let whereClauses: string[] = [];

    if (options.division) {
        const prefixFilter = buildDivisionPrefixFilter(options.division);
        if (prefixFilter.clause) {
            whereClauses.push(prefixFilter.clause);
            params.push(...prefixFilter.params);
        }
    }

    if (options.gangCode && options.gangCode !== "ALL" && options.gangCode.trim()) {
        whereClauses.push(`UPPER(RTRIM(gang_code)) = ?`);
        params.push(options.gangCode.trim().toUpperCase());
    }

    if (options.religion) {
        whereClauses.push(`UPPER(RTRIM(religion)) = ?`);
        params.push(options.religion.trim().toUpperCase());
    }

    if (options.status) {
        whereClauses.push(`UPPER(RTRIM(status)) = ?`);
        params.push(options.status.trim().toUpperCase());
    }

    const whereClause = whereClauses.length > 0
        ? `WHERE ${whereClauses.join(" AND ")}`
        : "";

    const sql = `
        SELECT
            RTRIM(emp_code) AS nik,
            RTRIM(nik) AS actual_nik,
            emp_name AS nama,
            gender AS jenis_kelamin,
            RTRIM(loc_code) AS loc_code,
            RTRIM(gang_code) AS gang_code,
            RTRIM(religion) AS religion,
            RTRIM(status) AS status,
            RTRIM(employee_type) AS employee_type,
            CONVERT(VARCHAR, birth_date, 23) AS birth_date,
            CONVERT(VARCHAR, join_date, 23) AS join_date,
            CONVERT(VARCHAR, terminate_date, 23) AS terminate_date,
            CONVERT(VARCHAR, birth_date, 23) AS birth_date_str,
            period_month,
            period_year
        FROM dbo.history_hr_employee h
        ${whereClause}
        AND period_year = (SELECT MAX(period_year) FROM dbo.history_hr_employee h2 WHERE h2.emp_code = h.emp_code)
        AND period_month = (SELECT MAX(period_month) FROM dbo.history_hr_employee h3
            WHERE h3.emp_code = h.emp_code AND h3.period_year = h.period_year)
        ORDER BY emp_name
    `;

    return await db.query<any>(sql, params);
}

/**
 * @query searchEmployeesFromHistory
 * @table history_hr_employee (extend_db_ptrj)
 * @input db, term, limit?, division?
 * @output any[] employee rows matching term
 * @sql SELECT TOP N ... FROM dbo.history_hr_employee WHERE (emp_code LIKE ? OR emp_name LIKE ? OR nik LIKE ?) [AND division prefix] ORDER BY emp_name
 */
export async function searchEmployeesFromHistory(
    db: Database,
    term: string,
    limit: number = 50,
    division?: string
): Promise<any[]> {
    let params: any[] = [`%${term}%`, `%${term}%`, `%${term}%`];
    let whereClause = `(emp_code LIKE ? OR emp_name LIKE ? OR nik LIKE ?)`;

    if (division) {
        const prefixFilter = buildDivisionPrefixFilter(division);
        if (prefixFilter.clause) {
            whereClause += ` AND (${prefixFilter.clause})`;
            params.push(...prefixFilter.params);
        }
    }

    const sql = `
        SELECT TOP ${limit}
            RTRIM(emp_code) AS nik,
            RTRIM(nik) AS actual_nik,
            emp_name AS nama,
            gender AS jenis_kelamin,
            RTRIM(loc_code) AS loc_code,
            RTRIM(gang_code) AS gang_code,
            RTRIM(religion) AS religion,
            RTRIM(status) AS status,
            RTRIM(employee_type) AS employee_type,
            CONVERT(VARCHAR, birth_date, 23) AS birth_date,
            CONVERT(VARCHAR, join_date, 23) AS join_date
        FROM dbo.history_hr_employee
        WHERE ${whereClause}
        ORDER BY emp_name
    `;

    return await db.query<any>(sql, params);
}

/**
 * @query selectAvailableGangsFromHistory
 * @table history_hr_employee (extend_db_ptrj)
 * @input db, division?
 * @output string[] distinct gang_codes
 * @sql SELECT DISTINCT RTRIM(gang_code) ... FROM dbo.history_hr_employee WHERE gang_code IS NOT NULL [AND division prefix] ORDER BY gang_code
 */
export async function selectAvailableGangsFromHistory(
    db: Database,
    division?: string
): Promise<string[]> {
    let sql = `SELECT DISTINCT RTRIM(gang_code) AS gang_code FROM dbo.history_hr_employee WHERE gang_code IS NOT NULL AND RTRIM(gang_code) != ''`;
    const params: any[] = [];

    if (division) {
        const prefixFilter = buildDivisionPrefixFilter(division);
        if (prefixFilter.clause) {
            sql += ` AND (${prefixFilter.clause})`;
            params.push(...prefixFilter.params);
        }
    }

    sql += ` ORDER BY gang_code`;
    const rows = await db.query<{ gang_code: string }>(sql, params);
    return rows.map(r => r.gang_code?.trim()).filter(Boolean) as string[];
}

/**
 * @query selectAvailableReligionsFromHistory
 * @table history_hr_employee (extend_db_ptrj)
 * @input db
 * @output string[] distinct religions
 * @sql SELECT DISTINCT RTRIM(religion) ... FROM dbo.history_hr_employee WHERE religion IS NOT NULL ORDER BY religion
 */
export async function selectAvailableReligionsFromHistory(db: Database): Promise<string[]> {
    const rows = await db.query<{ religion: string }>(`
        SELECT DISTINCT RTRIM(religion) AS religion
        FROM dbo.history_hr_employee
        WHERE religion IS NOT NULL AND RTRIM(religion) != ''
        ORDER BY religion
    `);
    return rows.map(r => r.religion?.trim()).filter(Boolean) as string[];
}

/**
 * @query selectAvailableStatusesFromHistory
 * @table history_hr_employee (extend_db_ptrj)
 * @input db
 * @output string[] distinct statuses
 * @sql SELECT DISTINCT RTRIM(status) ... FROM dbo.history_hr_employee WHERE status IS NOT NULL ORDER BY status
 */
export async function selectAvailableStatusesFromHistory(db: Database): Promise<string[]> {
    const rows = await db.query<{ status: string }>(`
        SELECT DISTINCT RTRIM(status) AS status
        FROM dbo.history_hr_employee
        WHERE status IS NOT NULL AND RTRIM(status) != ''
        ORDER BY status
    `);
    return rows.map(r => r.status?.trim()).filter(Boolean) as string[];
}

// ============================================================================
// PAYROLL HISTORY MASTER QUERIES
// ============================================================================

/**
 * @query selectPayrollHistoryMasterExisting
 * @table payroll_history_header (extend_db_ptrj)
 * @input db, { period_month, period_year, division_code, gang_code, snapshot_version? }
 * @output { id } | null
 * @sql SELECT id FROM dbo.payroll_history_header WHERE period_month=? AND period_year=? AND division_code=? AND gang_code=? [AND snapshot_version=?]
 */
export async function selectPayrollHistoryMasterExisting(
    db: Database,
    data: {
        period_month: number;
        period_year: number;
        division_code: string;
        gang_code: string;
        snapshot_version?: number;
    }
): Promise<{ id: number } | null> {
    const hasSnapshotVersion = typeof data.snapshot_version === "number" && Number.isFinite(data.snapshot_version);

    if (hasSnapshotVersion) {
        return await db.queryOne<{ id: number }>(`
            SELECT id FROM dbo.payroll_history_header
            WHERE period_month = ? AND period_year = ? AND division_code = ? AND gang_code = ? AND snapshot_version = ?
        `, [data.period_month, data.period_year, data.division_code, data.gang_code, data.snapshot_version]);
    }

    return await db.queryOne<{ id: number }>(`
        SELECT id FROM dbo.payroll_history_header
        WHERE period_month = ? AND period_year = ? AND division_code = ? AND gang_code = ?
    `, [data.period_month, data.period_year, data.division_code, data.gang_code]);
}

/**
 * @query insertPayrollHistoryMaster
 * @table payroll_history_header (extend_db_ptrj)
 * @input db, columnMap (Record<string,any>)
 * @output inserted id
 * @sql INSERT INTO dbo.payroll_history_header (...) OUTPUT INSERTED.id VALUES (...)
 */
export async function insertPayrollHistoryMaster(
    db: Database,
    columnMap: Record<string, any>
): Promise<number> {
    const insertColumns = Object.keys(columnMap);
    const placeholders = insertColumns.map(() => "?").join(", ");
    const params = Object.values(columnMap);

    const result = await db.query(`
        INSERT INTO dbo.payroll_history_header (
            ${insertColumns.join(",\n                ")}
        ) OUTPUT INSERTED.id VALUES (
            ${placeholders}
        )
    `, params);
    return result[0]?.id;
}

/**
 * @query updatePayrollHistoryMaster
 * @table payroll_history_header (extend_db_ptrj)
 * @input db, columnMap, existingId
 * @output existingId
 * @sql UPDATE dbo.payroll_history_header SET col=?... WHERE id=?
 */
export async function updatePayrollHistoryMaster(
    db: Database,
    columnMap: Record<string, any>,
    existingId: number
): Promise<number> {
    const assignments = Object.keys(columnMap)
        .map((column) => `${column} = ?`)
        .join(",\n                    ");
    await db.query(`
        UPDATE dbo.payroll_history_header SET
            ${assignments}
        WHERE id = ?
    `, [...Object.values(columnMap), existingId]);
    return existingId;
}

/**
 * @query buildPayrollMasterColumnMap
 * @table (helper; builds column map for payroll_history_header insert/update)
 * @input data: HistoryQueriesPayrollMaster, created_at?
 * @output Record<string,any>
 * @sql (no SQL)
 */
export function buildPayrollMasterColumnMap(data: HistoryQueriesPayrollMaster, created_at?: Date): Record<string, any> {
    const map: Record<string, any> = {
        history_id: data.history_id,
        snapshot_batch_id: data.snapshot_batch_id,
        snapshot_version: data.snapshot_version,
        period_month: data.period_month,
        period_year: data.period_year,
        division_code: data.division_code,
        gang_code: data.gang_code,
        gang_description: data.gang_description,
        total_employees: data.total_employees,
        total_hk: data.total_hk,
        total_hari_kerja: data.total_hari_kerja,
        total_cuti_tahunan: data.total_cuti_tahunan,
        total_cuti_sakit: data.total_cuti_sakit,
        total_cuti_minggu: data.total_cuti_minggu,
        total_cuti_nasional: data.total_cuti_nasional,
        total_upah_dasar: data.total_upah_dasar,
        total_upah_pokok: data.total_upah_pokok,
        total_gaji_pokok: data.total_gaji_pokok,
        total_beras: data.total_beras,
        total_jabatan: data.total_jabatan,
        total_masa_kerja: data.total_masa_kerja,
        total_lembur: data.total_lembur,
        total_tunjangan: data.total_tunjangan,
        total_premi_brondol: data.total_premi_brondol,
        total_premi_prunning: data.total_premi_prunning,
        total_premi_insentif: data.total_premi_insentif,
        total_premi_kinerja: data.total_premi_kinerja,
        total_premi: data.total_premi,
        dynamic_premi_data: data.dynamic_premi_data,
        total_koreksi: data.total_koreksi,
        total_potongan: data.total_potongan,
        total_pph21: data.total_pph21,
        total_bpjs_pekerja: data.total_bpjs_pekerja,
        total_bpjs_majikan: data.total_bpjs_majikan,
        total_spsi: data.total_spsi,
        dynamic_potongan_data: data.dynamic_potongan_data,
        total_upah_kotor: data.total_upah_kotor,
        total_upah_bersih: data.total_upah_bersih,
        total_ffb_weight: data.total_ffb_weight,
        total_weight_tbs: data.total_weight_tbs,
        informasi_tambahan: data.informasi_tambahan,
        created_by: data.created_by,
        source_endpoint: data.source_endpoint,
        is_locked: data.is_locked ?? false,
        lock_reason: data.lock_reason,
    };
    if (created_at) {
        map['created_at'] = created_at;
    }
    return map;
}

/**
 * @query selectPayrollHistoryMaster
 * @table payroll_history_header (extend_db_ptrj)
 * @input db, periodMonth, periodYear, divisionCode?, gangCode?, divisionAliases?
 * @output HistoryQueriesPayrollMaster[]
 * @sql SELECT * FROM dbo.payroll_history_header WHERE period_month=? AND period_year=? [AND division_code IN (?)] [AND gang_code=?] ORDER BY division_code, gang_code
 */
export async function selectPayrollHistoryMaster(
    db: Database,
    periodMonth: number,
    periodYear: number,
    divisionCode?: string,
    gangCode?: string,
    divisionAliases?: string[]
): Promise<HistoryQueriesPayrollMaster[]> {
    let sql = `
        SELECT * FROM dbo.payroll_history_header
        WHERE period_month = ? AND period_year = ?
    `;
    const params: any[] = [periodMonth, periodYear];

    if (divisionCode && divisionAliases && divisionAliases.length > 0) {
        const placeholders = divisionAliases.map(() => '?').join(',');
        sql += ` AND division_code IN (${placeholders})`;
        params.push(...divisionAliases);
    }

    if (gangCode) {
        sql += ` AND gang_code = ?`;
        params.push(gangCode);
    }

    sql += ` ORDER BY division_code, gang_code`;

    return await db.query<HistoryQueriesPayrollMaster>(sql, params);
}

/**
 * @query selectHistoryTaxIdentityByEmpCodes
 * @table history_hr_employee (extend_db_ptrj)
 * @input db, periodMonth, periodYear, empCodes[]
 * @output any[] { emp_code, nik, new_nik, pajak_npwp, res_address, religion } latest per emp_code (chunked)
 * @sql SELECT emp_code, nik, new_nik, pajak_npwp, res_address, religion FROM (SELECT ..., ROW_NUMBER() OVER (PARTITION BY emp_code ORDER BY period match, year DESC, month DESC, id DESC) rn FROM dbo.history_hr_employee WHERE period_year=? AND emp_code IN (?)) WHERE rn=1
 */
export async function selectHistoryTaxIdentityByEmpCodes(
    db: Database,
    periodMonth: number,
    periodYear: number,
    empCodes: string[]
): Promise<any[]> {
    const result: any[] = [];
    const chunkSize = 500;

    for (let i = 0; i < empCodes.length; i += chunkSize) {
        const chunk = empCodes.slice(i, i + chunkSize);
        const placeholders = chunk.map(() => "?").join(",");
        const rows = await db.query<any>(`
            SELECT emp_code, nik, new_nik, pajak_npwp, res_address, religion
            FROM (
                SELECT
                    RTRIM(emp_code) AS emp_code,
                    NULLIF(RTRIM(ISNULL(nik, '')), '') AS nik,
                    NULLIF(RTRIM(ISNULL(new_nik, '')), '') AS new_nik,
                    NULLIF(RTRIM(ISNULL(pajak_npwp, '')), '') AS pajak_npwp,
                    NULLIF(RTRIM(ISNULL(res_address, '')), '') AS res_address,
                    NULLIF(RTRIM(ISNULL(religion, '')), '') AS religion,
                    ROW_NUMBER() OVER (
                        PARTITION BY RTRIM(emp_code)
                        ORDER BY
                            CASE WHEN period_month = ? AND period_year = ? THEN 0 ELSE 1 END,
                            period_year DESC,
                            period_month DESC,
                            id DESC
                    ) AS rn
                FROM dbo.history_hr_employee
                WHERE period_year = ?
                  AND RTRIM(emp_code) IN (${placeholders})
            ) ranked
            WHERE rn = 1
        `, [periodMonth, periodYear, periodYear, ...chunk]);
        result.push(...rows);
    }

    return result;
}

/**
 * @query updateLockPayrollHistory
 * @table payroll_history_header (extend_db_ptrj)
 * @input db, reason, periodMonth, periodYear, divisionCode, gangCode
 * @output void
 * @sql UPDATE dbo.payroll_history_header SET is_locked=1, lock_reason=? WHERE period_month=? AND period_year=? AND division_code=? AND gang_code=?
 */
export async function updateLockPayrollHistory(
    db: Database,
    reason: string,
    periodMonth: number,
    periodYear: number,
    divisionCode: string,
    gangCode: string
): Promise<void> {
    await db.query(`
        UPDATE dbo.payroll_history_header
        SET is_locked = 1, lock_reason = ?
        WHERE period_month = ? AND period_year = ? AND division_code = ? AND gang_code = ?
    `, [reason, periodMonth, periodYear, divisionCode, gangCode]);
}

// ============================================================================
// PAYROLL HISTORY DETAIL QUERIES
// ============================================================================

/**
 * @query selectPayrollHistoryDetailExisting
 * @table payroll_history_detail (extend_db_ptrj)
 * @input db, masterId, empCode
 * @output { id, nik, new_nik } | null
 * @sql SELECT id, nik, new_nik FROM dbo.payroll_history_detail WHERE master_id=? AND emp_code=?
 */
export async function selectPayrollHistoryDetailExisting(
    db: Database,
    masterId: number,
    empCode: string
): Promise<{ id: number; nik: string; new_nik: string } | null> {
    return await db.queryOne<{ id: number; nik: string; new_nik: string }>(`
        SELECT id, nik, new_nik FROM dbo.payroll_history_detail
        WHERE master_id = ? AND emp_code = ?
    `, [masterId, empCode]);
}

/**
 * @query buildPayrollDetailColumnMap
 * @table (helper; builds column map for payroll_history_detail insert)
 * @input data: HistoryQueriesDetail, resolvedNik?, resolvedNewNik?
 * @output Record<string,any>
 * @sql (no SQL)
 */
export function buildPayrollDetailColumnMap(
    data: HistoryQueriesDetail,
    resolvedNik: string | undefined,
    resolvedNewNik: string | undefined
): Record<string, any> {
    return {
        history_id: data.history_id,
        master_id: data.master_id,
        snapshot_batch_id: data.snapshot_batch_id,
        snapshot_version: data.snapshot_version,
        emp_code: data.emp_code,
        emp_name: data.emp_name,
        nik: resolvedNik ?? data.nik,
        new_nik: resolvedNewNik,
        gender: data.gender,
        gang_code: data.gang_code,
        division_code: data.division_code,
        loc_code: data.loc_code,
        status_ptkp: data.status_ptkp,
        kategori_ter: data.kategori_ter,
        hari_kerja: data.hari_kerja,
        cuti_tahunan_hari: data.cuti_tahunan_hari,
        cuti_sakit_haid_hari: data.cuti_sakit_haid_hari,
        cuti_minggu_hari: data.cuti_minggu_hari,
        cuti_nasional_hari: data.cuti_nasional_hari,
        jumlah_hk: data.jumlah_hk,
        total_jam_kerja: data.total_jam_kerja,
        upah_dasar: data.upah_dasar,
        upah_pokok: data.upah_pokok,
        gaji_pokok: data.gaji_pokok,
        gaji_pokok_ideal: data.gaji_pokok_ideal,
        gaji_pokok_aktual: data.gaji_pokok_aktual,
        koreksi_hk: data.koreksi_hk,
        beras_rate: data.beras_rate,
        beras_jumlah: data.beras_jumlah,
        jabatan_rate: data.jabatan_rate,
        jabatan_jumlah: data.jabatan_jumlah,
        masa_kerja_tahun: data.masa_kerja_tahun,
        masa_kerja_rate: data.masa_kerja_rate,
        masa_kerja_jumlah: data.masa_kerja_jumlah,
        lembur_jam: data.lembur_jam,
        lembur_rate: data.lembur_rate,
        lembur_jumlah: data.lembur_jumlah,
        lembur_records: data.lembur_records,
        total_tunjangan: data.total_tunjangan,
        premi_brondol: data.premi_brondol,
        premi_brondol_loosefruit: data.premi_brondol_loosefruit,
        premi_brondol_adtrans: data.premi_brondol_adtrans,
        premi_brondol_total: data.premi_brondol_total,
        premi_pph: data.premi_pph,
        total_premi: data.total_premi,
        premi_detail: data.premi_detail,
        pot_spsi: data.pot_spsi,
        pot_pph21: data.pot_pph21,
        pot_koreksi: data.pot_koreksi,
        pot_bpjs_kesehatan_pekerja: data.pot_bpjs_kesehatan_pekerja,
        pot_bpjs_kesehatan_majikan: data.pot_bpjs_kesehatan_majikan,
        pot_bpjs_pensiun_pekerja: data.pot_bpjs_pensiun_pekerja,
        pot_bpjs_pensiun_majikan: data.pot_bpjs_pensiun_majikan,
        pot_bpjs_pekerja_total: data.pot_bpjs_pekerja_total,
        pot_astek_pekerja: data.pot_astek_pekerja,
        pot_astek_majikan: data.pot_astek_majikan,
        pot_astek_jumlah: data.pot_astek_jumlah,
        potongan_detail: data.potongan_detail,
        total_potongan: data.total_potongan,
        total_potongan_bersih: data.total_potongan_bersih,
        jumlah_upah_kotor: data.jumlah_upah_kotor,
        upah_kotor_pajak: data.upah_kotor_pajak,
        penghasilan_bruto: data.penghasilan_bruto,
        tarif_pajak_ter: data.tarif_pajak_ter,
        pph21_ter: data.pph21_ter,
        upah_bersih: data.upah_bersih,
        task_code: data.task_code,
        task_desc: data.task_desc,
        shortage_details: data.shortage_details,
        shortage_total_hours: data.shortage_total_hours,
        jabatan: data.jabatan,
        is_spsi_member: data.is_spsi_member,
    };
}

/**
 * @query insertPayrollHistoryDetail
 * @table payroll_history_detail (extend_db_ptrj)
 * @input db, columnMap
 * @output inserted id
 * @sql INSERT INTO dbo.payroll_history_detail (...) OUTPUT INSERTED.id VALUES (...)
 */
export async function insertPayrollHistoryDetail(
    db: Database,
    columnMap: Record<string, any>
): Promise<number> {
    const columns = Object.keys(columnMap);
    const placeholders = columns.map(() => '?').join(', ');
    const params = Object.values(columnMap);

    const sql = `
        INSERT INTO dbo.payroll_history_detail (
            ${columns.join(',\n                ')}
        ) OUTPUT INSERTED.id VALUES (
            ${placeholders}
        )
    `;

    const result = await db.query(sql, params);
    return result[0]?.id;
}

/**
 * @query selectPayrollHistoryDetails
 * @table payroll_history_detail (extend_db_ptrj)
 * @input db, masterId
 * @output HistoryQueriesDetail[]
 * @sql SELECT * FROM dbo.payroll_history_detail WHERE master_id=? ORDER BY emp_code
 */
export async function selectPayrollHistoryDetails(
    db: Database,
    masterId: number
): Promise<HistoryQueriesDetail[]> {
    return await db.query<HistoryQueriesDetail>(`
        SELECT * FROM dbo.payroll_history_detail
        WHERE master_id = ?
        ORDER BY emp_code
    `, [masterId]);
}

// ============================================================================
// BIG HISTORY FETCH: master SELECT (for getHistoricalPayrollDataAsExtractorFormat)
// ============================================================================

export interface HistoryMasterFetchArgs {
    periodMonth: number;
    periodYear: number;
    gangCode?: string;
    divisionCode?: string;
    gangPrefix?: string;
    divisionCodes?: string[];
    virtualGangs?: string[];
    isVirtual?: boolean;
}

/**
 * @query selectPayrollHistoryMasters
 * @table payroll_history_header (extend_db_ptrj)
 * @input db, args: HistoryMasterFetchArgs { periodMonth, periodYear, gangCode?, divisionCode?, gangPrefix?, divisionCodes?, virtualGangs?, isVirtual? }
 * @output { id, snapshot_version, dynamic_premi_data, dynamic_potongan_data }[]
 * @sql SELECT h.id, h.snapshot_version, h.dynamic_premi_data, h.dynamic_potongan_data FROM dbo.payroll_history_header h WHERE period_month=? AND period_year=? [AND (gang_code IN (?) OR division_code IN (?))] [AND division_code IN (?)] [AND division_code='ALL'] [AND gang_code=?] AND snapshot_version=(max subquery)
 */
export async function selectPayrollHistoryMasters(
    db: Database,
    args: HistoryMasterFetchArgs
): Promise<{ id: number; snapshot_version: number; dynamic_premi_data: string; dynamic_potongan_data: string }[]> {
    let masterQuery = `SELECT h.id, h.snapshot_version, h.dynamic_premi_data, h.dynamic_potongan_data FROM dbo.payroll_history_header h WHERE h.period_month = ? AND h.period_year = ?`;
    const masterParams: any[] = [args.periodMonth, args.periodYear];

    if (args.divisionCode && args.virtualGangs && args.virtualGangs.length > 0 && args.isVirtual) {
        const targets = [...new Set([...args.virtualGangs, ...(args.divisionCodes || [])])];
        if (targets.length > 0) {
            const placeholders = targets.map(() => '?').join(',');
            masterQuery += ` AND (h.gang_code IN (${placeholders}) OR h.division_code IN (${placeholders}))`;
            masterParams.push(...targets, ...targets);
        }
    } else if (args.divisionCode && args.divisionCodes && args.divisionCodes.length > 0 && args.divisionCode !== 'ALL') {
        const placeholders = args.divisionCodes.map(() => '?').join(',');
        masterQuery += ` AND h.division_code IN (${placeholders})`;
        masterParams.push(...args.divisionCodes);
    } else if (args.divisionCode === 'ALL') {
        masterQuery += ` AND h.division_code = 'ALL'`;
    }

    if (args.gangCode && args.gangCode !== "ALL") {
        masterQuery += ` AND h.gang_code = ?`;
        masterParams.push(args.gangCode);
    }

    masterQuery += `
        AND ISNULL(h.snapshot_version, 0) = (
            SELECT ISNULL(MAX(h2.snapshot_version), 0)
            FROM dbo.payroll_history_header h2
            WHERE h2.period_month = h.period_month
              AND h2.period_year = h.period_year
              AND h2.division_code = h.division_code
              AND h2.gang_code = h.gang_code
        )
    `;

    return await db.query<{ id: number; snapshot_version: number; dynamic_premi_data: string; dynamic_potongan_data: string }>(masterQuery, masterParams);
}

export interface HistoryDetailFetchArgs {
    masterIds: number[];
    gangCode?: string;
    gangPrefix?: string;
    divisionCode?: string;
    divisionCodes?: string[];
    specificEmpCode?: string | null;
}

/**
 * @query selectPayrollHistoryDetailsByArgs
 * @table payroll_history_detail (extend_db_ptrj)
 * @input db, args: HistoryDetailFetchArgs { masterIds[], gangCode?, gangPrefix?, divisionCode?, divisionCodes?, specificEmpCode? }
 * @output any[]
 * @sql SELECT d.* FROM dbo.payroll_history_detail d WHERE master_id IN (?) [AND emp_code=?] [AND gang_code=?] [AND gang_code LIKE ?%] [AND (division_code IN (?) OR loc_code IN (?))] ORDER BY snapshot_version DESC, id DESC
 */
export async function selectPayrollHistoryDetailsByArgs(
    db: Database,
    args: HistoryDetailFetchArgs
): Promise<any[]> {
    const masterIdsStr = args.masterIds.join(',');

    let detailQuery = `
        SELECT d.*
        FROM dbo.payroll_history_detail d
        WHERE master_id IN (${masterIdsStr})
    `;
    const detailParams: any[] = [];

    if (args.specificEmpCode) {
        detailQuery += ` AND emp_code = ?`;
        detailParams.push(args.specificEmpCode);
    }

    if (args.gangCode && args.gangCode !== "ALL") {
        detailQuery += ` AND gang_code = ?`;
        detailParams.push(args.gangCode);
    } else if (args.gangPrefix && args.gangPrefix.trim() !== "" && !/^\d+$/.test(args.gangPrefix.trim())) {
        detailQuery += ` AND d.gang_code LIKE ?`;
        detailParams.push(`${args.gangPrefix.trim()}%`);
    } else if (args.divisionCode && args.divisionCode !== "ALL" && args.divisionCodes && args.divisionCodes.length > 0) {
        const divList = args.divisionCodes;
        const placeholders = divList.map(() => '?').join(',');
        detailQuery += ` AND (division_code IN (${placeholders}) OR loc_code IN (${placeholders}))`;
        detailParams.push(...divList, ...divList);
    }

    detailQuery += ` ORDER BY ISNULL(d.snapshot_version, 0) DESC, d.id DESC`;

    return await db.query<any>(detailQuery, detailParams);
}

/**
 * @query selectHistoryReligions
 * @table history_hr_employee (extend_db_ptrj)
 * @input db, periodMonth, periodYear, empCodes[]
 * @output { emp_code, religion }[] chunked
 * @sql SELECT RTRIM(emp_code), religion FROM dbo.history_hr_employee WHERE period_month=? AND period_year=? AND RTRIM(emp_code) IN (?)
 */
export async function selectHistoryReligions(
    db: Database,
    periodMonth: number,
    periodYear: number,
    empCodes: string[]
): Promise<{ emp_code: string; religion: string }[]> {
    const result: { emp_code: string; religion: string }[] = [];
    const REL_CHUNK = 500;

    for (let ri = 0; ri < empCodes.length; ri += REL_CHUNK) {
        const chunk = empCodes.slice(ri, ri + REL_CHUNK);
        const placeholders = chunk.map(() => '?').join(',');
        const rows = await db.query<{ emp_code: string; religion: string }>(`
            SELECT RTRIM(emp_code) as emp_code, religion
            FROM dbo.history_hr_employee
            WHERE period_month = ? AND period_year = ? AND RTRIM(emp_code) IN (${placeholders})
        `, [periodMonth, periodYear, ...chunk]);
        result.push(...rows);
    }

    return result;
}

/**
 * @query selectLiveHrEmployees
 * @table HR_EMPLOYEE (db_ptrj live)
 * @input db, empCodes[]
 * @output any[] { emp_code, res_address, hr_emp_type, actual_nik, Religion } chunked
 * @sql SELECT RTRIM(EmpCode), ResAddress, HREmpType, NewICNo, Religion FROM dbo.HR_EMPLOYEE WHERE RTRIM(EmpCode) IN (?)
 */
export async function selectLiveHrEmployees(
    db: Database,
    empCodes: string[]
): Promise<any[]> {
    const result: any[] = [];
    const HR_CHUNK = 500;

    for (let hi = 0; hi < empCodes.length; hi += HR_CHUNK) {
        const chunk = empCodes.slice(hi, hi + HR_CHUNK);
        const placeholders = chunk.map(() => '?').join(',');
        const rows = await db.query<any>(`
            SELECT RTRIM(EmpCode) as emp_code, ResAddress as res_address, HREmpType as hr_emp_type, NewICNo as actual_nik, Religion
            FROM dbo.HR_EMPLOYEE
            WHERE RTRIM(EmpCode) IN (${placeholders})
        `, chunk);
        result.push(...rows);
    }

    return result;
}

// ============================================================================
// DELETE QUERIES
// ============================================================================

/**
 * @query deletePayrollHistoryDetailsByMasterId
 * @table payroll_history_detail (extend_db_ptrj)
 * @input db, masterId
 * @output void
 * @sql DELETE FROM dbo.payroll_history_detail WHERE master_id=?
 */
export async function deletePayrollHistoryDetailsByMasterId(
    db: Database,
    masterId: number
): Promise<void> {
    await db.query(`
        DELETE FROM dbo.payroll_history_detail
        WHERE master_id = ?
    `, [masterId]);
}

/**
 * @query deleteHrEmployeeHistory
 * @table history_hr_employee (extend_db_ptrj)
 * @input db, periodMonth, periodYear, divisionCode?, gangCode?
 * @output void
 * @sql DELETE FROM dbo.history_hr_employee WHERE period_month=? AND period_year=? [AND loc_code=?] [AND gang_code=?]
 */
export async function deleteHrEmployeeHistory(
    db: Database,
    periodMonth: number,
    periodYear: number,
    divisionCode?: string,
    gangCode?: string
): Promise<void> {
    let sql = `DELETE FROM dbo.history_hr_employee WHERE period_month = ? AND period_year = ?`;
    const params: any[] = [periodMonth, periodYear];

    if (divisionCode) {
        sql += ` AND loc_code = ?`;
        params.push(divisionCode);
    }
    if (gangCode && gangCode !== 'ALL') {
        sql += ` AND gang_code = ?`;
        params.push(gangCode);
    }

    await db.query(sql, params);
}

/**
 * @query deleteHrGangHistory
 * @table history_hr_gang (extend_db_ptrj)
 * @input db, periodMonth, periodYear, divisionCode?, gangCode?
 * @output void
 * @sql DELETE FROM dbo.history_hr_gang WHERE period_month=? AND period_year=? [AND loc_code=?] [AND gang_code=?]
 */
export async function deleteHrGangHistory(
    db: Database,
    periodMonth: number,
    periodYear: number,
    divisionCode?: string,
    gangCode?: string
): Promise<void> {
    let sql = `DELETE FROM dbo.history_hr_gang WHERE period_month = ? AND period_year = ?`;
    const params: any[] = [periodMonth, periodYear];

    if (divisionCode) {
        sql += ` AND loc_code = ?`;
        params.push(divisionCode);
    }
    if (gangCode && gangCode !== 'ALL') {
        sql += ` AND gang_code = ?`;
        params.push(gangCode);
    }

    await db.query(sql, params);
}

/**
 * @query selectPayrollHistoryHeadersForDelete
 * @table payroll_history_header (extend_db_ptrj)
 * @input db, periodMonth, periodYear, divisionCode?, gangCode?
 * @output { id, history_id }[]
 * @sql SELECT id, history_id FROM dbo.payroll_history_header WHERE period_month=? AND period_year=? [AND division_code=?] [AND gang_code=?]
 */
export async function selectPayrollHistoryHeadersForDelete(
    db: Database,
    periodMonth: number,
    periodYear: number,
    divisionCode?: string,
    gangCode?: string
): Promise<{ id: number; history_id: string }[]> {
    let sql = `SELECT id, history_id FROM dbo.payroll_history_header WHERE period_month = ? AND period_year = ?`;
    const params: any[] = [periodMonth, periodYear];

    if (divisionCode && divisionCode !== 'ALL') {
        sql += ` AND division_code = ?`;
        params.push(divisionCode);
    }
    if (gangCode && gangCode !== 'ALL') {
        sql += ` AND gang_code = ?`;
        params.push(gangCode);
    }

    return await db.query<{ id: number; history_id: string }>(sql, params);
}

/**
 * @query deletePayrollHistoryDetailsByMasterIds
 * @table payroll_history_detail (extend_db_ptrj)
 * @input db, masterIds[]
 * @output void
 * @sql DELETE FROM dbo.payroll_history_detail WHERE master_id IN (...)
 */
export async function deletePayrollHistoryDetailsByMasterIds(
    db: Database,
    masterIds: number[]
): Promise<void> {
    const masterIdsStr = masterIds.join(',');
    await db.query(`DELETE FROM dbo.payroll_history_detail WHERE master_id IN(${masterIdsStr})`);
}

/**
 * @query deletePayrollHistoryHeadersByIds
 * @table payroll_history_header (extend_db_ptrj)
 * @input db, ids[]
 * @output void
 * @sql DELETE FROM dbo.payroll_history_header WHERE id IN (...)
 */
export async function deletePayrollHistoryHeadersByIds(
    db: Database,
    ids: number[]
): Promise<void> {
    const idsStr = ids.join(',');
    await db.query(`DELETE FROM dbo.payroll_history_header WHERE id IN(${idsStr})`);
}

/**
 * @query deleteTaskregHistoryByIds
 * @table history_taskreg (extend_db_ptrj_transaksi)
 * @input db, historyIds[]
 * @output void
 * @sql DELETE FROM dbo.history_taskreg WHERE history_id IN ('...')
 */
export async function deleteTaskregHistoryByIds(
    db: Database,
    historyIds: string[]
): Promise<void> {
    if (historyIds.length === 0) return;
    const idsStr = historyIds.map(id => `'${id}'`).join(',');
    await db.query(`DELETE FROM dbo.history_taskreg WHERE history_id IN(${idsStr})`);
}

/**
 * @query deleteAdtransHistoryByIds
 * @table history_adtrans (extend_db_ptrj_transaksi)
 * @input db, historyIds[]
 * @output void
 * @sql DELETE FROM dbo.history_adtrans WHERE history_id IN ('...')
 */
export async function deleteAdtransHistoryByIds(
    db: Database,
    historyIds: string[]
): Promise<void> {
    if (historyIds.length === 0) return;
    const idsStr = historyIds.map(id => `'${id}'`).join(',');
    await db.query(`DELETE FROM dbo.history_adtrans WHERE history_id IN(${idsStr})`);
}

/**
 * @query deleteGangMemberHistoryByIds
 * @table history_gang_member (extend_db_ptrj_transaksi)
 * @input db, historyIds[]
 * @output void
 * @sql DELETE FROM dbo.history_gang_member WHERE history_id IN ('...')
 */
export async function deleteGangMemberHistoryByIds(
    db: Database,
    historyIds: string[]
): Promise<void> {
    if (historyIds.length === 0) return;
    const idsStr = historyIds.map(id => `'${id}'`).join(',');
    await db.query(`DELETE FROM dbo.history_gang_member WHERE history_id IN(${idsStr})`);
}

// ============================================================================
// TRANSACTION HISTORY QUERIES
// ============================================================================

/**
 * @query selectTaskregHistoryExisting
 * @table history_taskreg (extend_db_ptrj_transaksi)
 * @input db, originalMasterId?, originalLineId?, periodMonth, periodYear
 * @output { id } | null
 * @sql SELECT id FROM dbo.history_taskreg WHERE original_master_id=? AND original_line_id=? AND period_month=? AND period_year=?
 */
export async function selectTaskregHistoryExisting(
    db: Database,
    originalMasterId: number | undefined,
    originalLineId: number | undefined,
    periodMonth: number,
    periodYear: number
): Promise<{ id: number } | null> {
    return await db.queryOne<{ id: number }>(`
        SELECT id FROM dbo.history_taskreg
        WHERE original_master_id = ? AND original_line_id = ? AND period_month = ? AND period_year = ?
    `, [originalMasterId, originalLineId, periodMonth, periodYear]);
}

/**
 * @query updateTaskregHistory
 * @table history_taskreg (extend_db_ptrj_transaksi)
 * @input db, data: HistoryQueriesTaskreg, existingId
 * @output existingId
 * @sql UPDATE dbo.history_taskreg SET history_id=?, reg_no=?, ... WHERE id=?
 */
export async function updateTaskregHistory(
    db: Database,
    data: HistoryQueriesTaskreg,
    existingId: number
): Promise<number> {
    await db.query(`
        UPDATE dbo.history_taskreg SET
            history_id = ?, reg_no = ?, reg_date = ?, emp_code = ?, gang_code = ?, division_code = ?,
            trx_date = ?, task_code = ?, task_desc = ?, hours = ?, ot = ?, rate = ?, amount = ?,
            tapping_type = ?, location_code = ?, status = ?, is_cuti_tahunan = ?, is_cuti_sakit = ?,
            is_cuti_minggu = ?, is_cuti_nasional = ?, is_hari_kerja = ?, is_lembur = ?, source_table = ?
        WHERE id = ?
    `, [
        data.history_id, data.reg_no, data.reg_date, data.emp_code, data.gang_code, data.division_code,
        data.trx_date, data.task_code, data.task_desc, data.hours, data.ot, data.rate, data.amount,
        data.tapping_type, data.location_code, data.status, data.is_cuti_tahunan, data.is_cuti_sakit,
        data.is_cuti_minggu, data.is_cuti_nasional, data.is_hari_kerja, data.is_lembur, data.source_table,
        existingId,
    ]);
    return existingId;
}

/**
 * @query insertTaskregHistory
 * @table history_taskreg (extend_db_ptrj_transaksi)
 * @input db, data: HistoryQueriesTaskreg
 * @output inserted id
 * @sql INSERT INTO dbo.history_taskreg(...) OUTPUT INSERTED.id VALUES(...)
 */
export async function insertTaskregHistory(
    db: Database,
    data: HistoryQueriesTaskreg
): Promise<number> {
    const result = await db.query(`
        INSERT INTO dbo.history_taskreg(
            history_id, original_master_id, reg_no, reg_date, emp_code, gang_code, division_code,
            original_line_id, line_no, trx_date, task_code, task_desc, hours, ot, rate, amount,
            tapping_type, location_code, status, is_cuti_tahunan, is_cuti_sakit, is_cuti_minggu,
            is_cuti_nasional, is_hari_kerja, is_lembur, period_month, period_year, source_table
        ) OUTPUT INSERTED.id VALUES(
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
    `, [
        data.history_id, data.original_master_id, data.reg_no, data.reg_date, data.emp_code,
        data.gang_code, data.division_code, data.original_line_id, data.line_no, data.trx_date,
        data.task_code, data.task_desc, data.hours, data.ot, data.rate, data.amount,
        data.tapping_type, data.location_code, data.status, data.is_cuti_tahunan,
        data.is_cuti_sakit, data.is_cuti_minggu, data.is_cuti_nasional, data.is_hari_kerja,
        data.is_lembur, data.period_month, data.period_year, data.source_table,
    ]);

    return result[0]?.id;
}

/**
 * @query selectAdtransHistoryExisting
 * @table history_adtrans (extend_db_ptrj_transaksi)
 * @input db, originalMasterId?, originalLineId?, periodMonth, periodYear
 * @output { id } | null
 * @sql SELECT id FROM dbo.history_adtrans WHERE original_master_id=? AND original_line_id=? AND period_month=? AND period_year=?
 */
export async function selectAdtransHistoryExisting(
    db: Database,
    originalMasterId: number | undefined,
    originalLineId: number | undefined,
    periodMonth: number,
    periodYear: number
): Promise<{ id: number } | null> {
    return await db.queryOne<{ id: number }>(`
        SELECT id FROM dbo.history_adtrans
        WHERE original_master_id = ? AND original_line_id = ? AND period_month = ? AND period_year = ?
    `, [originalMasterId, originalLineId, periodMonth, periodYear]);
}

/**
 * @query updateAdtransHistory
 * @table history_adtrans (extend_db_ptrj_transaksi)
 * @input db, data: HistoryQueriesAdtrans, existingId
 * @output existingId
 * @sql UPDATE dbo.history_adtrans SET history_id=?, doc_no=?, ... WHERE id=?
 */
export async function updateAdtransHistory(
    db: Database,
    data: HistoryQueriesAdtrans,
    existingId: number
): Promise<number> {
    await db.query(`
        UPDATE dbo.history_adtrans SET
            history_id = ?, doc_no = ?, doc_date = ?, doc_desc = ?, emp_code = ?, gang_code = ?,
            division_code = ?, line_no = ?, task_code = ?, task_desc = ?, amount = ?, quantity = ?,
            uom = ?, category = ?, sub_category = ?, is_dynamic = ?, dynamic_header_name = ?,
            is_premi_pph = ?, is_koreksi = ?, is_potongan = ?, is_premi = ?, source_table = ?
        WHERE id = ?
    `, [
        data.history_id, data.doc_no, data.doc_date, data.doc_desc, data.emp_code, data.gang_code,
        data.division_code, data.line_no, data.task_code, data.task_desc, data.amount, data.quantity,
        data.uom, data.category, data.sub_category, data.is_dynamic, data.dynamic_header_name,
        data.is_premi_pph, data.is_koreksi, data.is_potongan, data.is_premi, data.source_table,
        existingId,
    ]);
    return existingId;
}

/**
 * @query insertAdtransHistory
 * @table history_adtrans (extend_db_ptrj_transaksi)
 * @input db, data: HistoryQueriesAdtrans
 * @output inserted id
 * @sql INSERT INTO dbo.history_adtrans(...) OUTPUT INSERTED.id VALUES(...)
 */
export async function insertAdtransHistory(
    db: Database,
    data: HistoryQueriesAdtrans
): Promise<number> {
    const result = await db.query(`
        INSERT INTO dbo.history_adtrans(
            history_id, original_master_id, doc_no, doc_date, doc_desc, emp_code, gang_code,
            division_code, original_line_id, line_no, task_code, task_desc, amount, quantity,
            uom, category, sub_category, is_dynamic, dynamic_header_name, is_premi_pph,
            is_koreksi, is_potongan, is_premi, period_month, period_year, source_table
        ) OUTPUT INSERTED.id VALUES(
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
    `, [
        data.history_id, data.original_master_id, data.doc_no, data.doc_date, data.doc_desc,
        data.emp_code, data.gang_code, data.division_code, data.original_line_id, data.line_no,
        data.task_code, data.task_desc, data.amount, data.quantity, data.uom, data.category,
        data.sub_category, data.is_dynamic, data.dynamic_header_name, data.is_premi_pph,
        data.is_koreksi, data.is_potongan, data.is_premi, data.period_month, data.period_year,
        data.source_table,
    ]);

    return result[0]?.id;
}

/**
 * @query selectPphFromAdtransByYear
 * @table history_adtrans (extend_db_ptrj_transaksi)
 * @input db, year, divisionCode?, gangCode?
 * @output { emp_code, period_month, pph_amount }[]
 * @sql SELECT emp_code, period_month, SUM(amount) pph_amount FROM dbo.history_adtrans WHERE period_year=? AND category='POTONGAN' AND sub_category='PPH21' AND is_premi_pph=0 [AND (division_code=? OR gang_code IN (subquery))] [AND gang_code=?] GROUP BY emp_code, period_month
 */
export async function selectPphFromAdtransByYear(
    db: Database,
    year: number,
    divisionCode?: string,
    gangCode?: string
): Promise<{ emp_code: string; period_month: number; pph_amount: number }[]> {
    let sql = `
        SELECT emp_code, period_month, SUM(amount) as pph_amount
        FROM dbo.history_adtrans
        WHERE period_year = ?
          AND category = 'POTONGAN'
          AND sub_category = 'PPH21'
          AND is_premi_pph = 0
    `;
    const params: any[] = [year];

    if (divisionCode && divisionCode !== 'ALL') {
        sql += ` AND (division_code = ? OR gang_code IN (
            SELECT gang_code FROM dbo.history_gang_member
            WHERE period_year = ? AND division_code = ?
        ))`;
        params.push(divisionCode, year, divisionCode);
    }

    if (gangCode && gangCode !== 'ALL') {
        sql += ` AND gang_code = ?`;
        params.push(gangCode);
    }

    sql += ` GROUP BY emp_code, period_month`;

    return await db.query<{ emp_code: string; period_month: number; pph_amount: number }>(sql, params);
}

/**
 * @query selectGangMemberHistoryExisting
 * @table history_gang_member (extend_db_ptrj_transaksi)
 * @input db, empCode, periodMonth, periodYear
 * @output { id } | null
 * @sql SELECT id FROM dbo.history_gang_member WHERE emp_code=? AND period_month=? AND period_year=?
 */
export async function selectGangMemberHistoryExisting(
    db: Database,
    empCode: string,
    periodMonth: number,
    periodYear: number
): Promise<{ id: number } | null> {
    return await db.queryOne<{ id: number }>(`
        SELECT id FROM dbo.history_gang_member
        WHERE emp_code = ? AND period_month = ? AND period_year = ?
    `, [empCode, periodMonth, periodYear]);
}

/**
 * @query updateGangMemberHistory
 * @table history_gang_member (extend_db_ptrj_transaksi)
 * @input db, data: HistoryQueriesGangMember, existingId
 * @output existingId
 * @sql UPDATE dbo.history_gang_member SET history_id=?, gang_code=?, ... WHERE id=?
 */
export async function updateGangMemberHistory(
    db: Database,
    data: HistoryQueriesGangMember,
    existingId: number
): Promise<number> {
    await db.query(`
        UPDATE dbo.history_gang_member SET
            history_id = ?, gang_code = ?, gang_description = ?, division_code = ?, loc_code = ?,
            emp_name = ?, join_date = ?, is_active = ?, source_table = ?
        WHERE id = ?
    `, [
        data.history_id, data.gang_code, data.gang_description, data.division_code, data.loc_code,
        data.emp_name, data.join_date, data.is_active, data.source_table,
        existingId,
    ]);
    return existingId;
}

/**
 * @query insertGangMemberHistory
 * @table history_gang_member (extend_db_ptrj_transaksi)
 * @input db, data: HistoryQueriesGangMember
 * @output inserted id
 * @sql INSERT INTO dbo.history_gang_member(...) OUTPUT INSERTED.id VALUES(...)
 */
export async function insertGangMemberHistory(
    db: Database,
    data: HistoryQueriesGangMember
): Promise<number> {
    const result = await db.query(`
        INSERT INTO dbo.history_gang_member(
            history_id, gang_code, gang_description, division_code, loc_code, emp_code,
            emp_name, jabatan, join_date, is_active, period_month, period_year, source_table
        ) OUTPUT INSERTED.id VALUES(
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
    `, [
        data.history_id, data.gang_code, data.gang_description, data.division_code,
        data.loc_code, data.emp_code, data.emp_name, data.jabatan || null,
        data.join_date, data.is_active, data.period_month, data.period_year, data.source_table,
    ]);

    return result[0]?.id;
}

/**
 * @query deleteTransactionHistoryByHistoryId
 * @table history_taskreg, history_adtrans, history_gang_member (extend_db_ptrj_transaksi)
 * @input db, historyId
 * @output void
 * @sql DELETE FROM dbo.history_taskreg/history_adtrans/history_gang_member WHERE history_id=?
 */
export async function deleteTransactionHistoryByHistoryId(
    db: Database,
    historyId: string
): Promise<void> {
    await db.query(`DELETE FROM dbo.history_taskreg WHERE history_id = ?`, [historyId]);
    await db.query(`DELETE FROM dbo.history_adtrans WHERE history_id = ?`, [historyId]);
    await db.query(`DELETE FROM dbo.history_gang_member WHERE history_id = ?`, [historyId]);
}

// ============================================================================
// HR HISTORY QUERIES
// ============================================================================

/**
 * @query selectHrEmployeeExisting
 * @table history_hr_employee (extend_db_ptrj)
 * @input db, empCode, periodMonth, periodYear
 * @output { existing: { id, nik, new_nik? } | null, schemaHasNewNik: boolean }
 * @sql SELECT id, nik, new_nik FROM dbo.history_hr_employee WHERE emp_code=? AND period_month=? AND period_year=? (falls back to SELECT id, nik if new_nik column missing)
 */
export async function selectHrEmployeeExisting(
    db: Database,
    empCode: string,
    periodMonth: number,
    periodYear: number
): Promise<{ existing: { id: number; nik: string; new_nik?: string } | null; schemaHasNewNik: boolean }> {
    let schemaHasNewNik = true;

    try {
        const existing = await db.queryOne<{ id: number; nik: string; new_nik: string }>(`
            SELECT id, nik, new_nik FROM dbo.history_hr_employee
            WHERE emp_code = ? AND period_month = ? AND period_year = ?
        `, [empCode, periodMonth, periodYear]);
        return { existing, schemaHasNewNik: true };
    } catch (e: any) {
        const msg = e instanceof Error ? e.message : String(e || "");
        if (msg.toLowerCase().includes("invalid column name") && msg.toLowerCase().includes("new_nik")) {
            schemaHasNewNik = false;
            const existing = await db.queryOne<{ id: number; nik: string }>(`
                SELECT id, nik FROM dbo.history_hr_employee
                WHERE emp_code = ? AND period_month = ? AND period_year = ?
            `, [empCode, periodMonth, periodYear]);
            return { existing, schemaHasNewNik: false };
        }
        throw e;
    }
}

/**
 * @query insertHrEmployeeHistory
 * @table history_hr_employee (extend_db_ptrj)
 * @input db, columns[], values[]
 * @output inserted id
 * @sql INSERT INTO dbo.history_hr_employee(...) OUTPUT INSERTED.id VALUES(?...)
 */
export async function insertHrEmployeeHistory(
    db: Database,
    columns: string[],
    values: any[]
): Promise<number> {
    const result = await db.query(`
        INSERT INTO dbo.history_hr_employee(
            ${columns.join(", ")}
        ) OUTPUT INSERTED.id VALUES(
            ${columns.map(() => "?").join(", ")}
        )
    `, values);

    return result[0]?.id;
}

/**
 * @query insertHrGangHistory
 * @table history_hr_gang (extend_db_ptrj)
 * @input db, data: HistoryQueriesHrGang
 * @output inserted id
 * @sql INSERT INTO dbo.history_hr_gang(...) OUTPUT INSERTED.id VALUES(...)
 */
export async function insertHrGangHistory(
    db: Database,
    data: HistoryQueriesHrGang
): Promise<number> {
    const result = await db.query(`
        INSERT INTO dbo.history_hr_gang(
            history_id, period_month, period_year, division_code, loc_code,
            gang_code, gang_description, mandor_code, mandor_name, mandor_1_code,
            mandor_1_name, assistant_code, assistant_name, total_members, is_active, source_table
        ) OUTPUT INSERTED.id VALUES(
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
    `, [
        data.history_id, data.period_month, data.period_year, data.division_code, data.loc_code,
        data.gang_code, data.gang_description, data.mandor_code, data.mandor_name,
        data.mandor_1_code, data.mandor_1_name, data.assistant_code, data.assistant_name,
        data.total_members, data.is_active, data.source_table,
    ]);

    return result[0]?.id;
}

// ============================================================================
// METADATA QUERIES
// ============================================================================

/**
 * @query insertHistoryMetadata
 * @table history_metadata (extend_db_ptrj_transaksi)
 * @input db, data: HistoryQueriesMetadata
 * @output inserted id
 * @sql INSERT INTO dbo.history_metadata(...) OUTPUT INSERTED.id VALUES(...)
 */
export async function insertHistoryMetadata(
    db: Database,
    data: HistoryQueriesMetadata
): Promise<number> {
    const result = await db.query(`
        INSERT INTO dbo.history_metadata(
            history_id, operation, entity_type, entity_id, period_month, period_year,
            division_code, gang_code, description, old_values, new_values, record_count,
            status, error_message, performed_by, ip_address, user_agent, session_id
        ) OUTPUT INSERTED.id VALUES(
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
    `, [
        data.history_id, data.operation, data.entity_type, data.entity_id, data.period_month,
        data.period_year, data.division_code, data.gang_code, data.description, data.old_values,
        data.new_values, data.record_count, data.status || 'SUCCESS', data.error_message,
        data.performed_by, data.ip_address, data.user_agent, data.session_id,
    ]);

    return result[0]?.id;
}

/**
 * @query selectHistoryMetadata
 * @table history_metadata (extend_db_ptrj_transaksi)
 * @input db, historyId
 * @output HistoryQueriesMetadata[]
 * @sql SELECT * FROM dbo.history_metadata WHERE history_id=? ORDER BY performed_at DESC
 */
export async function selectHistoryMetadata(
    db: Database,
    historyId: string
): Promise<HistoryQueriesMetadata[]> {
    return await db.query<HistoryQueriesMetadata>(`
        SELECT * FROM dbo.history_metadata
        WHERE history_id = ?
        ORDER BY performed_at DESC
    `, [historyId]);
}

// ============================================================================
// EMPLOYEE HISTORICAL DATA QUERIES
// ============================================================================

/**
 * @query selectEmployeeCareerHistory
 * @table history_hr_employee (extend_db_ptrj)
 * @input db, empCode
 * @output any[] career rows
 * @sql SELECT period_month, period_year, emp_code, emp_name, nik, new_nik, division_code, loc_code, gang_code, job_code, position, status, employee_type, upah_dasar, tax_status, ptkp_beras, ptkp_pajak, total_hk, join_date, terminate_date FROM dbo.history_hr_employee WHERE RTRIM(emp_code)=? OR RTRIM(nik)=? ORDER BY period_year DESC, period_month DESC
 */
export async function selectEmployeeCareerHistory(
    db: Database,
    empCode: string
): Promise<any[]> {
    return await db.query(`
        SELECT
            period_month,
            period_year,
            emp_code,
            emp_name,
            nik,
            new_nik,
            division_code,
            loc_code,
            gang_code,
            job_code,
            position,
            status,
            employee_type,
            upah_dasar,
            tax_status,
            ptkp_beras,
            ptkp_pajak,
            total_hk,
            join_date,
            terminate_date
        FROM dbo.history_hr_employee
        WHERE RTRIM(emp_code) = ? OR RTRIM(nik) = ?
        ORDER BY period_year DESC, period_month DESC
    `, [empCode, empCode]);
}

/**
 * @query selectEmployeePayrollHistory
 * @table payroll_history_detail + payroll_history_header (extend_db_ptrj)
 * @input db, empCode
 * @output any[] payroll rows
 * @sql SELECT h.period_month, h.period_year, d.* FROM dbo.payroll_history_detail d JOIN dbo.payroll_history_header h ON d.master_id=h.id WHERE RTRIM(d.emp_code)=? OR RTRIM(d.nik)=? ORDER BY h.period_year DESC, h.period_month DESC
 */
export async function selectEmployeePayrollHistory(
    db: Database,
    empCode: string
): Promise<any[]> {
    return await db.query(`
        SELECT
            h.period_month,
            h.period_year,
            d.*
        FROM dbo.payroll_history_detail d
        JOIN dbo.payroll_history_header h ON d.master_id = h.id
        WHERE RTRIM(d.emp_code) = ? OR RTRIM(d.nik) = ?
        ORDER BY h.period_year DESC, h.period_month DESC
    `, [empCode, empCode]);
}

// ============================================================================
// MIGRATION DDL QUERIES
// ============================================================================

/**
 * @query ensureColumnExists
 * @table INFORMATION_SCHEMA.COLUMNS / target table (DDL)
 * @input db, tableName, columnName, definition
 * @output void
 * @sql IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME=? AND COLUMN_NAME=?) BEGIN ALTER TABLE dbo.? ADD ? ?; END
 */
export async function ensureColumnExists(
    db: Database,
    tableName: string,
    columnName: string,
    definition: string
): Promise<void> {
    await db.query(`
        IF NOT EXISTS (
            SELECT * FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME='${tableName}' AND COLUMN_NAME='${columnName}'
        )
        BEGIN
            ALTER TABLE dbo.${tableName} ADD ${columnName} ${definition};
        END
    `);
}

// ============================================================================
// WAGE DISTRIBUTION QUERIES
// ============================================================================

/**
 * @query selectWageDistributionMasters
 * @table payroll_history_header (extend_db_ptrj)
 * @input db, periodMonth, periodYear, divisionAliases?
 * @output { id, division_code }[] (snapshot latest per division+gang)
 * @sql SELECT h.id, h.division_code FROM dbo.payroll_history_header h WHERE period_month=? AND period_year=? AND ISNULL(snapshot_version,0)=(max subquery) [AND division_code IN (?)]
 */
export async function selectWageDistributionMasters(
    db: Database,
    periodMonth: number,
    periodYear: number,
    divisionAliases?: string[]
): Promise<{ id: number; division_code: string }[]> {
    let sql = `
        SELECT h.id, h.division_code
        FROM dbo.payroll_history_header h
        WHERE h.period_month = ? AND h.period_year = ?
          AND ISNULL(h.snapshot_version, 0) = (
              SELECT ISNULL(MAX(h2.snapshot_version), 0)
              FROM dbo.payroll_history_header h2
              WHERE h2.period_month = h.period_month
                AND h2.period_year = h.period_year
                AND h2.division_code = h.division_code
                AND h2.gang_code = h.gang_code
          )
    `;
    const params: any[] = [periodMonth, periodYear];

    if (divisionAliases && divisionAliases.length > 0) {
        sql += ` AND h.division_code IN (${divisionAliases.map(() => '?').join(',')})`;
        params.push(...divisionAliases);
    }

    return await db.query<{ id: number; division_code: string }>(sql, params);
}

/**
 * @query selectWageDistributionDetails
 * @table payroll_history_detail (extend_db_ptrj)
 * @input db, masterIds[]
 * @output any[] wage detail rows (chunked, all ISNULL-wrapped fields)
 * @sql SELECT d.emp_code, d.nik, d.emp_name, d.gang_code, d.master_id, ISNULL(...) AS ... FROM dbo.payroll_history_detail d WHERE d.master_id IN (?)
 */
export async function selectWageDistributionDetails(
    db: Database,
    masterIds: number[]
): Promise<any[]> {
    const result: any[] = [];
    const CHUNK = 500;

    for (let i = 0; i < masterIds.length; i += CHUNK) {
        const chunk = masterIds.slice(i, i + CHUNK);
        const ph = chunk.map(() => '?').join(',');
        const rows = await db.query<any>(`
            SELECT d.emp_code, d.nik, d.emp_name, d.gang_code, d.master_id,
                   d.jumlah_upah_kotor, d.upah_bersih,
                   ISNULL(d.status_ptkp, '') AS status_ptkp,
                   ISNULL(d.kategori_ter, '') AS kategori_ter,
                   ISNULL(d.jabatan, '') AS jabatan,
                   ISNULL(d.jumlah_upah_kotor, 0) AS upah_kotor,
                   ISNULL(d.upah_bersih, 0) AS upah_bersih,
                   ISNULL(d.gaji_pokok, 0) AS gaji_pokok,
                   ISNULL(d.gaji_pokok_aktual, 0) AS gaji_pokok_aktual,
                   ISNULL(d.gaji_pokok_ideal, 0) AS gaji_pokok_ideal,
                   ISNULL(d.upah_dasar, 0) AS upah_dasar,
                   ISNULL(d.lembur_jam, 0) AS lembur_jam,
                   ISNULL(d.lembur_rate, 0) AS lembur_rate,
                   ISNULL(d.lembur_jumlah, 0) AS lembur_jumlah,
                   ISNULL(d.total_premi, 0) AS total_premi,
                   ISNULL(d.total_tunjangan, 0) AS total_tunjangan,
                   ISNULL(d.beras_rate, 0) AS beras_rate,
                   ISNULL(d.beras_jumlah, 0) AS beras_jumlah,
                   ISNULL(d.jabatan_rate, 0) AS jabatan_rate,
                   ISNULL(d.jabatan_jumlah, 0) AS jabatan_jumlah,
                   ISNULL(d.masa_kerja_tahun, 0) AS masa_kerja_tahun,
                   ISNULL(d.masa_kerja_rate, 0) AS masa_kerja_rate,
                   ISNULL(d.masa_kerja_jumlah, 0) AS masa_kerja_jumlah,
                   ISNULL(d.premi_brondol, 0) AS premi_brondol,
                   ISNULL(d.premi_brondol_total, 0) AS premi_brondol_total,
                   ISNULL(d.premi_pph, 0) AS premi_pph,
                   ISNULL(d.total_potongan, 0) AS total_potongan,
                   ISNULL(d.total_potongan_bersih, 0) AS total_potongan_bersih,
                   ISNULL(d.pot_koreksi, 0) AS pot_koreksi,
                   ISNULL(d.pot_spsi, 0) AS pot_spsi,
                   ISNULL(d.pot_pph21, 0) AS pot_pph21,
                   ISNULL(d.pot_astek_pekerja, 0) AS pot_astek_pekerja,
                   ISNULL(d.pot_bpjs_kesehatan_pekerja, 0) AS pot_bpjs_kesehatan_pekerja,
                   ISNULL(d.pot_bpjs_pensiun_pekerja, 0) AS pot_bpjs_pensiun_pekerja,
                   ISNULL(d.jumlah_hk, 0) AS jumlah_hk,
                   ISNULL(d.hari_kerja, 0) AS hari_kerja,
                   ISNULL(d.cuti_minggu_hari, 0) AS cuti_minggu_hari,
                   ISNULL(d.cuti_nasional_hari, 0) AS cuti_nasional_hari,
                   ISNULL(d.total_jam_kerja, 0) AS total_jam_kerja,
                   ISNULL(d.upah_kotor_pajak, 0) AS upah_kotor_pajak,
                   ISNULL(d.penghasilan_bruto, 0) AS penghasilan_bruto,
                   ISNULL(d.pph21_ter, 0) AS pph21_ter,
                   ISNULL(d.tarif_pajak_ter, 0) AS tarif_pajak_ter,
                   d.status_ptkp, d.kategori_ter, d.jabatan
            FROM dbo.payroll_history_detail d
            WHERE d.master_id IN (${ph})
        `, chunk);
        result.push(...rows);
    }

    return result;
}

/**
 * @query selectLiveHrEmployeesForWageDistribution
 * @table HR_EMPLOYEE (db_ptrj live)
 * @input db, empCodes[]
 * @output { EmpCode, NewICNo, Status }[] chunked
 * @sql SELECT RTRIM(EmpCode), RTRIM(NewICNo), RTRIM(Status) FROM HR_EMPLOYEE WHERE RTRIM(EmpCode) IN (?)
 */
export async function selectLiveHrEmployeesForWageDistribution(
    db: Database,
    empCodes: string[]
): Promise<{ EmpCode: string; NewICNo: string; Status: string }[]> {
    const result: { EmpCode: string; NewICNo: string; Status: string }[] = [];

    for (let i = 0; i < empCodes.length; i += 500) {
        const chunk = empCodes.slice(i, i + 500).map(() => '?').join(',');
        const rows = await db.query<{ EmpCode: string; NewICNo: string; Status: string }>(`
            SELECT RTRIM(e.EmpCode) as EmpCode, RTRIM(e.NewICNo) as NewICNo, RTRIM(e.Status) as Status
            FROM HR_EMPLOYEE e
            WHERE RTRIM(e.EmpCode) IN (${chunk})
        `, empCodes.slice(i, i + 500));
        result.push(...rows);
    }

    return result;
}
