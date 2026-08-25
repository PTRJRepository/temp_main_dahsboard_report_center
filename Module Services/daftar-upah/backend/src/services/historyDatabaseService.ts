/**
 * History Database Service
 *
 * Service ini menangani routing database berdasarkan RUN_MODE dan
 * menyediakan method untuk operasi CRUD pada tabel history.
 *
 * Database Configuration:
 * - RUN_MODE=prod (history mode):
 *   - Payroll/Daftar Upah: extend_db_ptrj
 *   - Detail Transaksi (Taskreg, ADTrans): extend_db_ptrj_transaksi
 * - RUN_MODE=dev: Menggunakan db_ptrj (real-time)
 *
 * ============================================================================
 * IMPORTANT: CURRENT HISTORY WRITE POLICY
 * ============================================================================
 *
 * History di repo ini sekarang memakai dua pola yang berbeda:
 *
 * 1. Identity-style records tertentu tetap append-first / no-overwrite
 *    bila perubahan harus terlacak sebagai histori.
 * 2. Snapshot payroll per periode/divisi/gang memakai scoped replace:
 *    reseed dengan `force=true` akan menghapus snapshot lama pada scope yang
 *    sama, lalu menulis ulang snapshot baru agar hasil tetap idempotent.
 *
 * Implikasinya:
 * - Jangan menganggap semua tabel history bersifat append-only.
 * - Jangan melakukan broad delete lintas divisi/periode tanpa scope jelas.
 * - Untuk payroll snapshot, source of truth terbaru adalah hasil seed terakhir
 *   pada scope periode/divisi/gang yang sama.
 * ============================================================================
 */

import { Database } from "../db/client";
import { Config } from "../config";
import { gangService } from "./gangService";
import { employeeHrDataService } from "./employeeHrDataService";
import { divisionDefinition } from "./divisionDefinition";
import { debug, info, error as logError } from "../utils/logger";
import { sortByEmpCode } from "../utils/employeeSort";
import { resolveReportIdentity } from "../utils/taxReportIdentity";
import {
    selectHistoryDataExists,
    selectEmployeesFromHistory,
    searchEmployeesFromHistory,
    selectAvailableGangsFromHistory,
    selectAvailableReligionsFromHistory,
    selectAvailableStatusesFromHistory,
    selectPayrollHistoryMasterExisting,
    insertPayrollHistoryMaster,
    updatePayrollHistoryMaster,
    buildPayrollMasterColumnMap,
    selectPayrollHistoryMaster,
    selectHistoryTaxIdentityByEmpCodes,
    updateLockPayrollHistory,
    selectPayrollHistoryDetailExisting,
    buildPayrollDetailColumnMap,
    insertPayrollHistoryDetail,
    selectPayrollHistoryDetails as selectPayrollHistoryDetailsSimple,
    selectPayrollHistoryMasters,
    selectPayrollHistoryDetailsByArgs as selectPayrollHistoryDetailsByMasterIds2,
    selectHistoryReligions,
    selectLiveHrEmployees,
    deletePayrollHistoryDetailsByMasterId,
    deleteHrEmployeeHistory,
    deleteHrGangHistory,
    selectPayrollHistoryHeadersForDelete,
    deletePayrollHistoryDetailsByMasterIds,
    deletePayrollHistoryHeadersByIds,
    deleteTaskregHistoryByIds,
    deleteAdtransHistoryByIds,
    deleteGangMemberHistoryByIds,
    selectTaskregHistoryExisting,
    updateTaskregHistory,
    insertTaskregHistory,
    selectAdtransHistoryExisting,
    updateAdtransHistory,
    insertAdtransHistory,
    selectPphFromAdtransByYear,
    selectGangMemberHistoryExisting,
    updateGangMemberHistory,
    insertGangMemberHistory,
    deleteTransactionHistoryByHistoryId,
    selectHrEmployeeExisting,
    insertHrEmployeeHistory,
    insertHrGangHistory,
    insertHistoryMetadata,
    selectHistoryMetadata,
    selectEmployeeCareerHistory,
    selectEmployeePayrollHistory,
    ensureColumnExists,
    selectWageDistributionMasters,
    selectWageDistributionDetails,
    selectLiveHrEmployeesForWageDistribution,
} from "./payroll/history/historyQueries";
import { getHistoricalPayrollDataAsExtractorFormat } from "./payroll/history/historyExtractorFormat";
import type {
    Employee,
    PayrollHistoryMaster,
    PayrollHistoryDetail,
    HistoryTaskreg,
    HistoryAdtrans,
    HistoryGangMember,
    HistoryHrEmployee,
    HistoryHrGang,
    HistoryMetadata,
    HistoryTaxIdentity,
} from "../types/history/HistoryTypes";
export type {
    Employee,
    PayrollHistoryMaster,
    PayrollHistoryDetail,
    HistoryTaskreg,
    HistoryAdtrans,
    HistoryGangMember,
    HistoryHrEmployee,
    HistoryHrGang,
    HistoryMetadata,
    HistoryTaxIdentity,
} from "../types/history/HistoryTypes";

const CATEGORY = "HistoryDatabaseService";

// Environment variable untuk database transaksi
const DB_EXTEND_TRANS_DATABASE = Config.DB_EXTEND_TRANS_DATABASE;
// ponytail: history interfaces now live in ../types/history/HistoryTypes.ts (single source of truth, re-exported above).

export class HistoryDatabaseService {
    private static instance: HistoryDatabaseService;

