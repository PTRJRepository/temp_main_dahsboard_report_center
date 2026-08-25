/**
 * @module backend/src/api/taxReportRoutes.ts
 * @purpose Root /tax-report Elysia instance: derive/onBeforeHandle auth gate, mounts excelRoutes plugin,
 *            and core routes (monthly, annual, astek-bpjs, december, december/excel, ptkp PUT).
 * @input Request headers (Authorization / x-api-key) resolved to currentUser; query/body per core route
 * @output JSON per core route; Excel binary for december/excel; 401 when currentUser absent
 * @depends ./taxReport.shared (getUserFromHeader, sanitizeForFilename), ./taxReport.excelRoutes,
 *            ../services/{taxReportService, taxReportExcelService, ptkpTaxService, gangService, employeeDetailService},
 *            ../utils/taxReportQuery
 * @sideeffect PUT /ptkp writes PTKP master; december/excel reads payroll data
 * @tests backend/src/services/taxReportExcelService.test.ts, backend/src/services/taxReportAlpaFix.test.ts
 */
import { Elysia, t } from "elysia";
import { taxReportService } from "../services/taxReportService";
import { generateDecemberTaxExcel } from "../services/taxReportExcelService";
import { ptkpTaxService } from "../services/ptkpTaxService";
import { gangService } from "../services/gangService";
import { employeeDetailService } from "../services/employeeDetailService";
import { resolveMonthlyTaxQuery } from "../utils/taxReportQuery";
import { getUserFromHeader, sanitizeForFilename } from "./taxReport.shared";
import { excelRoutes } from "./taxReport.excelRoutes";

