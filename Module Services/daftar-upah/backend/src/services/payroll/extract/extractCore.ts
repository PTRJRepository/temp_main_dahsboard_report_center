/**
 * @module backend/src/services/payroll/extract/extractCore.ts
 * @purpose Single shared orchestration core for payroll extraction; SSE yields per phase, non-SSE drains it.
 * @input ExtractArgs + ExtractDeps { db: Database } ; side inputs via gangService/currentPeriodService/historyDatabaseService
 * @output AsyncGenerator<ExtractPhaseResult> { phase, gangs: Map<string, PayrollRow[]>, meta, dynamic_premi/potongan headers+titles }
 * @depends ./extractHelpers, ./extractQueries, ../../config/DivisionConfigService, ../../../utils/payrollGangScope, ../../historyDatabaseService, ../../gangService, ../../currentPeriodService, ../payroll/components/PayrollCalculator, manualAdjustment wiring, ../../../utils/logger
 * @sideeffect Reads DB via extractQueries + historyDatabaseService; reads extend_db via Database.getExtendedInstance; no writes.
 * @tests _dev_utils/baseline golden (REST+SSE), bun test dataExtractor.*
 */

import { Database } from "../../../db/client";
import { Config } from "../../../config";
import type { Employee } from "../../../types/employee/Employee";
import { gangService } from "../../gangService";
import { currentPeriodService } from "../../currentPeriodService";
import { historyDatabaseService } from "../../historyDatabaseService";
import { manualAdjustmentService } from "../../manualAdjustmentService";
import { calculateAllCaruman } from "../../carumanDefinitions";
import { mapBerasRateToPTKP, mapPTKPToTER } from "../formulas/PTKPMapper";
import { calculateMasaKerjaDisplay, deriveInitialSpsiMember } from "../../../utils/payrollProfileRules";
import { debug, warn } from "../../../utils/logger";
import { PayrollCalculator } from "../components/PayrollCalculator";
import { applyManualAdjustmentsToEmployee } from "../manualAdjustments/manualAdjustmentApplier";
import { payrollAutoBufferService } from "../payrollAutoBufferService";
import { divisionConfigService } from "../../config/DivisionConfigService";
import {
    resolvePayrollDivisionCodeForScope,
    resolvePayrollGangPrefixForDivision
} from "../../../utils/payrollGangScope";
import {
    attachPayrollPeriodAdjustmentNotes,
    resolveAdjustedJabatanJumlah,
    shouldForcePotPph21ToTer
} from "../../../utils/payrollPeriodAdjustments";
import { getCanonicalOtherIncomeType } from "../../../utils/otherIncomeCanonical";
import { OtherIncomesService } from "../../otherIncomesService";
import {
    applyJoinDateSourcesToEmployees,
    attachManualAdjustmentMetadata,
    attachManualAdjustmentSourceComparisons,
    attachManualAdjustmentValueSourceComparison,
    buildLatestHistoryJoinDateQuery,
    buildLatestProfileJoinDateQuery,
    buildLatestValueJoinDateQuery,
    buildManualAdjustmentIdentityIndex,
    filterRowsExcludedFromDivision,
    getManualAdjustmentsForEmployee,
    normalizePayrollValuePriorityMode,
    pickStaticPotonganForManualBuffer,
    pickStaticPremiForManualBuffer,
    registerManualAdjustmentMetadataDynamicHeaders,
    resolveManualAdjustmentDbPtrjCompareAmount,
    resolveManualAdjustmentFetchGangCode,
    shouldKeepPayrollRowAfterEffectiveHkFilter,
    resolveManualAdjustmentSourcePolicy,
} from "./extractHelpers";
import {
    getAttendance as getAttendanceQuery,
    getBrondol as getBrondolQuery,
    getCuti as getCutiQuery,
    getEmployees as getEmployeesQuery,
    getPremi as getPremiQuery,
    getPotongan as getPotonganQuery,
    getTaskCodes as getTaskCodesQuery,
    getTunjanganAmount as getTunjanganAmountQuery,
    getUpahPokok as getUpahPokokQuery,
    getLemburDetailsWithTaskBreakdown as getLemburDetailsWithTaskBreakdownQuery,
} from "./extractQueries";

const CATEGORY = "DataExtractor";

export type ExtractPhase = "identity" | "attendance" | "overtime" | "premium" | "complete";
export interface ExtractArgs {
    month: number;
    year: number;
    gangCode: string;
    divisionCode?: string;
    specificEmpCode?: string | null;
    serverProfile?: string;
    includeVirtualGangs?: boolean;
    useHistoryDb?: boolean | null;
    gangPrefix?: string | null;
    skipHarvest?: boolean;
    skipHeavyDetails?: boolean;
    snapshotVersion?: number | null;
    valuePriorityModeInput?: string | null;
}
export interface ExtractDeps { db: Database; getEmployees?: (gangCondition: string, month: number, year: number, serverProfile?: string, isHistorical?: boolean, gangCodeInput?: string | null) => Promise<any[]> }
export interface ExtractPhaseResult {
    phase: ExtractPhase;
    gangs: Map<string, any[]>;
    current_gang?: string;
    meta: {
        total_gangs: number;
        total_employees: number;
        processed_employees: number;
        progress_pct: number;
        message: string;
        // Snapshot metadata emitted by the history path (absent on live extraction)
        snapshot_version?: number | string | null;
        requested_snapshot_version?: number | string | null;
        available_snapshot_versions?: any[];
        is_history_snapshot?: boolean;
    };
    dynamic_premi_headers?: string[];
    dynamic_potongan_headers?: string[];
    dynamic_premi_titles?: Record<string, string>;
    dynamic_potongan_titles?: Record<string, string>;
}

