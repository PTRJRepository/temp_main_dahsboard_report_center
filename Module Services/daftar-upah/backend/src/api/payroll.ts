/**
 * @module backend/src/api/payroll.ts
 * @purpose Root /payroll Elysia instance: derive/onBeforeHandle auth gate, mounts 4 route-group plugins (manualAdjustment/adtransVerify/locked/report), and core routes (divisions, gangs, headers, columns, calculate, overrides, bpjs, premium, warm-cache, test, registry).
 * @input Request headers (Authorization / x-api-key) resolved to currentUser; query/body per core route
 * @output JSON per core route; 401 when currentUser absent (derive/onBeforeHandle gate)
 * @depends ./payroll.shared#getUserFromHeader, ./payroll.manualAdjustmentRoutes, ./payroll.adtransVerifyRoutes, ./payroll.lockedRoutes, ./payroll.reportRoutes, ../db/client#Database, ../services/{gangService,headerService,payrollService,authService,currentPeriodService,dataExtractorService}, ../types/user#UserRole
 * @sideeffect overrides/* write payroll_overlay tables; warm-cache triggers full payroll extraction per division
 * @tests backend/src/api/payroll.lockedVerify.test.ts, backend/src/api/payroll.manualAdjustmentByApiKey.test.ts, backend/src/api/payroll.premiumDefinitions.test.ts
 */
import { Database } from "../db/client";
import { Elysia, t } from "elysia";
import { gangService } from "../services/gangService";
import { headerService } from "../services/headerService";
import { payrollService } from "../services/payrollService";
import { AuthService } from "../services/authService";
import { currentPeriodService } from "../services/currentPeriodService";
import { dataExtractorService } from "../services/dataExtractorService";
import { UserRole } from "../types/user";
import { getUserFromHeader } from "./payroll.shared";
import { manualAdjustmentRoutes } from "./payroll.manualAdjustmentRoutes";
import { adtransVerifyRoutes } from "./payroll.adtransVerifyRoutes";
import { lockedRoutes } from "./payroll.lockedRoutes";
import { reportRoutes } from "./payroll.reportRoutes";

const authService = AuthService.getInstance();