export const taxReportRoutes = new Elysia({ prefix: "/tax-report" })
    .derive(async ({ headers }) => {
        const authHeader = headers['authorization'];
        const apiKeyHeader = headers['x-api-key'];
        console.log(`[TaxReport] Auth header: ${authHeader ? 'present' : apiKeyHeader ? 'api-key' : 'missing'}`);
        const user = await getUserFromHeader(headers);
        return { currentUser: user };
    })
    .onBeforeHandle(({ currentUser, set }) => {
        console.log(`[TaxReport] currentUser: ${currentUser ? 'authenticated' : 'not authenticated'}`);
        if (!currentUser) {
            set.status = 401;
            return { message: "Unauthorized" };
        }
    })
    .use(excelRoutes)

    // ========================================================
    // GET /tax-report/monthly
    // Monthly PPH21 tax report for a specific period
    // Uses the same source-selection contract as Daftar Upah via use_history
    // ========================================================
    .get("/monthly", async ({ query, set, currentUser }) => {
        try {
            const resolved = resolveMonthlyTaxQuery(query as any, currentUser);

            if (!resolved.hasValidPeriod) {
                set.status = 400;
                return { error: "Invalid year or month parameter" };
            }

            const result = await taxReportService.getMonthlyTaxReport(
                resolved.year,
                resolved.month,
                resolved.division,
                resolved.gang,
                resolved.gangPrefix,
                resolved.useHistoryDb,
                resolved.snapshotVersion,
                resolved.valuePriorityMode
            );
            return result;
        } catch (error: any) {
            console.error("[TaxReport] Error fetching monthly tax report:", error);
            set.status = 500;
            return { error: error.message || "Failed to fetch monthly tax report" };
        }
    }, {
        query: t.Object({
            year: t.String(),
            month: t.String(),
            division: t.Optional(t.String()),
            gang: t.Optional(t.String()),
            gangPrefix: t.Optional(t.String()),
            use_history: t.Optional(t.String()),
            snapshot_version: t.Optional(t.String()),
            value_priority_mode: t.Optional(t.String())
        })
    })

    // ========================================================
    // GET /tax-report/annual
    // Annual tax report with PTKP, Biaya Jabatan, PKP
    // ========================================================
    .get("/annual", async ({ query, set, currentUser }) => {
        try {
            const year = parseInt(query.year as string);
            const monthStr = query.month as string | undefined;
            const month = monthStr ? parseInt(monthStr) : undefined;
            let division = query.division as string || undefined;
            const gang = query.gang as string || undefined;
            const gangPrefix = query.gangPrefix as string || undefined;

            if (currentUser?.role?.toLowerCase() === 'kerani' && currentUser?.divisions?.length > 0) {
                division = currentUser.divisions[0];
            }

            if (!year) {
                set.status = 400;
                return { error: "Invalid year parameter" };
            }

            const result = await taxReportService.getAnnualTaxReport(year, month, division, gang, gangPrefix);
            return result;
        } catch (error: any) {
            console.error("[TaxReport] Error fetching annual tax report:", error);
            set.status = 500;
            return { error: error.message || "Failed to fetch annual tax report" };
        }
    })

    // ========================================================
    // GET /tax-report/astek-bpjs
    // Annual ASTEK & BPJS per-month report
    // ========================================================
    .get("/astek-bpjs", async ({ query, set, currentUser }) => {
        try {
            const year = parseInt(query.year as string);
            const monthStr = query.month as string | undefined;
            const month = monthStr ? parseInt(monthStr) : undefined;
            let division = query.division as string || undefined;
            const gang = query.gang as string || undefined;
            const gangPrefix = query.gangPrefix as string || undefined;

            if (currentUser?.role?.toLowerCase() === 'kerani' && currentUser?.divisions?.length > 0) {
                division = currentUser.divisions[0];
            }

            if (!year) {
                set.status = 400;
                return { error: "Invalid year parameter" };
            }

            const result = await taxReportService.getAnnualAstekBpjsReport(year, month, division, gang, gangPrefix);
            return result;
        } catch (error: any) {
            console.error("[TaxReport] Error fetching ASTEK/BPJS report:", error);
            set.status = 500;
            return { error: error.message || "Failed to fetch ASTEK/BPJS report" };
        }
    })

    // ========================================================
    // GET /tax-report/december
    // Dedicated December Tax Report with annualized aggregation
    // ========================================================
    .get("/december", async ({ query, set, currentUser }) => {
        try {
            const year = parseInt(query.year as string);
            let division = query.division as string || undefined;
            const gang = query.gang as string || undefined;
            const gangPrefix = query.gangPrefix as string || undefined;

            if (currentUser?.role?.toLowerCase() === 'kerani' && currentUser?.divisions?.length > 0) {
                division = currentUser.divisions[0];
            }

            if (!year) {
                set.status = 400;
                return { error: "Invalid year parameter" };
            }

            const result = await taxReportService.getDecemberTaxReport(year, division, gang, gangPrefix);
            return result;
        } catch (error: any) {
            console.error("[TaxReport] Error fetching December tax report:", error);
            set.status = 500;
            return { error: error.message || "Failed to fetch December tax report" };
        }
    })

    // ========================================================
    // GET /tax-report/december/excel
    // Download December tax report with monthly breakdown as Excel
    // ========================================================
    .get("/december/excel", async ({ query, set, currentUser }) => {
        try {
            const year = parseInt(query.year as string);
            let division = query.division as string || undefined;
            const gang = query.gang as string || undefined;
            const gangPrefix = query.gangPrefix as string || undefined;

            if (currentUser?.role?.toLowerCase() === 'kerani' && currentUser?.divisions?.length > 0) {
                division = currentUser.divisions[0];
            }

            if (!year) {
                set.status = 400;
                return { error: "Invalid year parameter" };
            }

            // Fetch the base data
            const data = await taxReportService.getDecemberTaxReport(year, division, gang, gangPrefix);

            if (!data || data.employees.length === 0) {
                set.status = 404;
                return { error: "No data available for the selected period" };
            }

            const gangLabel = gang || gangPrefix || 'ALL';

            // Get gang description for filename
            let gangDescForFilename = '';
            if (gangLabel && gangLabel !== 'ALL') {
                try {
                    const gangInfo = await gangService.getGangInfo(gangLabel);
                    if (gangInfo?.description) {
                        gangDescForFilename = '_' + sanitizeForFilename(gangInfo.description);
                    }
                } catch (e) {
                    console.warn(`[TaxReport] Could not get gang description for ${gangLabel}:`, e);
                }
            }

            // Generate Excel Buffer
            const excelBuffer = await generateDecemberTaxExcel(data, year, division || 'ALL', gangLabel);

            const filename = `PAJAK_DESEMBER_${division || 'ALL'}_${gangLabel}${gangDescForFilename}_${year}.xlsx`;
            set.headers["Content-Type"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            set.headers["Content-Disposition"] = `attachment; filename="${filename}"`;

            return excelBuffer;
        } catch (error: any) {
            console.error("[TaxReport] Error generating December Excel report:", error);
            set.status = 500;
            return { error: error.message || "Failed to generate Excel report" };
        }
    })

    // ========================================================
    // PUT /tax-report/ptkp/:emp_code
    // Update PTKP status for a specific employee (portal edit)
    // ========================================================
    .put("/ptkp/:emp_code", async ({ params, body, set, currentUser }) => {
        try {
            const { year, ptkp_status } = body as { year: number; ptkp_status: string };
            const empCode = params.emp_code;

            if (!year || !ptkp_status) {
                set.status = 400;
                return { success: false, error: "year and ptkp_status are required" };
            }

            const validStatuses = ['TK/0', 'TK/1', 'TK/2', 'TK/3', 'K/0', 'K/1', 'K/2', 'K/3'];
            if (!validStatuses.includes(ptkp_status)) {
                set.status = 400;
                return { success: false, error: `Invalid PTKP status. Must be one of: ${validStatuses.join(', ')}` };
            }

            // [GATE] Hanya gang percobaan (desc "PERCOBAAN" / code berakhiran P / code BHL)
            // yang boleh mengubah PTKP master langsung dari CustomPayrollTable.
            const empInfo = await employeeDetailService.getEmployeeInfo(empCode).catch(() => null);
            const employeeGangCode = empInfo?.gang_code || '';
            const employeeGangDesc = empInfo?.gang_description || '';
            if (!gangService.isPercobaanGang(employeeGangCode, employeeGangDesc)) {
                set.status = 403;
                return {
                    success: false,
                    error: `PTKP master hanya bisa diubah untuk gang percobaan (description mengandung PERCOBAAN, gang code berawalan P, atau mengandung BHL). Gang: ${employeeGangCode || 'unknown'} - ${employeeGangDesc || 'unknown'}`
                };
            }

            const username = currentUser?.username || 'system';
            const result = await ptkpTaxService.updatePtkpStatus(year, empCode, ptkp_status, username);

            return { success: true, updated: result, emp_code: empCode, year, ptkp_status };
        } catch (error: any) {
            console.error("[TaxReport] Error updating PTKP:", error);
            set.status = 500;
            return { success: false, error: error.message || "Failed to update PTKP status" };
        }
    }, {
        body: t.Object({
            year: t.Number(),
            ptkp_status: t.String()
        })
    });
