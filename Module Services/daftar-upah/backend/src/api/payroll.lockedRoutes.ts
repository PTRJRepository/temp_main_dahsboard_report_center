/**
 * @module backend/src/api/payroll.lockedRoutes.ts
 * @purpose Locked (authenticated) operational route group for /payroll: locked verify, raw-tree report, manual edit, income/pendapatan-lainnya edits, gang list, auto-buffer seed/validate.
 * @input Query/body: div/division_code, month, year, gang_code, nik, emp_name, period, income_type, amount; currentUser from derive (401 when absent)
 * @output JSON raw-tree report with gangs+totals, edit results { success, id/action }, gang list; 401/403 for missing or unauthorized user
 * @depends ./payroll.shared (slimEmployee, buildAutoBufferSeedEndpointResponse, getUserFromHeader), ../config#Config, ../services/gangService, ../services/dataExtractorService, ../types/user#UserRole, ../utils/queryParsers, ../utils/employeeSort#sortByEmpCode
 * @sideeffect Writes employee_other_incomes (extend_db_ptrj) on income-delete/pendapatan-lainnya-edit; manual-edit writes payroll_manual_adjustments; clears cacheService
 * @tests backend/src/api/payroll.lockedVerify.test.ts
 */
import { Elysia, t } from "elysia";
import { info, warn, error as logError } from "../utils/logger";
const CATEGORY = "PayrollLockedRoutes";
import { Config } from "../config";
import { gangService } from "../services/gangService";
import { dataExtractorService } from "../services/dataExtractorService";
import { UserRole } from "../types/user";
import { parseBooleanQueryParam, parsePositiveIntegerQueryParam } from "../utils/queryParsers";
import { sortByEmpCode } from "../utils/employeeSort";
import {
    getUserFromHeader,
    slimEmployee,
    buildAutoBufferSeedEndpointResponse
} from "./payroll.shared";