    private constructor() { }

    public static getInstance(): HistoryDatabaseService {
        if (!HistoryDatabaseService.instance) {
            HistoryDatabaseService.instance = new HistoryDatabaseService();
        }
        return HistoryDatabaseService.instance;
    }

    /**
     * Check if system is in history mode (prod)
     */
    public isHistoryMode(): boolean {
        return Config.RUN_MODE === 'prod';
    }

    /**
     * Get database instance for payroll/daftar upah data
     * - History mode (prod): extend_db_ptrj
     * - Dev mode: extend_db_ptrj (always use extend_db for history tables)
     */
    public getPayrollDatabase(): Database {
        // Always use extend_db_ptrj for history tables regardless of RUN_MODE
        // History tables (payroll_history_header, payroll_history_detail) only exist in extend_db_ptrj
        return Database.getInstance(Config.DB_EXTEND_DATABASE, Config.DB_EXTEND_PROFILE);
    }

    /**
     * Get database instance for transaction data
     * - History mode (prod): extend_db_ptrj_transaksi
     * - Dev mode: db_ptrj (default)
     */
    public getTransactionDatabase(): Database {
        if (this.isHistoryMode()) {
            return Database.getInstance(DB_EXTEND_TRANS_DATABASE, Config.DB_EXTEND_PROFILE);
        }
        return Database.getInstance();
    }

    /**
     * Generate unique history_id
     */
    public generateHistoryId(): string {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `HIST-${timestamp}-${random}`;
    }

    // ============================================================================
    // HR HISTORY FALLBACK OPERATIONS
    // Used when origin DB has no data - queries from history tables
    // ============================================================================

    /**
     * Get the history database instance directly (always extend_db_ptrj with SERVER_PROFILE_1)
     * Used for fallback when origin DB returns no data
     */
    public getHistoryDb(): Database {
        return Database.getInstance(Config.DB_EXTEND_DATABASE, Config.DB_EXTEND_PROFILE);
    }

    /**
     * Check if history DB has any data for the given period
     */
    public async hasHistoryData(periodMonth?: number, periodYear?: number): Promise<boolean> {
        try {
            const db = this.getHistoryDb();
            return await selectHistoryDataExists(db, periodMonth, periodYear);
        } catch (e) {
            logError(CATEGORY, "Error checking history data availability", e);
            return false;
        }
    }

    /**
     * List employees from history database with optional filters
     */
    public async listEmployeesFromHistory(options: {
        skip?: number;
        limit?: number;
        gangCode?: string;
        division?: string;
        religion?: string;
        status?: string;
    } = {}): Promise<Employee[]> {
        const { skip = 0, limit = 100, gangCode, division, religion, status } = options;

        try {
            info(CATEGORY, `listEmployeesFromHistory() called with:`, { gangCode, division, religion, status });

            const db = this.getHistoryDb();
            const rows = await selectEmployeesFromHistory(db, { gangCode, division, religion, status });

            // Apply pagination after deduplication
            const allEmployees: Employee[] = rows.map((r: any) => ({
                nik: r.nik?.trim() || "",
                actual_nik: r.actual_nik?.trim() || r.nik?.trim() || "",
                nama: r.nama?.trim() || "",
                jenis_kelamin: r.gender?.trim() || "L",
                loc_code: r.loc_code?.trim() || "",
                gang_code: r.gang_code?.trim() || "",
                religion: r.religion?.trim() || "",
                status: r.status?.trim() || "",
                employee_type: r.employee_type?.trim() || "",
                birth_date: r.birth_date_str || undefined,
                join_date: r.join_date || undefined,
                terminate_date: r.terminate_date || undefined,
            }));

            info(CATEGORY, `History DB returned ${allEmployees.length} employees`);
            return allEmployees.slice(skip, skip + limit);
        } catch (e) {
            logError(CATEGORY, "listEmployeesFromHistory failed:", e);
            return [];
        }
    }

    /**
     * Search employees from history database
     */
    public async searchEmployeesFromHistory(term: string, limit: number = 50, division?: string): Promise<Employee[]> {
        if (!term || term.length < 2) return [];

        try {
            const db = this.getHistoryDb();
            const rows = await searchEmployeesFromHistory(db, term, limit, division);
            return rows.map((r: any) => ({
                nik: r.nik?.trim() || "",
                actual_nik: r.actual_nik?.trim() || r.nik?.trim() || "",
                nama: r.nama?.trim() || "",
                jenis_kelamin: r.gender?.trim() || "L",
                loc_code: r.loc_code?.trim() || "",
                gang_code: r.gang_code?.trim() || "",
                religion: r.religion?.trim() || "",
                status: r.status?.trim() || "",
                employee_type: r.employee_type?.trim() || "",
                birth_date: r.birth_date || undefined,
                join_date: r.join_date || undefined,
            }));
        } catch (e) {
            logError(CATEGORY, "searchEmployeesFromHistory failed:", e);
            return [];
        }
    }

    /**
     * Get available gang codes from history database
     */
    public async getAvailableGangsFromHistory(division?: string): Promise<string[]> {
        try {
            const db = this.getHistoryDb();
            return await selectAvailableGangsFromHistory(db, division);
        } catch (e) {
            logError(CATEGORY, "getAvailableGangsFromHistory failed:", e);
            return [];
        }
    }

