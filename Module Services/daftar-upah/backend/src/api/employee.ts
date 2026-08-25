import { Elysia, t } from "elysia";
import { info, warn, error as logError } from "../utils/logger";
const CATEGORY = "EmployeeRoutes";
import { AuthService } from "../services/authService";
import { Database } from "../db/client";
import { employeeDetailService } from "../services/employeeDetailService";
import { lemburCalculator } from "../services/lemburCalculator";
import { employeeRepository } from "../services/employeeRepository";
import { dataExtractorService } from "../services/dataExtractorService";
import { employeeCareerHistoryService } from "../services/employeeCareerHistoryService";
import { Config } from "../config";
import { User } from "../types/user";
import { divisionDefinition } from "../services/divisionDefinition";
import { parseBooleanQueryParam, parsePositiveIntegerQueryParam } from "../utils/queryParsers";
import { resolveUserFromHeaders } from "../utils/authBypass";
import { canAccessEmployeeDetailScope } from "../utils/employeeDetailAccess";

const authService = AuthService.getInstance();

// Helper to get user from header
async function getUserFromHeader(headers: Record<string, string | undefined>): Promise<User | null> {
    return resolveUserFromHeaders(headers, authService);
}

export const employeeRoutes = new Elysia({ prefix: "/payroll/employee" })
    .derive(async ({ headers }) => {
        const user = await getUserFromHeader(headers);
        return { currentUser: user };
    })
    .onBeforeHandle(({ currentUser, set }) => {
        if (!currentUser) {
            set.status = 401;
            return { message: "Unauthorized" };
        }
    })
    // ========================
    // STATIC ROUTES FIRST (before parameterized routes)
    // ========================

    // --- List Employees by Gang ---
    .get("/list", async ({ query, currentUser }) => {
        info(CATEGORY, `[API /list] currentUser: ${currentUser ? currentUser.username : 'null'}, query:`, query);
        let division = query.division || undefined;
        let gangCode = query.gang_code || undefined;
        const religion = query.religion || undefined;
        const status = query.status || undefined;
        const forceHistory = query.force_history === "true";
        const sortBy = query.sort_by || "nama"; // default: nama
        const sortOrder = query.sort_order || "asc"; // default: asc

        // Strictly lock division for Kerani
        if (currentUser?.role?.toLowerCase() === 'kerani' && currentUser?.divisions?.length > 0) {
            division = currentUser.divisions[0];
        }

        info(CATEGORY, `[API /list] Calling repository with:`, { gangCode, division, religion, status, forceHistory, sortBy, sortOrder });
        const result = await employeeRepository.list({
            gangCode: gangCode,
            division: division,
            religion: religion,
            status: status,
            skip: parseInt(query.skip || "0"),
            limit: parseInt(query.limit || "500"),
            forceHistory,
            sortBy,
            sortOrder
        });
        info(CATEGORY, `[API /list] Repository returned ${result.employees.length} employees from ${result.dataSource}`);
        return { count: result.employees.length, data: result.employees, dataSource: result.dataSource };
    }, {
        query: t.Object({
            gang_code: t.Optional(t.String()),
            division: t.Optional(t.String()),
            religion: t.Optional(t.String()),
            status: t.Optional(t.String()),
            skip: t.Optional(t.String()),
            limit: t.Optional(t.String()),
            force_history: t.Optional(t.String()),
            sort_by: t.Optional(t.String()),
            sort_order: t.Optional(t.String())
        })
    })
    // --- Search Employees ---
    .get("/search", async ({ query, currentUser }) => {
        let division = undefined;

        // Strictly lock division for Kerani
        if (currentUser?.role?.toLowerCase() === 'kerani' && currentUser?.divisions?.length > 0) {
            division = currentUser.divisions[0];
        }

        const result = await employeeRepository.search(
            query.q || "",
            parseInt(query.limit || "50"),
            division
        );
        return { count: result.employees.length, data: result.employees, dataSource: result.dataSource };
    }, {
        query: t.Object({
            q: t.String(),
            limit: t.Optional(t.String())
        })
    })
    // --- Get All Employees for Analytics (bypasses 500 limit) ---
    .get("/list-all", async ({ query, currentUser }) => {
        let division = query.division || undefined;
        let gangCode = query.gang_code || undefined;
        const religion = query.religion || undefined;
        const status = query.status || undefined;
        const forceHistory = query.force_history === "true";

        if (currentUser?.role?.toLowerCase() === 'kerani' && currentUser?.divisions?.length > 0) {
            division = currentUser.divisions[0];
        }

        const result = await employeeRepository.list({
            gangCode: gangCode,
            division: division,
            religion: religion,
            status: status,
            skip: 0,
            limit: 10000,  // Large limit for analytics
            forceHistory
        });
        return { count: result.employees.length, data: result.employees, dataSource: result.dataSource };
    }, {
        query: t.Object({
            gang_code: t.Optional(t.String()),
            division: t.Optional(t.String()),
            religion: t.Optional(t.String()),
            status: t.Optional(t.String()),
            force_history: t.Optional(t.String())
        })
    })

    // --- Get Available Gangs ---
    .get("/available-gangs", async ({ query }) => {
        const gangs = await employeeRepository.getAvailableGangs(query.division);
        return { count: gangs.length, gangs };
    }, {
        query: t.Object({
            division: t.Optional(t.String())
        })
    })
    // --- Get Available Religions ---
    .get("/available-religions", async () => {
        const religions = await employeeRepository.getAvailableReligions();
        return { count: religions.length, religions };
    })
    // --- Get Available Statuses ---
    .get("/available-statuses", async () => {
        const statuses = await employeeRepository.getAvailableStatuses();
        return { count: statuses.length, statuses };
    })
