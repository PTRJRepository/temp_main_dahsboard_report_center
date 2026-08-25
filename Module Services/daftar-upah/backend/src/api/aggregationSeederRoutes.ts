/**
 * Aggregation Seeding Routes
 * API endpoints for triggering and managing aggregation seeding to extend_db_ptrj
 * Always uses server_profile_1 for extend_db_ptrj connection
 */

import { Elysia, t } from "elysia";
import { info, warn, error as logError } from "../utils/logger";
const CATEGORY = "AggregationSeederRoutes";
import { Database } from "../db/client";

import { Config } from "../config";
import { getForwardAuthorizationHeader } from "../utils/authBypass";
import {
    seederProgress,
    updateProgress,
    seedAggregationToDb,
    fetchMillData,
    validateAggregation,
    getAvailableDivisions
} from "../services/aggregation/aggregationSeederService";

export { seederProgress, updateProgress };

export const aggregationSeederRoutes = new Elysia({ prefix: "/payroll/aggregation" })
    .get("/progress", async () => {
        return {
            success: true,
            progress: seederProgress,
            elapsed_seconds: seederProgress.started_at 
                ? Math.floor((Date.now() - new Date(seederProgress.started_at).getTime()) / 1000)
                : 0
        };
    })
    .get("/health", async () => {
        const db = Database.getExtendedInstance();
        try {
            await db.query("SELECT 1");
            return {
                success: true,
                message: `extend_db_ptrj connection successful (${Config.DB_EXTEND_PROFILE})`,
                profile: Config.DB_EXTEND_PROFILE,
                timestamp: new Date().toISOString()
            };
        } catch (error: any) {
            return {
                success: false,
                message: `Connection failed: ${error.message}`,
                profile: Config.DB_EXTEND_PROFILE,
                timestamp: new Date().toISOString()
            };
        }
    })
    .post("/seed", async ({ body, headers, set }) => {
        // Verify authentication
        const authHeader = getForwardAuthorizationHeader(headers);
        if (!authHeader) {
            set.status = 401;
            return { success: false, error: "Unauthorized" };
        }

        const { division, month, year, force, useParallel } = body;

        try {
            let result;
            
            // Use parallel seeder if requested (faster)
            if (useParallel !== false) {  // Default to parallel
                const { seedAggregationParallel } = await import("./parallelAggregationSeeder");
                const divisions = division ? [division] : await getAvailableDivisions();
                result = await seedAggregationParallel(divisions, month, year, authHeader, force || false);
            } else {
                // Fallback to old sequential method (for compatibility)
                result = await seedAggregationToDb(division, month, year, authHeader, force || false);
            }
            
            return {
                success: true,
                data: result
            };
        } catch (error: any) {
            logError(CATEGORY, "[AggregationSeeder] Error:", error);
            return {
                success: false,
                error: error.message || "Failed to seed aggregation"
            };
        }
    }, {
        body: t.Object({
            division: t.Optional(t.String()),
            month: t.Numeric(),
            year: t.Numeric(),
            force: t.Optional(t.Boolean()),
            useParallel: t.Optional(t.Boolean())
        })
    })
    // Seed based on exact UI filters (ensures 100% match with Daftar Upah)
    .post("/seed-ui", async ({ body, headers, set }) => {
        const authHeader = getForwardAuthorizationHeader(headers);
        if (!authHeader) {
            set.status = 401;
            return { success: false, error: "Unauthorized" };
        }

        const { division, month, year, gangCode, gangPrefix } = body;

        try {
            const { seedFromUI } = await import("./uiBasedSeeder");
            const result = await seedFromUI(division, month, year, gangCode, gangPrefix);

            return {
                success: result.success,
                data: {
                    total_gangs: result.total_gangs,
                    total_employees: result.total_employees,
                    results: result.results
                }
            };
        } catch (error: any) {
            logError(CATEGORY, "[UI Seeder] Error:", error);
            return {
                success: false,
                error: error.message || "Failed to seed from UI"
            };
        }
    }, {
        body: t.Object({
            division: t.String(),
            month: t.Numeric(),
            year: t.Numeric(),
            gangCode: t.Optional(t.String()),
            gangPrefix: t.Optional(t.String())
        })
    })
    .post("/seed-tonase", async ({ body, headers, set }) => {
        // Seed ONLY tonase (FFB weight) from db_ptrj_mill (server_3)
        const authHeader = getForwardAuthorizationHeader(headers);
        if (!authHeader) {
            set.status = 401;
            return { success: false, error: "Unauthorized" };
        }

        const { month, year } = body;

        try {
            info(CATEGORY, `[TonaseSeeder] Starting tonase-only seed for ${month}/${year}...`);
            const db = Database.getExtendedInstance();
            const millDb = Database.getMillInstance();

            // Get all PTRJ FFB records grouped by supplier
            const rows = await millDb.query<{ CustomerCode: string; SupplierName: string; total_weight: string }>(`
                SELECT 
                    T.[CustomerCode],
                    S.[Name] AS SupplierName,
                    SUM(CAST(T.[NetWeight] AS DECIMAL(18,2))) / 1000.0 AS total_weight
                FROM [dbo].[WM_TICKET] T
                LEFT JOIN [dbo].[PU_SUPPLIER] S ON T.[CustomerCode] = S.[SupplierCode]
                WHERE T.[CustomerCode] IN ('PTRJ01','PTRJ02','PTRJ03','PTRJ04','PTRJ05','PTRJ06','PTRJ07','PTRJ08','PTRJ09')
                  AND MONTH(T.[DateReceived]) = ?
                  AND YEAR(T.[DateReceived]) = ?
                  AND T.[ProductCode] = 'FFB'
                GROUP BY T.[CustomerCode], S.[Name]
            `, [month, year]);

            info(CATEGORY, `[TonaseSeeder] Fetched ${rows.length} FFB records from db_ptrj_mill`);

            // Get all divisions that have aggregation data for this period
            const divisionRows = await db.query<{ division_code: string }>(`
                SELECT DISTINCT division_code
                FROM dbo.daftar_upah_aggregation_history
                WHERE period_month = ? AND period_year = ?
                  AND division_code IS NOT NULL
            `, [month, year]);

            const results: { division: string; tonase: number; status: string }[] = [];

            for (const divRow of divisionRows) {
                const divCode = divRow.division_code.trim();
                // Match tonase by checking if division code appears in supplier name or customer code
                let divTonase = 0;
                for (const row of rows) {
                    const supplierName = (row.SupplierName || '').toUpperCase();
                    const customerCode = (row.CustomerCode || '').toUpperCase();
                    const weight = parseFloat(row.total_weight) || 0;

                    if (supplierName.includes(divCode) || customerCode.includes(divCode)) {
                        divTonase += weight;
                    }
                }

                if (divTonase > 0) {
                    // Tulis tonase SEKALI per divisi ke tabel division_tonase (bukan broadcast ke baris gang).
                    // Baris gang di aggregation_history tidak lagi memegang tonase (hindari double-count).
                    await db.query(`
                        MERGE dbo.division_tonase AS target
                        USING (SELECT ? AS period_month, ? AS period_year, ? AS division_code) AS src
                        ON target.period_month = src.period_month AND target.period_year = src.period_year
                           AND target.division_code = src.division_code
                        WHEN MATCHED THEN
                            UPDATE SET tonase = ?, source = 'mill_supplier', updated_at = GETDATE()
                        WHEN NOT MATCHED THEN
                            INSERT (period_month, period_year, division_code, tonase, source)
                            VALUES (src.period_month, src.period_year, src.division_code, ?, 'mill_supplier');
                    `, [month, year, divCode, divTonase, divTonase]);

                    info(CATEGORY, `[TonaseSeeder] ${divCode}: ${divTonase.toFixed(2)} tons → updated`);
                    results.push({ division: divCode, tonase: Math.round(divTonase * 100) / 100, status: 'UPDATED' });
                } else {
                    info(CATEGORY, `[TonaseSeeder] ${divCode}: no tonase data found`);
                    results.push({ division: divCode, tonase: 0, status: 'NO_DATA' });
                }
            }

            return {
                success: true,
                message: `Tonase seeded for ${month}/${year}`,
                total_divisions: results.length,
                updated: results.filter(r => r.status === 'UPDATED').length,
                results
            };
        } catch (error: any) {
            logError(CATEGORY, "[TonaseSeeder] Error:", error);
            return {
                success: false,
                error: error.message || "Failed to seed tonase"
            };
        }
    }, {
        body: t.Object({
            month: t.Numeric(),
            year: t.Numeric()
        })
    })
    .get("/seed/progress", async ({ headers, set }) => {
        // Verify authentication
        const authHeader = getForwardAuthorizationHeader(headers);
        if (!authHeader) {
            set.status = 401;
            return { success: false, error: "Unauthorized" };
        }

        try {
            // Import HistorySeederService to get its static progress
            const { HistorySeederService } = await import("../services/historySeederService");
            const progress = HistorySeederService.getProgress();

            return {
                success: true,
                data: progress
            };
        } catch (error: any) {
            logError(CATEGORY, "[AggregationSeeder] Progress Error:", error);
            set.status = 500;
            return {
                success: false,
                error: error.message || "Failed to fetch progress"
            };
        }
    })
    .get("/history", async ({ query, headers }) => {
        // Verify authentication
        const authHeader = getForwardAuthorizationHeader(headers);
        if (!authHeader) {
            return { success: false, error: "Unauthorized" };
        }

        const month = parseInt(query.month || "0");
        const year = parseInt(query.year || "0");
        const division = query.division;

        try {
            const db = Database.getExtendedInstance();

            let sql = `
                SELECT
                    id, period_month, period_year, division_code, gang_code, gang_description,
                    total_employees, total_hk, total_hari_kerja,
                    total_upah_dasar, total_upah_pokok, total_gaji_pokok,
                    total_beras, total_jabatan, total_masa_kerja, total_lembur, total_tunjangan,
                    total_premi_brondol, total_premi_prunning, total_premi_insentif, total_premi_kinerja,
                    total_premi, dynamic_premi_data, informasi_tambahan, total_koreksi,
                    total_potongan, total_pph21, total_bpjs_pekerja, total_bpjs_majikan, total_spsi,
                    total_upah_kotor, total_upah_bersih, total_ffb_weight, total_weight_tbs,
                    created_at, updated_at, source_endpoint
                FROM dbo.daftar_upah_aggregation_history
                WHERE 1=1
            `;

            const params: any[] = [];

            if (month > 0) {
                sql += " AND period_month = ?";
                params.push(month);
            }
            if (year > 0) {
                sql += " AND period_year = ?";
                params.push(year);
            }
            if (division) {
                sql += " AND division_code = ?";
                params.push(division);
            }

            sql += " ORDER BY division_code, gang_code";

            const records = await db.query<any>(sql, params.length > 0 ? params : undefined);

            return {
                success: true,
                data: records,
                count: records.length
            };
        } catch (error: any) {
            logError(CATEGORY, "[AggregationHistory] Error:", error);
            return {
                success: false,
                error: error.message || "Failed to fetch aggregation history",
                data: []
            };
        }
    })
    .get("/summary", async ({ query, headers }) => {
        // Verify authentication
        const authHeader = getForwardAuthorizationHeader(headers);
        if (!authHeader) {
            return { success: false, error: "Unauthorized" };
        }

        const month = parseInt(query.month || "0");
        const year = parseInt(query.year || "0");

        try {
            const db = Database.getExtendedInstance();

            const summary = await db.query<{
                division_code: string;
                gang_count: number;
                total_emp: number;
                total_hk: number;
                total_upah: number;
                total_premi: number;
                total_lembur: number;
                total_ffb: number;
                total_potongan: number;
                total_pph21: number;
                total_bpjs_pekerja: number;
                total_bpjs_majikan: number;
                total_spsi: number;
            }>(`
                WITH latest_rows AS (
                    SELECT
                        h.*,
                        ROW_NUMBER() OVER (
                            PARTITION BY h.period_month, h.period_year, h.gang_code
                            ORDER BY COALESCE(h.updated_at, h.created_at) DESC, h.id DESC
                        ) as row_rank
                    FROM dbo.daftar_upah_aggregation_history h
                    WHERE h.period_month = ? AND h.period_year = ?
                )
                SELECT
                    h.division_code,
                    COUNT(*) as gang_count,
                    SUM(h.total_employees) as total_emp,
                    SUM(h.total_hk) as total_hk,
                    SUM(h.total_upah_bersih) as total_upah,
                    SUM(h.total_premi) as total_premi,
                    SUM(h.total_lembur) as total_lembur,
                    SUM(h.total_ffb_weight) as total_ffb,
                    SUM(h.total_potongan) as total_potongan,
                    SUM(h.total_pph21) as total_pph21,
                    SUM(h.total_bpjs_pekerja) as total_bpjs_pekerja,
                    SUM(h.total_bpjs_majikan) as total_bpjs_majikan,
                    SUM(h.total_spsi) as total_spsi
                FROM latest_rows h
                WHERE h.row_rank = 1
                GROUP BY h.division_code
                ORDER BY h.division_code
            `, [month, year]);

            const grandTotal = summary.reduce((acc, row) => ({
                division_code: "GRAND TOTAL",
                gang_count: acc.gang_count + (row.gang_count || 0),
                total_emp: acc.total_emp + (row.total_emp || 0),
                total_hk: acc.total_hk + (row.total_hk || 0),
                total_upah: acc.total_upah + (row.total_upah || 0),
                total_premi: acc.total_premi + (row.total_premi || 0),
                total_lembur: acc.total_lembur + (row.total_lembur || 0),
                total_ffb: acc.total_ffb + (row.total_ffb || 0),
                total_potongan: acc.total_potongan + (row.total_potongan || 0),
                total_pph21: acc.total_pph21 + (row.total_pph21 || 0),
                total_bpjs_pekerja: acc.total_bpjs_pekerja + (row.total_bpjs_pekerja || 0),
                total_bpjs_majikan: acc.total_bpjs_majikan + (row.total_bpjs_majikan || 0),
                total_spsi: acc.total_spsi + (row.total_spsi || 0)
            }), {
                division_code: "GRAND TOTAL",
                gang_count: 0,
                total_emp: 0,
                total_hk: 0,
                total_upah: 0,
                total_premi: 0,
                total_lembur: 0,
                total_ffb: 0,
                total_potongan: 0,
                total_pph21: 0,
                total_bpjs_pekerja: 0,
                total_bpjs_majikan: 0,
                total_spsi: 0
            });

            return {
                success: true,
                summary: summary,
                grand_total: grandTotal
            };
        } catch (error: any) {
            logError(CATEGORY, "[AggregationSummary] Error:", error);
            return {
                success: false,
                error: error.message || "Failed to fetch aggregation summary",
                summary: [],
                grand_total: null
            };
        }
    })
    .get("/divisions", async ({ headers }) => {
        // Verify authentication
        const authHeader = getForwardAuthorizationHeader(headers);
        if (!authHeader) {
            return { success: false, error: "Unauthorized" };
        }

        try {
            const db = Database.getExtendedInstance();

            const rows = await db.query<{ division_code: string }>(`
                SELECT DISTINCT division_code
                FROM dbo.daftar_upah_aggregation_history
                WHERE division_code IS NOT NULL
                ORDER BY division_code
            `);

            const divisions = rows.map(r => r.division_code);

            return {
                success: true,
                divisions: divisions
            };
        } catch (error: any) {
            logError(CATEGORY, "[AggregationDivisions] Error:", error);
            return {
                success: false,
                error: error.message || "Failed to fetch divisions",
                divisions: []
            };
        }
    })
    .get("/periods", async ({ headers }) => {
        // Verify authentication
        const authHeader = getForwardAuthorizationHeader(headers);
        if (!authHeader) {
            return { success: false, error: "Unauthorized" };
        }

        try {
            const db = Database.getExtendedInstance();

            const periods = await db.query<{ period_month: number; period_year: number }>(`
                SELECT DISTINCT period_month, period_year
                FROM dbo.daftar_upah_aggregation_history
                ORDER BY period_year DESC, period_month DESC
            `);

            return {
                success: true,
                periods: periods
            };
        } catch (error: any) {
            logError(CATEGORY, "[AggregationPeriods] Error:", error);
            return {
                success: false,
                error: error.message || "Failed to fetch periods",
                periods: []
            };
        }
    })
    .get("/status/:month/:year", async ({ params, headers }) => {
        // Check aggregation status for a specific period
        const authHeader = getForwardAuthorizationHeader(headers);
        if (!authHeader) {
            return { success: false, error: "Unauthorized" };
        }

        const month = parseInt(params.month);
        const year = parseInt(params.year);

        try {
            const db = Database.getExtendedInstance();

            const statusRecords = await db.query<{
                division_code: string;
                gang_count: number;
            }>(`
                WITH latest_rows AS (
                    SELECT
                        h.division_code,
                        h.gang_code,
                        ROW_NUMBER() OVER (
                            PARTITION BY h.period_month, h.period_year, h.gang_code
                            ORDER BY COALESCE(h.updated_at, h.created_at) DESC, h.id DESC
                        ) as row_rank
                    FROM dbo.daftar_upah_aggregation_history h
                    WHERE h.period_month = ? AND h.period_year = ?
                )
                SELECT h.division_code, COUNT(*) as gang_count
                FROM latest_rows h
                WHERE h.row_rank = 1
                GROUP BY h.division_code
                ORDER BY h.division_code
            `, [month, year]);

            return {
                success: true,
                month,
                year,
                divisions: statusRecords,
                total_gangs: statusRecords.reduce((sum, r) => sum + (r.gang_count || 0), 0)
            };
        } catch (error: any) {
            logError(CATEGORY, "[AggregationStatus] Error:", error);
            return {
                success: false,
                error: error.message || "Failed to fetch aggregation status",
                divisions: [],
                total_gangs: 0
            };
        }
    })
    .get("/validate", async ({ query, headers }) => {
        // Validate aggregation totals against real-time payroll calculations
        const authHeader = getForwardAuthorizationHeader(headers);
        if (!authHeader) {
            return { success: false, error: "Unauthorized" };
        }

        const month = parseInt(query.month);
        const year = parseInt(query.year);
        const divisionCode = query.division; // Optional: validate specific division only

        return await validateAggregation(month, year, divisionCode || undefined, authHeader);
    });