    /**
     * Get available religions from history database
     */
    public async getAvailableReligionsFromHistory(): Promise<string[]> {
        try {
            const db = this.getHistoryDb();
            return await selectAvailableReligionsFromHistory(db);
        } catch (e) {
            logError(CATEGORY, "getAvailableReligionsFromHistory failed:", e);
            return [];
        }
    }

    /**
     * Get available statuses from history database
     */
    public async getAvailableStatusesFromHistory(): Promise<string[]> {
        try {
            const db = this.getHistoryDb();
            return await selectAvailableStatusesFromHistory(db);
        } catch (e) {
            logError(CATEGORY, "getAvailableStatusesFromHistory failed:", e);
            return [];
        }
    }

    // ============================================================================
    // PAYROLL HISTORY MASTER OPERATIONS
    // ============================================================================

    /**
     * Insert or update payroll history master
     */
    public async savePayrollHistoryMaster(data: PayrollHistoryMaster): Promise<number> {
        const db = this.getPayrollDatabase();

        const existing = await selectPayrollHistoryMasterExisting(db, {
            period_month: data.period_month,
            period_year: data.period_year,
            division_code: data.division_code,
            gang_code: data.gang_code,
            snapshot_version: data.snapshot_version,
        });

        if (existing) {
            await updatePayrollHistoryMaster(db, buildPayrollMasterColumnMap(data as any), existing.id);
            return existing.id;
        }

        return await insertPayrollHistoryMaster(db, buildPayrollMasterColumnMap(data as any, new Date()));
    }

    /**
     * Get payroll history master by period and gang
     */
    public async getPayrollHistoryMaster(
        periodMonth: number,
        periodYear: number,
        divisionCode?: string,
        gangCode?: string
    ): Promise<PayrollHistoryMaster[]> {
        const db = this.getPayrollDatabase();

        let divisionAliases: string[] | undefined;
        if (divisionCode) {
            divisionAliases = gangService.getAllDivisionAliases(divisionCode);
        }

        return await selectPayrollHistoryMaster(db, periodMonth, periodYear, divisionCode, gangCode, divisionAliases);
    }

    public async getHistoryTaxIdentityByEmpCodes(
        periodMonth: number,
        periodYear: number,
        empCodes: string[]
    ): Promise<Map<string, HistoryTaxIdentity>> {
        const result = new Map<string, HistoryTaxIdentity>();
        const normalizedEmpCodes = [...new Set(
            (empCodes || [])
                .map(code => String(code || "").trim().toUpperCase())
                .filter(Boolean)
        )];

        if (normalizedEmpCodes.length === 0) return result;

        const db = this.getPayrollDatabase();

        try {
            const rows = await selectHistoryTaxIdentityByEmpCodes(db, periodMonth, periodYear, normalizedEmpCodes);
            rows.forEach((row: any) => {
                const empCode = String(row.emp_code || "").trim().toUpperCase();
                if (empCode) result.set(empCode, row as HistoryTaxIdentity);
            });
        } catch (e) {
            logError(CATEGORY, "Error fetching tax identity from history_hr_employee", e);
        }

        return result;
    }

    /**
     * Lock payroll history to prevent modification
     */
    public async lockPayrollHistory(
        periodMonth: number,
        periodYear: number,
        divisionCode: string,
        gangCode: string,
        reason: string,
        lockedBy: string
    ): Promise<boolean> {
        const db = this.getPayrollDatabase();

        await updateLockPayrollHistory(db, reason, periodMonth, periodYear, divisionCode, gangCode);

        return true;
    }

    // ============================================================================
    // PAYROLL HISTORY DETAIL OPERATIONS
    // ============================================================================

    /**
     * Insert payroll history detail.
     *
     * IMPORTANT: DATA APPEND-ONLY PATTERN (Immutable History)
     * - Selalu INSERT record baru. TIDAK pernah UPDATE record existing.
     * - NIK TIDAK PERNAH di-update. Jika NIK berubah di source (db_ptrj),
     *   simpan NIK baru di kolom `new_nik`, JANGAN overwrite kolom `nik`.
     * - Jika master_id + emp_code sudah ada → INSERT record baru dengan new_nik tracking
     * - NIK lama (kolom `nik`) adalah ground truth dan TIDAK AKAN PERNAH berubah.
     *
     * new_nik tracking:
     * - new_nik NULL + existing record → INSERT baru (first seeding)
     * - new_nik berbeda dari existing `nik` → INSERT baru, set new_nik = current source NIK
     * - new_nik sama dengan existing `nik` → INSERT baru, set new_nik = same value
     */
    public async savePayrollHistoryDetail(data: PayrollHistoryDetail): Promise<number> {
        const db = this.getPayrollDatabase();

        // Check existing record to determine new_nik value
        const existing = await selectPayrollHistoryDetailExisting(db, data.master_id, data.emp_code);

        let resolvedNewNik: string | undefined = undefined;

        if (existing) {
            // NIK dalam source berbeda dari NIK lama yang tersimpan → tracking di new_nik
            // NIK lama (kolom `nik`) TIDAK PERNAH diubah
            if (data.nik && existing.nik && data.nik !== existing.nik) {
                resolvedNewNik = data.nik;  // NIK baru dari source → simpan di new_nik
            } else if (data.nik) {
                resolvedNewNik = data.nik;
            }
        } else {
            // Record pertama untuk master_id + emp_code ini
            resolvedNewNik = data.new_nik;
        }

        const columnMap = buildPayrollDetailColumnMap(
            data as any,
            existing ? existing.nik : data.nik,
            resolvedNewNik
        );

        return await insertPayrollHistoryDetail(db, columnMap);
    }

