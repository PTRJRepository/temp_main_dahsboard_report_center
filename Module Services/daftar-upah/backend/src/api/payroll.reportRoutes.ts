/**
 * @module backend/src/api/payroll.reportRoutes.ts
 * @purpose Payroll report route group for /payroll: division-raw-tree (+SSE stream), report, report-with-components, employee components, gang-payroll-summary, export/pajak.
 * @input Query: division_code/div, month, year, gang_code, gang_prefix, use_history, snapshot_version, value_priority_mode; SSE stream endpoint requires currentUser
 * @output JSON report { gangs[], grand_total, dynamic_premi/potongan_headers, meta } / component detail / pajak export JSON attachment; SSE events meta/progress/gang/gang_update/headers/complete/error
 * @depends ./payroll.shared (slimEmployee, sortedSlimStreamEmployees, getUserFromHeader), ../config#Config, ../services/dataExtractorService, ../services/taxReportService, ../types/user#UserRole, ../utils/queryParsers, ../utils/employeeSort#sortByEmpCode
 * @sideeffect None (read-only reports); SSE stream holds long-lived connection
 * @tests none — report endpoints exercised manually / via frontend (no dedicated test file)
 */
import { Elysia, t } from "elysia";
import { Config } from "../config";
import { dataExtractorService } from "../services/dataExtractorService";
import { taxReportService } from "../services/taxReportService";
import { UserRole } from "../types/user";
import { parseBooleanQueryParam, parsePositiveIntegerQueryParam } from "../utils/queryParsers";
import { sortByEmpCode } from "../utils/employeeSort";
import {
    getUserFromHeader,
    slimEmployee,
    sortedSlimStreamEmployees
} from "./payroll.shared";