export const lockedRoutes = new Elysia()
    .derive(async ({ headers }) => {
        try {
            const user = await getUserFromHeader(headers);
            return { currentUser: user };
        } catch (e) {
            logError(CATEGORY, "[PayrollRoutes] Derive error:", e);
            return { currentUser: null };
        }
    })
    .onBeforeHandle(({ currentUser, set }) => {
        if (!currentUser) {
            set.status = 401;
            return { message: "Unauthorized" };
        }
    })
    // --- Locked: Token Verification (used by frontend verifyExternalToken) ---
    .get("/locked/verify", async ({ currentUser, set }): Promise<any> => {
        // currentUser is derived from Authorization via derive() (401 if absent).
        // Frontend lockedDivisionService.verifyExternalToken() expects { valid, ... }
        if (!currentUser) {
            set.status = 401;
            return { valid: false, message: "Unauthorized" };
        }
        const divisions = currentUser.divisions || [];
        return {
            valid: true,
            username: currentUser.username,
            role: currentUser.role,
            divisions,
            division: divisions[0] || null,
            id: currentUser.id,
            full_name: currentUser.full_name
        };
    })
    // --- Locked Report: Raw Tree (Alias for Proxy/Frontend Compat) ---
    .get("/locked/report/raw-tree", async ({ query, set, currentUser }): Promise<any> => {
        try {

            // Frontend sends 'div' instead of 'division_code' for this endpoint
            const divisionCode = query.div;
            const month = parseInt(query.month);
            const year = parseInt(query.year);
            const useHistoryDb = parseBooleanQueryParam(query.use_history);
            const snapshotVersion = parsePositiveIntegerQueryParam(query.snapshot_version);
            const valuePriorityMode = query.value_priority_mode;

            if (!divisionCode || !month || !year) {
                set.status = 400;
                return { error: "div, month, and year are required" };
            }

            // PERMISSION CHECK
            if (!currentUser) {
                set.status = 401;
                return { error: "Unauthorized" };
            }

            // PERMISSION CHECK - Enforce for KERANI
            // ADMIN = All access
            // USER = All access (Legacy behavior retained for backward compatibility if needed, or strictly enforce?)
            // KERANI = RESTRICTED to assigned divisions

            if (currentUser.role === UserRole.KERANI) {
                // Normalize requested division using divisionDefinition resolveDivisionCode
                // This handles AREC -> ARC, WORKSHOP AR -> WKS_AR, etc.
                const { divisionDefinition } = await import("../services/divisionDefinition");
                const requestedDiv = divisionDefinition.resolveDivisionCode(String(divisionCode).trim().toUpperCase());



                const hasPermission = currentUser.divisions.some(d => {
                    // Also normalize user's division using resolveDivisionCode
                    const div = divisionDefinition.resolveDivisionCode(String(d).trim().toUpperCase());
                    const match = div === requestedDiv;

                    return match;
                });

                if (!hasPermission) {
                    warn(CATEGORY, `[PayrollRoutes] KERANI ${currentUser.username} denied. Divs: ${JSON.stringify(currentUser.divisions)}, Req: ${requestedDiv}`);
                    // info(CATEGORY, `[DEBUG] permission check failed`);
                    set.status = 403;
                    return { error: `Access refused: You do not have permission for division ${divisionCode}` };
                }
            }

            /*
            if (currentUser.role !== UserRole.ADMIN) {
                info(CATEGORY, `[PayrollRoutes DEBUG Report] Permission Check for User: ${currentUser.username}, Requested: '${divisionCode}', UserDivs: ${JSON.stringify(currentUser.divisions)}`);

                // Normalize for comparison
                const requestedDiv = String(divisionCode).trim().toUpperCase();

                // Check if ANY user division (or its alias) matches the requests
                const hasPermission = currentUser.divisions.some(d => {
                    const div = String(d).trim().toUpperCase();
                    if (div === requestedDiv) return true;

                    // Helper: Convert P1A -> PG1A and vice versa via alias mapping
                    const alias = gangService.convertDivisionToLocCode(div);
                    if (alias === requestedDiv) return true;

                    return false;
                });

                if (!hasPermission) {
                    warn(CATEGORY, `[PayrollRoutes] User ${currentUser.username} attempted to access unauthorized division: ${divisionCode}`);
                    set.status = 403;
                    return { error: `Access refused: You do not have permission for division ${divisionCode}` };
                }
            */

            const includeVirtual = query.include_virtual === 'true';
            const gangPrefix = query.gang_prefix;
            const gangCode = query.gang_code || "ALL";

            // Use Config.DB_PROFILE for payroll data (main payroll database)

            // [OPTIMIZATION] Skip heavy bunches data (tandan) for the main table view
            const skipHarvest = true;

        info(CATEGORY, `[PayrollRoutes] /locked/report/raw-tree | div=${divisionCode} month=${month} year=${year} gangCode=${gangCode} gangPrefix=${gangPrefix} valuePriorityMode=${valuePriorityMode || 'non_db_ptrj'} useHistory=${useHistoryDb}`);

            const result = await dataExtractorService.extractPayrollData(
                month,
                year,
                gangCode,
                divisionCode,
                null,
                Config.DB_PROFILE,
                includeVirtual,
                useHistoryDb,
                gangPrefix,
                skipHarvest,
                false,
                snapshotVersion,
                valuePriorityMode
            );

            // [DEBUG] Log result summary
            const dataRows = sortByEmpCode(result?.data_rows || []);
            const empCount = dataRows.length;
            const uniqueGangs = new Set(dataRows.map(r => r.gang_code || "UNKNOWN"));
            const gangCount = uniqueGangs.size;
            info(CATEGORY, `[PayrollRoutes] /locked/report/raw-tree RESULT | gangs=${gangCount} employees=${empCount} | gangCode=${gangCode} | gangPrefix=${gangPrefix}`);

            // [NEW] Use centralized payrollTotalsCalculator for consistent totals
            const { calculatePayrollTotals, calculateTaxMatrixTotals, reconcileGangTotalsToGrandTotal } = await import("../services/payrollTotalsCalculator");
            const grandTotal = calculatePayrollTotals(dataRows, 'GRAND TOTAL');

            // Group by gang and calculate totals
            const gangsMap: Record<string, any[]> = {};
            for (const row of dataRows) {
                const gang = row.gang_code || "UNKNOWN";
                if (!gangsMap[gang]) gangsMap[gang] = [];
                gangsMap[gang].push(row);
            }

            // Build gangs list with pre-calculated totals
            const gangsList = Object.entries(gangsMap)
                .map(([gang_code, employees]) => ({
                    gang_code,
                    employees: employees.map(slimEmployee),  // Strip heavy arrays before sending
                    gang_totals: calculatePayrollTotals(employees, `TOTAL ${gang_code}`),  // Pre-calculated totals from FULL data
                    tax_matrix_totals: calculateTaxMatrixTotals(employees)
                }))
                .sort((a, b) => a.gang_code.localeCompare(b.gang_code));

            const reconciledGangTotals = reconcileGangTotalsToGrandTotal(
                gangsList.map((gang) => gang.gang_totals),
                grandTotal
            );
            gangsList.forEach((gang, index) => {
                gang.gang_totals = reconciledGangTotals[index];
            });



            return {
                division: divisionCode,
                month,
                year,
                gangs: gangsList,
                grand_total: grandTotal,  // Division-level totals
                tax_matrix_totals: calculateTaxMatrixTotals(dataRows),
                dynamic_premi_headers: result.dynamic_premi_headers,
                dynamic_potongan_headers: result.dynamic_potongan_headers,
                premi_title_map: result.premi_title_map,
                potongan_title_map: result.potongan_title_map,
                meta: result.meta
            };
        } catch (e: any) {
            logError(CATEGORY, "[PayrollRoutes] locked/report/raw-tree error:", e);
            set.status = String(e?.message || "").includes("Snapshot version") ? 404 : 500;
            return { error: e.message };
        }
    }, {
        query: t.Object({
            div: t.String(),
            month: t.String(),
            year: t.String(),
            include_virtual: t.Optional(t.String()),
            use_history: t.Optional(t.String()),
            gang_prefix: t.Optional(t.String()),
            gang_code: t.Optional(t.String()),
            snapshot_version: t.Optional(t.String()),
            value_priority_mode: t.Optional(t.String())
        })
    })
    // --- Locked Manual Edit ---
    .post("/locked/manual-edit", async ({ body, set, currentUser }) => {
        try {
            // PERMISSION CHECK
            if (!currentUser) {
                set.status = 401;
                return { error: "Unauthorized" };
            }

            const { manualAdjustmentService } = await import("../services/manualAdjustmentService");
            const { cacheService } = await import("../services/cacheService");
            const data = body as any;

            const username = currentUser?.username || 'system';
            const resultId = await manualAdjustmentService.saveAdjustment(data, username);

            // Always clear cache after save to ensure fresh data on next load
            // Use suffix matching because keys format is payroll_data:{gangCode}:{month}:{year}
            const pattern = `:${data.period_month}:${data.period_year}`;
            cacheService.clearByPattern(pattern);
            info(CATEGORY, `[PayrollRoutes] Cleared cache for pattern: ${pattern} after locked manual edit`);

            return { success: true, id: resultId, message: "Manual adjustment saved successfully." };
        } catch (e: any) {
            logError(CATEGORY, "[PayrollRoutes] locked/manual-edit error:", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        body: t.Object({
            period_month: t.Number(),
            period_year: t.Number(),
            nik: t.Optional(t.String()),  // Real NIK (KTP) - for PENDAPATAN_LAINNYA
            emp_code: t.String(),
            emp_name: t.Optional(t.String()),
            gang_code: t.String(),
            division_code: t.Optional(t.String()),
            adjustment_type: t.String(), // PREMI, POTONGAN_KOTOR, POTONGAN_BERSIH, PENDAPATAN_LAINNYA
            adjustment_name: t.String(),
            amount: t.Number(),
            remarks: t.Optional(t.String()),
            metadata_json: t.Optional(t.String()),
            ad_code: t.Optional(t.String()),
            task_code: t.Optional(t.String()),
            base_task_code: t.Optional(t.String()),
            task_desc: t.Optional(t.String())
        })
    })
    // --- Locked: validate premium conversion ---
    .get("/locked/manual-adjustment/validate-conversion", async ({ query, set, currentUser }) => {
        try {
            if (!currentUser) {
                set.status = 401;
                return { success: false, error: "Unauthorized" };
            }
            const { premiumDefinitionService } = await import("../services/premiumDefinitionService");
            const validation = premiumDefinitionService.validatePremiumConversion(query.from, query.to);
            return { success: true, validation };
        } catch (e: any) {
            logError(CATEGORY, "[PayrollRoutes] locked/validate-conversion error:", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        query: t.Object({
            from: t.String(),
            to: t.String()
        })
    })
    // --- Locked: convert premium type (per-column bulk) ---
    .post("/locked/manual-adjustment/convert-type", async ({ body, set, currentUser }) => {
        try {
            if (!currentUser) {
                set.status = 401;
                return { success: false, error: "Unauthorized" };
            }
            const { manualAdjustmentService } = await import("../services/manualAdjustmentService");
            const { premiumDefinitionService } = await import("../services/premiumDefinitionService");
            const validation = premiumDefinitionService.validatePremiumConversion(body.from_adjustment_name, body.to_adjustment_name);
            if (!validation.allowed) {
                set.status = 422;
                return { success: false, error: validation.reason, validation };
            }
            const { cacheService } = await import("../services/cacheService");
            const result = await manualAdjustmentService.convertAdjustmentType({
                ...body,
                updated_by: currentUser?.username || "system"
            });
            cacheService.clearByPattern(`:${body.period_month}:${body.period_year}`);
            return { success: true, ...result };
        } catch (e: any) {
            logError(CATEGORY, "[PayrollRoutes] locked/convert-type error:", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        body: t.Object({
            period_month: t.Number(),
            period_year: t.Number(),
            division_code: t.Optional(t.String()),
            adjustment_type: t.String(),
            from_adjustment_name: t.String(),
            to_adjustment_name: t.String()
        })
    })
    .delete("/locked/manual-adjustment/column", async ({ query, set, currentUser }) => {
        try {
            if (!currentUser) {
                set.status = 401;
                return { success: false, error: "Unauthorized" };
            }

            const periodMonth = Number(query.period_month);
            const periodYear = Number(query.period_year);
            if (!Number.isInteger(periodMonth) || periodMonth < 1 || periodMonth > 12) {
                set.status = 400;
                return { success: false, error: "period_month tidak valid" };
            }
            if (!Number.isInteger(periodYear) || periodYear < 2000) {
                set.status = 400;
                return { success: false, error: "period_year tidak valid" };
            }

            const { manualAdjustmentService } = await import("../services/manualAdjustmentService");
            const { cacheService } = await import("../services/cacheService");
            const deletedCount = await manualAdjustmentService.deleteAdjustmentColumn({
                period_month: periodMonth,
                period_year: periodYear,
                division_code: query.division_code || undefined,
                adjustment_type: query.adjustment_type,
                adjustment_name: query.adjustment_name
            });

            cacheService.clearByPattern(`:${periodMonth}:${periodYear}`);
            return { success: true, deleted_count: deletedCount, message: "Manual adjustment column deleted successfully." };
        } catch (e: any) {
            logError(CATEGORY, "[PayrollRoutes] locked/manual-adjustment column DELETE error:", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        query: t.Object({
            period_month: t.String(),
            period_year: t.String(),
            division_code: t.Optional(t.String()),
            adjustment_type: t.String(),
            adjustment_name: t.String()
        })
    })
    // --- Explicit Strict Income Deletion (Kontan/THR) ---
    .post("/locked/income-delete", async ({ body, set, currentUser }) => {
        try {
            if (!currentUser) { set.status = 401; return { error: "Unauthorized" }; }
            const { Database } = await import("../db/client");
            const { cacheService } = await import("../services/cacheService");
            const data = body as any;
            const db = Database.getExtendedInstance();
            
            const incomeType = String(data.income_type || '').toUpperCase().trim();
            const realNik = (data.nik || '').trim();
            
            if (!incomeType || !realNik || !data.period_month || !data.period_year) {
                set.status = 400; return { error: "income_type, nik, period_month, period_year required" };
            }

            // Strictly delete ONLY this income type for this employee
            await db.query(`
                DELETE FROM employee_other_incomes 
                WHERE nik = ? AND period_month = ? AND period_year = ? AND income_type = ?
            `, [realNik, data.period_month, data.period_year, incomeType]);
            
            const pattern = `:${data.period_month}:${data.period_year}`;
            cacheService.clearByPattern(pattern);
            info(CATEGORY, `[PayrollRoutes] Cleared cache for pattern: ${pattern} after income delete`);

            return { success: true, message: `${incomeType} deleted successfully for NIK ${realNik}` };
        } catch (e: any) {
            set.status = 500; return { success: false, error: e.message };
        }
    }, {
        body: t.Object({
            nik: t.String(),
            period_month: t.Number(),
            period_year: t.Number(),
            income_type: t.String()
        })
    })
    // --- Locked Pendapatan Lainnya Edit (Generic: Kontanan, Insentif, etc.) ---
    .post("/locked/pendapatan-lainnya-edit", async ({ body, set, currentUser }) => {
        try {
            if (!currentUser) {
                set.status = 401;
                return { error: "Unauthorized" };
            }

            const { Database } = await import("../db/client");
            const { cacheService } = await import("../services/cacheService");
            const data = body as any;

            const db = Database.getExtendedInstance();
            const parsedAmount = parseFloat(data.amount?.toString()) || 0;
            const incomeType = String(data.income_type || '').toUpperCase().trim().replace(/\s+/g, '_');
            const incomeName = String(data.income_name || data.income_type || '').trim();

            if (!incomeType) {
                set.status = 400;
                return { error: "income_type is required" };
            }

            // Look for existing record for this NIK + emp_name + income_type in this period
            // Using NIK + emp_name to disambiguate employees that may share the same NIK
            const existing = await db.query(`
                SELECT id FROM employee_other_incomes 
                WHERE nik = ? AND emp_name = ? AND period_year = ? AND period_month = ? AND income_type = ?
            `, [data.nik, data.emp_name, data.period_year, data.period_month, incomeType]);

            const clearPeriodCache = () => {
                const pattern = `payroll_data:${data.period_month}:${data.period_year}`;
                cacheService.clearByPattern(pattern);
                info(CATEGORY, `[PayrollRoutes] Cleared cache for pattern: ${pattern} after saving ${incomeType}`);
            };

            if (existing && existing.length > 0) {
                if (parsedAmount === 0) {
                    await db.query(`DELETE FROM employee_other_incomes WHERE id = ?`, [existing[0].id]);
                    clearPeriodCache();
                    return { success: true, action: 'deleted', message: `${incomeName} removed.` };
                } else {
                    await db.query(`
                        UPDATE employee_other_incomes 
                        SET amount = ?, emp_name = ?, gang_code = ?, division_code = ?, income_name = ?, updated_at = GETDATE()
                        WHERE id = ?
                    `, [parsedAmount, data.emp_name, data.gang_code, data.division_code || null, incomeName, existing[0].id]);
                    clearPeriodCache();
                    return { success: true, action: 'updated', id: existing[0].id, message: `${incomeName} updated.` };
                }
            } else {
                if (parsedAmount === 0) {
                    return { success: true, action: 'skipped', message: "Zero amount, nothing saved." };
                }
                await db.query(`
                    INSERT INTO employee_other_incomes (
                        nik, emp_name, division_code, gang_code, period_year, period_month,
                        income_type, income_name, amount, is_paid_in_thp, is_taxable
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
                `, [data.nik, data.emp_name, data.division_code || null, data.gang_code, data.period_year, data.period_month, incomeType, incomeName, parsedAmount]);
                clearPeriodCache();
                return { success: true, action: 'inserted', message: `${incomeName} saved.` };
            }
        } catch (e: any) {
            logError(CATEGORY, "[PayrollRoutes] locked/pendapatan-lainnya-edit error:", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        body: t.Object({
            nik: t.String(),
            emp_name: t.String(),
            period_month: t.Number(),
            period_year: t.Number(),
            amount: t.Number(),
            gang_code: t.String(),
            division_code: t.Optional(t.String()),
            income_type: t.String(),
            income_name: t.Optional(t.String())
        })
    })
    // --- Locked Pendapatan Lainnya Custom Types ---
    .get("/locked/pendapatan-lainnya-types", async ({ query, set, currentUser }): Promise<any> => {
        try {
            if (!currentUser) {
                set.status = 401;
                return { error: "Unauthorized" };
            }

            const { Database } = await import("../db/client");
            const db = Database.getExtendedInstance();
            const month = parseInt(query.month as string) || new Date().getMonth() + 1;
            const year = parseInt(query.year as string) || new Date().getFullYear();

            // Fetch distinct custom income types for this period
            // Exclude standard types (THR, BONUS, CUSTOM) that come from the OtherIncomes bulk system
            const rows = await db.query<{ income_type: string; income_name: string }>(`
                SELECT DISTINCT income_type, income_name 
                FROM employee_other_incomes
                WHERE period_year = ? AND period_month = ?
                  AND income_type NOT IN ('THR', 'BONUS', 'CUSTOM')
                ORDER BY income_type
            `, [year, month]);

            const types = rows.map(r => ({
                type: r.income_type,
                name: r.income_name || r.income_type
            }));

            return { success: true, types };
        } catch (e: any) {
            logError(CATEGORY, "[PayrollRoutes] pendapatan-lainnya-types error:", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    })
    // --- Locked Gangs List ---
    .get("/locked/gangs", async ({ query, set, currentUser }): Promise<any> => {
        try {
            // Frontend service likely sends 'div' based on previous pattern, 
            // but let's support 'division' too just in case.
            const divisionCode = query.div || query.division;

            if (!divisionCode) {
                set.status = 400;
                return { error: "Division code is required" };
            }

            // PERMISSION CHECK - RELAXED TO MATCH PYTHON BACKEND
            if (!currentUser) {
                set.status = 401;
                return { error: "Unauthorized" };
            }

            // PERMISSION CHECK - Enforce for KERANI
            // The Python backend (payroll_locked.py) does NOT check if the user has the division in their token.
            // However, for KERANI, we need to be STRICT.

            if (currentUser.role === UserRole.KERANI) {
                // Normalize requested division using divisionDefinition resolveDivisionCode
                // This handles AREC -> ARC, WORKSHOP AR -> WKS_AR, etc.
                const { divisionDefinition } = await import("../services/divisionDefinition");
                const requestedDiv = divisionDefinition.resolveDivisionCode(String(divisionCode).trim().toUpperCase());



                const hasPermission = currentUser.divisions.some(d => {
                    // Also normalize user's division using resolveDivisionCode
                    const div = divisionDefinition.resolveDivisionCode(String(d).trim().toUpperCase());
                    const match = div === requestedDiv;

                    return match;
                });

                if (!hasPermission) {
                    warn(CATEGORY, `[PayrollRoutes] KERANI ${currentUser.username} attempted to access unauthorized gangs for division: ${divisionCode}`);
                    set.status = 403;
                    return { error: `Access denied. You have ${JSON.stringify(currentUser.divisions)}, but requested ${divisionCode}` };
                }
            }

            /*
            if (currentUser.role !== UserRole.ADMIN) {
                info(CATEGORY, `[PayrollRoutes DEBUG] Permission Check for User: ${currentUser.username}, Requested: '${divisionCode}', UserDivs: ${JSON.stringify(currentUser.divisions)}`);
     
                // Normalize for comparison
                const requestedDiv = String(divisionCode).trim().toUpperCase();
     
                // Check if ANY user division (or its alias) matches the requests
                // This handles P1A vs PG1A mismatches
                const hasPermission = currentUser.divisions.some(d => {
                    const div = String(d).trim().toUpperCase();
                    if (div === requestedDiv) return true;
     
                    // Helper: Convert P1A -> PG1A and vice versa is tricky if GangService only does one way.
                    // But GangService has convertDivisionToLocCode (PG1A -> P1A).
                    // So if User has PG1A, convert to P1A and check.
                    const alias = gangService.convertDivisionToLocCode(div);
                    if (alias === requestedDiv) return true;
     
                    return false;
                });
     
                if (!hasPermission) {
                    warn(CATEGORY, `[PayrollRoutes] User ${currentUser.username} attempted to access unauthorized gangs for division: ${divisionCode}`);
                    set.status = 403;
                    return { error: `Access denied. You have ${JSON.stringify(currentUser.divisions)}, but requested ${divisionCode}` };
                }
            }
            */

            const gangs = await gangService.fetchGangs(divisionCode);
            return gangs;
        } catch (e: any) {
            logError(CATEGORY, "[PayrollRoutes] locked/gangs error:", e);
            set.status = 500;
            return { error: e.message };
        }
    }, {
        query: t.Object({
            div: t.Optional(t.String()),
            division: t.Optional(t.String())
        })
    })
    .post("/locked/manual-adjustment/seed-auto-buffer", async ({ body, set, currentUser }) => {
        try {
            const { autoBufferManualAdjustmentSeederService } = await import("../services/autoBufferManualAdjustmentSeederService");
            const { cacheService } = await import("../services/cacheService");
            const payload = body as any;

            const result = await autoBufferManualAdjustmentSeederService.seedPeriod({
                period_month: payload.period_month,
                period_year: payload.period_year,
                division_code: payload.division_code,
                gang_code: payload.gang_code,
                use_history_db: payload.use_history_db,
                snapshot_version: payload.snapshot_version,
                replace_existing: payload.replace_existing,
                value_priority_mode: payload.value_priority_mode,
                created_by: currentUser?.username || "system"
            });

            const pattern = `:${payload.period_month}:${payload.period_year}`;
            cacheService.clearByPattern(pattern);

            return buildAutoBufferSeedEndpointResponse(result);
        } catch (e: any) {
            logError(CATEGORY, "[PayrollRoutes] locked/manual-adjustment/seed-auto-buffer error:", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        body: t.Object({
            period_month: t.Number(),
            period_year: t.Number(),
            division_code: t.String(),
            gang_code: t.Optional(t.String()),
            use_history_db: t.Optional(t.Boolean()),
            snapshot_version: t.Optional(t.Number()),
            replace_existing: t.Optional(t.Boolean()),
            value_priority_mode: t.Optional(t.String())
        })
    })
    .post("/locked/manual-adjustment/auto-buffer-validate", async ({ body, set, currentUser }) => {
        try {
            const { autoBufferManualAdjustmentSeederService } = await import("../services/autoBufferManualAdjustmentSeederService");
            const payload = body as any;

            const result = await autoBufferManualAdjustmentSeederService.validatePeriod({
                period_month: payload.period_month,
                period_year: payload.period_year,
                division_code: payload.division_code,
                gang_code: payload.gang_code,
                created_by: currentUser?.username || "system"
            });

            return {
                success: true,
                message: "Auto buffer validation completed",
                data: result
            };
        } catch (e: any) {
            logError(CATEGORY, "[PayrollRoutes] locked/manual-adjustment/auto-buffer-validate error:", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        body: t.Object({
            period_month: t.Number(),
            period_year: t.Number(),
            division_code: t.String(),
            gang_code: t.Optional(t.String())
        })
    })