    /**
     * Get payroll history details by master_id
     */
    public async getPayrollHistoryDetails(masterId: number): Promise<PayrollHistoryDetail[]> {
        const db = this.getPayrollDatabase();

        return await selectPayrollHistoryDetailsSimple(db, masterId) as PayrollHistoryDetail[];
    }

    /**
     * Get historical payroll data mapped to match DataExtractorService's exact format.
     * Use this to seamlessly read from deep history tables when the UI requests a legacy period.
     */
    public async getHistoricalPayrollDataAsExtractorFormat(
        periodMonth: number,
        periodYear: number,
        gangCode: string = "ALL",
        divisionCode?: string,
        specificEmpCode: string | null = null,
        gangPrefix?: string
    ): Promise<{
        data_rows: any[];
        dynamic_premi_headers: string[];
        dynamic_potongan_headers: string[];
        premi_title_map: Record<string, string>;
        potongan_title_map: Record<string, string>;
        meta: {
            execution_time_ms: number;
            row_count: number;
            is_history_snapshot: boolean;
            snapshot_version?: string | null;
            requested_snapshot_version?: string | null;
            available_snapshot_versions?: any[];
        }
    } | null> {
        return getHistoricalPayrollDataAsExtractorFormat(
            this.getPayrollDatabase(),
            periodMonth, periodYear, gangCode, divisionCode, specificEmpCode, gangPrefix
        );
    }

    /**
     * Delete payroll history details by master_id (for re-insert)
     */
    public async deletePayrollHistoryDetails(masterId: number): Promise<void> {
        const db = this.getPayrollDatabase();

        await deletePayrollHistoryDetailsByMasterId(db, masterId);
    }

    /**
     * Delete all history data for a specific period and location
     * Used to prevent duplicates when re-seeding
     */
    public async deleteHistoryForPeriodAndLocation(periodMonth: number, periodYear: number, divisionCode?: string, gangCode?: string): Promise<void> {
        const payrollDb = this.getPayrollDatabase();
        const transDb = this.getTransactionDatabase();

        info(CATEGORY, `Deleting history for ${periodMonth} / ${periodYear}, Div: ${divisionCode || 'ALL'}, Gang: ${gangCode || 'ALL'} `);

        // 1. Delete Employee & Gang HR history
        await deleteHrEmployeeHistory(payrollDb, periodMonth, periodYear, divisionCode, gangCode);
        await deleteHrGangHistory(payrollDb, periodMonth, periodYear, divisionCode, gangCode);

        // 2. Find matching headers to delete detail and transactions
        const headers = await selectPayrollHistoryHeadersForDelete(payrollDb, periodMonth, periodYear, divisionCode, gangCode);

        if (headers.length > 0) {
            const masterIds = headers.map(h => h.id);
            const historyIds = headers.map(h => h.history_id);

            // Delete Details
            await deletePayrollHistoryDetailsByMasterIds(payrollDb, masterIds);

            // Delete Headers
            await deletePayrollHistoryHeadersByIds(payrollDb, masterIds);

            // Delete Transactions
            if (historyIds.length > 0) {
                await deleteTaskregHistoryByIds(transDb, historyIds);
                await deleteAdtransHistoryByIds(transDb, historyIds);
                await deleteGangMemberHistoryByIds(transDb, historyIds);
            }
        }
    }

    // ============================================================================
    // TRANSACTION HISTORY OPERATIONS
    // ============================================================================

    /**
     * Insert taskreg history
     */
    public async saveTaskregHistory(data: HistoryTaskreg): Promise<number> {
        const db = this.getTransactionDatabase();

        const existing = await selectTaskregHistoryExisting(db, data.original_master_id, data.original_line_id, data.period_month, data.period_year);

        if (existing) {
            return await updateTaskregHistory(db, data as any, existing.id);
        } else {
            return await insertTaskregHistory(db, data as any);
        }
    }

    /**
     * Insert adtrans history
     */
    public async saveAdtransHistory(data: HistoryAdtrans): Promise<number> {
        const db = this.getTransactionDatabase();

        const existing = await selectAdtransHistoryExisting(db, data.original_master_id, data.original_line_id, data.period_month, data.period_year);

        if (existing) {
            return await updateAdtransHistory(db, data as any, existing.id);
        } else {
            return await insertAdtransHistory(db, data as any);
        }
    }

    /**
     * Ambil nilai PPH21 aktual dari history_adtrans per emp_code per bulan untuk satu tahun.
     * Mengambil record dengan category='POTONGAN', sub_category='PPH21', is_premi_pph=false.
     * Return: Map<emp_code, Map<month, pph_amount>>
     */
    public async getPphFromAdtransByYear(
        year: number,
        divisionCode?: string,
        gangCode?: string
    ): Promise<Map<string, Map<number, number>>> {
        const db = this.getTransactionDatabase();

        try {
            const rows = await selectPphFromAdtransByYear(db, year, divisionCode, gangCode);

            const result = new Map<string, Map<number, number>>();
            for (const row of rows) {
                const empCode = (row.emp_code || '').trim();
                if (!result.has(empCode)) {
                    result.set(empCode, new Map<number, number>());
                }
                result.get(empCode)!.set(Number(row.period_month), Number(row.pph_amount) || 0);
            }
            return result;
        } catch (e: any) {
            console.error('[HistoryDB] getPphFromAdtransByYear error:', e.message);
            return new Map();
        }
    }