// --- Batch Checkroll: logic lives in employeeDetailService.getBatchCheckroll ---
const handleBatchCheckroll = async (
    empCodesStr: string | string[],
    monthStr: string | number,
    yearStr: string | number,
    set: any,
    useHistoryDb?: boolean | null,
    snapshotVersion?: number | null
) => {
    const month = typeof monthStr === 'number' ? monthStr : parseInt(String(monthStr));
    const year = typeof yearStr === 'number' ? yearStr : parseInt(String(yearStr));

    if (!empCodesStr || (Array.isArray(empCodesStr) && empCodesStr.length === 0)) {
        set.status = 400;
        return { error: "No employee codes provided" };
    }
    if (isNaN(month) || isNaN(year)) {
        set.status = 400;
        return { error: "Invalid month or year" };
    }

    const result = await employeeDetailService.getBatchCheckroll(empCodesStr, month, year, useHistoryDb, snapshotVersion);
    if (!result.success && result.error && !result.data) {
        set.status = result.error.includes("Invalid month or year") ? 400 : 500;
    }
    return result;
};
employeeRoutes
    .get("/batch-checkroll", async ({ query, set }) => {
        return handleBatchCheckroll(
            query.emp_codes || "",
            query.month,
            query.year,
            set,
            parseBooleanQueryParam(query.use_history),
            parsePositiveIntegerQueryParam(query.snapshot_version)
        );
    }, {
        query: t.Object({
            emp_codes: t.String(),
            month: t.String(),
            year: t.String(),
            use_history: t.Optional(t.Union([t.String(), t.Boolean()])),
            snapshot_version: t.Optional(t.String())
        })
    })
    .post("/batch-checkroll", async ({ body, set }) => {
        return handleBatchCheckroll(
            body.emp_codes || [],
            String(body.month),
            String(body.year),
            set,
            typeof body.use_history === "boolean"
                ? body.use_history
                : parseBooleanQueryParam(typeof body.use_history === "string" ? body.use_history : undefined),
            parsePositiveIntegerQueryParam(
                typeof body.snapshot_version === "number"
                    ? body.snapshot_version
                    : typeof body.snapshot_version === "string"
                        ? body.snapshot_version
                        : undefined
            )
        );
    }, {
        body: t.Object({
            emp_codes: t.Array(t.String()),
            month: t.Union([t.String(), t.Number()]),
            year: t.Union([t.String(), t.Number()]),
            use_history: t.Optional(t.Union([t.String(), t.Boolean()])),
            snapshot_version: t.Optional(t.Union([t.String(), t.Number()]))
        })
    })

    // ========================
    // PARAMETERIZED ROUTES (after static routes)
    // ========================

    // --- Get Employee by NIK ---
    .get("/by-nik/:nik", async ({ params, set, currentUser }) => {
        const nik = (params.nik || '').trim();
        const employee = await employeeRepository.getByNik(nik);
        if (!employee) {
            set.status = 404;
            return { error: "Employee not found" };
        }

        // KERANI DIVISION RESTRICTION
        if (currentUser?.role?.toLowerCase() === 'kerani' && currentUser?.divisions?.length > 0) {
            const empLocCode = (employee.loc_code || '').trim().toUpperCase();
            const { divisionDefinition } = await import('../services/divisionDefinition');
            const empDivision = divisionDefinition.resolveDivisionCode(empLocCode);

            const hasPermission = currentUser.divisions.some(d => {
                const userDiv = divisionDefinition.resolveDivisionCode(String(d).trim().toUpperCase());
                return userDiv === empDivision;
            });

            if (!hasPermission) {
                warn(CATEGORY, `[API] KERANI denied access to employee by NIK ${params.nik}. Emp division: ${empDivision}`);
                set.status = 403;
                return { error: `Akses ditolak: Anda tidak memiliki izin untuk melihat data karyawan dari divisi lain` };
            }
        }

        return employee;
    })
    // --- Checkroll (Full Implementation) ---
    .get("/:emp_code/checkroll", async ({ params, query, set, currentUser }) => {
        try {
            let empCode = (params.emp_code || '').trim();
            const month = parseInt(query.month);
            const year = parseInt(query.year);
            const requestedDivision = query.div;
            const useHistoryDb = parseBooleanQueryParam(query.use_history);
            const snapshotVersion = parsePositiveIntegerQueryParam(query.snapshot_version);

            // NIK-to-EmpCode resolution: if the param looks like a KTP number (all digits, >10 chars),
            // resolve it to the actual EmpCode via HR_EMPLOYEE.NewICNo
            const isNik = /^\d{10,}$/.test(empCode);
            let resolvedFromNik = false;
            if (isNik) {
                info(CATEGORY, `[API] Detected NIK (KTP): ${empCode}, resolving to EmpCode...`);
                const db = (await import('../db/client')).Database.getInstance();
                const rows = await db.query<{ EmpCode: string }>(
                    `SELECT TOP 1 EmpCode FROM HR_EMPLOYEE WHERE RTRIM(NewICNo) = RTRIM(?) ORDER BY EmpCode`,
                    [empCode]
                );
                if (rows.length > 0) {
                    const resolvedCode = rows[0].EmpCode.trim();
                    info(CATEGORY, `[API] Resolved NIK ${empCode} -> EmpCode ${resolvedCode}`);
                    empCode = resolvedCode;
                    resolvedFromNik = true;
                } else {
                    warn(CATEGORY, `[API] NIK ${empCode} not found in HR_EMPLOYEE.NewICNo`);
                    set.status = 404;
                    return { error: `Employee with NIK ${empCode} not found`, emp_code: empCode };
                }
            }

            // KERANI DIVISION RESTRICTION: Check if kerani can access this employee
            if (currentUser?.role?.toLowerCase() === 'kerani' && currentUser?.divisions?.length > 0) {
                // Get employee's loc_code (division) from their gang code
                const db = (await import('../db/client')).Database.getInstance();
                const empRows = await db.query<{
                    LocCode: string;
                    GangCode?: string;
                    GangDescription?: string;
                }>(
                    `
                    SELECT TOP 1
                        e.LocCode,
                        gl.GangCode,
                        g.Description as GangDescription
                    FROM HR_EMPLOYEE e
                    LEFT JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
                    LEFT JOIN HR_GANG g ON RTRIM(g.GangCode) = RTRIM(gl.GangCode)
                    WHERE RTRIM(e.EmpCode) = ?
                    ORDER BY gl.GangCode
                    `,
                    [empCode]
                );
                if (empRows.length > 0) {
                    const empLocCode = (empRows[0].LocCode || '').trim().toUpperCase();
                    const empDivision = divisionDefinition.resolveDivisionCode(empLocCode);
                    const hasPermission = canAccessEmployeeDetailScope({
                        userDivisions: currentUser.divisions,
                        requestedDivision,
                        employeeLocCode: empLocCode,
                        employeeGangCode: empRows[0].GangCode,
                        employeeGangDescription: empRows[0].GangDescription
                    });

                    if (!hasPermission) {
                        warn(CATEGORY, `[API] KERANI denied access to employee ${empCode}. Emp division: ${empDivision}, gang: ${empRows[0].GangCode || '-'}, requested: ${requestedDivision || '-'}, User divisions: ${JSON.stringify(currentUser.divisions)}`);
                        set.status = 403;
                        return { error: `Akses ditolak: Anda tidak memiliki izin untuk melihat data karyawan dari divisi lain`, emp_code: empCode };
                    }
                }
            }

            const result = await employeeDetailService.getEmployeeCheckroll(empCode, month, year, true, useHistoryDb, snapshotVersion); // skipHarvest=true
            info(CATEGORY, "[API DEBUG] Checkroll Result Keys:", Object.keys(result));

            if (result.error) {
                set.status = 404;
                return result;
            }

            return result;
        } catch (e: any) {
            set.status = 500;
            return { error: e.message };
        }
    }, {
        query: t.Object({
            month: t.String(),
            year: t.String(),
            div: t.Optional(t.String()),
            use_history: t.Optional(t.String()),
            snapshot_version: t.Optional(t.String())
        })
    })
    // --- Attendance Detail (Full Implementation) ---
    .get("/:emp_code/attendance/detail", async ({ params, query, set, currentUser }) => {
        try {
            const empCode = (params.emp_code || '').trim();
            const month = parseInt(query.month);
            const year = parseInt(query.year);

            // KERANI DIVISION RESTRICTION
            if (currentUser?.role?.toLowerCase() === 'kerani' && currentUser?.divisions?.length > 0) {
                const db = (await import('../db/client')).Database.getInstance();
                const empRows = await db.query<{ LocCode: string }>(
                    `SELECT LocCode FROM HR_EMPLOYEE WHERE RTRIM(EmpCode) = ?`,
                    [empCode]
                );
                if (empRows.length > 0) {
                    const empLocCode = (empRows[0].LocCode || '').trim().toUpperCase();
                    const { divisionDefinition } = await import('../services/divisionDefinition');
                    const empDivision = divisionDefinition.resolveDivisionCode(empLocCode);
                    const hasPermission = currentUser.divisions.some(d => {
                        const userDiv = divisionDefinition.resolveDivisionCode(String(d).trim().toUpperCase());
                        return userDiv === empDivision;
                    });
                    if (!hasPermission) {
                        set.status = 403;
                        return { error: `Akses ditolak: Anda tidak memiliki izin untuk melihat data karyawan dari divisi lain`, emp_code: empCode };
                    }
                }
            }

            const result = await employeeDetailService.getDailyAttendance(empCode, month, year);
            return {
                emp_code: empCode,
                month,
                year,
                ...result
            };
        } catch (e: any) {
            set.status = 500;
            return { error: e.message };
        }
    }, {
        query: t.Object({
            month: t.String(),
            year: t.String(),
            div: t.Optional(t.String())
        })
    })
    // --- Overtime Detail (Full Implementation) ---
    .get("/:emp_code/overtime/detail", async ({ params, query, set, currentUser }) => {
        try {
            const empCode = (params.emp_code || '').trim();
            const month = parseInt(query.month);
            const year = parseInt(query.year);

            // KERANI DIVISION RESTRICTION
            if (currentUser?.role?.toLowerCase() === 'kerani' && currentUser?.divisions?.length > 0) {
                const db = (await import('../db/client')).Database.getInstance();
                const empRows = await db.query<{ LocCode: string }>(
                    `SELECT LocCode FROM HR_EMPLOYEE WHERE RTRIM(EmpCode) = ?`,
                    [empCode]
                );
                if (empRows.length > 0) {
                    const empLocCode = (empRows[0].LocCode || '').trim().toUpperCase();
                    const { divisionDefinition } = await import('../services/divisionDefinition');
                    const empDivision = divisionDefinition.resolveDivisionCode(empLocCode);
                    const hasPermission = currentUser.divisions.some(d => {
                        const userDiv = divisionDefinition.resolveDivisionCode(String(d).trim().toUpperCase());
                        return userDiv === empDivision;
                    });
                    if (!hasPermission) {
                        set.status = 403;
                        return { error: `Akses ditolak: Anda tidak memiliki izin untuk melihat data karyawan dari divisi lain`, emp_code: empCode };
                    }
                }
            }

            const result = await employeeDetailService.getDailyOvertime(empCode, month, year);
            return {
                emp_code: empCode,
                month,
                year,
                ...result
            };
        } catch (e: any) {
            set.status = 500;
            return { error: e.message };
        }
    }, {
        query: t.Object({
            month: t.String(),
            year: t.String(),
            div: t.Optional(t.String())
        })
    })
    // --- Lembur Calculation (New) ---
    .get("/:emp_code/lembur", async ({ params, query, set, currentUser }) => {
        try {
            const empCode = (params.emp_code || '').trim();
            const month = parseInt(query.month);
            const year = parseInt(query.year);

            // KERANI DIVISION RESTRICTION
            if (currentUser?.role?.toLowerCase() === 'kerani' && currentUser?.divisions?.length > 0) {
                const db = (await import('../db/client')).Database.getInstance();
                const empRows = await db.query<{ LocCode: string }>(
                    `SELECT LocCode FROM HR_EMPLOYEE WHERE RTRIM(EmpCode) = ?`,
                    [empCode]
                );
                if (empRows.length > 0) {
                    const empLocCode = (empRows[0].LocCode || '').trim().toUpperCase();
                    const { divisionDefinition } = await import('../services/divisionDefinition');
                    const empDivision = divisionDefinition.resolveDivisionCode(empLocCode);
                    const hasPermission = currentUser.divisions.some(d => {
                        const userDiv = divisionDefinition.resolveDivisionCode(String(d).trim().toUpperCase());
                        return userDiv === empDivision;
                    });
                    if (!hasPermission) {
                        set.status = 403;
                        return { error: `Akses ditolak: Anda tidak memiliki izin untuk melihat data karyawan dari divisi lain`, emp_code: empCode };
                    }
                }
            }

            const result = await lemburCalculator.calculate(empCode, month, year);
            return result;
        } catch (e: any) {
            set.status = 500;
            return { error: e.message };
        }
    }, {
        query: t.Object({
            month: t.String(),
            year: t.String()
        })
    })
    // --- Employee History (Multiple Periods) ---
    .get("/:emp_code/history", async ({ params, query, set, currentUser }) => {
        try {
            let requestedEmpCode = params.emp_code;
            const requestedMonths = parseInt(query.months || "12"); // Number of months to fetch
            const includeCurrent = query.include_current !== "false";

            // KERANI DIVISION RESTRICTION
            if (currentUser?.role?.toLowerCase() === 'kerani' && currentUser?.divisions?.length > 0) {
                const db = (await import('../db/client')).Database.getInstance();
                const empRows = await db.query<{ LocCode: string }>(
                    `SELECT LocCode FROM HR_EMPLOYEE WHERE RTRIM(EmpCode) = ?`,
                    [requestedEmpCode]
                );
                if (empRows.length > 0) {
                    const empLocCode = (empRows[0].LocCode || '').trim().toUpperCase();
                    const { divisionDefinition } = await import('../services/divisionDefinition');
                    const empDivision = divisionDefinition.resolveDivisionCode(empLocCode);
                    const hasPermission = currentUser.divisions.some(d => {
                        const userDiv = divisionDefinition.resolveDivisionCode(String(d).trim().toUpperCase());
                        return userDiv === empDivision;
                    });
                    if (!hasPermission) {
                        set.status = 403;
                        return { error: `Akses ditolak: Anda tidak memiliki izin untuk melihat data karyawan dari divisi lain`, emp_code: requestedEmpCode };
                    }
                }
            }

            // RESOLVE ALL HISTORICAL EMPCODES BY NIK
            const db = require("../db/client").Database.getInstance();

            // NIK-to-EmpCode resolution for history endpoint
            const isNik = /^\d{10,}$/.test(requestedEmpCode);
            if (isNik) {
                info(CATEGORY, `[EmployeeHistory] Detected NIK (KTP): ${requestedEmpCode}, resolving...`);
                const nikRows = await db.query(`SELECT TOP 1 RTRIM(EmpCode) as EmpCode FROM HR_EMPLOYEE WHERE RTRIM(NewICNo) = RTRIM(?) ORDER BY EmpCode`, [requestedEmpCode]);
                if (nikRows.length > 0) {
                    info(CATEGORY, `[EmployeeHistory] Resolved NIK ${requestedEmpCode} -> ${nikRows[0].EmpCode}`);
                    requestedEmpCode = nikRows[0].EmpCode;
                } else {
                    set.status = 404;
                    return { error: `Employee with NIK ${requestedEmpCode} not found` };
                }
            }

            let targetNik = null;
            let targetName = null;

            try {
                const empQuery = await db.query(`SELECT RTRIM(EmpName) as EmpName, RTRIM(NewICNo) as NewICNo FROM HR_EMPLOYEE WHERE RTRIM(EmpCode) = ?`, [requestedEmpCode]);
                if (empQuery.length > 0) {
                    targetName = empQuery[0].EmpName?.trim();
                    targetNik = empQuery[0].NewICNo?.trim();
                }
            } catch (e) {
                warn(CATEGORY, "[EmployeeHistory] Could not fetch NIK info:", e);
            }

            let historicalEmpCodes = [requestedEmpCode]; // Fallback to at least the requested code
            try {
                if (targetName) {
                    const nameCleaned = targetName.replace(/\s+/g, '%');
                    let queryStr = `SELECT RTRIM(EmpCode) as EmpCode FROM HR_EMPLOYEE WHERE RTRIM(EmpName) LIKE ?`;
                    let qParams = [`%${nameCleaned}%`];

                    if (targetNik && targetNik.length > 5) {
                        queryStr += ` OR RTRIM(NewICNo) = ?`;
                        qParams.push(targetNik);
                    }

                    const codesQuery = await db.query(queryStr, qParams);
                    const foundCodes = codesQuery.map((row: any) => row.EmpCode);

                    // Add requested code to be safe, then unique
                    foundCodes.push(requestedEmpCode);
                    historicalEmpCodes = [...new Set(foundCodes)] as string[];
                }
            } catch (e) {
                warn(CATEGORY, "[EmployeeHistory] Could not fetch historical codes:", e);
            }

            info(CATEGORY, `[EmployeeHistory] Target ${requestedEmpCode} resolved to historical codes: ${historicalEmpCodes.join(', ')}`);

            // Get current period first
            const { currentPeriodService } = await import("../services/currentPeriodService");
            const currentPeriod = await currentPeriodService.getCurrentPeriod();

            // Calculate periods to fetch
            const monthsToFetch = includeCurrent ? requestedMonths : requestedMonths + 1;

            const periods = [];
            let startMonth = currentPeriod.month;
            let startYear = currentPeriod.year;

            for (let i = 0; i < monthsToFetch; i++) {
                let m = startMonth - i;
                let y = startYear;

                while (m < 1) {
                    m += 12;
                    y -= 1;
                }

                if (includeCurrent || !(m === currentPeriod.month && y === currentPeriod.year)) {
                    periods.push({ month: m, year: y });
                }
            }

            // Fetch data for each period concurrently
            const periodPromises = periods.map(async (period) => {
                try {
                    let bestPayrollResult: any = null;
                    let activeEmpCodeForMonth = null;

                    // Try all historical codes. We take the first one that successfully returns payroll_data.
                    for (const checkCode of historicalEmpCodes) {
                        try {
                            const result = await dataExtractorService.extractPayrollData(
                                period.month,
                                period.year,
                                "ALL",
                                undefined,
                                checkCode,
                                Config.DB_PROFILE
                            );

                            if (result && result.data_rows && result.data_rows.length > 0) {
                                // Find exactly our code (handles whitespace/case issues just in case)
                                const row = result.data_rows.find((r: any) => (r.nik || '').trim().toUpperCase() === checkCode.trim().toUpperCase());
                                if (row) {
                                    bestPayrollResult = { payroll_data: row };
                                    activeEmpCodeForMonth = checkCode;
                                    break; // Found the active record for this month
                                }
                            }
                        } catch (innerErr) {
                            // ignore and try next code
                        }
                    }

                    if (bestPayrollResult && bestPayrollResult.payroll_data) {
                        const data = bestPayrollResult.payroll_data;

                        // Try to fetch PR_WAGES data (non-blocking)
                        let wagesData = null;
                        if (activeEmpCodeForMonth) {
                            try {
                                const { wagesService } = await import("../services/wagesService");
                                wagesData = await wagesService.getWagesByEmployee(
                                    activeEmpCodeForMonth,
                                    period.month,
                                    period.year
                                );
                            } catch (wagesErr: any) {
                                // Silently ignore PR_WAGES errors - don't break payroll history
                                warn(CATEGORY, `[EmployeeHistory] Could not fetch PR_WAGES for ${period.month}/${period.year}:`, wagesErr?.message || 'Unknown error');
                            }
                        }

                        // Spread ALL payroll_data fields (PayrollRow has 80+ fields)
                        return {
                            // Period metadata
                            period_month: period.month,
                            period_year: period.year,
                            period_label: `${getMonthName(period.month)} ${period.year}`,

                            // Spread ALL payroll data fields
                            ...data,

                            // Override/ensure key identity fields
                            emp_code: activeEmpCodeForMonth,
                            nik: data.nik || activeEmpCodeForMonth,
                            nama: data.nama || data.emp_name || '-',

                            // Empty summaries since we skip the heavy matrix compilation
                            attendance_summary: null,
                            cuti_tahunan_hari: data.cuti_tahunan_hari || 0,
                            cuti_sakit_haid_hari: data.cuti_sakit_haid_hari || 0,
                            cuti_minggu_hari: data.cuti_minggu_hari || 0,
                            cuti_nasional_hari: data.cuti_nasional_hari || 0,

                            overtime_summary: null,
                            harvest_summary: null,

                            // PR_WAGES data (actual paid amount from PR_WAGES table)
                            wages_data: wagesData ? {
                                wages_no: wagesData.wages_no,
                                payment_date: wagesData.payment_date,
                                payment_status: wagesData.payment_status,
                                upah_bersih_pr_wages: wagesData.upah_bersih,  // Actual paid amount
                                gaji_pokok_pr_wages: wagesData.gaji_pokok,
                                total_tunjangan_pr_wages: wagesData.total_tunjangan,
                                total_premi_pr_wages: wagesData.total_premi,
                                total_potongan_pr_wages: wagesData.total_potongan,
                                jumlah_hk_pr_wages: wagesData.jumlah_hk,
                                upah_dasar_pr_wages: wagesData.upah_dasar,
                            } : null,
                        };
                    }
                } catch (err) {
                    logError(CATEGORY, `[EmployeeHistory] Failed to fetch period ${period.month}/${period.year}:`, err);
                }
                return null;
            });

            const resolvedResults = await Promise.all(periodPromises);
            const results = resolvedResults.filter(r => r !== null);

            // Sort by period (most recent first)
            results.sort((a, b) => {
                const periodA = a.period_year * 100 + a.period_month;
                const periodB = b.period_year * 100 + b.period_month;
                return periodB - periodA;
            });

            return {
                success: true,
                emp_code: requestedEmpCode,
                count: results.length,
                data: results,
                current_period: currentPeriod
            };
        } catch (e: any) {
            logError(CATEGORY, "[EmployeeHistory] Error:", e);
            set.status = 500;
            return { error: e.message };
        }
    }, {
        query: t.Object({
            months: t.Optional(t.String()),
            include_current: t.Optional(t.String())
        })
    })
    .get("/:emp_code/hr-changelog", async ({ params, set }) => {
        try {
            const requestedEmpCode = params.emp_code?.trim()?.toUpperCase();
            if (!requestedEmpCode) {
                set.status = 400;
                return { error: "Employee code is required" };
            }

            info(CATEGORY, `[EmployeeHistory] Fetching HR Changelog for '${requestedEmpCode}'`);

            const db = Database.getInstance();
            let finalEmpCode = requestedEmpCode;

            // Resolve NIK if provided
            if (/^\d{10,}$/.test(requestedEmpCode)) {
                try {
                    const empQuery = await db.query(`SELECT RTRIM(EmpCode) as EmpCode FROM HR_EMPLOYEE WHERE RTRIM(NewICNo) = ?`, [requestedEmpCode]);
                    if (empQuery.length > 0) {
                        finalEmpCode = empQuery[0].EmpCode?.trim();
                    }
                } catch (e) {
                    // ignore
                }
            }

            const { employeeDetailService } = await import("../services/employeeDetailService");
            const changelog = await employeeDetailService.getHrChangelog(finalEmpCode);
            return changelog;
        } catch (error: any) {
            logError(CATEGORY, "[EmployeeHistory] Failed to fetch HR changelog:", error);
            set.status = 500;
            return { error: error.message || "Failed to fetch HR changelog" };
        }
    })
    // ========================
    // EMPLOYEE CAREER HISTORY TRACKING
    // ========================
    // --- Get Career Summary by NIK or EmpCode ---
    .get("/career/:identifier", async ({ params, set }) => {
        try {
            const summary = await employeeCareerHistoryService.getCareerSummary(params.identifier);
            if (!summary) {
                set.status = 404;
                return { error: "Employee not found" };
            }
            return summary;
        } catch (error: any) {
            logError(CATEGORY, "[CareerSummary] Error:", error);
            set.status = 500;
            return { error: error.message || "Failed to fetch career summary" };
        }
    })
    // --- Get Career Timeline ---
    .get("/career/:identifier/timeline", async ({ params, query, set }) => {
        try {
            const history = await employeeCareerHistoryService.getCareerHistory(params.identifier, {
                fromYear: query.from_year ? parseInt(query.from_year) : undefined,
                toYear: query.to_year ? parseInt(query.to_year) : undefined,
                includeCurrent: query.include_current !== "false"
            });
            return { count: history.length, data: history };
        } catch (error: any) {
            logError(CATEGORY, "[CareerTimeline] Error:", error);
            set.status = 500;
            return { error: error.message || "Failed to fetch career timeline" };
        }
    }, {
        query: t.Object({
            from_year: t.Optional(t.String()),
            to_year: t.Optional(t.String()),
            include_current: t.Optional(t.String())
        })
    })
    // --- Get Gang Changes (Perpindahan Gang) ---
    .get("/career/:identifier/gang-changes", async ({ params, set }) => {
        try {
            const changes = await employeeCareerHistoryService.getGangChanges(params.identifier);
            return { count: changes.length, data: changes };
        } catch (error: any) {
            logError(CATEGORY, "[GangChanges] Error:", error);
            set.status = 500;
            return { error: error.message || "Failed to fetch gang changes" };
        }
    })
    // --- Search Career History by Name ---
    .get("/career/search", async ({ query, set }) => {
        try {
            const name = query.name;
            if (!name || name.length < 2) {
                set.status = 400;
                return { error: "Name must be at least 2 characters" };
            }
            const summaries = await employeeCareerHistoryService.searchByName(name, parseInt(query.limit || "20"));
            return { count: summaries.length, data: summaries };
        } catch (error: any) {
            logError(CATEGORY, "[CareerSearch] Error:", error);
            set.status = 500;
            return { error: error.message || "Failed to search career history" };
        }
    }, {
        query: t.Object({
            name: t.String(),
            limit: t.Optional(t.String())
        })
    })
    // --- Get Gang Transfers by Period ---
    .get("/career/transfers/:month/:year", async ({ params, set }) => {
        try {
            const month = parseInt(params.month);
            const year = parseInt(params.year);
            if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
                set.status = 400;
                return { error: "Invalid month or year" };
            }
            const transfers = await employeeCareerHistoryService.getGangTransfers(month, year);
            return { count: transfers.length, data: transfers };
        } catch (error: any) {
            logError(CATEGORY, "[GangTransfers] Error:", error);
            set.status = 500;
            return { error: error.message || "Failed to fetch gang transfers" };
        }
    }, {
        params: t.Object({
            month: t.String(),
            year: t.String()
        })
    })
    // ========================
    // GANG ATTENDANCE MATRIX (uses extend_db_ptrj history data)
    // ========================
    .get("/gang-attendance-matrix", async ({ query, set }) => {
        try {
            const { gangAttendanceService } = await import("../services/gangAttendanceService");

            const gangCodesRaw = query.gang_codes || "";
            const gangCodes = gangCodesRaw.split(",").map((g: string) => g.trim()).filter(Boolean);
            const month = parseInt(query.month);
            const year = parseInt(query.year);
            const includeFaceVerification = query.include_face_verification !== 'false';

            if (gangCodes.length === 0) {
                set.status = 400;
                return { error: "No gang codes provided. Use gang_codes=A1H1,A1H2" };
            }

            if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
                set.status = 400;
                return { error: "Invalid month or year" };
            }

            const startTime = Date.now();
            const results = await gangAttendanceService.getGangAttendanceMatrix(gangCodes, month, year, { includeFaceVerification });

            return {
                success: true,
                data: results,
                meta: {
                    gang_count: results.length,
                    total_employees: results.reduce((sum, r) => sum + r.employees.length, 0),
                    execution_time_ms: Date.now() - startTime
                }
            };
        } catch (e: any) {
            logError(CATEGORY, "[GangAttendanceMatrix] Error:", e);
            set.status = 500;
            return { error: e.message };
        }
    }, {
        query: t.Object({
            gang_codes: t.String(),
            month: t.String(),
            year: t.String(),
            include_face_verification: t.Optional(t.String())
        })
    })
    // ========================
    // GANG OVERTIME MATRIX (lembur per day per employee)
    // ========================
    .get("/gang-overtime-matrix", async ({ query, set }) => {
        try {
            const { gangAttendanceService } = await import("../services/gangAttendanceService");

            const gangCodesRaw = query.gang_codes || "";
            const gangCodes = gangCodesRaw.split(",").map((g: string) => g.trim()).filter(Boolean);
            const month = parseInt(query.month);
            const year = parseInt(query.year);

            if (gangCodes.length === 0) {
                set.status = 400;
                return { error: "No gang codes provided. Use gang_codes=A1H1,A1H2" };
            }

            if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
                set.status = 400;
                return { error: "Invalid month or year" };
            }

            const startTime = Date.now();
            const results = await gangAttendanceService.getGangOvertimeMatrix(gangCodes, month, year);

            return {
                success: true,
                data: results,
                meta: {
                    gang_count: results.length,
                    total_employees: results.reduce((sum, r) => sum + r.employees.length, 0),
                    execution_time_ms: Date.now() - startTime
                }
            };
        } catch (e: any) {
            logError(CATEGORY, "[GangOvertimeMatrix] Error:", e);
            set.status = 500;
            return { error: e.message };
        }
    }, {
        query: t.Object({
            gang_codes: t.String(),
            month: t.String(),
            year: t.String()
        })
    });

// Helper function for month name
function getMonthName(month: number): string {
    const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return months[month - 1] || '';
}