export async function* extractPayrollCore(
    deps: ExtractDeps,
    args: ExtractArgs
): AsyncGenerator<ExtractPhaseResult> {
    const {
        month,
        year,
        gangCode,
        divisionCode,
        serverProfile,
        gangPrefix,
        useHistoryDb,
        snapshotVersion,
        valuePriorityModeInput
    } = args;

    const valuePriorityMode = normalizePayrollValuePriorityMode(valuePriorityModeInput);
    const manualAdjustmentPolicy = resolveManualAdjustmentSourcePolicy(valuePriorityMode);
        const useAutoBuffer = valuePriorityMode !== "db_ptrj_only";
        const allowManualAdjustments = manualAdjustmentPolicy.applyAmounts;
        const fetchManualAdjustmentRows = manualAdjustmentPolicy.fetchRowsForMetadata;
        const manualBufferOnlyMode = manualAdjustmentPolicy.manualBufferOnly;
        const startTime = Date.now();
        const startDate = `${year}-${month.toString().padStart(2, "0")}-01`;
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        const endDate = `${nextYear}-${nextMonth.toString().padStart(2, "0")}-01`;
        const resolvedDivisionCode = resolvePayrollDivisionCodeForScope(divisionCode);
        const effectiveGangPrefix = resolvePayrollGangPrefixForDivision(divisionCode, gangPrefix);

        const buildProgressiveGangsMap = (rows: any[]): Map<string, any[]> => {
            const gangsMap = new Map<string, any[]>();

            for (const row of rows) {
                const normalizedGangCode = (row.gang_code || "UNKNOWN").trim() || "UNKNOWN";
                if (!gangsMap.has(normalizedGangCode)) {
                    gangsMap.set(normalizedGangCode, []);
                }
                gangsMap.get(normalizedGangCode)!.push(row);
            }

            return gangsMap;
        };

        // Helper: timeout wrapper for enrichment queries - prevents stream from hanging
        async function withTimeout<T>(label: string, promise: Promise<T>, timeoutMs: number): Promise<T | null> {
            try {
                return await Promise.race([
                    promise,
                    new Promise<null>((_, reject) =>
                        setTimeout(() => reject(new Error(`${label} timeout (${timeoutMs}ms)`)), timeoutMs)
                    )
                ]);
            } catch (e: any) {
                debug(CATEGORY, `âš ï¸ ${label} failed/timed out: ${e.message}`);
                return null;
            }
        }

        // NON-BLOCKING: Get gangs first (fast), start currentPeriod in background
        const allGangsPromise = gangService.fetchGangs(divisionCode || undefined, undefined, args.includeVirtualGangs ?? false);
        const currentPeriodPromise = currentPeriodService.getCurrentPeriod().catch(err => {
            console.error("[DataExtractor] Failed to get current period, using defaults:", err.message);
            return { month: month, year: year, is_cached: false };
        });

        const currentPeriod = await currentPeriodPromise;
        const isHistorical = (year < currentPeriod.year) || (year === currentPeriod.year && month < currentPeriod.month);

        let shouldFetchHistory = isHistorical && historyDatabaseService.isHistoryMode();
        if (useHistoryDb === true) {
            shouldFetchHistory = true;
        } else if (useHistoryDb === false) {
            shouldFetchHistory = false;
        }

        const shouldReadHistorySnapshotForSourceMode = valuePriorityMode === "db_ptrj_only";
        if (shouldFetchHistory && shouldReadHistorySnapshotForSourceMode) {
            const historyResult = await (await import("../../dataExtractorService")).dataExtractorService.extractPayrollData(
                month,
                year,
                gangCode,
                divisionCode,
                null,
                serverProfile,
                false,
                useHistoryDb,
                effectiveGangPrefix,
                false,
                false,
                snapshotVersion,
                valuePriorityMode
            );
            const groupedHistoryRows = buildProgressiveGangsMap(historyResult.data_rows);

            yield {
                phase: "complete",
                gangs: groupedHistoryRows,
                meta: {
                    total_gangs: groupedHistoryRows.size,
                    total_employees: historyResult.data_rows.length,
                    processed_employees: historyResult.data_rows.length,
                    progress_pct: 100,
                    message: "Loaded payroll rows from history snapshot"
                },
                dynamic_premi_headers: historyResult.dynamic_premi_headers,
                dynamic_potongan_headers: historyResult.dynamic_potongan_headers,
                dynamic_premi_titles: historyResult.premi_title_map,
                dynamic_potongan_titles: historyResult.potongan_title_map
            };
            return;
        }

        // Wait for gangs first (faster query)
        const allGangs = await allGangsPromise;

        // Build gang condition
        let gangCondition = "1=1";
        let gangCodeInput: string | null = null;
        if (gangCode && gangCode !== "ALL") {
            gangCodeInput = gangCode.trim().toUpperCase();
            gangCondition = `(UPPER(RTRIM(gl.GangCode)) = '${gangCodeInput}' OR UPPER(RTRIM(g.GangCode)) = '${gangCodeInput}' OR UPPER(RTRIM(g.Description)) = '${gangCodeInput}')`;
        } else if (divisionCode) {
            const isVirtual = gangService.isVirtualDivision(divisionCode);
            console.log(`--- REFLI VERSION 1.1.0 (Progressive) ---`);
            console.log(`[DataExtractor.Progressive] Division: ${divisionCode}, isVirtual: ${isVirtual}, allGangs: ${allGangs.length}`);
            if (isVirtual) {
                if (resolvedDivisionCode === 'INF') {
                    // [USER REQUEST] Hardcoded isolation for Infrastruktur: Strictly INF and INT
                    gangCondition = `(UPPER(RTRIM(gl.GangCode)) IN ('INF', 'INT') OR UPPER(RTRIM(g.GangCode)) IN ('INF', 'INT'))`;
                } else if (allGangs.length > 0) {
                    const gangCodes = allGangs.map((gang: { gang_code: string }) => `'${gang.gang_code.trim().toUpperCase()}'`).join(',');
                    const gangDescs = allGangs.filter(g => g.description).map((gang: { description: string }) => `'${gang.description.trim().toUpperCase()}'`).join(',');
                    
                    gangCondition = `(UPPER(RTRIM(gl.GangCode)) IN (${gangCodes}) OR UPPER(RTRIM(g.GangCode)) IN (${gangCodes})`;
                    if (gangDescs) {
                        gangCondition += ` OR UPPER(RTRIM(g.Description)) IN (${gangDescs})`;
                    }
                    gangCondition += `)`;
                } else {
                    gangCondition = "1=0";
                }
            } else {
                const aliases = gangService.getDivisionCodesWithAliases(divisionCode);
                const placeholders = aliases.map((a: string) => `'${a.toUpperCase()}'`).join(',');
                
                let locCondition = `(UPPER(RTRIM(g.LocCode)) IN (${placeholders}))`;
                
                if (allGangs.length > 0) {
                    const gangCodes = allGangs.map((gang: { gang_code: string }) => `'${gang.gang_code.trim().toUpperCase()}'`).join(',');
                    locCondition = `(${locCondition} OR UPPER(RTRIM(gl.GangCode)) IN (${gangCodes}))`;
                }

                gangCondition = locCondition;

                // Exclude virtual division gangs strictly using divisionConfigService (covers INFRA, NURSERY, WORKSHOP, MEC)
                gangCondition += divisionConfigService.getVirtualExclusionSQL();
            }
        }

        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        // PHASE 0: Get employees ONLY (fast, ~1s)
        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        const t0 = Date.now();
        
        // Get current period WITHOUT blocking employee query
        const currentMonth = currentPeriod.month;
        const currentYear = currentPeriod.year;
        
        let employees: Employee[] = deps.getEmployees
            ? await (deps.getEmployees as any)(gangCondition, month, year, serverProfile, isHistorical, gangCodeInput)
            : await getEmployeesQuery(deps.db, gangCondition, month, year, serverProfile, isHistorical, gangCodeInput);
        employees = filterRowsExcludedFromDivision(employees, divisionCode);
        const phase0Time = Date.now() - t0;
        debug(CATEGORY, `ðŸš€ Phase 0 (identity): ${phase0Time}ms, ${employees.length} employees`);

        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        // PHASE 0b: Enrichment - NIK from extend_db_ptrj history
        // Jabatan: will be added later when history_gang_member has the column
        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        if (employees.length > 0) {
            const empCodeList = employees.map(e => `'${e.emp_code}'`).join(',');
            let nikFound = 0;

            // Ensure ALL employees have nik and jabatan fields (even if empty)
            for (const emp of employees) {
                emp.nik = emp.actual_nik || emp.emp_code;  // Default fallback
                emp.jabatan = emp.jabatan || '';            // Default fallback
            }

            // Try NIK from history_hr_employee (extend_db_ptrj)
            // CRITICAL: Wrap with timeout to prevent stream from hanging
            try {
                const extendDb = Database.getExtendedInstance();
                const nikRows = await withTimeout('NIK lookup (history_hr_employee)',
                    extendDb.query<any>(`
                        SELECT RTRIM(emp_code) as emp_code, RTRIM(nik) as nik
                        FROM dbo.history_hr_employee
                        WHERE RTRIM(emp_code) IN (${empCodeList})
                          AND nik IS NOT NULL AND RTRIM(nik) != ''
                    `),
                    5000 // 5 second timeout
                );
                if (nikRows) {
                    const nikMap = new Map<string, string>();
                    for (const row of nikRows) {
                        if (row?.emp_code && !nikMap.has(row.emp_code)) nikMap.set(row.emp_code, row.nik ?? '');
                    }
                    for (const emp of employees) {
                        if (nikMap.has(emp.emp_code)) {
                            const nikVal = nikMap.get(emp.emp_code)!;
                            emp.actual_nik = nikVal;
                            emp.nik = nikVal;
                            nikFound++;
                        }
                    }
                    debug(CATEGORY, `ðŸ“‹ NIK from history_hr_employee: ${nikFound}/${employees.length}`);
                }
            } catch (e: any) {
                debug(CATEGORY, `âš ï¸ history_hr_employee NIK lookup skipped: ${e.message}`);
            }

            // [JOIN_DATE] Get join_date with override support
            // Priority: 1) employee_profile_override_history.effective_start_date (current edit mode),
            //           2) payroll_value_override_history legacy join_date fallback,
            //           3) history_hr_employee seed base.
            let joinDateFound = 0;
            try {
                const extendDb = Database.getExtendedInstance();

                const profileOverrideRows = await withTimeout('Join date lookup (profile override latest)',
                    extendDb.query<any>(buildLatestProfileJoinDateQuery(empCodeList)),
                    5000
                );

                const overrideRows = await withTimeout('Join date lookup (legacy value override latest)',
                    extendDb.query<any>(buildLatestValueJoinDateQuery(empCodeList)),
                    5000
                );
                if (overrideRows && overrideRows.length > 0) {
                    debug(CATEGORY, `ðŸ“‹ Join date from value override: ${overrideRows.length} overrides found`);
                }

                if (profileOverrideRows && profileOverrideRows.length > 0) {
                    debug(CATEGORY, `ðŸ“‹ Join date from profile override latest: ${profileOverrideRows.length} found`);
                }

                const historyRows = await withTimeout('Join date lookup (history_hr_employee latest)',
                    extendDb.query<any>(buildLatestHistoryJoinDateQuery(empCodeList)),
                    5000
                );

                applyJoinDateSourcesToEmployees(employees as any, {
                    profileOverrideRows: profileOverrideRows as any,
                    valueOverrideRows: overrideRows as any,
                    historyRows: historyRows as any
                });

                for (const emp of employees) {
                    if (emp.join_date) {
                        joinDateFound++;
                    }
                }
                debug(CATEGORY, `ðŸ“‹ Join date enriched: ${joinDateFound}/${employees.length}`);
            } catch (e: any) {
                debug(CATEGORY, `âš ï¸ join_date enrichment skipped: ${e.message}`);
            }

            // [IS_SPSI_MEMBER] Resolve SPSI membership:
            // Priority: 1) employee_profile_override_history, 2) history_hr_employee base.
            let spsiFound = 0;
            try {
                const extendDb = Database.getExtendedInstance();
                const spsiMap = new Map<string, boolean>();

                const profileSpsiRows = await withTimeout('SPSI member lookup (employee_profile_override_history MAX id)',
                    extendDb.query<any>(`
                        SELECT p.emp_code, p.is_spsi_member
                        FROM dbo.employee_profile_override_history p
                        INNER JOIN (
                            SELECT emp_code, MAX(id) as max_id
                            FROM dbo.employee_profile_override_history
                            WHERE RTRIM(emp_code) IN (${empCodeList})
                              AND is_spsi_member IS NOT NULL
                            GROUP BY emp_code
                        ) latest ON p.emp_code = latest.emp_code AND p.id = latest.max_id
                    `),
                    5000
                );

                if (profileSpsiRows && profileSpsiRows.length > 0) {
                    for (const row of profileSpsiRows) {
                        const empCode = String(row.emp_code || '').trim().toUpperCase();
                        if (!empCode || spsiMap.has(empCode)) continue;
                        spsiMap.set(empCode, !!row.is_spsi_member);
                    }
                    debug(CATEGORY, `ðŸ“‹ is_spsi_member from employee_profile_override_history (MAX id): ${profileSpsiRows.length} source rows`);
                }

                const historySpsiRows = await withTimeout('SPSI member lookup (history_hr_employee MAX id)',
                    extendDb.query<any>(`
                        SELECT h.emp_code, h.is_spsi_member
                        FROM dbo.history_hr_employee h
                        INNER JOIN (
                            SELECT emp_code, MAX(id) as max_id
                            FROM dbo.history_hr_employee
                            WHERE RTRIM(emp_code) IN (${empCodeList})
                              AND is_spsi_member IS NOT NULL
                            GROUP BY emp_code
                        ) latest ON h.emp_code = latest.emp_code AND h.id = latest.max_id
                    `),
                    5000
                );

                if (historySpsiRows && historySpsiRows.length > 0) {
                    for (const row of historySpsiRows) {
                        const empCode = String(row.emp_code || '').trim().toUpperCase();
                        if (!empCode || spsiMap.has(empCode)) continue;
                        spsiMap.set(empCode, !!row.is_spsi_member);
                    }
                    debug(CATEGORY, `ðŸ“‹ is_spsi_member from history_hr_employee (MAX id): ${historySpsiRows.length} source rows`);
                }

                // Forward-persistence: emp yang pernah SPSI member di periode < periode ini.
                // Sekali member -> member sampai override false. Cegah flapping null/false.
                const periodStart = year * 12 + (month - 1);
                const priorSpsiRows = await withTimeout('SPSI prior member lookup (history_hr_employee)',
                    extendDb.query<{ emp_code: string }>(`
                        SELECT DISTINCT RTRIM(emp_code) as emp_code
                        FROM dbo.history_hr_employee
                        WHERE RTRIM(emp_code) IN (${empCodeList})
                          AND is_spsi_member = 1
                          AND (period_year * 12 + (period_month - 1)) < ?
                    `, [periodStart]),
                    5000
                );
                const priorSpsiMember = new Set<string>();
                if (priorSpsiRows) {
                    for (const row of priorSpsiRows) {
                        const ec = String(row.emp_code || '').trim().toUpperCase();
                        if (ec) priorSpsiMember.add(ec);
                    }
                    debug(CATEGORY, `ðŸ“‹ SPSI forward-persist candidates (prior member): ${priorSpsiMember.size}`);
                }

                // Auto-buffer SPSI evidence: emp dengan auto-buffer SPSI amount>0 di periode
                // manapun = bukti member. Masuk forward-persist set.
                const autoBufferSpsiRows = await withTimeout('SPSI auto-buffer member lookup',
                    extendDb.query<{ emp_code: string }>(`
                        SELECT DISTINCT RTRIM(emp_code) as emp_code
                        FROM dbo.payroll_manual_adjustments
                        WHERE adjustment_type = 'AUTO_BUFFER'
                          AND adjustment_name = 'SPSI'
                          AND ABS(amount) > 0
                          AND RTRIM(emp_code) IN (${empCodeList})
                    `),
                    5000
                );
                if (autoBufferSpsiRows) {
                    let added = 0;
                    for (const row of autoBufferSpsiRows) {
                        const ec = String(row.emp_code || '').trim().toUpperCase();
                        if (ec && !priorSpsiMember.has(ec)) { priorSpsiMember.add(ec); added++; }
                    }
                    debug(CATEGORY, `ðŸ“‹ SPSI forward-persist candidates (auto-buffer evidence): +${added}`);
                }

                // SSOT SPSI: extend_db_ptrj (override > history).
                // Forward-persistence guard: kalo pernah member di periode sebelumnya (history),
                // tetap member kecuali override false. Live db_ptrj (pot_spsi) hanya comparison,
                // fallback kalau extend tidak punya data sama sekali.
                for (const emp of employees) {
                    const empCodeKey = String(emp.emp_code || '').trim().toUpperCase();
                    let resolved: boolean | null = null;
                    if (spsiMap.has(empCodeKey)) {
                        resolved = !!spsiMap.get(empCodeKey);
                    }
                    // Forward-persistence: kalau extend belum ada nilai, cek history prior member
                    if (resolved === null && priorSpsiMember.has(empCodeKey)) {
                        resolved = true;
                    }
                    // Fallback: live db_ptrj pot_spsi > 0 (comparison source)
                    if (resolved === null) {
                        const liveSpsi = Number(emp.pot_spsi || 0) > 0;
                        if (liveSpsi) resolved = true;
                    }
                    if (resolved !== null) {
                        emp.is_spsi_member = resolved;
                        spsiFound++;
                    }
                }
                debug(CATEGORY, `ðŸ“‹ is_spsi_member enriched: ${spsiFound}/${employees.length} (override/history + forward-persist + live fallback)`);
            } catch (e: any) {
                debug(CATEGORY, `âš ï¸ is_spsi_member enrichment skipped: ${e.message}`);
            }

            // Try Jabatan from history_gang_member (extend_db_ptrj)
            // NOTE: Jabatan (role text like "Mandor", "Kerani") is stored in extend_db_ptrj,
            // NOT in HR_GANGLN. HR_GANGLN only has GangMember/GangCode (gang membership), not jabatan.
            // Two sources for jabatan:
            //   1. history_gang_member.jabatan - from manual seed/entry
            //   2. employee_estate.jabatan - from employee estate management
            let jabatanFound = 0;
            try {
                const extendDb = Database.getExtendedInstance();
                const jabatanRows = await withTimeout('Jabatan lookup (history_gang_member)',
                    extendDb.query<any>(`
                        SELECT RTRIM(emp_code) as emp_code, RTRIM(jabatan) as jabatan
                        FROM dbo.history_gang_member
                        WHERE RTRIM(emp_code) IN (${empCodeList})
                          AND jabatan IS NOT NULL AND RTRIM(jabatan) != ''
                    `),
                    5000 // 5 second timeout
                );
                if (jabatanRows) {
                    const jabatanMap = new Map<string, string>();
                    for (const row of jabatanRows) {
                        if (!jabatanMap.has(row.emp_code)) jabatanMap.set(row.emp_code, row.jabatan);
                    }
                    for (const emp of employees) {
                        if (jabatanMap.has(emp.emp_code)) {
                            emp.jabatan = jabatanMap.get(emp.emp_code);
                            jabatanFound++;
                        }
                    }
                    debug(CATEGORY, `ðŸ“‹ Jabatan from history_gang_member: ${jabatanFound}/${employees.length}`);
                }
            } catch (e: any) {
                debug(CATEGORY, `âš ï¸ history_gang_member jabatan lookup skipped: ${e.message}`);
            }

            // [FALLBACK] If jabatan still empty, try employee_estate
            // employee_estate is the PRIMARY source for jabatan (role text) when history_gang_member is not seeded
            let jabatanEstateFound = 0;
            try {
                const extendDb = Database.getExtendedInstance();
                const estateRows = await withTimeout('Jabatan lookup (employee_estate fallback)',
                    extendDb.query<any>(`
                        SELECT RTRIM(empcode) as emp_code, RTRIM(jabatan) as jabatan
                        FROM dbo.employee_estate
                        WHERE RTRIM(empcode) IN (${empCodeList})
                          AND jabatan IS NOT NULL AND RTRIM(jabatan) != ''
                    `),
                    5000 // 5 second timeout
                );
                if (estateRows) {
                    const estateMap = new Map<string, string>();
                    for (const row of estateRows) {
                        if (!estateMap.has(row.emp_code)) estateMap.set(row.emp_code, row.jabatan);
                    }
                    for (const emp of employees) {
                        if (!emp.jabatan && estateMap.has(emp.emp_code)) {
                            emp.jabatan = estateMap.get(emp.emp_code);
                            jabatanEstateFound++;
                        }
                    }
                    debug(CATEGORY, `ðŸ“‹ Jabatan from employee_estate (fallback): ${jabatanEstateFound}/${employees.length}`);
                }
            } catch (e: any) {
                debug(CATEGORY, `âš ï¸ employee_estate jabatan fallback skipped: ${e.message}`);
            }

            // [JABATAN ESTATE] Get jabatan from employee_estate (extend_db_ptrj) for jabatan_estate field
            // CRITICAL: Wrap with timeout to prevent stream from hanging if query is slow
            let jabatanEstateSectionFound = 0;
            try {
                const { EmployeeEstateService: EES } = await import("../../employeeEstateService");
                debug(CATEGORY, `ðŸ” Attempting to get employee jobs with NIK...`);
                // Timeout wrapper: 5 seconds max for this enrichment query
                const timeoutMs = 5000;
                const currentEmpCodes = employees.map(e => e.emp_code);
                const jobTitlesResult = await Promise.race([
                    EES.getEmployeeJobsWithNik(currentEmpCodes),
                    new Promise<null>((_, reject) =>
                        setTimeout(() => reject(new Error('getEmployeeJobsWithNik timeout (5s)')), timeoutMs)
                    )
                ]).catch((e) => {
                    debug(CATEGORY, `âš ï¸ employee_estate jabatan lookup timed out: ${e.message}`);
                    return null;
                }) as any;

                if (jobTitlesResult) {
                    const { empcodeMap: estateEmpMap, nikMap: estateNikMap } = jobTitlesResult;
                    debug(CATEGORY, `ðŸ“Š Loaded estate maps - empcodeMap: ${Object.keys(estateEmpMap).length} entries, nikMap: ${Object.keys(estateNikMap).length} entries`);
                    for (const emp of employees) {
                        const nikClean = (emp.actual_nik || '').trim().toUpperCase();
                        const estateJabatan = estateEmpMap[emp.emp_code] || estateNikMap[nikClean] || '';
                        if (estateJabatan) {
                            emp.jabatan_estate = estateJabatan;
                            jabatanEstateSectionFound++;
                        } else if (emp.jabatan) {
                            // Fallback to history_gang_member jabatan if estate is empty
                            emp.jabatan_estate = emp.jabatan;
                        } else {
                            emp.jabatan_estate = '';
                        }
                    }
                    debug(CATEGORY, `ðŸ“‹ Jabatan estate from employee_estate: ${jabatanEstateSectionFound}/${employees.length}`);
                } else {
                    debug(CATEGORY, `âš ï¸ jobTitlesResult is null - no estate maps available`);
                }
            } catch (e: any) {
                debug(CATEGORY, `âš ï¸ employee_estate jabatan lookup skipped: ${e.message}`);
            }

            // Log enrichment result
            debug(CATEGORY, `ðŸ“Š Final enrichment: NIK=${nikFound}, Jabatan=${jabatanFound}`);
            for (let i = 0; i < Math.min(3, employees.length); i++) {
                debug(CATEGORY, `  ${employees[i].emp_code}: nik=${employees[i].nik || '-'}, jabatan=${employees[i].jabatan || '-'}`);
            }
        }

        // Apply gangPrefix filter
        if (effectiveGangPrefix && employees.length > 0) {
            const isNumeric = /^\d+$/.test(effectiveGangPrefix);
            employees = employees.filter(emp => {
                const gc = (emp.gang_code || '').trim().toUpperCase();
                if (isNumeric) {
                    const asistensi = gc.startsWith('K2') ? '1' : (gc.match(/\d+/)?.[0] ?? null);
                    return asistensi === effectiveGangPrefix;
                }
                return gc.startsWith(effectiveGangPrefix.toUpperCase());
            });
        }

        if (employees.length === 0) {
            yield {
                phase: 'complete',
                gangs: new Map(),
                meta: { total_gangs: 0, total_employees: 0, processed_employees: 0, progress_pct: 100, message: 'No employees found' }
            };
            return;
        }

        // Build initial gangs map with IDENTITY ONLY (nama, gender, gang)
        const gangsMap = new Map<string, any[]>();
        const gangOrder: string[] = [];
        
        // DEBUG: Log first 3 employees after enrichment
        debug(CATEGORY, `ðŸ“Š Building gangsMap with ${employees.length} employees. Sample enrichment status:`);
        for (let i = 0; i < Math.min(3, employees.length); i++) {
            const emp = employees[i];
            debug(CATEGORY, `  ${emp.emp_code}: actual_nik=${emp.actual_nik || '(none)'}, jabatan=${emp.jabatan || '(none)'}, role=${emp.role || '(none)'}`);
        }
        
        for (const emp of employees) {
            const gang = emp.gang_code || "UNKNOWN";
            if (!gangsMap.has(gang)) {
                gangsMap.set(gang, []);
                gangOrder.push(gang);
            }
            const masaKerjaIdentity = calculateMasaKerjaDisplay(emp.join_date, month, year);
            const isSpsiIdentity = typeof emp.is_spsi_member === "boolean" ? emp.is_spsi_member : false;
            gangsMap.get(gang)!.push({
                emp_code: emp.emp_code,
                nik: emp.actual_nik || emp.emp_code,  // NIK from extend_db_ptrj or fallback to emp_code
                nama: emp.emp_name,
                gang_code: emp.gang_code,
                gang_desc: emp.gang_desc || '',
                loc_code: emp.loc_code,
                gender: emp.gender,
                join_date: emp.join_date || null,
                tanggal_masuk: emp.join_date || null,
                is_spsi_member: isSpsiIdentity,
                masa_kerja_tahun: masaKerjaIdentity.years,
                masa_kerja_display_years: masaKerjaIdentity.years,
                masa_kerja_display_months: masaKerjaIdentity.months,
                masa_kerja_label: masaKerjaIdentity.label,
                // Jabatan ROLE TEXT (e.g. "Mandor", "Kerani") from extend_db_ptrj
                // NOT from HR_GANGLN - Phase 3 enriches this from employee_estate or history_gang_member
                jabatan: emp.jabatan || '',
                jabatan_estate: emp.jabatan_estate || emp.jabatan || '',  // Jabatan from employee_estate (extend_db_ptrj)
                role: emp.role || '',        // Role from history
                alamat: emp.res_address || '', // Map res_address to alamat for frontend
                // Phase markers
                _phase: 0,
                _enriched: false,
                _loading: false
            });
        }

        // âœ… YIELD PHASE 0: Names ONLY - Frontend renders IMMEDIATELY
        yield {
            phase: 'identity',
            gangs: new Map(gangsMap),
            meta: {
                total_gangs: gangsMap.size,
                total_employees: employees.length,
                processed_employees: employees.length,
                progress_pct: 10,
                message: `Loaded ${employees.length} employees. Fetching attendance...`
            }
        };

        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        // PHASE 1: LAZY LOAD Attendance + Cuti (Background)
        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        const t1 = Date.now();
        const empCodes = employees.map(e => e.emp_code);
        const BATCH_SIZE = 50;
        const empCodeChunks: string[][] = [];
        for (let i = 0; i < empCodes.length; i += BATCH_SIZE) {
            empCodeChunks.push(empCodes.slice(i, i + BATCH_SIZE));
        }

        // Global accumulators for lazy loading
        const globalAttendanceMap: Record<string, any> = {};
        const globalCutiMap: Record<string, any> = {};
        const globalLemburMap: Record<string, any> = {};
        const globalJabatanMap: Record<string, number> = {};
        const globalMasaKerjaMap: Record<string, number> = {};
        const globalUpahPokokMap: Record<string, number> = {};
        const globalBrondolMap: Record<string, number> = {};
        const globalTaskCodesMap: Record<string, any> = {};
        const globalPremiResult = { amounts: {} as Record<string, Record<string, number>>, titleMap: {} as Record<string, string> };
        const globalPotonganResult = { amounts: {} as Record<string, Record<string, number>>, titleMap: {} as Record<string, string> };
        const baselinePotSpsiByEmp: Record<string, number> = {};
        const dynamicPremiSet = new Set<string>();
        const dynamicPotonganSet = new Set<string>();

        async function safeQuery<T>(label: string, fn: () => Promise<T>, defaultValue: T): Promise<T> {
            try {
                return await fn();
            } catch (err: any) {
                warn(CATEGORY, `âš ï¸ ${label} failed: ${err.message}`);
                return defaultValue;
            }
        }

        const emptyPremiResult = { amounts: {} as Record<string, Record<string, number>>, titleMap: {} as Record<string, string>, details: {} as Record<string, any[]> };
        const emptyPotonganResult = { amounts: {} as Record<string, Record<string, number>>, titleMap: {} as Record<string, string> };
        const manualAdjustmentsPromise = fetchManualAdjustmentRows
            ? safeQuery(
                'manualAdjustments',
                () => manualAdjustmentService.getAdjustments(month, year, resolveManualAdjustmentFetchGangCode(gangCode, divisionCode), undefined, divisionCode),
                [] as any[]
            )
            : Promise.resolve([] as any[]);

        // [PHASE 1] Attendance + Cuti
        debug(CATEGORY, `ðŸ“‹ Phase 1: Loading attendance/cuti...`);
        const phase1Promises = empCodeChunks.map((chunk, idx) => Promise.all([
            safeQuery(`attendance[${idx}]`, () => getAttendanceQuery(deps.db, chunk, startDate, endDate, serverProfile), {}),
            safeQuery(`cuti[${idx}]`, () => getCutiQuery(deps.db, chunk, startDate, endDate, serverProfile), {}),
        ]));
        const phase1Results = await Promise.all(phase1Promises);
        for (const [attB, cutiB] of phase1Results) {
            Object.assign(globalAttendanceMap, attB);
            Object.assign(globalCutiMap, cutiB);
        }

        // Update employees with attendance data
        for (const emp of employees) {
            const attData = globalAttendanceMap[emp.emp_code] || { hk: 0, total_hours: 0, total_amount_rp: 0, shortage_count: 0 };
            const empCuti = globalCutiMap[emp.emp_code] || { cuti_tahunan: 0, cuti_sakit_haid: 0, cuti_minggu: 0, cuti_nasional: 0 };
            emp.jumlah_hk = attData.hk || 0;
            emp.total_jam_kerja = attData.total_hours || 0;
            emp.total_amount_rp = attData.total_amount_rp || 0; // Gaji Pokok Aktual dari database
            emp.shortage_count = attData.shortage_count || 0;
            emp.cuti_tahunan_hari = empCuti.cuti_tahunan;
            emp.cuti_sakit_haid_hari = empCuti.cuti_sakit_haid;
            emp.cuti_minggu_hari = empCuti.cuti_minggu;
            emp.cuti_nasional_hari = empCuti.cuti_nasional;
            emp._phase = 1;
        }

        // Update gangsMap with attendance data
        for (const [gangCodeKey, gangEmployees] of gangsMap) {
            for (const emp of gangEmployees) {
                const empData = employees.find(e => e.emp_code === emp.emp_code);
                if (empData) {
                    Object.assign(emp, {
                        jumlah_hk: empData.jumlah_hk,
                        total_jam_kerja: empData.total_jam_kerja,
                        total_amount_rp: empData.total_amount_rp,
                        shortage_count: empData.shortage_count,
                        cuti_tahunan_hari: empData.cuti_tahunan_hari,
                        cuti_sakit_haid_hari: empData.cuti_sakit_haid_hari,
                        cuti_minggu_hari: empData.cuti_minggu_hari,
                        cuti_nasional_hari: empData.cuti_nasional_hari,
                        _phase: 1
                    });
                }
            }
        }

        debug(CATEGORY, `âœ… Phase 1 (attendance): ${Date.now() - t1}ms`);
        yield {
            phase: 'attendance',
            gangs: new Map(gangsMap),
            meta: {
                total_gangs: gangsMap.size,
                total_employees: employees.length,
                processed_employees: employees.length,
                progress_pct: 25,
                message: `Attendance loaded. Processing overtime...`
            }
        };

        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        // PHASE 2: LAZY LOAD Overtime + Allowances
        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        const t2 = Date.now();
        debug(CATEGORY, `â±ï¸ Phase 2: Loading overtime/allowances...`);

        const phase2Promises = empCodeChunks.map((chunk, idx) => Promise.all([
            safeQuery(`lembur[${idx}]`, () => getLemburDetailsWithTaskBreakdownQuery(chunk, month, year, serverProfile), {}),
            safeQuery(`jabatan[${idx}]`, () => getTunjanganAmountQuery(deps.db, chunk, startDate, endDate, "JABATAN", serverProfile), {}),
            safeQuery(`masaKerja[${idx}]`, () => getTunjanganAmountQuery(deps.db, chunk, startDate, endDate, "MASA%KERJA", serverProfile), {}),
            safeQuery(`upahPokok[${idx}]`, () => getUpahPokokQuery(deps.db, chunk, year, currentYear, serverProfile), {}),
        ]));
        const phase2Results = await Promise.all(phase2Promises);
        for (const [lemburB, jabatanB, masaKerjaB, upahB] of phase2Results) {
            Object.assign(globalLemburMap, lemburB);
            Object.assign(globalJabatanMap, jabatanB);
            Object.assign(globalMasaKerjaMap, masaKerjaB);
            Object.assign(globalUpahPokokMap, upahB);
        }

        // Update employees with overtime data
        for (const emp of employees) {
            const empLembur = globalLemburMap[emp.emp_code] || { jam: 0, jumlah: 0, records: [] };
            emp.lembur_jam = empLembur.jam || 0;
            emp.lembur_jumlah = empLembur.jumlah || 0;
            emp.lembur_records = empLembur.records || [];
            emp.jabatan_jumlah = globalJabatanMap[emp.emp_code] || 0;
            emp.masa_kerja_jumlah = globalMasaKerjaMap[emp.emp_code] || 0;
            emp.upah_dasar = globalUpahPokokMap[emp.emp_code] || emp.pay_rate || 0;
            emp._phase = 2;
        }

        // Update gangsMap
        for (const [gangCodeKey, gangEmployees] of gangsMap) {
            for (const emp of gangEmployees) {
                const empData = employees.find(e => e.emp_code === emp.emp_code);
                if (empData) {
                    Object.assign(emp, {
                        lembur_jam: empData.lembur_jam,
                        lembur_jumlah: empData.lembur_jumlah,
                        lembur_records: empData.lembur_records,
                        jabatan_jumlah: empData.jabatan_jumlah,
                        masa_kerja_jumlah: empData.masa_kerja_jumlah,
                        upah_dasar: empData.upah_dasar,
                        _phase: 2
                    });
                }
            }
        }

        debug(CATEGORY, `âœ… Phase 2 (overtime/allowances): ${Date.now() - t2}ms`);
        yield {
            phase: 'overtime',
            gangs: new Map(gangsMap),
            meta: {
                total_gangs: gangsMap.size,
                total_employees: employees.length,
                processed_employees: employees.length,
                progress_pct: 50,
                message: `Overtime loaded. Processing premiums...`
            }
        };

        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        // PHASE 3: LAZY LOAD Premiums + Deductions
        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        const t3 = Date.now();
        debug(CATEGORY, `ðŸ’° Phase 3: Loading premiums/deductions...`);

        const phase3Promises = empCodeChunks.map((chunk, idx) => Promise.all([
            safeQuery(`premi[${idx}]`, () => getPremiQuery(deps.db, chunk, startDate, endDate, isHistorical, serverProfile), JSON.parse(JSON.stringify(emptyPremiResult))),
            safeQuery(`potongan[${idx}]`, () => getPotonganQuery(deps.db, chunk, startDate, endDate, serverProfile), JSON.parse(JSON.stringify(emptyPotonganResult))),
            safeQuery(`brondol[${idx}]`, () => getBrondolQuery(deps.db, chunk, startDate, endDate, serverProfile), {}),
            safeQuery(`taskCodes[${idx}]`, () => getTaskCodesQuery(deps.db, chunk, startDate, endDate, serverProfile), {}),
        ]));
        const phase3Results = await Promise.all(phase3Promises);
        for (const [premiB, potB, brondolB, taskCodesB] of phase3Results) {
            Object.assign(globalPremiResult.amounts, premiB.amounts);
            Object.assign(globalPremiResult.titleMap, premiB.titleMap);
            Object.assign(globalPotonganResult.amounts, potB.amounts);
            Object.assign(globalPotonganResult.titleMap, potB.titleMap);
            Object.assign(globalBrondolMap, brondolB);
            Object.assign(globalTaskCodesMap, taskCodesB);

            // Collect dynamic headers
            if (!manualBufferOnlyMode) {
                for (const [, empPremi] of Object.entries(premiB.amounts || {})) {
                    for (const key of Object.keys(empPremi || {})) {
                        if (key !== "koreksi" && key !== "brondol") {
                            // Use prefixed field name to match frontend data
                            const fieldName = key.startsWith('premi_') ? key : `premi_${key}`;
                            dynamicPremiSet.add(fieldName);
                        }
                    }
                }
            }
            for (const [empCode, empPot] of Object.entries(potB.amounts || {})) {
                if (baselinePotSpsiByEmp[empCode] === undefined) {
                    baselinePotSpsiByEmp[empCode] = Math.abs(Number((empPot as any)?.SPSI) || 0);
                }
                if (!manualBufferOnlyMode) {
                    for (const key of Object.keys(empPot || {})) {
                        if (key !== "SPSI" && key !== "PPH21") {
                            // For KOREKSI: use key as-is (e.g., "KOREKSI_1", "KOREKSI_2")
                            // For others: use prefixed name (e.g., "potongan_X")
                            let fieldName;
                            if (String(key).toUpperCase().startsWith("KOREKSI")) {
                                fieldName = key; // Keep KOREKSI fields as-is for frontend matching
                            } else if (key.startsWith('potongan_')) {
                                fieldName = key;
                            } else {
                                fieldName = `potongan_${key}`;
                            }
                            dynamicPotonganSet.add(fieldName);
                        }
                    }
                }
            }
        }

        const manualAdjustmentsRaw = await manualAdjustmentsPromise;
        const manualAdjustmentsByIdentity = buildManualAdjustmentIdentityIndex(
            Array.isArray(manualAdjustmentsRaw) ? manualAdjustmentsRaw : []
        );

        // Update employees with premium data
        for (const emp of employees) {
            const dbEmpPremiSource = globalPremiResult.amounts[emp.emp_code] || {};
            const dbEmpPotonganSource = globalPotonganResult.amounts[emp.emp_code] || {};
            const empPremi = manualBufferOnlyMode ? pickStaticPremiForManualBuffer(dbEmpPremiSource) : { ...dbEmpPremiSource };
            const empPotongan = manualBufferOnlyMode
                ? pickStaticPotonganForManualBuffer(dbEmpPotonganSource)
                : { ...dbEmpPotonganSource };
            const empBrondol = globalBrondolMap[emp.emp_code] || 0;
            const empPremiBrondol = empPremi["brondol"] || 0;
            const valueSyncFrame: Record<string, "red" | "green"> = { ...(emp.value_sync_frame || {}) };

            let total_premi = 0;
            for (const [key, val] of Object.entries(empPremi)) {
                if (key !== "koreksi") total_premi += Number(val) || 0;
            }
            total_premi += empBrondol;

            const empAdjustments = fetchManualAdjustmentRows
                ? getManualAdjustmentsForEmployee(manualAdjustmentsByIdentity, emp)
                : [];
            Object.defineProperty(emp, "_manualAdjustmentCount", {
                value: empAdjustments.length,
                configurable: true,
                writable: true,
                enumerable: false
            });
            registerManualAdjustmentMetadataDynamicHeaders(
                empAdjustments,
                dynamicPremiSet,
                dynamicPotonganSet,
                globalPremiResult.titleMap,
                globalPotonganResult.titleMap
            );
            if (allowManualAdjustments && empAdjustments.length > 0) {
                const premiKeysBefore = new Set(Object.keys(empPremi));
                const potonganKeysBefore = new Set(Object.keys(empPotongan));
                const manualApplied = applyManualAdjustmentsToEmployee({
                    adjustments: empAdjustments as any[],
                    empPremi,
                    empPotongan,
                    premiTitleMap: globalPremiResult.titleMap,
                    potonganTitleMap: globalPotonganResult.titleMap,
                    mode: 'override'
                });

                for (const key of Object.keys(manualApplied.empPremi)) {
                    if (premiKeysBefore.has(key) || key === "koreksi" || key === "brondol") continue;
                    const fieldName = key.startsWith("premi_") ? key : `premi_${key}`;
                    dynamicPremiSet.add(fieldName);
                }

                for (const key of Object.keys(manualApplied.empPotongan)) {
                    if (potonganKeysBefore.has(key)) continue;

                    const keyUpper = String(key).toUpperCase();
                    if (keyUpper === "SPSI" || keyUpper === "PPH21" || keyUpper === "PREMI_PPH") continue;

                    let fieldName: string;
                    if (keyUpper.startsWith("KOREKSI")) {
                        fieldName = key;
                    } else if (key.startsWith("potongan_")) {
                        fieldName = key;
                    } else {
                        fieldName = `potongan_${key}`;
                    }
                    dynamicPotonganSet.add(fieldName);
                }

                total_premi += manualApplied.totalPremiDelta;
                for (const syncMeta of manualApplied.fieldSyncMeta) {
                    attachManualAdjustmentValueSourceComparison(
                        valueSyncFrame,
                        emp.value_source_compare ||= {},
                        syncMeta,
                        resolveManualAdjustmentDbPtrjCompareAmount(syncMeta, dbEmpPremiSource, dbEmpPotonganSource)
                    );
                }
            } else if (empAdjustments.length > 0) {
                attachManualAdjustmentSourceComparisons(
                    valueSyncFrame,
                    emp.value_source_compare ||= {},
                    empAdjustments,
                    dbEmpPremiSource,
                    dbEmpPotonganSource
                );
            }
            attachManualAdjustmentMetadata(emp as any, empAdjustments);

            globalPremiResult.amounts[emp.emp_code] = empPremi;
            globalPotonganResult.amounts[emp.emp_code] = empPotongan;
            globalBrondolMap[emp.emp_code] = empBrondol;

            emp.premi = empPremi;
            emp.potongan = empPotongan;
            emp.premi_brondol = empBrondol + empPremiBrondol;
            emp.total_premi = total_premi;
            emp.task_code = globalTaskCodesMap[emp.emp_code]?.task_code || "";
            emp.task_desc = globalTaskCodesMap[emp.emp_code]?.task_desc || "";
            emp.value_sync_frame = valueSyncFrame;
            emp._phase = 3;
        }

        // Update gangsMap
        for (const [gangCodeKey, gangEmployees] of gangsMap) {
            for (const emp of gangEmployees) {
                const empData = employees.find(e => e.emp_code === emp.emp_code);
                if (empData) {
                    Object.assign(emp, {
                        premi: empData.premi,
                        potongan: empData.potongan,
                        premi_brondol: empData.premi_brondol,
                        total_premi: empData.total_premi,
                        task_code: empData.task_code,
                        task_desc: empData.task_desc,
                        value_sync_frame: empData.value_sync_frame,
                        value_source_compare: empData.value_source_compare,
                        manual_adjustment_metadata: empData.manual_adjustment_metadata,
                        manual_adjustment_metadata_mismatch: empData.manual_adjustment_metadata_mismatch,
                        _phase: 3
                    });
                }
            }
        }

        debug(CATEGORY, `âœ… Phase 3 (premiums/deductions): ${Date.now() - t3}ms`);
        yield {
            phase: 'premium',
            gangs: new Map(gangsMap),
            meta: {
                total_gangs: gangsMap.size,
                total_employees: employees.length,
                processed_employees: employees.length,
                progress_pct: 75,
                message: `Premiums loaded. Calculating final values...`
            },
            dynamic_premi_headers: Array.from(dynamicPremiSet),
            dynamic_potongan_headers: Array.from(dynamicPotonganSet),
            dynamic_premi_titles: globalPremiResult.titleMap,
            dynamic_potongan_titles: globalPotonganResult.titleMap
        };

        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        // PHASE 4: FINAL CALCULATIONS (Gaji Bersih, PPh21, etc)
        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        const t4 = Date.now();
        debug(CATEGORY, `ðŸ§® Phase 4: Final calculations...`);

        // Build PTKP map with timeout-safe approach
        // Use cached/fast lookup first, async PTKP only if fast
        const dbPtkpMap = new Map<string, string>();
        try {
            // Try to get PTKP with timeout-safe approach
            // [FIX] Timeout dinaikkan 2s -> 10s: query history_ptkp_pajak butuh ~1.9s via SQL gateway.
            // Dengan 2s, Promise.race sering resolve kosong -> dbPtkpMap kosong -> status PTKP
            // fallback ke mapBerasRateToPTKP (salah utk banyak karyawan) -> kategori TER & PPH21
            // bergeser dari nilai produksi.
            const { ptkpTaxService } = await import("../../ptkpTaxService");
            // Use Promise.race with timeout to prevent hanging
            const ptkpPromise = ptkpTaxService.getPtkpByYear(year);
            const timeoutPromise = new Promise<void>((resolve) => setTimeout(() => resolve(), 10000)); // 10s max for PTKP (query ~1.9s)
            const ptkpMasterRecords = await Promise.race([ptkpPromise, timeoutPromise]) || [];
            if (ptkpMasterRecords.length === 0) {
                warn(CATEGORY, "PTKP lookup returned 0 records (timeout?) - falling back to beras_rate mapping");
            }
            for (const record of ptkpMasterRecords) {
                if (record.emp_code) {
                    dbPtkpMap.set(record.emp_code.trim().toUpperCase(), record.ptkp_status);
                }
            }
        } catch (e: any) {
            warn(CATEGORY, `âš ï¸ PTKP lookup failed, using default: ${e.message}`);
        }

        // Calculate final values for each employee
        // Use for...of instead of forEach for better performance
        for (let i = 0; i < employees.length; i++) {
            const emp = employees[i];
            const empCode = emp.emp_code;
            const attData = globalAttendanceMap[empCode] || { hk: 0, total_hours: 0, total_amount_rp: 0 };
            const empCuti = globalCutiMap[empCode] || { cuti_tahunan: 0, cuti_sakit_haid: 0, cuti_minggu: 0, cuti_nasional: 0 };
            const empPremi = globalPremiResult.amounts[empCode] || {};
            const empPotongan = globalPotonganResult.amounts[empCode] || {};
            const empLembur = globalLemburMap[empCode] || { jam: 0, jumlah: 0 };
            const hk = attData.hk || 0;
            const berasRate = (emp.beras_rate ?? 0) > 0 ? emp.beras_rate : 0;
            const berasJumlah = berasRate && berasRate > 0 && hk > 0 ? berasRate * hk : 0;
            const upahDasar = globalUpahPokokMap[empCode] || emp.pay_rate || 0;
            const dbJabatanJumlah = globalJabatanMap[empCode] || 0;
            const dbMasaKerjaJumlah = globalMasaKerjaMap[empCode] || 0;
            const dbPotSpsi = baselinePotSpsiByEmp[empCode] ?? Math.abs(Number(empPotongan["SPSI"]) || 0);
            const valueSyncFrame: Record<string, "red" | "green"> = { ...(emp.value_sync_frame || {}) };
            const valueSourceCompare: Record<string, { db_ptrj: number | string | boolean | null; active: number | string | boolean | null }> = {
                ...(emp.value_source_compare || {})
            };

            // [MASA_KERJA] Calculate masa kerja display from join_date
            const masaKerjaDisplay = calculateMasaKerjaDisplay(emp.join_date, month, year);
            const masaKerjaTahun = masaKerjaDisplay.years;
            emp.masa_kerja_tahun = masaKerjaTahun;
            emp.masa_kerja_display_years = masaKerjaDisplay.years;
            emp.masa_kerja_display_months = masaKerjaDisplay.months;
            emp.masa_kerja_label = masaKerjaDisplay.label;

            // Effective HK
            const effective_hk = hk - (empCuti.cuti_minggu + empCuti.cuti_nasional);
            const totalCuti = empCuti.cuti_tahunan + empCuti.cuti_sakit_haid + empCuti.cuti_minggu + empCuti.cuti_nasional;
            const hari_kerja = Math.max(0, hk - totalCuti);
            const other_cuti = empCuti.cuti_tahunan + empCuti.cuti_sakit_haid;

            const isSpsiMember = typeof emp.is_spsi_member === "boolean"
                ? emp.is_spsi_member
                : deriveInitialSpsiMember(dbPotSpsi);
            emp.is_spsi_member = isSpsiMember;
            const autoBufferVerification = payrollAutoBufferService.calculateVerificationValues({
                jabatanText: emp.jabatan_estate || emp.jabatan || "",
                roleText: emp.jabatan || emp.role || "",
                hariKerja: hari_kerja,
                masaKerjaTahun,
                isSpsiMember,
                divisionCode,
                dbJabatanJumlah,
                dbMasaKerjaJumlah,
                dbPotSpsi,
                useAutoBuffer
            });
            let jabatanJumlah = autoBufferVerification.display.jabatanAmount;
            let masaKerjaJumlah = autoBufferVerification.display.masaKerjaAmount;
            let jabatanRate = autoBufferVerification.display.jabatanRate;
            let masaKerjaRate = autoBufferVerification.display.masaKerjaRate;
            let pot_spsi = autoBufferVerification.display.spsiDeduction;
            jabatanJumlah = resolveAdjustedJabatanJumlah(emp, { month, year, divisionCode }, jabatanJumlah);
            if (jabatanJumlah === 0 && autoBufferVerification.display.jabatanAmount !== 0) {
                jabatanRate = 0;
            }
            attachPayrollPeriodAdjustmentNotes(emp, { month, year, divisionCode });
            Object.assign(valueSyncFrame, autoBufferVerification.valueSyncFrame);
            valueSourceCompare.is_spsi_member = { db_ptrj: deriveInitialSpsiMember(dbPotSpsi), active: isSpsiMember };
            Object.assign(valueSourceCompare, autoBufferVerification.valueSourceCompare);

            // Canonical totals:
            // - total_tunjangan is inclusive of lembur_jumlah
            // - derived payroll fields are produced only by PayrollCalculator
            const total_tunjangan = berasJumlah + jabatanJumlah + masaKerjaJumlah + (empLembur.jumlah || 0);
            let total_premi = 0;
            for (const [key, val] of Object.entries(empPremi)) {
                if (key !== "koreksi") total_premi += Number(val) || 0;
            }
            total_premi += (globalBrondolMap[empCode] || 0);

            // Deductions
            const pot_pph21 = Math.abs(empPotongan["PPH21"] || 0);
            const pot_premi_pph = Math.abs(empPotongan["PREMI_PPH"] || 0);
            let pot_koreksi = 0;
            let db_bpjs_kes = 0;
            let other_potongan = 0;
            for (const [key, rawVal] of Object.entries(empPotongan)) {
                const keyUpper = String(key).toUpperCase();
                const value = Math.abs(Number(rawVal) || 0);

                if (keyUpper.startsWith("KOREKSI")) {
                    pot_koreksi += value;
                    continue;
                }

                if (["SPSI", "PPH21", "PREMI_PPH"].includes(keyUpper)) {
                    continue;
                }

                if (keyUpper.includes("BPJS")) {
                    if (!keyUpper.includes("MAJIKAN") && !keyUpper.includes("MAJ")) {
                        db_bpjs_kes += value;
                    }
                    continue;
                }

                // Custom incomes are modeled via employee_other_incomes and rolled into
                // pendapatan_lainnya in Phase 4b, so skip them here to avoid double deduction.
                if (keyUpper.includes("KONTAN") || keyUpper.includes("THR") || keyUpper.includes("BONUS")) {
                    continue;
                }

                other_potongan += value;
            }

            // Calculate payroll components (match GajiPokokService formulas)
            const gaji_pokok_aktual = emp.total_amount_rp || 0; // Already set in Phase 1
            const hk_attendance = emp.jumlah_hk || 0;
            const gaji_pokok_ideal = upahDasar * hk_attendance; // upah_dasar Ã— HK
            const koreksi_hk = gaji_pokok_aktual - gaji_pokok_ideal; // Positive = overpaid, Negative = underpaid

            // Use cached PTKP or default based on beras rate
            const statusPTKP = dbPtkpMap.get(empCode.toUpperCase()) || mapBerasRateToPTKP(berasRate ?? 0);
            const kategoriTER = mapPTKPToTER(statusPTKP);
            const caruman = calculateAllCaruman(upahDasar, masaKerjaJumlah);
            const pot_astek_pekerja = caruman.astek_pekerja_jht;
            const pot_bpjs_kesehatan_pekerja = caruman.bpjs_kes_pekerja + db_bpjs_kes;
            const pot_bpjs_pensiun_pekerja = caruman.bpjs_pensiun_pekerja;
            const pot_bpjs_pekerja_total = pot_bpjs_kesehatan_pekerja + pot_bpjs_pensiun_pekerja;

            // pendapatan_lainnya is resolved in Phase 4b; use 0 for this base pass.
            const calculatorInput = {
                gaji_pokok_aktual,
                beras_jumlah: berasJumlah,
                jabatan_jumlah: jabatanJumlah,
                masa_kerja_jumlah: masaKerjaJumlah,
                lembur_jumlah: empLembur.jumlah || 0,
                total_tunjangan,
                total_premi,
                pot_koreksi,
                pendapatan_lainnya: 0,
                pot_astek_pekerja,
                pot_bpjs_kesehatan_pekerja,
                pot_bpjs_pensiun_pekerja,
                pot_spsi,
                pot_pph21,
                other_potongan,
                pot_premi_pph,
                astek_majikan: caruman.astek_majikan_jkk_jkm || 0,
                bpjs_majikan: caruman.bpjs_kes_majikan || 0
            };
            let calc = PayrollCalculator.calculate(
                calculatorInput,
                statusPTKP,
                year
            );
            const adjustedPotPph21 = shouldForcePotPph21ToTer(emp, { month, year, divisionCode })
                ? Math.abs(Number(calc.pph21_ter) || 0)
                : pot_pph21;
            if (adjustedPotPph21 !== pot_pph21) {
                calculatorInput.pot_pph21 = adjustedPotPph21;
                calc = PayrollCalculator.calculate(calculatorInput, statusPTKP, year);
            }

            // Apply final data directly to emp object
            emp.hari_kerja = hari_kerja;
            emp.beras_rate = berasRate;
            emp.beras_jumlah = berasJumlah;
            emp.jabatan_jumlah = jabatanJumlah;
            emp.masa_kerja_jumlah = masaKerjaJumlah;
            emp.jabatan_rate = jabatanRate;
            emp.masa_kerja_rate = masaKerjaRate;
            emp.total_tunjangan = total_tunjangan;
            
            // Payroll fields (match frontend columnDefs)
            emp.gaji_pokok_ideal = gaji_pokok_ideal;
            emp.gaji_pokok_aktual = gaji_pokok_aktual;
            emp.gaji_pokok = gaji_pokok_aktual; // Main alias
            emp.gaji_pokok_dibayarkan = gaji_pokok_aktual; // For PAJAK section (GP BAYAR)
            emp.koreksi_hk = koreksi_hk;
            emp.pot_koreksi = pot_koreksi; // Deduction amount (positive magnitude)
            emp.astek_084 = caruman.astek_majikan_jkk_jkm || 0; // ASTEK 0.84% untuk pajak
            
            // Total tunjangan for display
            emp.total_tunjangan_display = total_tunjangan;
            emp.upah_kotor_pajak = calc.upah_kotor_pajak;
            emp.jumlah_upah_kotor = calc.jumlah_upah_kotor;
            emp.penghasilan_bruto = calc.penghasilan_bruto;
            emp.pph21_ter = calc.pph21_ter;
            emp.tarif_pajak_ter = calc.tarif_pajak_ter;
            emp.taxable_pendapatan_lainnya = 0;
            
            // Backend field names (detailed)
            emp.pot_astek = pot_astek_pekerja;
            emp.pot_bpjs_pekerja_total = pot_bpjs_pekerja_total;
            emp.pot_spsi = pot_spsi;
            emp.pot_pph21 = adjustedPotPph21;
            emp.pot_premi_pph = pot_premi_pph; // [FIX] Add for aggregation service
            emp.total_potongan = calc.total_potongan;
            emp.total_potongan_bersih = calc.total_potongan_bersih;
            emp.upah_bersih = calc.upah_bersih;
            
            // Frontend-compatible aliases (for column rendering)
            emp.astek = pot_astek_pekerja; // ASTEK total
            emp.bpjs_kes = pot_bpjs_pekerja_total; // BPJS Kesehatan + Pensiun pekerja
            emp.spsi = pot_spsi;
            emp.pph21 = adjustedPotPph21;
            // [FIX] pph21_ter is the calculated TER tax - do NOT overwrite with pot_pph21
            // pot_pph21 could be 0 if no PPh21 transaction exists in PR_ADTRANS, but TER calculation is still valid
            
            // BPJS detail breakdown (must match frontend columnDefs exactly)
            emp.pot_astek_maj = caruman.astek_majikan_jht || 0;
            emp.pot_bpjs_kesehatan_pekerja = pot_bpjs_kesehatan_pekerja;
            emp.pot_bpjs_kesehatan_majikan = caruman.bpjs_kes_majikan || 0;
            emp.pot_bpjs_pensiun_pekerja = pot_bpjs_pensiun_pekerja;
            emp.pot_bpjs_pensiun_majikan = caruman.bpjs_pensiun_majikan || 0;
            
            // Additional aliases for flexibility
            emp.bpjs_kes_pekerja = pot_bpjs_kesehatan_pekerja;
            emp.bpjs_kes_majikan = caruman.bpjs_kes_majikan || 0;
            emp.bpjs_pensiun_pekerja = pot_bpjs_pensiun_pekerja;
            emp.bpjs_pensiun_majikan = caruman.bpjs_pensiun_majikan || 0;
            emp.astek_jht_pekerja = pot_astek_pekerja;
            emp.astek_jht_majikan = caruman.astek_majikan_jht || 0;

            emp.status_ptkp = statusPTKP;
            emp.kategori_ter = kategoriTER;
            emp.value_sync_frame = valueSyncFrame;
            emp.value_source_compare = valueSourceCompare;
            emp._phase = 4;
            emp._enriched = true;
            emp._loading = false;
        }

        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        // PHASE 4b: Other Incomes (THR, Bonus, Custom) from extend_db_ptrj
        // NOTE: employee_other_incomes is in extend_db_ptrj, NOT db_ptrj!
        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        try {
            // Use the CORRECT database instance for extend_db_ptrj
            const extDb = Database.getInstance(Config.DB_EXTEND_DATABASE, Config.DB_EXTEND_PROFILE);
            const empCodeList = employees.map(e => `'${e.emp_code}'`).join(',');
            
            // Get other incomes from extend_db_ptrj
            // IMPORTANT: THR records may have empty emp_code, so we also match by NIK
            const nikList = employees.filter(e => e.actual_nik).map(e => `'${e.actual_nik}'`).join(',');
            
            if (!empCodeList && !nikList) {
                debug(CATEGORY, `ðŸ’° Skipping other incomes lookup - no emp_codes or NIKs available`);
                return;
            }
            
            const conditions: string[] = [];
            if (empCodeList) conditions.push(`RTRIM(emp_code) IN (${empCodeList})`);
            if (nikList) conditions.push(`RTRIM(nik) IN (${nikList})`);
            
            const incomeRowsRaw = await extDb.query<any>(`
                SELECT id, RTRIM(emp_code) as emp_code, RTRIM(nik) as nik, RTRIM(ISNULL(new_nik, '')) as new_nik, RTRIM(income_type) as income_type,
                       RTRIM(income_name) as income_name, amount
                FROM dbo.employee_other_incomes
                WHERE period_month = ? AND period_year = ?
                  AND (${conditions.join(' OR ')})
                ORDER BY id
            `, [month, year]);
            const incomeRows = OtherIncomesService.deduplicateIncomeRows(incomeRowsRaw);

            debug(CATEGORY, `Found ${incomeRowsRaw?.length || 0} other income records in extend_db_ptrj, ${incomeRows?.length || 0} after latest-record dedupe`);
            
            if (incomeRows?.length === 0) {
                debug(CATEGORY, `ðŸ’° WARNING: No other incomes found for month=${month}, year=${year}. Table may be empty or emp_codes may be missing.`);
            }

            // Group by emp_code
            const incomeByEmp = new Map<string, Array<{type: string, name: string, amount: number}>>();
            let matchedByEmpCode = 0;
            let matchedByNik = 0;
            let unmatched = 0;
            
            for (const row of incomeRows) {
                let key: string = row.emp_code ?? '';
                let matched = false;
                
                // Try to match by emp_code first (RTRIM already done in SQL)
                if (key && key.trim()) {
                    const normalizedKey = key.trim().toUpperCase();
                    // Find employee with matching emp_code
                    const emp = employees.find(e => e.emp_code?.trim().toUpperCase() === normalizedKey);
                    if (emp) {
                        key = emp.emp_code ?? key;
                        matchedByEmpCode++;
                        matched = true;
                    }
                }

                // Fallback: match by NIK if emp_code didn't match
                if (!matched && row.nik && row.nik.trim()) {
                    const normalizedNik = row.nik.trim();
                    const emp = employees.find(e => e.actual_nik === normalizedNik || e.new_nik === normalizedNik);
                    if (emp) {
                        key = emp.emp_code ?? key;
                        matchedByNik++;
                        matched = true;
                    }
                }
                
                if (!matched) {
                    unmatched++;
                    console.log(`[Phase 4b] âš ï¸ Unmatched income: emp_code="${row.emp_code}", nik="${row.nik}", type="${row.income_type}", amount=${row.amount}`);
                    continue;
                }

                if (!incomeByEmp.has(key)) incomeByEmp.set(key, []);
                incomeByEmp.get(key)!.push({
                    type: getCanonicalOtherIncomeType(row),
                    name: String(row.income_name ?? ''),
                    amount: row.amount || 0
                });
            }
            
            debug(CATEGORY, `ðŸ’° Matching: ${matchedByEmpCode} by emp_code, ${matchedByNik} by NIK, ${unmatched} unmatched`);

            // Attach to employees and calculate additional income
            let totalEmployeesWithIncome = 0;
            for (const emp of employees) {
                const incomes = incomeByEmp.get(emp.emp_code) || [];
                emp.other_incomes = incomes;

                // Extract specific income types to top-level fields
                for (const inc of incomes) {
                    const fieldKey = `pendapatan_${getCanonicalOtherIncomeType(inc).toLowerCase()}`;
                    emp[fieldKey] = inc.amount;
                }

                // Calculate total_pendapatan_lainnya (THR + Bonus + Custom + KONTAN)
                const totalPendapatanLainnya = incomes.reduce((sum, inc) => sum + (inc.amount || 0), 0);
                emp.total_pendapatan_lainnya = totalPendapatanLainnya;
                emp.pendapatan_lainnya = totalPendapatanLainnya; // Alias for compatibility

                if (incomes.length > 0) {
                    totalEmployeesWithIncome++;
                    console.log(`[Phase 4b] ${emp.emp_code}: Found ${incomes.length} incomes, total=${totalPendapatanLainnya}`);
                }

                // Recalculate derived payroll fields using canonical calculator.
                // This prevents drift between progressive and non-progressive endpoints.
                const potonganMap = (emp.potongan && typeof emp.potongan === 'object')
                    ? emp.potongan
                    : {};
                const pot_pph21 = Math.abs(Number(potonganMap["PPH21"]) || 0);
                const pot_premi_pph = Math.abs(Number(potonganMap["PREMI_PPH"]) || 0);
                let pot_koreksi = 0;
                let db_bpjs_kes = 0;
                let other_potongan = 0;
                for (const [key, rawVal] of Object.entries(potonganMap)) {
                    const keyUpper = String(key).toUpperCase();
                    const value = Math.abs(Number(rawVal) || 0);

                    if (keyUpper.startsWith("KOREKSI")) {
                        pot_koreksi += value;
                        continue;
                    }
                    if (["SPSI", "PPH21", "PREMI_PPH"].includes(keyUpper)) {
                        continue;
                    }
                    if (keyUpper.includes("BPJS")) {
                        if (!keyUpper.includes("MAJIKAN") && !keyUpper.includes("MAJ")) {
                            db_bpjs_kes += value;
                        }
                        continue;
                    }
                    if (keyUpper.includes("KONTAN") || keyUpper.includes("THR") || keyUpper.includes("BONUS")) {
                        continue;
                    }
                    other_potongan += value;
                }

                const caruman = calculateAllCaruman(emp.upah_dasar || emp.pay_rate || 0, emp.masa_kerja_jumlah || 0);
                const pot_astek_pekerja = caruman.astek_pekerja_jht || 0;
                const pot_bpjs_kesehatan_pekerja = (caruman.bpjs_kes_pekerja || 0) + db_bpjs_kes;
                const pot_bpjs_pensiun_pekerja = caruman.bpjs_pensiun_pekerja || 0;
                const statusPTKP = emp.status_ptkp || dbPtkpMap.get(emp.emp_code?.toUpperCase()) || mapBerasRateToPTKP(emp.beras_rate || 0);

                const adjustedJabatanJumlah = resolveAdjustedJabatanJumlah(
                    emp,
                    { month, year, divisionCode },
                    Number(emp.jabatan_jumlah || 0)
                );
                if (adjustedJabatanJumlah !== Number(emp.jabatan_jumlah || 0)) {
                    emp.jabatan_jumlah = adjustedJabatanJumlah;
                    emp.jabatan_rate = 0;
                    emp.total_tunjangan = Number(emp.beras_jumlah || 0)
                        + adjustedJabatanJumlah
                        + Number(emp.masa_kerja_jumlah || 0)
                        + Number(emp.lembur_jumlah || 0);
                }
                attachPayrollPeriodAdjustmentNotes(emp, { month, year, divisionCode });

                const calculatorInput = {
                    gaji_pokok_aktual: Number(emp.gaji_pokok_aktual || emp.gaji_pokok || emp.total_amount_rp || 0),
                    beras_jumlah: Number(emp.beras_jumlah || 0),
                    jabatan_jumlah: adjustedJabatanJumlah,
                    masa_kerja_jumlah: Number(emp.masa_kerja_jumlah || 0),
                    lembur_jumlah: Number(emp.lembur_jumlah || 0),
                    total_tunjangan: Number(emp.total_tunjangan || 0),
                    total_premi: Number(emp.total_premi || 0),
                    pot_koreksi,
                    pendapatan_lainnya: totalPendapatanLainnya,
                    pot_astek_pekerja,
                    pot_bpjs_kesehatan_pekerja,
                    pot_bpjs_pensiun_pekerja,
                    pot_spsi: Number(emp.pot_spsi || 0),
                    pot_pph21,
                    other_potongan,
                    pot_premi_pph,
                    astek_majikan: caruman.astek_majikan_jkk_jkm || 0,
                    bpjs_majikan: caruman.bpjs_kes_majikan || 0
                };
                let calc = PayrollCalculator.calculate(
                    calculatorInput,
                    statusPTKP,
                    year
                );
                const adjustedPotPph21 = shouldForcePotPph21ToTer(emp, { month, year, divisionCode })
                    ? Math.abs(Number(calc.pph21_ter) || 0)
                    : pot_pph21;
                if (adjustedPotPph21 !== pot_pph21) {
                    calculatorInput.pot_pph21 = adjustedPotPph21;
                    calc = PayrollCalculator.calculate(calculatorInput, statusPTKP, year);
                }

                emp.pot_koreksi = pot_koreksi;
                emp.pot_pph21 = adjustedPotPph21;
                emp.pph21 = adjustedPotPph21;
                emp.pot_premi_pph = pot_premi_pph;
                emp.pot_astek = pot_astek_pekerja;
                emp.pot_bpjs_kesehatan_pekerja = pot_bpjs_kesehatan_pekerja;
                emp.pot_bpjs_pensiun_pekerja = pot_bpjs_pensiun_pekerja;
                emp.pot_bpjs_pekerja_total = pot_bpjs_kesehatan_pekerja + pot_bpjs_pensiun_pekerja;

                emp.jumlah_upah_kotor = calc.jumlah_upah_kotor;
                // [FIX] Add upah_kotor separately - base gross without koreksi for correct tax/export
                emp.upah_kotor = calc.upah_kotor;
                emp.upah_kotor_pajak = calc.upah_kotor_pajak;
                emp.penghasilan_bruto = calc.penghasilan_bruto;
                emp.pph21_ter = calc.pph21_ter;
                emp.tarif_pajak_ter = calc.tarif_pajak_ter;
                emp.total_potongan = calc.total_potongan;
                emp.total_potongan_bersih = calc.total_potongan_bersih;
                emp.upah_bersih = calc.upah_bersih;
                emp.taxable_pendapatan_lainnya = totalPendapatanLainnya;
            }
            debug(CATEGORY, `ðŸ’° Other incomes: ${totalEmployeesWithIncome}/${employees.length} employees with income`);
            debug(CATEGORY, `ðŸ’° Other incomes attached to ${incomeByEmp.size} employees`);
        } catch (e: any) {
            debug(CATEGORY, `âš ï¸ Other income lookup skipped: ${e.message}`);
        }

        // Filter & sort employees
        const filteredEmployees = [];
        let filteredOutCount = 0;
        for (const emp of employees) {
            const effective_hk = (emp.jumlah_hk || 0) - ((emp.cuti_minggu_hari || 0) + (emp.cuti_nasional_hari || 0));
            const totalCuti = (emp.cuti_tahunan_hari || 0) + (emp.cuti_sakit_haid_hari || 0) + (emp.cuti_minggu_hari || 0) + (emp.cuti_nasional_hari || 0);
            const hari_kerja = Math.max(0, (emp.jumlah_hk || 0) - totalCuti);
            const other_cuti = (emp.cuti_tahunan_hari || 0) + (emp.cuti_sakit_haid_hari || 0);

            if (shouldKeepPayrollRowAfterEffectiveHkFilter({
                jumlahHk: emp.jumlah_hk,
                cutiMingguHari: emp.cuti_minggu_hari,
                cutiNasionalHari: emp.cuti_nasional_hari,
                hasManualAdjustments: Number((emp as any)._manualAdjustmentCount || 0) > 0
            })) {
                filteredEmployees.push(emp);
            } else {
                filteredOutCount++;
            }
        }

        debug(CATEGORY, `ðŸ“Š Filter result: ${filteredEmployees.length} kept, ${filteredOutCount} filtered out (effective_hk = 0)`);

        // Sort by emp_code (default sort)
        filteredEmployees.sort((a, b) => (a?.emp_code || '').localeCompare(b?.emp_code || ''));

        // Flatten nested premi/potongan objects to top-level fields for frontend compatibility
        for (const emp of filteredEmployees) {
            if (emp.premi && typeof emp.premi === 'object') {
                for (const [key, val] of Object.entries(emp.premi)) {
                    if (key !== 'brondol' && key !== 'koreksi') {
                        const fieldName = key.startsWith('premi_') ? key : `premi_${key}`;
                        emp[fieldName] = val;
                    }
                }
            }
            if (emp.potongan && typeof emp.potongan === 'object') {
                for (const [key, val] of Object.entries(emp.potongan)) {
                    // KOREKSI fields: keep as-is (KOREKSI_1, KOREKSI_2)
                    // Others: add potongan_ prefix
                    let fieldName;
                    const keyUpper = String(key).toUpperCase();
                    if (keyUpper.startsWith('KOREKSI')) {
                        fieldName = key; // KOREKSI_1, KOREKSI_2, etc.
                    } else if (keyUpper.startsWith('POTONGAN_')) {
                        fieldName = key;
                    } else {
                        fieldName = `potongan_${key}`;
                    }
                    emp[fieldName] = val;
                }
            }
            // Calculate total potongan upah kotor (sum of all KOREKSI)
            let totalKoreksi = 0;
            for (const [key, val] of Object.entries(emp)) {
                if (String(key).toUpperCase().startsWith('KOREKSI') && typeof val === 'number') {
                    totalKoreksi += Math.abs(val);
                }
            }
            emp.potongan_upah_kotor_total = totalKoreksi;
        }

        // Rebuild gangsMap with filtered & sorted data
        gangsMap.clear();
        for (const emp of filteredEmployees) {
            // Safety check: ensure employee has name (could be emp_name or nama)
            const empNama = emp.nama || emp.emp_name;
            if (!emp || !empNama) continue;
            const gang = emp.gang_code || "UNKNOWN";
            if (!gangsMap.has(gang)) gangsMap.set(gang, []);
            
            // Ensure nama field exists for frontend compatibility
            if (!emp.nama) emp.nama = emp.emp_name;
            
            gangsMap.get(gang)!.push(emp);
        }

        const totalTime = Date.now() - startTime;
        const totalEmployees = Array.from(gangsMap.values()).reduce((sum, arr) => sum + arr.length, 0);

        debug(CATEGORY, `âœ… Phase 4 (final): ${Date.now() - t4}ms | Total: ${totalTime}ms for ${totalEmployees} employees`);

        yield {
            phase: 'complete',
            gangs: new Map(gangsMap),
            meta: {
                total_gangs: gangsMap.size,
                total_employees: totalEmployees,
                processed_employees: totalEmployees,
                progress_pct: 100,
                message: `âœ… Complete! ${totalEmployees} employees in ${(totalTime / 1000).toFixed(1)}s`
            },
            dynamic_premi_headers: Array.from(dynamicPremiSet),
            dynamic_potongan_headers: Array.from(dynamicPotonganSet),
            dynamic_premi_titles: globalPremiResult.titleMap,
            dynamic_potongan_titles: globalPotonganResult.titleMap
        };




}