    /**
     * Ambil nilai PPH21 aktual dari history_adtrans untuk satu bulan spesifik.
     * Return: Map<emp_code, pph_amount>
     */
    public async getPphFromAdtransByMonth(
        month: number,
        year: number,
        divisionCode?: string,
        gangCode?: string
    ): Promise<Map<string, number>> {
        const yearMap = await this.getPphFromAdtransByYear(year, divisionCode, gangCode);
        const result = new Map<string, number>();
        for (const [empCode, monthMap] of yearMap) {
            if (monthMap.has(month)) {
                result.set(empCode, monthMap.get(month)!);
            }
        }
        return result;
    }



    /**
     * Insert gang member history
     */
    public async saveGangMemberHistory(data: HistoryGangMember): Promise<number> {
        const db = this.getTransactionDatabase();

        const existing = await selectGangMemberHistoryExisting(db, data.emp_code, data.period_month, data.period_year);

        if (existing) {
            return await updateGangMemberHistory(db, data as any, existing.id);
        } else {
            return await insertGangMemberHistory(db, data as any);
        }
    }

    /**
     * Delete transaction history by history_id
     */
    public async deleteTransactionHistory(historyId: string): Promise<void> {
        const db = this.getTransactionDatabase();

        await deleteTransactionHistoryByHistoryId(db, historyId);
    }

    // ============================================================================
    // HR HISTORY OPERATIONS
    // ============================================================================

    /**
     * Insert HR Employee history.
     *
     * IMPORTANT: DATA APPEND-ONLY PATTERN (Immutable History)
     * - Selalu INSERT record baru. TIDAK pernah UPDATE record existing.
     * - NIK TIDAK PERNAH di-update. Jika NIK berubah di source (db_ptrj),
     *   simpan NIK baru di kolom `new_nik`, JANGAN overwrite kolom `nik`.
     * - NIK lama (kolom `nik`) adalah ground truth dan TIDAK AKAN PERNAH berubah.
     *
     * Constraint: UNIQUE(emp_code, period_month, period_year) diperlukan
     * untuk mencegah duplikat. Jika constraint belum ada, seeding berulang
     * pada periode yang sama akan menyebabkan constraint violation (harus di-drop
     * terlebih dahulu atau gunakan ON CONFLICT).
     */
    public async saveHrEmployeeHistory(data: HistoryHrEmployee): Promise<number> {
        const db = this.getPayrollDatabase(); // HR history goes to extend_db_ptrj

        const { existing, schemaHasNewNik } = await selectHrEmployeeExisting(db, data.emp_code, data.period_month, data.period_year);

        let resolvedNewNik: string | undefined = undefined;

        if (schemaHasNewNik && existing) {
            // NIK source berbeda dari NIK lama yang tersimpan → tracking di new_nik
            // NIK lama TIDAK PERNAH diubah
            if (data.nik && existing.nik && data.nik !== existing.nik) {
                resolvedNewNik = data.nik;
            } else if (data.nik) {
                resolvedNewNik = data.nik;
            }
        } else if (schemaHasNewNik) {
            resolvedNewNik = data.new_nik;
        }

        const columns = [
            "history_id", "period_month", "period_year", "nik",
            ...(schemaHasNewNik ? ["new_nik"] : []),
            "pajak_npwp", "res_address",
            "emp_code", "emp_name",
            "company_code", "division_code", "loc_code", "gang_code", "job_code", "position",
            "jabatan", "is_spsi_member",
            "join_date", "terminate_date", "status", "employee_type", "gender", "religion",
            "birth_place", "birth_date", "marital_status",
            "tax_status", "ptkp_beras", "ptkp_pajak",
            "upah_dasar", "total_hk", "source_table"
        ];
        const values = [
            data.history_id, data.period_month, data.period_year,
            existing ? existing.nik : data.nik,  // JANGAN overwrite NIK lama
            ...(schemaHasNewNik ? [resolvedNewNik] : []),
            data.pajak_npwp?.trim() || null,
            data.res_address?.trim() || null,
            data.emp_code,
            data.emp_name, data.company_code, data.division_code, data.loc_code, data.gang_code,
            data.job_code, data.position,
            data.jabatan, data.is_spsi_member ?? null,
            data.join_date, data.terminate_date, data.status,
            data.employee_type, data.gender, data.religion,
            data.birth_place, data.birth_date, data.marital_status,
            data.tax_status, data.ptkp_beras, data.ptkp_pajak,
            data.upah_dasar, data.total_hk, data.source_table
        ];

        // Always INSERT - append-only pattern
        return await insertHrEmployeeHistory(db, columns, values);
    }

    /**
     * Insert HR Gang history
     */
    /**
     * Insert HR Gang history.
     *
     * IMPORTANT: DATA APPEND-ONLY PATTERN (Immutable History)
     * - Selalu INSERT record baru. TIDAK pernah UPDATE record existing.
     * - Gang history dicatat per periode untuk tracking perubahan komposisi.
     */
    public async saveHrGangHistory(data: HistoryHrGang): Promise<number> {
        const db = this.getPayrollDatabase(); // HR history goes to extend_db_ptrj

        // Always INSERT - append-only pattern
        return await insertHrGangHistory(db, data as any);
    }

    // ============================================================================
    // METADATA OPERATIONS
    // ============================================================================