export const payrollRoutes = new Elysia({ prefix: "/payroll" })
    .derive(async ({ headers }) => {
        try {
            const user = await getUserFromHeader(headers);
            return { currentUser: user };
        } catch (e) {
            console.error("[PayrollRoutes] Derive error:", e);
            return { currentUser: null };
        }
    })
    .onBeforeHandle(({ currentUser, set }) => {
        if (!currentUser) {
            set.status = 401;
            return { message: "Unauthorized" };
        }
    })
    .use(manualAdjustmentRoutes)
    .use(adtransVerifyRoutes)
    .use(lockedRoutes)
    .use(reportRoutes)
    // --- Divisions ---
    .get("/divisions", async ({ currentUser }): Promise<any> => {
        if (currentUser) {
            return authService.getAccessibleDivisions(currentUser);
        }
        // Exclude virtual divisions - they are derived at read time from real divisions
        const divisions = await gangService.getAllDivisions(false);
        return divisions;
    })
    .get("/subdivisions", async ({ set }) => {
        try {
            const subDivisions: any[] = [];
            return subDivisions;
        } catch (e) {
            set.status = 500;
            return { message: "Failed to fetch sub-divisions" };
        }
    })
    .get("/current-period", async ({ set }) => {
        try {
            const period = await currentPeriodService.getCurrentPeriod();
            return period;
        } catch (e: any) {
            set.status = 500;
            return { message: `Failed to get current period: ${e.message}` };
        }
    })
    .get("/gangs", async ({ query, currentUser, set }): Promise<any> => {
        try {
            const division = query.division === "ALL" ? undefined : query.division;
            const search = query.search || undefined;

            // Permission check
            if (currentUser && (currentUser.role !== UserRole.ADMIN)) {
                if (division && !currentUser.divisions.includes(division)) {
                    set.status = 403;
                    return { message: "Division not accessible" };
                }
            }

            const gangs = await gangService.fetchGangs(division, search);
            return gangs;
        } catch (e: any) {
            set.status = 500;
            return { message: `Failed to fetch gangs: ${e.message}` };
        }
    }, {
        query: t.Object({
            division: t.Optional(t.String()),
            search: t.Optional(t.String()),
            force: t.Optional(t.String())
        })
    })
    .get("/gangs/by-loc", async ({ query, set }) => {
        try {
            const codes = await gangService.fetchGangsByLocCode(query.loc_code);
            if (codes.length === 0) {
                set.status = 404;
                return { message: `No gangs found for locCode ${query.loc_code}` };
            }
            return codes;
        } catch (e: any) {
            set.status = 500;
            return { message: `Failed to fetch gangs by locCode: ${e.message}` };
        }
    }, {
        query: t.Object({
            loc_code: t.String(),
            force: t.Optional(t.String())
        })
    })
    .get("/gang/:gang_code/info", async ({ params, set }) => {
        try {
            const info = await gangService.getGangInfo(params.gang_code);
            return info;
        } catch (e: any) {
            set.status = 500;
            return { message: `Failed to get gang info: ${e.message}` };
        }
    })
    .get("/headers", async ({ query, set }) => {
        try {
            const month = query.month ? parseInt(query.month) : undefined;
            const year = query.year ? parseInt(query.year) : undefined;
            const gangCode = query.gang_code || undefined;

            const result = await headerService.generateDynamicHeaders(month, year, gangCode);
            return result;
        } catch (e: any) {
            set.status = 500;
            return { message: `Failed to generate headers: ${e.message}` };
        }
    }, {
        query: t.Object({
            month: t.Optional(t.String()),
            year: t.Optional(t.String()),
            gang_code: t.Optional(t.String())
        })
    })
    .get("/columns", async ({ query, set }): Promise<any> => {
        try {
            const month = query.month ? parseInt(query.month) : undefined;
            const year = query.year ? parseInt(query.year) : undefined;
            const gangCode = query.gang_code || undefined;

            const columns = await headerService.getColumnDefinitions(month, year, gangCode);
            return columns;
        } catch (e: any) {
            set.status = 500;
            return { message: `Failed to generate column definitions: ${e.message}` };
        }
    }, {
        query: t.Object({
            month: t.Optional(t.String()),
            year: t.Optional(t.String()),
            gang_code: t.Optional(t.String()),
            fallback: t.Optional(t.String())
        })
    })
    .post("/calculate", async ({ body }) => {
        const { upah_dasar, hk_count, allowances, deductions } = body as any;

        const result = payrollService.calculate(upah_dasar, hk_count, allowances || {}, deductions || {});
        return result;
    }, {
        body: t.Object({
            upah_dasar: t.Number(),
            hk_count: t.Number(),
            allowances: t.Optional(t.Record(t.String(), t.Number())),
            deductions: t.Optional(t.Record(t.String(), t.Number()))
        })
    })
    /**
     * SNAPSHOT TABLES ARE IMMUTABLE.
     * NEVER WRITE USER EDITS DIRECTLY INTO SNAPSHOT TABLES.
     * ALL MANUAL CHANGES MUST GO TO OVERLAY HISTORY TABLES.
     */
    .post("/overrides/profile", async ({ body, currentUser, set }) => {
        try {
            const { payrollOverlayService } = await import("../services/payrollOverlayService");
            const { cacheService } = await import("../services/cacheService");
            const username = currentUser?.username || "system";
            const id = await payrollOverlayService.saveProfileOverride({
                ...(body as any),
                changed_by: username,
                change_source: "DAFTAR_UPAH_UI"
            });

            cacheService.clear();
            return { success: true, id };
        } catch (e: any) {
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        body: t.Object({
            emp_code: t.String(),
            nik: t.Optional(t.String()),
            is_spsi_member: t.Optional(t.Boolean()),
            effective_start_date: t.Optional(t.Union([t.String(), t.Null()])),
            employee_status_at_change: t.Optional(t.String()),
            change_reason: t.Optional(t.String())
        })
    })
    /**
     * SNAPSHOT TABLES ARE IMMUTABLE.
     * NEVER WRITE USER EDITS DIRECTLY INTO SNAPSHOT TABLES.
     * ALL MANUAL CHANGES MUST GO TO OVERLAY HISTORY TABLES.
     */
    .post("/overrides/values", async ({ body, currentUser, set }) => {
        try {
            const { payrollOverlayService } = await import("../services/payrollOverlayService");
            const { cacheService } = await import("../services/cacheService");
            const username = currentUser?.username || "system";
            const ids = await payrollOverlayService.saveValueOverrides((body as any).items, username);

            cacheService.clear();
            return { success: true, ids };
        } catch (e: any) {
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        body: t.Object({
            items: t.Array(t.Object({
                period_month: t.Number(),
                period_year: t.Number(),
                division_code: t.String(),
                gang_code: t.String(),
                emp_code: t.String(),
                nik: t.Optional(t.String()),
                field_name: t.String(),
                field_group: t.String(),
                numeric_value: t.Optional(t.Union([t.Number(), t.Null()])),
                text_value: t.Optional(t.Union([t.String(), t.Null()])),
                change_reason: t.Optional(t.String())
            }))
        })
    })
    /**
     * Join Date Override
     * Updates join_date via employee_profile_override_history.effective_start_date
     * This overrides join_date from history_hr_employee
     */
    .post("/overrides/join-date", async ({ body, currentUser, set }) => {
        try {
            const { payrollOverlayService } = await import("../services/payrollOverlayService");
            const { cacheService } = await import("../services/cacheService");
            const username = currentUser?.username || "system";
            const { emp_code, join_date, change_reason } = body as { emp_code: string; join_date: string; change_reason?: string };

            if (!emp_code || !join_date) {
                set.status = 400;
                return { success: false, error: "emp_code and join_date are required" };
            }

            const id = await payrollOverlayService.saveProfileOverride({
                emp_code,
                effective_start_date: join_date,
                changed_by: username,
                change_source: "DAFTAR_UPAH_UI",
                change_reason: change_reason || `Join date updated to ${join_date}`
            });

            cacheService.clear();
            return { success: true, id };
        } catch (e: any) {
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        body: t.Object({
            emp_code: t.String(),
            join_date: t.String(),
            change_reason: t.Optional(t.String())
        })
    })
    // --- BPJS Calculation (New) ---
    .get("/bpjs-calculate", async ({ query }) => {
        const masaKerjaJumlah = parseFloat(query.masa_kerja_jumlah || "0");
        const upahDasar = parseFloat(query.upah_dasar || "0");
        const components = payrollService.calculateBpjsComponents(masaKerjaJumlah, upahDasar);
        return components;
    }, {
        query: t.Object({
            masa_kerja_jumlah: t.Optional(t.String()),
            upah_dasar: t.Optional(t.String())
        })
    })
    /**
     * TEST ENDPOINT: Diagnose jabatan, THR, and KONTAN data availability
     * Tests the full chain: gang → employees → employee_estate / employee_other_incomes
     */
    .get("/test/jabatan-thr-kontan", async ({ query, set }) => {
        try {
            const db = Database.getExtendedInstance();
            const dbMain = Database.getInstance();
            const { OtherIncomesService } = await import("../services/otherIncomesService");

            const gangCode = (query.gang_code as string) || 'H1H';
            const month = parseInt(query.month as string) || 3;
            const year = parseInt(query.year as string) || 2026;

            const result: any = {
                params: { gang_code: gangCode, month, year },
                timestamp: new Date().toISOString()
            };

            // STEP 1: Get employees in the gang
            const gangEmployees = await dbMain.query(`
                SELECT TOP 20
                    RTRIM(e.EmpCode) as emp_code,
                    RTRIM(e.NewICNo) as nik,
                    RTRIM(e.EmpName) as emp_name,
                    RTRIM(gl.GangCode) as gang_code,
                    e.Status
                FROM HR_EMPLOYEE e
                INNER JOIN HR_GANGLN gl ON e.EmpCode = gl.GangMember
                INNER JOIN HR_GANG g ON gl.GangCode = g.GangCode
                WHERE gl.GangCode = ?
                ORDER BY e.EmpName
            `, [gangCode]);

            result.step1_employees = {
                total: gangEmployees.length,
                sample: gangEmployees.slice(0, 5).map((e: any) => ({
                    emp_code: e.emp_code,
                    nik: e.nik || '(empty)',
                    emp_name: e.emp_name
                }))
            };

            if (gangEmployees.length === 0) {
                result.conclusion = 'FAIL';
                result.message = `No employees found for gang ${gangCode}`;
                return result;
            }

            const empCodes = gangEmployees.map((e: any) => e.emp_code);
            const niks = gangEmployees.map((e: any) => (e.nik || '').trim().toUpperCase()).filter(Boolean);

            // STEP 2: Check employee_estate (JABATAN)
            const estateRows = await db.query(`
                SELECT empcode, employee_name, gang, jabatan
                FROM employee_estate
                WHERE empcode IN (${empCodes.map(() => '?').join(',')})
            `, empCodes);

            const estateMap = new Map<string, string>();
            estateRows.forEach((r: any) => estateMap.set(r.empcode?.trim().toUpperCase(), r.jabatan));

            // Also check by nik
            const estateRowsByNik = await db.query(`
                SELECT nik, employee_name, gang, jabatan
                FROM employee_estate
                WHERE nik IN (${niks.map(() => '?').join(',')})
            `, niks);
            estateRowsByNik.forEach((r: any) => {
                const key = (r.nik || '').trim().toUpperCase();
                if (key && !estateMap.has(key)) {
                    estateMap.set(key, r.jabatan);
                }
            });

            const totalEstateCount = await db.query(`SELECT COUNT(*) as cnt FROM employee_estate`);
            result.step2_jabatan = {
                table_total_records: totalEstateCount[0]?.cnt || 0,
                records_for_gang: estateRows.length,
                matched_by_empcode: estateRows.length,
                matched_by_nik: estateRowsByNik.length,
                sample: estateRows.slice(0, 5).map((r: any) => ({
                    empcode: r.empcode,
                    jabatan: r.jabatan
                })),
                status: estateRows.length > 0 ? 'OK' : 'EMPTY - seed needed'
            };

            // STEP 3: Check employee_other_incomes (THR + KONTAN)
            const otherIncomes = await OtherIncomesService.getIncomes(year, month, undefined, gangCode);
            const thrRecords = otherIncomes.filter((i: any) => i.income_type === 'THR');
            const kontanRecords = otherIncomes.filter((i: any) => i.income_type === 'KONTAN' || i.income_type === 'KONTANAN');

            // Match against gang employees
            let thrMatched = 0;
            let kontanMatched = 0;
            const thrSample: any[] = [];
            const kontanSample: any[] = [];

            for (const emp of gangEmployees) {
                const nikKey = (emp.nik || '').trim().toUpperCase();
                const empCodeKey = (emp.emp_code || '').trim().toUpperCase();

                const hasThr = thrRecords.some((r: any) =>
                    ((r.nik || '').trim().toUpperCase() === nikKey && nikKey) ||
                    ((r.emp_code || '').trim().toUpperCase() === empCodeKey && empCodeKey)
                );
                const hasKontan = kontanRecords.some((r: any) =>
                    ((r.nik || '').trim().toUpperCase() === nikKey && nikKey) ||
                    ((r.emp_code || '').trim().toUpperCase() === empCodeKey && empCodeKey)
                );

                if (hasThr) {
                    thrMatched++;
                    if (thrSample.length < 5) {
                        const rec = thrRecords.find((r: any) =>
                            ((r.nik || '').trim().toUpperCase() === nikKey && nikKey) ||
                            ((r.emp_code || '').trim().toUpperCase() === empCodeKey && empCodeKey)
                        );
                        thrSample.push({ emp_name: emp.emp_name, nik: nikKey || empCodeKey, amount: rec?.amount });
                    }
                }
                if (hasKontan) {
                    kontanMatched++;
                    if (kontanSample.length < 5) {
                        const rec = kontanRecords.find((r: any) =>
                            ((r.nik || '').trim().toUpperCase() === nikKey && nikKey) ||
                            ((r.emp_code || '').trim().toUpperCase() === empCodeKey && empCodeKey)
                        );
                        kontanSample.push({ emp_name: emp.emp_name, nik: nikKey || empCodeKey, amount: rec?.amount });
                    }
                }
            }

            const totalThrInDb = await db.query(`SELECT COUNT(*) as cnt FROM employee_other_incomes WHERE income_type = 'THR' AND period_year = ? AND period_month = ?`, [year, month]);
            const totalKontanInDb = await db.query(`SELECT COUNT(*) as cnt FROM employee_other_incomes WHERE income_type IN ('KONTAN','KONTANAN') AND period_year = ? AND period_month = ?`, [year, month]);

            result.step3_thr = {
                db_total_records: totalThrInDb[0]?.cnt || 0,
                for_gang: thrRecords.length,
                matched_to_gang_employees: thrMatched,
                gang_employees_total: gangEmployees.length,
                sample: thrSample,
                status: thrMatched > 0 ? 'OK' : 'EMPTY'
            };

            result.step4_kontan = {
                db_total_records: totalKontanInDb[0]?.cnt || 0,
                for_gang: kontanRecords.length,
                matched_to_gang_employees: kontanMatched,
                gang_employees_total: gangEmployees.length,
                sample: kontanSample,
                status: kontanMatched > 0 ? 'OK' : 'EMPTY - KONTAN data not seeded'
            };

            // CONCLUSION
            const allOk = thrMatched > 0 && kontanMatched >= 0 && estateRows.length > 0;
            result.conclusion = allOk ? 'PASS' : 'PARTIAL';
            result.message = allOk
                ? `Jabatan: ${estateRows.length} records, THR: ${thrMatched}/${gangEmployees.length} employees, KONTAN: ${kontanMatched} employees`
                : `Some data is missing. Seed missing tables.`;

            return result;
        } catch (e: any) {
            console.error("[PayrollRoutes] test/jabatan-thr-kontan error:", e);
            set.status = 500;
            return { error: e.message };
        }
    }, {
        query: t.Object({
            gang_code: t.Optional(t.String()),
            month: t.Optional(t.String()),
            year: t.Optional(t.String())
        })
    })

    /**
     * Get component registry health status
     * Returns all registered components and their versions
     */
    .get("/components/registry", async () => {
        try {
            const { payrollComponentRegistry } = await import("../services/payroll");

            const health = payrollComponentRegistry.getHealthStatus();

            return health;
        } catch (e: any) {
            console.error("[PayrollRoutes] components registry error:", e);
            return { error: e.message };
        }
    })

    /**
     * Cache warming endpoint - pre-populates cache for fast subsequent requests
     * POST /api/payroll/warm-cache
     */
    .post("/warm-cache", async ({ body, set }): Promise<any> => {
        try {
            const { divisionConfigService } = await import("../services/config/DivisionConfigService");
            const { currentPeriodService } = await import("../services/currentPeriodService");
            const { cacheService } = await import("../services/cacheService");
            const { Config } = await import("../config");

            const data = body as any;
            const division = data?.division || 'ALL';
            const month = data?.month;
            const year = data?.year;

            // Get current period if not specified
            let targetMonth = month;
            let targetYear = year;
            if (!targetMonth || !targetYear) {
                const current = await currentPeriodService.getCurrentPeriod();
                targetMonth = current.month;
                targetYear = current.year;
            }

            console.log(`[CacheWarm] Starting cache warm for div=${division} month=${targetMonth} year=${targetYear}`);

            const startTime = Date.now();
            let gangsWarmed = 0;
            let employeesWarmed = 0;
            let errors = 0;

            if (division === 'ALL') {
                // Warm cache for all REAL divisions only (exclude virtual divisions)
                // Virtual divisions are derived at read time from real divisions
                const divisions = divisionConfigService.getAllDivisionCodes().filter(d => !divisionConfigService.isVirtualDivision(d));
                for (const div of divisions) {
                    try {
                        const result = await dataExtractorService.extractPayrollData(
                            targetMonth, targetYear, "ALL", div, null,
                            Config.DB_PROFILE, false, null, undefined, true, true
                        );
                        gangsWarmed++;
                        employeesWarmed += result.data_rows.length;
                    } catch (e: any) {
                        errors++;
                        console.error(`[CacheWarm] Error warming ${div}:`, e?.message || e);
                    }
                }
            } else {
                // Warm cache for specific division
                const result = await dataExtractorService.extractPayrollData(
                    targetMonth, targetYear, "ALL", division, null,
                    Config.DB_PROFILE, false, null, undefined, true, true
                );
                gangsWarmed++;
                employeesWarmed += result.data_rows.length;
            }

            const elapsed = Date.now() - startTime;
            console.log(`[CacheWarm] Complete: ${gangsWarmed} divisions, ${employeesWarmed} employees in ${elapsed}ms, errors: ${errors}`);

            return {
                success: true,
                warmed: {
                    divisions: gangsWarmed,
                    employees: employeesWarmed,
                    elapsed_ms: elapsed,
                    errors
                }
            };
        } catch (e: any) {
            console.error('[CacheWarm] Error:', e);
            set.status = 500;
            return { error: e.message };
        }
    }, {
        body: t.Object({
            division: t.Optional(t.String()),
            month: t.Optional(t.Number()),
            year: t.Optional(t.Number())
        })
    })

    /**
     * Get cache statistics
     */
    .get("/cache-stats", async (): Promise<any> => {
        const { cacheService } = await import("../services/cacheService");
        return cacheService.getStats();
    })

    // --- Premium Definitions (from JSON file) ---
    .get("/premium-definitions", async ({ set }) => {
        try {
            set.headers["Cache-Control"] = "no-store, max-age=0";
            const { premiumDefinitionService } = await import("../services/premiumDefinitionService");
            const definitions = premiumDefinitionService.getActiveDefinitions();
            return { success: true, count: definitions.length, data: definitions };
        } catch (e: any) {
            console.error("[PayrollRoutes] premium-definitions GET error:", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    })
    .post("/premium-definitions", async ({ body, set }) => {
        try {
            const { premiumDefinitionService } = await import("../services/premiumDefinitionService");
            const data = body as any;
            premiumDefinitionService.addOrUpdateDefinition({
                adjustment_type: data.adjustment_type,
                adjustment_name: data.adjustment_name,
                ad_code: data.ad_code,
                task_desc: data.task_desc,
                input_type: data.input_type,
                is_active: data.is_active ?? true
            });
            return { success: true, message: "Premium definition saved." };
        } catch (e: any) {
            console.error("[PayrollRoutes] premium-definitions POST error:", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        body: t.Object({
            adjustment_name: t.String(),
            ad_code: t.String(),
            task_desc: t.String(),
            input_type: t.String(),
            adjustment_type: t.Optional(t.String()),
            is_active: t.Optional(t.Boolean())
        })
    })
    .post("/premium-import-excel", async ({ body, query, set }) => {
        try {
            const { importPremiumExcel } = await import("../services/premiumImportService");
            const { ManualAdjustmentService } = await import("../services/manualAdjustmentService");
            const file = (body as any)?.file;
            if (!file || !file.data) {
                set.status = 400;
                return { success: false, error: "File Excel wajib diunggah." };
            }
            const buffer = Buffer.from(file.data);
            const periodMonth = Number((query as any)?.period_month);
            const periodYear = Number((query as any)?.period_year);
            const divisionCode = String((query as any)?.division_code || 'ALL');
            if (!periodMonth || !periodYear) {
                set.status = 400;
                return { success: false, error: "period_month dan period_year wajib diisi." };
            }
            const service = ManualAdjustmentService.getInstance();
            const result = await importPremiumExcel(buffer, periodMonth, periodYear, divisionCode, service);
            if (!result.success) set.status = 400;
            const { success, ...rest } = result;
            return { success, ...rest };
        } catch (e: any) {
            console.error("[PayrollRoutes] premium-import-excel error:", e);
            set.status = 500;
            return { success: false, error: e.message || "Gagal mengimpor Excel." };
        }
    })