export const reportRoutes = new Elysia()
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
    // --- Report: Division Raw Tree ---
    .get("/report/division-raw-tree", async ({ query, set }): Promise<any> => {
        try {

            const divisionCode = query.division_code;
            const month = parseInt(query.month);
            const year = parseInt(query.year);
            const useHistoryDb = parseBooleanQueryParam(query.use_history) ?? false;
            const gangPrefix = query.gang_prefix;
            const snapshotVersion = parsePositiveIntegerQueryParam(query.snapshot_version);
            const valuePriorityMode = query.value_priority_mode;

            if (!divisionCode || !month || !year) {
                set.status = 400;
                return { error: "division_code, month, and year are required" };
            }

            // [OPTIMIZATION] The user explicitly requested to skip heavy bunches data (tandan) for the main table view
            const skipHarvest = true;

            // [DEBUG] Log input parameters
            console.log(`[PayrollRoutes] /report/division-raw-tree | div=${divisionCode} month=${month} year=${year} gangPrefix=${gangPrefix || 'none'} valuePriorityMode=${valuePriorityMode || 'non_db_ptrj'} DB_PROFILE=${Config.DB_PROFILE} useHistory=${useHistoryDb} RUN_MODE=${Config.RUN_MODE}`);

            const result = await dataExtractorService.extractPayrollData(
                month,
                year,
                "ALL",
                divisionCode,
                null,
                Config.DB_PROFILE,
                false,
                useHistoryDb,
                gangPrefix,
                skipHarvest,
                false,
                snapshotVersion,
                valuePriorityMode
            );

            // [DEBUG] Log result summary
            const dataRows = sortByEmpCode(result.data_rows);
            const uniqueGangs = new Set(dataRows.map(r => r.gang_code || "UNKNOWN"));
            console.log(`[PayrollRoutes] /report/division-raw-tree RESULT | data_rows=${dataRows.length} gangs=${uniqueGangs.size} | gangPrefix=${gangPrefix}`);

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

            console.log(`[PayrollRoutes] division-raw-tree: division=${divisionCode}, month=${month}, year=${year}, gangPrefix=${gangPrefix || 'none'}`);
            console.log(`[PayrollRoutes] division-raw-tree: data_rows count=${dataRows.length}, gangs count=${Object.keys(gangsMap).length}`);
            console.log(`[PayrollRoutes] division-raw-tree: dynamic_premi=${result.dynamic_premi_headers?.length || 0}, dynamic_pot=${result.dynamic_potongan_headers?.length || 0}`);

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

            const response = {
                division: divisionCode,
                month,
                year,
                gangs: gangsList,
                grand_total: grandTotal,  // Division-level totals
                tax_matrix_totals: calculateTaxMatrixTotals(dataRows),
                dynamic_premi_headers: result.dynamic_premi_headers || [],
                dynamic_potongan_headers: result.dynamic_potongan_headers || [],
                premi_title_map: result.premi_title_map || {},
                potongan_title_map: result.potongan_title_map || {},
                meta: result.meta || {}
            };

            console.log(`[PayrollRoutes] division-raw-tree: returning response with ${gangsList.length} gangs`);
            return response;
        } catch (e: any) {
            console.error("[PayrollRoutes] division-raw-tree error:", e);
            set.status = String(e?.message || "").includes("Snapshot version") ? 404 : 500;
            return { error: e.message };
        }
    }, {
        query: t.Object({
            division_code: t.String(),
            month: t.String(),
            year: t.String(),
            use_history: t.Optional(t.String()),
            gang_prefix: t.Optional(t.String()),
            snapshot_version: t.Optional(t.String()),
            value_priority_mode: t.Optional(t.String())
        })
    })
    // --- Report: Gang Grid ---
    .get("/report", async ({ query, set }): Promise<any> => {
        try {
            const { calculatePayrollTotals, reconcileGangTotalsToGrandTotal } = await import("../services/payrollTotalsCalculator");

            const gangCode = query.gang_code || "ALL";
            const month = parseInt(query.month || String(new Date().getMonth() + 1));
            const year = parseInt(query.year || String(new Date().getFullYear()));
            const useHistoryDb = parseBooleanQueryParam(query.use_history);
            const gangPrefix = query.gang_prefix;
            const serverProfile = query.server_profile || Config.DB_PROFILE;
            const skipHeavyDetails = query.summary_only === 'true';
            const snapshotVersion = parsePositiveIntegerQueryParam(query.snapshot_version);

            // Use provided serverProfile or default to Config.DB_PROFILE
            const result = await dataExtractorService.extractPayrollData(month, year, gangCode, undefined, null, serverProfile, false, useHistoryDb, gangPrefix, false, skipHeavyDetails, snapshotVersion);

            // [NEW] Calculate totals on backend to replace frontend calculation
            // Group data by gang_code
            const gangsMap: Record<string, any[]> = {};
            const dataRows = sortByEmpCode(result.data_rows);

            dataRows.forEach((row: any) => {
                const gang = row.gang_code || "UNKNOWN";
                if (!gangsMap[gang]) gangsMap[gang] = [];
                gangsMap[gang].push(row);
            });

            // Calculate gang totals
            const gangsList = Object.entries(gangsMap).map(([gang_code, employees]) => ({
                gang_code,
                employees,
                gang_totals: calculatePayrollTotals(employees, `TOTAL ${gang_code}`)
            }));

            const grandTotal = calculatePayrollTotals(dataRows, 'GRAND TOTAL');
            const reconciledGangTotals = reconcileGangTotalsToGrandTotal(
                gangsList.map((gang) => gang.gang_totals),
                grandTotal
            );
            gangsList.forEach((gang, index) => {
                gang.gang_totals = reconciledGangTotals[index];
            });

            return {
                gang_code: gangCode,
                month,
                year,
                data: dataRows,
                gangs: gangsList,
                grand_total: grandTotal,
                dynamic_premi_headers: result.dynamic_premi_headers,
                dynamic_potongan_headers: result.dynamic_potongan_headers,
                meta: result.meta
            };
        } catch (e: any) {
            console.error("[PayrollRoutes] report error:", e);
            set.status = String(e?.message || "").includes("Snapshot version") ? 404 : 500;
            return { error: e.message };
        }
    }, {
        query: t.Object({
            gang_code: t.Optional(t.String()),
            month: t.Optional(t.String()),
            year: t.Optional(t.String()),
            skip: t.Optional(t.String()),
            limit: t.Optional(t.String()),
            use_history: t.Optional(t.String()),
            gang_prefix: t.Optional(t.String()),
            server_profile: t.Optional(t.String()),
            summary_only: t.Optional(t.String()),
            snapshot_version: t.Optional(t.String())
        })
    })
    // =========================================================================
    // NEW COMPONENT ARCHITECTURE ENDPOINTS
    // These endpoints expose the new unified component services with metadata
    // =========================================================================

    /**
     * Get payroll report with full component metadata
     * This endpoint demonstrates the new architecture where all calculations
     * return PayrollComponent with traceable metadata
     */
    .get("/report-with-components", async ({ query, set }): Promise<any> => {
        try {

            const gangCode = query.gang_code || "ALL";
            const month = parseInt(query.month || String(new Date().getMonth() + 1));
            const year = parseInt(query.year || String(new Date().getFullYear()));
            const useHistoryDb = parseBooleanQueryParam(query.use_history);

            // Use new component-based extraction method
            const result = await dataExtractorService.extractPayrollDataWithComponents(month, year, gangCode, undefined, null, Config.DB_PROFILE, useHistoryDb);

            return {
                gang_code: gangCode,
                month,
                year,
                data: sortByEmpCode(result.data_rows),
                components: result.components,  // All component data with metadata
                meta: result.meta
            };
        } catch (e: any) {
            console.error("[PayrollRoutes] report-with-components error:", e);
            set.status = 500;
            return { error: e.message };
        }
    }, {
        query: t.Object({
            gang_code: t.Optional(t.String()),
            month: t.Optional(t.String()),
            year: t.Optional(t.String()),
            use_history: t.Optional(t.String())
        })
    })

    /**
     * Get detailed component breakdown for a single employee
     * Returns all calculations with full metadata traceability
     */
    .get("/employee/:emp_code/components", async ({ params, query, set }): Promise<any> => {
        try {

            const empCode = params.emp_code;
            const month = parseInt(query.month || String(new Date().getMonth() + 1));
            const year = parseInt(query.year || String(new Date().getFullYear()));

            const result = await dataExtractorService.getEmployeeComponentDetails(empCode, month, year, Config.DB_PROFILE);

            return result;
        } catch (e: any) {
            console.error("[PayrollRoutes] employee components error:", e);
            set.status = 500;
            return { error: e.message };
        }
    }, {
        params: t.Object({
            emp_code: t.String()
        }),
        query: t.Object({
            month: t.Optional(t.String()),
            year: t.Optional(t.String())
        })
    })
    // Progressive streaming endpoint - uses SSE to stream data progressively
    // Falls back to standard fetch if SSE not supported
    .get("/report/division-raw-tree/stream", async ({ headers, query, set, currentUser }): Promise<any> => {
        const user = currentUser;
        if (!user) {
            set.status = 401;
            return { error: "Unauthorized" };
        }

        const divisionCode = query.division_code;
        const month = parseInt(query.month);
        const year = parseInt(query.year);
        const gangPrefix = query.gang_prefix;
        const gangCode = query.gang_code || "ALL";
        const useHistoryDb = parseBooleanQueryParam(query.use_history as string | undefined) ?? false;
        const snapshotVersion = parsePositiveIntegerQueryParam(query.snapshot_version as string | undefined);
        const valuePriorityMode = query.value_priority_mode as string | undefined;

        if (!divisionCode || !month || !year) {
            set.status = 400;
            return { error: "division_code, month, and year are required" };
        }

        // Permission check - Use NORMALIZED division check like non-SSE endpoints
        if (user && user.role !== UserRole.ADMIN) {
            const { divisionDefinition } = await import("../services/divisionDefinition");
            const requestedDiv = divisionDefinition.resolveDivisionCode(String(divisionCode).trim().toUpperCase());

            const hasPermission = user.divisions.some(d => {
                const div = divisionDefinition.resolveDivisionCode(String(d).trim().toUpperCase());
                return div === requestedDiv;
            });

            if (!hasPermission) {
                console.warn(`[Stream] KERANI/USER ${user.username} denied. Divs: ${JSON.stringify(user.divisions)}, Req: ${requestedDiv}`);
                set.status = 403;
                return { error: "Division not accessible" };
            }
        }

        console.log(`[Stream] Starting progressive | div=${divisionCode} month=${month} year=${year} gangCode=${gangCode} valuePriorityMode=${valuePriorityMode || 'non_db_ptrj'} useHistory=${useHistoryDb}`);

        const encoder = new TextEncoder();
        let cancelled = false;

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    // Import services
                    const { Config } = await import("../config");
                    const { calculatePayrollTotals, reconcileGangTotalsToGrandTotal } = await import("../services/payrollTotalsCalculator");

                    // Send initial progress
                    controller.enqueue(encoder.encode(`event: progress\ndata: ${JSON.stringify({
                        stage: 'connecting',
                        message: 'Menghubungi server...',
                        processed_gangs: 0,
                        total_gangs: 0
                    })}\n\n`));

                    // Use TRUE lazy loading extraction - yields data in phases
                    const progressiveStream = dataExtractorService.extractPayrollDataProgressive(
                        month, year, gangCode, divisionCode,
                        Config.DB_PROFILE, gangPrefix, useHistoryDb, snapshotVersion, valuePriorityMode
                    );

                    let gangIndex = 0;
                    const gangOrder: string[] = [];
                    let lastMeta: any = null;
                    let lastPhase = '';
                    const streamStartTime = Date.now();

                    const allDynamicPremiHeaders = new Set<string>();
                    const allDynamicPotonganHeaders = new Set<string>();
                    let globalPremiTitleMap: Record<string, string> = {};
                    let globalPotonganTitleMap: Record<string, string> = {};

                    let streamComplete = false;

                    for await (const chunk of progressiveStream) {
                        if (cancelled) break;

                        const { phase, gangs, current_gang, meta, dynamic_premi_headers, dynamic_potongan_headers, dynamic_premi_titles, dynamic_potongan_titles } = chunk;

                        // Track gang order from identity phase
                        if (phase === 'identity' && gangOrder.length === 0) {
                            gangOrder.push(...Array.from(gangs.keys()).sort());
                        }

                        // Update dynamic headers as they arrive
                        if (dynamic_premi_headers) {
                            dynamic_premi_headers.forEach(h => allDynamicPremiHeaders.add(h));
                        }
                        if (dynamic_potongan_headers) {
                            dynamic_potongan_headers.forEach(h => allDynamicPotonganHeaders.add(h));
                        }
                        if (dynamic_premi_titles) {
                            Object.assign(globalPremiTitleMap, dynamic_premi_titles);
                        }
                        if (dynamic_potongan_titles) {
                            Object.assign(globalPotonganTitleMap, dynamic_potongan_titles);
                        }

                        if (phase !== lastPhase) {
                            console.log(`[Stream] Phase ${phase}: ${meta.message}`);
                            lastPhase = phase;
                        }

                        lastMeta = meta;

                        // Phase 0: Identity (names only)
                        if (phase === 'identity') {
                            controller.enqueue(encoder.encode(`event: meta\ndata: ${JSON.stringify({
                                division: divisionCode,
                                month,
                                year,
                                total_gangs: meta.total_gangs,
                                total_employees: meta.total_employees,
                                dynamic_premi_headers: [],
                                dynamic_potongan_headers: [],
                                stage: 'identity',
                                query_time_ms: 0
                            })}\n\n`));

                            // Send all gangs with names only
                            for (const [gangCodeKey, employees] of gangs) {
                                const idx = gangOrder.indexOf(gangCodeKey);
                                const slimEmployees = sortedSlimStreamEmployees(employees);

                                controller.enqueue(encoder.encode(`event: gang\ndata: ${JSON.stringify({
                                    gang_code: gangCodeKey,
                                    employees: slimEmployees,
                                    gang_index: idx >= 0 ? idx : gangIndex++,
                                    employees_count: slimEmployees.length,
                                    phase: 'identity',
                                    is_complete: false
                                })}\n\n`));
                            }

                            controller.enqueue(encoder.encode(`event: progress\ndata: ${JSON.stringify({
                                stage: 'identity_loaded',
                                message: meta.message,
                                processed_gangs: meta.total_gangs,
                                total_gangs: meta.total_gangs,
                                progress_pct: meta.progress_pct
                            })}\n\n`));
                        }

                        // Phase 1-3: Progressive enrichment
                        if (phase === 'attendance' || phase === 'overtime' || phase === 'premium') {
                            const stageMap: Record<string, string> = {
                                'attendance': 'attendance_loaded',
                                'overtime': 'overtime_loaded',
                                'premium': 'premium_loaded'
                            };

                            // Send updated gangs
                            for (const [gangCodeKey, employees] of gangs) {
                                const idx = gangOrder.indexOf(gangCodeKey);
                                const slimEmployees = sortedSlimStreamEmployees(employees);

                                controller.enqueue(encoder.encode(`event: gang_update\ndata: ${JSON.stringify({
                                    gang_code: gangCodeKey,
                                    employees: slimEmployees,
                                    gang_index: idx,
                                    phase: phase,
                                    is_complete: false
                                })}\n\n`));
                            }

                            controller.enqueue(encoder.encode(`event: progress\ndata: ${JSON.stringify({
                                stage: stageMap[phase] || 'loading',
                                message: meta.message,
                                processed_gangs: meta.total_gangs,
                                total_gangs: meta.total_gangs,
                                progress_pct: meta.progress_pct
                            })}\n\n`));
                        }

                        // Complete phase
                        if (phase === 'complete') {
                            console.log(`[Stream] ✅ Complete: ${meta.message}`);

                            const completedGangPayloads = Array.from(gangs.entries()).map(([gangCodeKey, employees]) => ({
                                gangCodeKey,
                                employees,
                                gangTotals: null as any
                            }));

                            completedGangPayloads.forEach((gang) => {
                                gang.gangTotals = calculatePayrollTotals(gang.employees, `TOTAL ${gang.gangCodeKey}`);
                            });

                            const grandTotal = calculatePayrollTotals(
                                completedGangPayloads.flatMap((gang) => gang.employees),
                                "GRAND TOTAL"
                            );
                            const reconciledGangTotals = reconcileGangTotalsToGrandTotal(
                                completedGangPayloads.map((gang) => gang.gangTotals),
                                grandTotal
                            );
                            completedGangPayloads.forEach((gang, index) => {
                                gang.gangTotals = reconciledGangTotals[index];
                            });

                            // Send final filtered & sorted gangs with gang_totals
                            for (const { gangCodeKey, employees, gangTotals } of completedGangPayloads) {
                                const idx = gangOrder.indexOf(gangCodeKey);
                                const slimEmployees = sortedSlimStreamEmployees(employees);

                                controller.enqueue(encoder.encode(`event: gang\ndata: ${JSON.stringify({
                                    gang_code: gangCodeKey,
                                    employees: slimEmployees,
                                    gang_index: idx >= 0 ? idx : gangIndex++,
                                    employees_count: slimEmployees.length,
                                    gang_totals: gangTotals,
                                    phase: 'complete',
                                    is_complete: true
                                })}\n\n`));
                            }

                            controller.enqueue(encoder.encode(`event: progress\ndata: ${JSON.stringify({
                                stage: 'complete',
                                message: meta.message,
                                total_gangs: meta.total_gangs,
                                progress_pct: 100
                            })}\n\n`));

                            // Send final headers
                            controller.enqueue(encoder.encode(`event: headers\ndata: ${JSON.stringify({
                                dynamic_premi_headers: Array.from(allDynamicPremiHeaders),
                                dynamic_potongan_headers: Array.from(allDynamicPotonganHeaders),
                                dynamic_premi_titles: globalPremiTitleMap,
                                dynamic_potongan_titles: globalPotonganTitleMap,
                                snapshot_version: meta.snapshot_version ?? null,
                                requested_snapshot_version: meta.requested_snapshot_version ?? null,
                                available_snapshot_versions: meta.available_snapshot_versions ?? [],
                                is_history_snapshot: meta.is_history_snapshot ?? false
                            })}\n\n`));

                            controller.enqueue(encoder.encode(`event: complete\ndata: ${JSON.stringify({
                                message: meta.message,
                                grand_total: grandTotal,
                                total_execution_ms: Date.now() - streamStartTime,
                                total_gangs: meta.total_gangs,
                                total_employees: meta.total_employees,
                                gangs_count: meta.total_gangs,
                                employees_count: meta.total_employees
                            })}\n\n`));

                            streamComplete = true;
                        }
                    }

                    // Only close controller after the stream has truly finished
                    if (streamComplete) {
                        controller.close();
                    }

                } catch (e: any) {
                    console.error('[Stream] Error:', e);
                    try {
                        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: e.message })}\n\n`));
                        controller.close();
                    } catch {}
                }
            },
            cancel() {
                cancelled = true;
            }
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
                "Access-Control-Allow-Origin": "*",
            }
        });
    }, {
        query: t.Object({
            division_code: t.String(),
            month: t.String(),
            year: t.String(),
            gang_prefix: t.Optional(t.String()),
            gang_code: t.Optional(t.String()),
            use_history: t.Optional(t.String()),
            snapshot_version: t.Optional(t.String()),
            value_priority_mode: t.Optional(t.String())
        })
    })
    /**
     * Gang Payroll Summary - used by GangAttendanceMatrix to show money columns
     * Returns: emp_code, jumlah_upah_kotor, koreksi_hk, pot_koreksi, pph21_ter, upah_bersih
     * Source: db_ptrj via dataExtractorService (same data source as the main payroll table)
     */
    .get("/gang-payroll-summary", async ({ query, set }): Promise<any> => {
        try {
            const month = parseInt(query.month);
            const year = parseInt(query.year);
            const gangCodes = (query.gang_codes || '').split(',').map((c: string) => c.trim()).filter(Boolean);

            if (!month || !year || gangCodes.length === 0) {
                set.status = 400;
                return { error: "month, year, and gang_codes are required" };
            }

            // Use dataExtractorService which queries db_ptrj
            // Extract payroll data for ALL gangs, then filter by requested gangCodes
            const skipHarvest = true;
            const result = await dataExtractorService.extractPayrollData(
                month, year, "ALL", undefined, null, Config.DB_PROFILE, false, null, undefined, skipHarvest
            );

            // Filter to only the requested gang codes and extract summary fields
            const gangCodesSet = new Set(gangCodes.map((c: string) => c.trim().toUpperCase()));
            const data = sortByEmpCode(result.data_rows
                .filter((row: any) => gangCodesSet.has((row.gang_code || '').trim().toUpperCase()))
                .map((row: any) => ({
                    emp_code: (row.emp_code || row.nik || '').trim(),
                    gang_code: (row.gang_code || '').trim(),
                    jumlah_upah_kotor: Number(row.jumlah_upah_kotor) || 0,
                    koreksi_hk: Number(row.koreksi_hk) || 0,
                    pot_koreksi: Number(row.pot_koreksi) || 0,
                    pph21_ter: Number(row.pph21_ter || row.pot_pph21) || 0,
                    upah_bersih: Number(row.upah_bersih) || 0,
                    gaji_pokok_aktual: Number(row.gaji_pokok_aktual) || 0,
                    total_tunjangan: Number(row.total_tunjangan) || 0,
                    total_premi: Number(row.total_premi) || 0,
                })));

            return {
                data,
                meta: {
                    month,
                    year,
                    total_employees: data.length,
                    gang_codes: gangCodes
                }
            };
        } catch (e: any) {
            console.error("[PayrollRoutes] gang-payroll-summary error:", e);
            set.status = 500;
            return { error: e.message };
        }
    }, {
        query: t.Object({
            month: t.String(),
            year: t.String(),
            gang_codes: t.String()
        })
    })

    // ================================================================
    // GET /payroll/export/pajak
    // Export PPh21 TER calculation + PPh21 input (pot_pph21) per emp_code
    // Query params: month, year, gang (optional, default ALL)
    // ================================================================
    .get("/export/pajak", async ({ query, set }) => {
        try {
            const month = parseInt(query.month as string);
            const year = parseInt(query.year as string);
            const gang = query.gang as string || undefined;
            const division = query.div as string || undefined;
            const gangPrefix = query.gang_prefix as string || undefined;
            const useHistoryDb = parseBooleanQueryParam(query.use_history) ?? false;
            const snapshotVersion = parsePositiveIntegerQueryParam(query.snapshot_version as string | undefined);
            const valuePriorityMode = query.value_priority_mode as string | undefined;

            if (!month || !year || month < 1 || month > 12) {
                set.status = 400;
                return { error: "Invalid month or year" };
            }

            const result = await taxReportService.getMonthlyTaxReport(year, month, division, gang, gangPrefix, useHistoryDb, snapshotVersion, valuePriorityMode);

            // Build emp_code → pajak mapping
            const employeesMap: Record<string, any> = {};
            for (const emp of result.employees) {
                employeesMap[emp.emp_code] = {
                    emp_code: emp.emp_code,
                    emp_name: emp.emp_name,
                    nik: emp.nik,
                    gang_code: emp.gang_code,
                    jabatan: emp.jabatan,
                    status_ptkp: emp.status_ptkp,
                    kategori_ter: emp.kategori_ter,
                    // Calculated TER
                    penghasilan_bruto: emp.penghasilan_bruto,
                    tarif_pajak_ter: emp.tarif_pajak_ter,
                    pph21_ter: emp.pph21_ter,
                    // Input PPh21 from PR_ADTRANS (pot_pph21 in potongan upah bersih)
                    pph21_input: emp.pot_pph21 ?? null,
                    // Selisih = input - ter
                    selisih: (emp.pot_pph21 ?? 0) - (emp.pph21_ter ?? 0),
                    // Income
                    upah_kotor: emp.upah_kotor,
                    total_tunjangan: emp.total_tunjangan,
                    total_premi: emp.total_premi,
                    hk: emp.hk,
                    // Potongan components
                    pot_spsi: emp.pot_spsi,
                    pot_koreksi: emp.pot_koreksi,
                    bpjs_kes_majikan: emp.bpjs_kes_majikan,
                    astek_jht_majikan: emp.astek_jht_majikan,
                    // Restoration of THR and Kontan
                    thr_amount: emp.thr_amount || 0,
                    exgratia_amount: emp.exgratia_amount || 0,
                    other_income_amount: emp.other_income_amount || 0,
                };
            }

            // [FIX] Use pot_pph21 (actual deduction) as primary total to match Daftar Upah grand total
            // pph21_ter is calculated TER which may differ from actual deduction for some employees
            const actualPph21Total = result.employees.reduce((s: number, e: any) => s + (e.pot_pph21 ?? 0), 0);
            const payload = {
                tipe: "pajak_export",
                periode: { bulan: month, tahun: year },
                gang: gang || "ALL",
                generated_at: new Date().toISOString(),
                data_source: result.data_source,
                total_pph21: actualPph21Total,           // Matches Daftar Upah grand total
                total_pph21_input: actualPph21Total,   // Legacy alias (same value)
                total_pph21_ter: result.total_pph21,    // Calculated TER (for comparison)
                selisih_total: result.total_pph21 - actualPph21Total, // TER - actual
                employee_count: result.employees.length,
                employees: employeesMap,
            };

            const filename = `PAJAK_${gang || "ALL"}_${month}_${year}.json`;
            const jsonBody = JSON.stringify(payload);
            console.log(`[PayrollRoutes] /export/pajak: JSON size=${jsonBody.length} bytes, employees=${result.employees.length}`);

            return new Response(jsonBody, {
                headers: {
                    "Content-Type": "application/json; charset=utf-8",
                    "Content-Disposition": `attachment; filename="${filename}"`,
                    "Content-Length": String(jsonBody.length)
                }
            });
        } catch (e: any) {
            console.error("[PayrollRoutes] /export/pajak error:", e);
            set.status = 500;
            return { error: e.message };
        }
    }, {
        query: t.Object({
            month: t.String(),
            year: t.String(),
            gang: t.Optional(t.String()),
            div: t.Optional(t.String()),
            gang_prefix: t.Optional(t.String()),
            use_history: t.Optional(t.String()),
            snapshot_version: t.Optional(t.String()),
            value_priority_mode: t.Optional(t.String()),
        })
    })