    /**
     * Insert history metadata for audit trail
     */
    public async saveHistoryMetadata(data: HistoryMetadata): Promise<number> {
        const db = this.getTransactionDatabase();

        return await insertHistoryMetadata(db, data as any);
    }

    /**
     * Get history metadata by history_id
     */
    public async getHistoryMetadata(historyId: string): Promise<HistoryMetadata[]> {
        const db = this.getTransactionDatabase();

        return await selectHistoryMetadata(db, historyId) as HistoryMetadata[];
    }

    // ============================================================================
    // EMPLOYEE HR INFO SPECIFIC
    // ============================================================================

    /**
     * Get aggregated historical data for a specific employee across all seeded periods
     */
    public async getEmployeeHistoricalData(empCode: string): Promise<any> {
        const db = this.getPayrollDatabase(); // history is in extend_db_ptrj

        // Run both queries concurrently
        const [hrHistory, payrollHistory] = await Promise.all([
            selectEmployeeCareerHistory(db, empCode).catch((e) => {
                logError(CATEGORY, "Error fetching HR history:", e);
                return [];
            }),
            selectEmployeePayrollHistory(db, empCode).catch((e) => {
                logError(CATEGORY, "Error fetching Payroll history:", e);
                return [];
            })
        ]);

        return {
            emp_code: empCode,
            career: hrHistory,
            payroll: payrollHistory
        };
    }

    // ============================================================================
    // MIGRATION OPERATIONS
    // ============================================================================

    /**
     * Migrate history tables to add new_nik column for NIK change tracking.
     * This is part of the append-only + NIK immutable pattern implementation.
     *
     * Run this once to add the new_nik column to existing tables.
     */
    public async migrateNewNikColumn(): Promise<void> {
        const db = this.getPayrollDatabase();
        const transDb = this.getTransactionDatabase();

        try {
            const ensureColumn = async (
                targetDb: Database,
                tableName: string,
                columnName: string,
                definition: string,
                label: string
            ) => {
                await ensureColumnExists(targetDb, tableName, columnName, definition);
                console.log(`[HistoryDatabaseService] Migrated: ${label}`);
            };

            // payroll_history_detail
            await ensureColumn(db, "payroll_history_detail", "new_nik", "VARCHAR(50) NULL", "payroll_history_detail.new_nik");

            // history_hr_employee
            await ensureColumn(db, "history_hr_employee", "new_nik", "VARCHAR(50) NULL", "history_hr_employee.new_nik");

            // history_gang_member - add jabatan column
            await ensureColumn(db, "history_gang_member", "jabatan", "VARCHAR(100) NULL", "history_gang_member.jabatan");

            // payroll_history_detail - add jabatan column
            await ensureColumn(db, "payroll_history_detail", "jabatan", "VARCHAR(100) NULL", "payroll_history_detail.jabatan");

            // payroll_history_detail - add is_spsi_member column
            await ensureColumn(db, "payroll_history_detail", "is_spsi_member", "BIT NULL", "payroll_history_detail.is_spsi_member");

            // history_hr_employee - add columns for jabatan and is_spsi_member
            await ensureColumn(db, "history_hr_employee", "jabatan", "VARCHAR(100) NULL", "history_hr_employee.jabatan");
            await ensureColumn(db, "history_hr_employee", "is_spsi_member", "BIT NULL", "history_hr_employee.is_spsi_member");
            await ensureColumn(db, "history_hr_employee", "pajak_npwp", "VARCHAR(50) NULL", "history_hr_employee.pajak_npwp");
            await ensureColumn(db, "history_hr_employee", "res_address", "NVARCHAR(512) NULL", "history_hr_employee.res_address");

            const payrollDetailColumns: Array<{ name: string; definition: string }> = [
                { name: "beras_rate", definition: "DECIMAL(18,4) NULL DEFAULT 0" },
                { name: "jabatan_rate", definition: "DECIMAL(18,4) NULL DEFAULT 0" },
                { name: "masa_kerja_rate", definition: "DECIMAL(18,4) NULL DEFAULT 0" },
                { name: "lembur_jam", definition: "DECIMAL(18,2) NULL DEFAULT 0" },
                { name: "lembur_rate", definition: "DECIMAL(18,4) NULL DEFAULT 0" },
                { name: "lembur_records", definition: "NVARCHAR(MAX) NULL" },
                { name: "total_tunjangan", definition: "DECIMAL(18,2) NULL DEFAULT 0" },
                { name: "premi_brondol_loosefruit", definition: "DECIMAL(18,2) NULL DEFAULT 0" },
                { name: "premi_brondol_adtrans", definition: "DECIMAL(18,2) NULL DEFAULT 0" },
                { name: "premi_brondol_total", definition: "DECIMAL(18,2) NULL DEFAULT 0" },
                { name: "premi_pph", definition: "DECIMAL(18,2) NULL DEFAULT 0" },
                { name: "premi_detail", definition: "NVARCHAR(MAX) NULL" },
                { name: "pot_astek_pekerja", definition: "DECIMAL(18,2) NULL DEFAULT 0" },
                { name: "pot_astek_majikan", definition: "DECIMAL(18,2) NULL DEFAULT 0" },
                { name: "pot_astek_jumlah", definition: "DECIMAL(18,2) NULL DEFAULT 0" },
                { name: "potongan_detail", definition: "NVARCHAR(MAX) NULL" },
                { name: "upah_kotor_pajak", definition: "DECIMAL(18,2) NULL DEFAULT 0" },
                { name: "penghasilan_bruto", definition: "DECIMAL(18,2) NULL DEFAULT 0" },
                { name: "task_code", definition: "VARCHAR(20) NULL" },
                { name: "task_desc", definition: "NVARCHAR(100) NULL" },
                { name: "shortage_details", definition: "NVARCHAR(MAX) NULL" },
                { name: "shortage_total_hours", definition: "DECIMAL(18,2) NULL" },
                { name: "snapshot_batch_id", definition: "BIGINT NULL" },
                { name: "snapshot_version", definition: "INT NULL" }
            ];

            for (const column of payrollDetailColumns) {
                await ensureColumn(
                    db,
                    "payroll_history_detail",
                    column.name,
                    column.definition,
                    `payroll_history_detail.${column.name}`
                );
            }

            await ensureColumn(
                db,
                "payroll_history_header",
                "snapshot_batch_id",
                "BIGINT NULL",
                "payroll_history_header.snapshot_batch_id"
            );

            await ensureColumn(
                db,
                "payroll_history_header",
                "snapshot_version",
                "INT NULL",
                "payroll_history_header.snapshot_version"
            );

            const historyMetadataColumns: Array<{ name: string; definition: string }> = [
                { name: "operation", definition: "VARCHAR(20) NULL" },
                { name: "entity_type", definition: "VARCHAR(30) NULL" },
                { name: "entity_id", definition: "INT NULL" },
                { name: "gang_code", definition: "VARCHAR(20) NULL" },
                { name: "description", definition: "NVARCHAR(255) NULL" },
                { name: "old_values", definition: "NVARCHAR(MAX) NULL" },
                { name: "new_values", definition: "NVARCHAR(MAX) NULL" },
                { name: "record_count", definition: "INT NULL" },
                { name: "status", definition: "VARCHAR(20) NULL" },
                { name: "error_message", definition: "NVARCHAR(MAX) NULL" },
                { name: "performed_by", definition: "VARCHAR(100) NULL" },
                { name: "performed_at", definition: "DATETIME NULL DEFAULT GETDATE()" },
                { name: "ip_address", definition: "VARCHAR(50) NULL" },
                { name: "user_agent", definition: "NVARCHAR(255) NULL" },
                { name: "session_id", definition: "VARCHAR(100) NULL" }
            ];

            for (const column of historyMetadataColumns) {
                await ensureColumn(
                    transDb,
                    "history_metadata",
                    column.name,
                    column.definition,
                    `history_metadata.${column.name}`
                );
            }

            console.log("[HistoryDatabaseService] All migrations completed successfully");
        } catch (e: any) {
            console.error("[HistoryDatabaseService] Migration failed:", e.message);
            throw e;
        }
    }

    /**
     * Distribusi upah kotor per bucket untuk chart sebaran karyawan.
     * Sumber: payroll_history_detail (snapshot terbaru per division+gang pada periode).
     * Mengembalikan daftar karyawan ringkas (bukan agregat) agar frontend bisa bucket fleksibel
     * + drilldown. field = 'jumlah_upah_kotor' | 'upah_bersih'.
     */
    public async getWageDistribution(
        periodMonth: number,
        periodYear: number,
        divisionCode?: string
    ): Promise<{ emp_code: string; nik: string; emp_name: string; gang_code: string; division_code: string; upah_kotor: number; upah_bersih: number }[]> {
        const db = this.getPayrollDatabase();

        // Snapshot terbaru per (division_code, gang_code) pada periode — pola sama seperti getHistoricalPayrollDataAsExtractorFormat
        let divisionAliases: string[] | undefined;
        if (divisionCode && divisionCode !== 'ALL') {
            try {
                const divList = gangService.getAllDivisionAliases(divisionCode);
                if (divList.length > 0) {
                    divisionAliases = divList;
                }
            } catch (e) {
                logError(CATEGORY, "getWageDistribution division filter error:", e);
            }
        }

        const masters = await selectWageDistributionMasters(db, periodMonth, periodYear, divisionAliases);
        if (masters.length === 0) return [];

        const divByMaster = new Map(masters.map(m => [m.id, m.division_code]));
        const ids = masters.map(m => m.id);

        const detailRows = await selectWageDistributionDetails(db, ids);

        let out: any[] = [];
        for (const r of detailRows) {
            const row: any = {
                emp_code: r.emp_code,
                nik: r.nik,
                emp_name: r.emp_name,
                gang_code: r.gang_code,
                division_code: divByMaster.get(r.master_id) || '',
                status_ptkp: r.status_ptkp,
                kategori_ter: r.kategori_ter,
                jabatan_estate: r.jabatan,
                upah_kotor: Number(r.upah_kotor) || 0,
                jumlah_upah_kotor: Number(r.upah_kotor) || 0,
                upah_bersih: Number(r.upah_bersih) || 0,
                upah_kotor_pajak: Number(r.upah_kotor_pajak) || 0,
                penghasilan_bruto: Number(r.penghasilan_bruto) || 0,
                pph21_ter: Number(r.pph21_ter) || 0,
                tarif_pajak_ter: Number(r.tarif_pajak_ter) || 0,
                upah_dasar: Number(r.upah_dasar) || 0,
                gaji_pokok: Number(r.gaji_pokok) || 0,
                gaji_pokok_aktual: Number(r.gaji_pokok_aktual) || 0,
                gaji_pokok_ideal: Number(r.gaji_pokok_ideal) || 0,
                lembur_jam: Number(r.lembur_jam) || 0,
                lembur_rate: Number(r.lembur_rate) || 0,
                lembur_jumlah: Number(r.lembur_jumlah) || 0,
                total_premi: Number(r.total_premi) || 0,
                total_tunjangan: Number(r.total_tunjangan) || 0,
                beras_rate: Number(r.beras_rate) || 0,
                beras_jumlah: Number(r.beras_jumlah) || 0,
                jabatan_rate: Number(r.jabatan_rate) || 0,
                jabatan_jumlah: Number(r.jabatan_jumlah) || 0,
                masa_kerja_tahun: Number(r.masa_kerja_tahun) || 0,
                masa_kerja_rate: Number(r.masa_kerja_rate) || 0,
                masa_kerja_jumlah: Number(r.masa_kerja_jumlah) || 0,
                premi_brondol: Number(r.premi_brondol) || 0,
                premi_brondol_total: Number(r.premi_brondol_total) || 0,
                premi_pph: Number(r.premi_pph) || 0,
                total_potongan: Number(r.total_potongan) || 0,
                total_potongan_bersih: Number(r.total_potongan_bersih) || 0,
                pot_koreksi: Number(r.pot_koreksi) || 0,
                pot_spsi: Number(r.pot_spsi) || 0,
                pot_pph21: Number(r.pot_pph21) || 0,
                pot_astek_pekerja: Number(r.pot_astek_pekerja) || 0,
                pot_bpjs_kesehatan_pekerja: Number(r.pot_bpjs_kesehatan_pekerja) || 0,
                pot_bpjs_pensiun_pekerja: Number(r.pot_bpjs_pensiun_pekerja) || 0,
                jumlah_hk: Number(r.jumlah_hk) || 0,
                hari_kerja: Number(r.hari_kerja) || 0,
                kehadiran: Number(r.hari_kerja) || 0,
                cuti_minggu_hari: Number(r.cuti_minggu_hari) || 0,
                cuti_nasional_hari: Number(r.cuti_nasional_hari) || 0,
                total_jam_kerja: Number(r.total_jam_kerja) || 0
            };
            out.push(row);
        }
        // [SALARY-ANALYSIS] Enrich setiap baris snapshot dengan status aktif + HK efektif dari HR master,
        // lalu buang karyawan non-aktif dan dedupe per NIK ke empcode terbaru.
        // Dilakukan di backend supaya semua consumer (SalaryAnalysisPage dll) dapat data konsisten.
        try {
            const liveDb = Database.getInstance();
            const empCodes = [...new Set(out.map(r => String(r.emp_code || '').trim()).filter(Boolean))];
            const activeMap = new Map<string, string>(); // nik -> emp_code (yang dipakai, terbaru & aktif)

            // 1) Ambil status aktif + NIK semua empcode dari HR_EMPLOYEE (live db_ptrj)
            const liveHrRows = await selectLiveHrEmployeesForWageDistribution(liveDb, empCodes);
            for (const r of liveHrRows) {
                const code = (r.EmpCode || '').trim();
                const nik = (r.NewICNo || code || '').trim().toUpperCase();
                const active = String(r.Status || '').trim() === '1';
                if (!active) continue; // [RULE] hanya status aktif ('1') yang dipertahankan
                const existing = activeMap.get(nik);
                // empcode terbaru menang (huruf prefix maksimum = C > B > A, lalu numerik terbesar)
                if (!existing || code > existing) activeMap.set(nik, code);
            }

            // 2) Filter baris: empcode harus aktif, dan hanya satu baris per NIK (dedupe nama sama beda empcode)
            const nikCounter = new Map<string, number>();
            const hkByCode = new Map<string, number>();
            out = out.filter(r => {
                const code = String(r.emp_code || '').trim();
                if (!code) return false;
                let nik = String(r.nik || '').trim().toUpperCase();
                if (!nik) nik = String(r.emp_name || '').trim().toUpperCase();
                if (!nik) nik = code;
                const resolved = activeMap.get(nik);
                // Buang kalau: empcode non-aktif ATAU NIK sudah diwakili empcode lain (dup)
                if (!resolved || String(resolved).toUpperCase() !== code.toUpperCase()) return false;
                const n = (nikCounter.get(nik) || 0) + 1;
                nikCounter.set(nik, n);
                return n === 1;
            });

            // 3) Hitung HK efektif per empcode (jumlah_hk - cuti_minggu - cuti_nasional) dari baris terpilih
            for (const r of out) {
                const code = String(r.emp_code || '').trim();
                const hkEfektif = Math.max(0, (Number(r.jumlah_hk) || 0) - (Number(r.cuti_minggu_hari) || 0) - (Number(r.cuti_nasional_hari) || 0));
                r.hari_kerja_efektif = hkEfektif;
                hkByCode.set(code, hkEfektif);
            }
        } catch (e) {
            // Jangan gagalkan data bila enrichment HR gagal — fallback: hitung HK efektif dari baris saja
            logError(CATEGORY, "getWageDistribution active-status enrichment failed:", e);
            for (const r of out) {
                r.hari_kerja_efektif = Math.max(0, (Number(r.jumlah_hk) || 0) - (Number(r.cuti_minggu_hari) || 0) - (Number(r.cuti_nasional_hari) || 0));
            }
        }
        return out;
    }
}

export const historyDatabaseService = HistoryDatabaseService.getInstance();
