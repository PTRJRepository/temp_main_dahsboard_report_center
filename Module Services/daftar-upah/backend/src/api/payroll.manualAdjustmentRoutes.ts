/**
 * @module backend/src/api/payroll.manualAdjustmentRoutes.ts
 * @purpose Manual-adjustment route group for /payroll: manual-adjustment CRUD, manual-edit, presets, by-api-key automation, seeders.
 * @input Query/body: period_month, period_year, emp_code/nik, gang_code, division_code, adjustment_type/name, amount, remarks, metadata_json, ad_code; x-api-key header for by-api-key routes
 * @output JSON { success, count, data | id | deleted_count } on manual-adjustment/manual-edit/presets endpoints; gate 403 when manual edit blocked
 * @depends ./payroll.shared (getManualEditGate, parseAdjustmentNameOptionTypes, ADJUSTMENT_NAME_OPTION_TYPES, buildAutoBufferSeedEndpointResponse, getUserFromHeader), ../config#Config, ../utils/authBypass#hasValidApiKeyBypass, ../utils/queryParsers#parseBooleanQueryParam; services via dynamic import
 * @sideeffect Reads/writes payroll_manual_adjustments + payroll_manual_adjustment_presets (extend_db_ptrj, SERVER_PROFILE_1); clears cacheService pattern after mutations
 * @tests backend/src/api/payroll.manualAdjustmentByApiKey.test.ts
 */
import { Elysia, t } from "elysia";
import { info, warn, error as logError } from "../utils/logger";
const CATEGORY = "PayrollManualAdjustmentRoutes";
import { Config } from "../config";
import { hasValidApiKeyBypass } from "../utils/authBypass";
import { parseBooleanQueryParam } from "../utils/queryParsers";
import {
    getUserFromHeader,
    getManualEditGate,
    parseAdjustmentNameOptionTypes,
    ADJUSTMENT_NAME_OPTION_TYPES,
    buildAutoBufferSeedEndpointResponse
} from "./payroll.shared";

export const manualAdjustmentRoutes = new Elysia()
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
    // --- Manual Adjustment TaskCode Options ---
    .get("/manual-adjustment/taskcode-options", async ({ query, set }) => {
        try {
            const { taskCodeOptionService } = await import("../services/taskCodeOptionService");
            const data = await taskCodeOptionService.searchOptions({
                search: query.search || undefined,
                divisionCode: query.division_code || undefined,
                limit: query.limit ? Number(query.limit) : undefined
            });

            return { success: true, count: data.length, data };
        } catch (e: any) {
            logError(CATEGORY, "[PayrollRoutes] manual-adjustment/taskcode-options error:", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        query: t.Object({
            search: t.Optional(t.String()),
            division_code: t.Optional(t.String()),
            limit: t.Optional(t.String())
        })
    })
    .get("/manual-adjustment/automation-options/by-api-key", async ({ query, headers, set }) => {
        try {
            const apiKey = headers["x-api-key"] || headers["X-API-Key"];
            if (!apiKey || apiKey !== Config.API_KEY_BYPASS) {
                set.status = 401;
                return { success: false, error: "Invalid API key" };
            }

            const { taskCodeOptionService } = await import("../services/taskCodeOptionService");
            const data = await taskCodeOptionService.searchAutomationAdjustmentOptions({
                search: query.search || undefined,
                divisionCode: query.division_code || undefined,
                limit: query.limit ? Number(query.limit) : undefined,
                categories: query.categories ? String(query.categories).split(",") : undefined
            });

            return { success: true, count: data.length, data };
        } catch (e: any) {
            logError(CATEGORY, "[PayrollRoutes] manual-adjustment/automation-options/by-api-key error:", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        query: t.Object({
            search: t.Optional(t.String()),
            division_code: t.Optional(t.String()),
            limit: t.Optional(t.String()),
            categories: t.Optional(t.String())
        })
    })
    .get("/manual-adjustment/adjustment-name-options/by-api-key", async ({ query, headers, set }) => {
        try {
            if (!hasValidApiKeyBypass(headers as Record<string, string | undefined>)) {
                set.status = 401;
                return { success: false, error: "Unauthorized: invalid x-api-key" };
            }

            const parsedTypes = parseAdjustmentNameOptionTypes(query.adjustment_type || query.adjustment_types);
            if (parsedTypes.invalid.length > 0) {
                set.status = 400;
                return {
                    success: false,
                    error: `adjustment_type tidak valid: ${parsedTypes.invalid.join(", ")}`,
                    allowed_adjustment_types: [...ADJUSTMENT_NAME_OPTION_TYPES]
                };
            }

            const { manualAdjustmentService } = await import("../services/manualAdjustmentService");
            const metadataOnly = ["1", "true", "yes", "metadata"].includes(String(query.metadata_only || query.has_metadata || "").trim().toLowerCase());
            const data = await manualAdjustmentService.listAdjustmentNameOptions({
                periodMonth: query.period_month ? Number(query.period_month) : undefined,
                periodYear: query.period_year ? Number(query.period_year) : undefined,
                search: query.search || undefined,
                divisionCode: query.division_code || query.estate || undefined,
                gangCode: query.gang_code || undefined,
                limit: query.limit ? Number(query.limit) : undefined,
                adjustmentTypes: parsedTypes.types,
                metadataOnly
            });
            const byType = Object.fromEntries(parsedTypes.types.map((type) => [
                type,
                data.filter((option) => option.adjustment_type === type)
            ]));
            const adjustmentNamesByType = Object.fromEntries(parsedTypes.types.map((type) => [
                type,
                Array.from(new Set(data
                    .filter((option) => option.adjustment_type === type)
                    .map((option) => option.adjustment_name)))
            ]));

            return {
                success: true,
                count: data.length,
                adjustment_types: parsedTypes.types,
                by_type: byType,
                adjustment_names_by_type: adjustmentNamesByType,
                data
            };
        } catch (e: any) {
            logError(CATEGORY, "[PayrollRoutes] manual-adjustment/adjustment-name-options/by-api-key error:", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        query: t.Object({
            adjustment_type: t.Optional(t.String()),
            adjustment_types: t.Optional(t.String()),
            period_month: t.Optional(t.String()),
            period_year: t.Optional(t.String()),
            search: t.Optional(t.String()),
            division_code: t.Optional(t.String()),
            estate: t.Optional(t.String()),
            gang_code: t.Optional(t.String()),
            metadata_only: t.Optional(t.String()),
            has_metadata: t.Optional(t.String()),
            limit: t.Optional(t.String())
        })
    })
    // --- Manual Adjustment Presets ---
    .get("/manual-adjustment-presets", async ({ query, set }) => {
        try {
            const { manualAdjustmentPresetService } = await import("../services/manualAdjustmentPresetService");
            const data = await manualAdjustmentPresetService.listPresets({
                adjustmentType: query.adjustment_type || undefined,
                search: query.search || undefined,
                divisionCode: query.division_code || undefined,
                includeInactive: parseBooleanQueryParam(query.include_inactive) ?? undefined
            });

            return { success: true, count: data.length, data };
        } catch (e: any) {
            logError(CATEGORY, "[PayrollRoutes] manual-adjustment-presets GET error:", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        query: t.Object({
            adjustment_type: t.Optional(t.String()),
            search: t.Optional(t.String()),
            division_code: t.Optional(t.String()),
            include_inactive: t.Optional(t.String())
        })
    })
    .post("/manual-adjustment-presets", async ({ body, currentUser, set }) => {
        try {
            const { manualAdjustmentPresetService } = await import("../services/manualAdjustmentPresetService");
            const { resolveManualAdjustmentPresetMapping } = await import("../services/manualAdjustmentService");
            const input = body as any;
            const mappedFields = await resolveManualAdjustmentPresetMapping(input, input.adjustment_name);
            const presetInput = { ...input, ...mappedFields };
            const id = await manualAdjustmentPresetService.upsertPreset(presetInput, currentUser?.username || "system");
            return { success: true, id, message: "Manual adjustment preset saved successfully." };
        } catch (e: any) {
            logError(CATEGORY, "[PayrollRoutes] manual-adjustment-presets POST error:", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        body: t.Object({
            adjustment_type: t.String(),
            adjustment_name: t.String(),
            ad_code: t.Optional(t.String()),
            task_code: t.Optional(t.String()),
            base_task_code: t.Optional(t.String()),
            task_desc: t.Optional(t.String()),
            division_code: t.Optional(t.String()),
            remarks_template: t.Optional(t.String())
        })
    })
    .post("/manual-adjustment-presets/infer", async ({ body, set }) => {
        try {
            const {
                inferManualAdjustmentAdCodeFromRemarks,
                normalizeManualAdjustmentPresetName
            } = await import("../utils/manualAdjustmentRemarkParser");
            const data = body as any;
            return {
                success: true,
                adjustment_name: normalizeManualAdjustmentPresetName(data.remarks),
                ...inferManualAdjustmentAdCodeFromRemarks(data.remarks)
            };
        } catch (e: any) {
            logError(CATEGORY, "[PayrollRoutes] manual-adjustment-presets infer error:", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        body: t.Object({
            remarks: t.String()
        })
    })
    .delete("/manual-adjustment-presets/:id", async ({ params, currentUser, set }) => {
        try {
            const id = Number(params.id);
            if (!Number.isInteger(id) || id <= 0) {
                set.status = 400;
                return { success: false, error: "id tidak valid" };
            }

            const { manualAdjustmentPresetService } = await import("../services/manualAdjustmentPresetService");
            await manualAdjustmentPresetService.deletePreset(id, currentUser?.username || "system");
            return { success: true, message: "Manual adjustment preset deleted successfully." };
        } catch (e: any) {
            logError(CATEGORY, "[PayrollRoutes] manual-adjustment-presets DELETE error:", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        params: t.Object({ id: t.String() })
    })
    // --- Save Manual Edit ---
    .post("/manual-edit", async ({ body, currentUser, set }) => {
        try {
            const gate = await getManualEditGate();
            if (!gate.allowed) {
                set.status = 403;
                return { success: false, error: gate.reason };
            }
            const { manualAdjustmentService } = await import("../services/manualAdjustmentService");
            const { cacheService } = await import("../services/cacheService");
            const data = body as any;
            info(CATEGORY, `[manual-edit] Incoming payload:`, JSON.stringify({
                period_month: data.period_month,
                period_year: data.period_year,
                nik: data.nik,
                emp_code: data.emp_code,
                emp_name: data.emp_name,
                gang_code: data.gang_code,
                adjustment_type: data.adjustment_type,
                adjustment_name: data.adjustment_name,
                amount: data.amount
            }));

            const username = currentUser?.username || 'system';
            const resultId = await manualAdjustmentService.saveAdjustment(data, username);

            // Always clear cache after save to ensure fresh data on next load
            // Use suffix matching because keys format is payroll_data:{gangCode}:{month}:{year}
            const pattern = `:${data.period_month}:${data.period_year}`;
            cacheService.clearByPattern(pattern);
            info(CATEGORY, `[PayrollRoutes] Cleared cache for pattern: ${pattern} after manual edit`);

            return { success: true, id: resultId, message: "Manual adjustment saved successfully." };
        } catch (e: any) {
            logError(CATEGORY, "[PayrollRoutes] manual-edit error:", e);
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
    // --- Manual Adjustment for authenticated UI ---
    .get("/manual-adjustment", async ({ query, set }) => {
        try {
            const periodMonth = Number(query.period_month);
            const periodYear = Number(query.period_year);

            if (!Number.isInteger(periodMonth) || periodMonth < 1 || periodMonth > 12) {
                set.status = 400;
                return { success: false, error: "period_month harus 1-12" };
            }

            if (!Number.isInteger(periodYear) || periodYear < 2000) {
                set.status = 400;
                return { success: false, error: "period_year tidak valid" };
            }

            const {
                manualAdjustmentService
            } = await import("../services/manualAdjustmentService");
            const metadataOnly = ["1", "true", "yes", "metadata"].includes(String(query.metadata_only || query.has_metadata || "").trim().toLowerCase());
            // ponytail: recompute_sync default true (real-time vs ADTRANS). Set =0/false untuk legacy baked-remarks path.
            const recomputeSync = !["0", "false", "no", "off"].includes(String(query.recompute_sync || "").trim().toLowerCase());

            if (recomputeSync) {
                const apiRows = await manualAdjustmentService.getAdjustmentsWithSyncRecompute(
                    periodMonth,
                    periodYear,
                    query.gang_code || undefined,
                    query.emp_code || undefined,
                    query.division_code || undefined,
                    query.adjustment_type || undefined,
                    query.adjustment_name || undefined,
                    metadataOnly
                );
                return { success: true, count: apiRows.length, data: apiRows };
            }

            const rows = await manualAdjustmentService.getAdjustments(
                periodMonth,
                periodYear,
                query.gang_code || undefined,
                query.emp_code || undefined,
                query.division_code || undefined,
                query.adjustment_type || undefined,
                query.adjustment_name || undefined,
                metadataOnly
            );
            const { buildManualAdjustmentApiResponseRows } = await import("../services/manualAdjustmentService");

            return { success: true, count: rows.length, data: buildManualAdjustmentApiResponseRows(rows) };
        } catch (e: any) {
            logError(CATEGORY, "[PayrollRoutes] manual-adjustment GET error:", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        query: t.Object({
            period_month: t.String(),
            period_year: t.String(),
            gang_code: t.Optional(t.String()),
            emp_code: t.Optional(t.String()),
            division_code: t.Optional(t.String()),
            adjustment_type: t.Optional(t.String()),
            adjustment_name: t.Optional(t.String()),
            metadata_only: t.Optional(t.String()),
            has_metadata: t.Optional(t.String()),
            recompute_sync: t.Optional(t.String())
        })
    })
    .get("/manual-adjustment/allowed", async () => {
        const { manualAdjustmentService } = await import("../services/manualAdjustmentService");
        const allowed = manualAdjustmentService.getManualEditAllowed();
        return {
            success: true,
            allowed,
            reason: allowed ? null : manualAdjustmentService.getManualEditBlockReason()
        };
    })
    .post("/manual-adjustment", async ({ body, currentUser, set }) => {
        try {
            const gate = await getManualEditGate();
            if (!gate.allowed) {
                set.status = 403;
                return { success: false, error: gate.reason };
            }
            const data = body as any;
            const allowedTypes = ["PREMI", "POTONGAN_KOTOR", "POTONGAN_BERSIH", "PENDAPATAN_LAINNYA"];

            if (!allowedTypes.includes(data.adjustment_type)) {
                set.status = 400;
                return { success: false, error: "adjustment_type tidak valid untuk input UI" };
            }

            const { manualAdjustmentService } = await import("../services/manualAdjustmentService");
            const { cacheService } = await import("../services/cacheService");
            const resultId = await manualAdjustmentService.saveAdjustment(data, currentUser?.username || "system");

            const pattern = `:${data.period_month}:${data.period_year}`;
            cacheService.clearByPattern(pattern);

            return { success: true, id: resultId, message: "Manual adjustment saved successfully." };
        } catch (e: any) {
            logError(CATEGORY, "[PayrollRoutes] manual-adjustment POST error:", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        body: t.Object({
            period_month: t.Number(),
            period_year: t.Number(),
            nik: t.Optional(t.String()),
            emp_code: t.String(),
            emp_name: t.Optional(t.String()),
            gang_code: t.String(),
            division_code: t.Optional(t.String()),
            adjustment_type: t.String(),
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
    // --- Validate premium conversion (lightweight, no DB) ---
    .get("/manual-adjustment/validate-conversion", async ({ query, set }) => {
        try {
            const { premiumDefinitionService } = await import("../services/premiumDefinitionService");
            const validation = premiumDefinitionService.validatePremiumConversion(query.from, query.to);
            return { success: true, validation };
        } catch (e: any) {
            logError(CATEGORY, "[PayrollRoutes] validate-conversion error:", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        query: t.Object({
            from: t.String(),
            to: t.String()
        })
    })
    // --- Convert premium type (per-column bulk) ---
    .post("/manual-adjustment/convert-type", async ({ body, currentUser, set }) => {
        try {
            const gate = await getManualEditGate();
            if (!gate.allowed) {
                set.status = 403;
                return { success: false, error: gate.reason };
            }
            const { manualAdjustmentService } = await import("../services/manualAdjustmentService");
            const { premiumDefinitionService } = await import("../services/premiumDefinitionService");
            // Pre-check validation gate — return 422 with reason if blocked
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
            logError(CATEGORY, "[PayrollRoutes] convert-type error:", e);
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
    .delete("/manual-adjustment/column", async ({ query, set }) => {
        try {
            const gate = await getManualEditGate();
            if (!gate.allowed) {
                set.status = 403;
                return { success: false, error: gate.reason };
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
            logError(CATEGORY, "[PayrollRoutes] manual-adjustment column DELETE error:", e);
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
    .delete("/manual-adjustment/:id", async ({ params, query, set }) => {
        try {
            const gate = await getManualEditGate();
            if (!gate.allowed) {
                set.status = 403;
                return { success: false, error: gate.reason };
            }
            const id = Number(params.id);
            if (!Number.isInteger(id) || id <= 0) {
                set.status = 400;
                return { success: false, error: "id tidak valid" };
            }

            const { manualAdjustmentService } = await import("../services/manualAdjustmentService");
            const { cacheService } = await import("../services/cacheService");
            await manualAdjustmentService.deleteAdjustment(id);

            if (query.period_month && query.period_year) {
                cacheService.clearByPattern(`:${query.period_month}:${query.period_year}`);
            } else {
                cacheService.clear();
            }

            return { success: true, message: "Manual adjustment deleted successfully." };
        } catch (e: any) {
            logError(CATEGORY, "[PayrollRoutes] manual-adjustment DELETE error:", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        params: t.Object({ id: t.String() }),
        query: t.Object({
            period_month: t.Optional(t.String()),
            period_year: t.Optional(t.String())
        })
    })
    // --- Manual Adjustment via API Key Bypass (x-api-key) ---
    .get("/manual-adjustment/by-api-key", async ({ query, headers, set }) => {
        try {
            if (!hasValidApiKeyBypass(headers as Record<string, string | undefined>)) {
                set.status = 401;
                return { success: false, error: "Unauthorized: invalid x-api-key" };
            }

            const periodMonth = Number(query.period_month);
            const periodYear = Number(query.period_year);

            if (!Number.isInteger(periodMonth) || periodMonth < 1 || periodMonth > 12) {
                set.status = 400;
                return { success: false, error: "period_month harus 1-12" };
            }

            if (!Number.isInteger(periodYear) || periodYear < 2000) {
                set.status = 400;
                return { success: false, error: "period_year tidak valid" };
            }

            const {
                manualAdjustmentService
            } = await import("../services/manualAdjustmentService");
            const metadataOnly = ["1", "true", "yes", "metadata"].includes(String(query.metadata_only || query.has_metadata || "").trim().toLowerCase());
            const recomputeSync = !["0", "false", "no", "off"].includes(String(query.recompute_sync || "").trim().toLowerCase());

            // ponytail: recompute_sync default true (real-time vs ADTRANS). =0/false -> legacy baked-remarks path.
            let dataRows: any[];
            if (recomputeSync) {
                dataRows = await manualAdjustmentService.getAdjustmentsWithSyncRecompute(
                    periodMonth,
                    periodYear,
                    query.gang_code || undefined,
                    query.emp_code || undefined,
                    query.division_code || undefined,
                    query.adjustment_type || undefined,
                    query.adjustment_name || undefined,
                    metadataOnly
                );
            } else {
                const r = await manualAdjustmentService.getAdjustments(
                    periodMonth, periodYear,
                    query.gang_code || undefined,
                    query.emp_code || undefined,
                    query.division_code || undefined,
                    query.adjustment_type || undefined,
                    query.adjustment_name || undefined,
                    metadataOnly
                );
                const { buildManualAdjustmentApiResponseRows } = await import("../services/manualAdjustmentService");
                dataRows = buildManualAdjustmentApiResponseRows(r);
            }

            if (String(query.view || "").trim().toLowerCase() === "grouped") {
                const { buildGroupedManualAdjustmentResponse } = await import("../services/manualAdjustmentService");
                const grouped = buildGroupedManualAdjustmentResponse(dataRows);
                return {
                    success: true,
                    view: "grouped",
                    metadata_only: metadataOnly,
                    count: dataRows.length,
                    summary: grouped.summary,
                    data: grouped.divisions
                };
            }

            return {
                success: true,
                view: "flat",
                metadata_only: metadataOnly,
                count: dataRows.length,
                data: dataRows
            };
        } catch (e: any) {
            logError(CATEGORY, "[PayrollRoutes] manual-adjustment/by-api-key GET error:", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        query: t.Object({
            period_month: t.String(),
            period_year: t.String(),
            gang_code: t.Optional(t.String()),
            emp_code: t.Optional(t.String()),
            division_code: t.Optional(t.String()),
            adjustment_type: t.Optional(t.String()),
            adjustment_name: t.Optional(t.String()),
            view: t.Optional(t.String()),
            metadata_only: t.Optional(t.String()),
            has_metadata: t.Optional(t.String()),
            recompute_sync: t.Optional(t.String())
        })
    })
    .post("/manual-adjustment/by-api-key", async ({ body, headers, set }) => {
        try {
            if (!hasValidApiKeyBypass(headers as Record<string, string | undefined>)) {
                set.status = 401;
                return { success: false, error: "Unauthorized: invalid x-api-key" };
            }

            const { manualAdjustmentService } = await import("../services/manualAdjustmentService");
            const { cacheService } = await import("../services/cacheService");
            const data = body as any;
            const resultId = await manualAdjustmentService.saveAdjustment(data, "api_key_bypass");

            const pattern = `:${data.period_month}:${data.period_year}`;
            cacheService.clearByPattern(pattern);

            return { success: true, id: resultId, message: "Manual adjustment saved successfully." };
        } catch (e: any) {
            logError(CATEGORY, "[PayrollRoutes] manual-adjustment/by-api-key POST error:", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        body: t.Object({
            period_month: t.Number(),
            period_year: t.Number(),
            nik: t.Optional(t.String()),
            emp_code: t.String(),
            gang_code: t.String(),
            division_code: t.Optional(t.String()),
            adjustment_type: t.String(),
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
    .post("/manual-adjustment/sync-status/by-api-key", async ({ body, headers, set }) => {
        try {
            if (!hasValidApiKeyBypass(headers as Record<string, string | undefined>)) {
                set.status = 401;
                return { success: false, error: "Unauthorized: invalid x-api-key" };
            }

            const data = body as any;
            const adjustmentTypes = Array.isArray(data.adjustment_types)
                ? data.adjustment_types
                : data.adjustment_type
                    ? String(data.adjustment_type).split(",")
                    : undefined;
            const { manualAdjustmentService } = await import("../services/manualAdjustmentService");
            const { cacheService } = await import("../services/cacheService");
            const result = await manualAdjustmentService.updateManualAdjustmentSyncStatus({
                periodMonth: Number(data.period_month),
                periodYear: Number(data.period_year),
                divisionCode: data.division_code || data.estate || undefined,
                gangCode: data.gang_code || undefined,
                empCode: data.emp_code || undefined,
                adjustmentTypes,
                adjustmentName: data.adjustment_name || undefined,
                ids: Array.isArray(data.ids) ? data.ids : undefined,
                syncStatus: data.sync_status || "SYNC",
                updatedBy: data.updated_by || data.created_by || "sync_status_api",
                onlyIfAdtransExists: data.only_if_adtrans_exists === true,
                dryRun: data.dry_run === true,
                limit: data.limit ? Number(data.limit) : undefined
            });

            if (!result.dry_run && result.updated_count > 0) {
                cacheService.clearByPattern(`:${data.period_month}:${data.period_year}`);
            }

            return {
                success: true,
                message: `Sync status update checked ${result.matched_count} rows and updated ${result.updated_count}`,
                data: result
            };
        } catch (e: any) {
            logError(CATEGORY, "[PayrollRoutes] manual-adjustment/sync-status/by-api-key error:", e);
            set.status = 500;
            return { success: false, error: e.message || "Internal server error" };
        }
    }, {
        body: t.Object({
            period_month: t.Number(),
            period_year: t.Number(),
            division_code: t.Optional(t.String()),
            estate: t.Optional(t.String()),
            gang_code: t.Optional(t.String()),
            emp_code: t.Optional(t.String()),
            adjustment_type: t.Optional(t.String()),
            adjustment_types: t.Optional(t.Array(t.String())),
            adjustment_name: t.Optional(t.String()),
            ids: t.Optional(t.Array(t.Number())),
            sync_status: t.Optional(t.String()),
            updated_by: t.Optional(t.String()),
            created_by: t.Optional(t.String()),
            only_if_adtrans_exists: t.Optional(t.Boolean()),
            dry_run: t.Optional(t.Boolean()),
            limit: t.Optional(t.Number())
        })
    })
    /**
     * @route POST /payroll/manual-adjustment/save-verified/by-api-key
     * @description Save manual adjustment with verification against db_ptrj.
     *              verify_mode: "warn" (default) | "strict" | "skip"
     * @access Public (with X-API-Key)
     */
    .post("/manual-adjustment/save-verified/by-api-key", async ({ body, headers, set }) => {
        try {
            const apiKey = headers["x-api-key"] || headers["X-API-Key"];
            if (!apiKey || apiKey !== Config.API_KEY_BYPASS) {
                set.status = 401;
                return { success: false, error: "Invalid API key" };
            }

            const { manualAdjustmentVerificationService } = await import("../services/manualAdjustmentVerificationService");
            const result = await manualAdjustmentVerificationService.saveVerifiedAdjustment(
                body,
                "api_key_user",
                (body.verify_mode as "warn" | "strict" | "skip") || "warn"
            );

            if (result.verification?.status === "MISMATCH" && body.verify_mode === "strict") {
                set.status = 409;
                return { success: false, error: "VERIFICATION_FAILED", verification: result.verification };
            }

            return { success: true, id: result.id, action: result.action, verification: result.verification };
        } catch (e: any) {
            logError(CATEGORY, "[PayrollRoutes] manual-adjustment/save-verified error:", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        body: t.Object({
            period_month: t.Number(),
            period_year: t.Number(),
            emp_code: t.String(),
            nik: t.Optional(t.String()),
            emp_name: t.Optional(t.String()),
            gang_code: t.Optional(t.String()),
            division_code: t.String(),
            adjustment_type: t.String(),
            adjustment_name: t.String(),
            amount: t.Number(),
            ad_code: t.Optional(t.String()),
            task_code: t.Optional(t.String()),
            base_task_code: t.Optional(t.String()),
            task_desc: t.Optional(t.String()),
            remarks: t.Optional(t.String()),
            metadata_json: t.Optional(t.String()),
            verify_mode: t.Optional(t.String())
        })
    })
    .post("/manual-adjustment/seed-sync-status/by-api-key", async ({ body, headers, set }) => {
        try {
            if (!hasValidApiKeyBypass(headers as Record<string, string | undefined>)) {
                set.status = 401;
                return { success: false, error: "Unauthorized: invalid x-api-key" };
            }

            const payload = body as any;
            const { manualAdjustmentSyncStatusSeederService } = await import("../services/manualAdjustmentSyncStatusSeederService");
            const { cacheService } = await import("../services/cacheService");
            const result = await manualAdjustmentSyncStatusSeederService.seedPeriod({
                period_month: payload.period_month,
                period_year: payload.period_year,
                division_code: payload.division_code || payload.estate || undefined,
                gang_code: payload.gang_code || undefined,
                emp_code: payload.emp_code || undefined,
                adjustment_types: Array.isArray(payload.adjustment_types)
                    ? payload.adjustment_types
                    : payload.adjustment_type
                        ? String(payload.adjustment_type).split(",")
                        : undefined,
                adjustment_name: payload.adjustment_name || undefined,
                ids: Array.isArray(payload.ids) ? payload.ids : undefined,
                sync_status: payload.sync_status || "SYNC",
                created_by: payload.created_by || payload.updated_by || "sync_status_seeder_api",
                only_if_adtrans_exists: payload.only_if_adtrans_exists !== false,
                dry_run: payload.dry_run === true,
                limit: payload.limit ? Number(payload.limit) : undefined
            });

            if (!result.dry_run && result.updated_count > 0) {
                cacheService.clearByPattern(`:${payload.period_month}:${payload.period_year}`);
            }

            return {
                success: true,
                message: `Manual adjustment sync-status seeder checked ${result.matched_count} rows and updated ${result.updated_count}`,
                data: result
            };
        } catch (e: any) {
            logError(CATEGORY, "[PayrollRoutes] manual-adjustment/seed-sync-status/by-api-key error:", e);
            set.status = 500;
            return { success: false, error: e.message || "Internal server error" };
        }
    }, {
        body: t.Object({
            period_month: t.Number(),
            period_year: t.Number(),
            division_code: t.Optional(t.String()),
            estate: t.Optional(t.String()),
            gang_code: t.Optional(t.String()),
            emp_code: t.Optional(t.String()),
            adjustment_type: t.Optional(t.String()),
            adjustment_types: t.Optional(t.Array(t.String())),
            adjustment_name: t.Optional(t.String()),
            ids: t.Optional(t.Array(t.Number())),
            sync_status: t.Optional(t.String()),
            created_by: t.Optional(t.String()),
            updated_by: t.Optional(t.String()),
            only_if_adtrans_exists: t.Optional(t.Boolean()),
            dry_run: t.Optional(t.Boolean()),
            limit: t.Optional(t.Number())
        })
    })
    .post("/manual-adjustment/seed-auto-buffer", async ({ body, currentUser, set }) => {
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
            logError(CATEGORY, "[PayrollRoutes] manual-adjustment/seed-auto-buffer error:", e);
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
    .post("/manual-adjustment/seed-sync-status", async ({ body, currentUser, set }) => {
        try {
            const { manualAdjustmentSyncStatusSeederService } = await import("../services/manualAdjustmentSyncStatusSeederService");
            const { cacheService } = await import("../services/cacheService");
            const payload = body as any;

            const result = await manualAdjustmentSyncStatusSeederService.seedPeriod({
                period_month: payload.period_month,
                period_year: payload.period_year,
                division_code: payload.division_code || payload.estate || undefined,
                gang_code: payload.gang_code || undefined,
                emp_code: payload.emp_code || undefined,
                adjustment_types: Array.isArray(payload.adjustment_types)
                    ? payload.adjustment_types
                    : payload.adjustment_type
                        ? String(payload.adjustment_type).split(",")
                        : undefined,
                adjustment_name: payload.adjustment_name || undefined,
                ids: Array.isArray(payload.ids) ? payload.ids : undefined,
                sync_status: payload.sync_status || "SYNC",
                created_by: payload.created_by || currentUser?.username || "sync_status_seeder",
                only_if_adtrans_exists: payload.only_if_adtrans_exists !== false,
                dry_run: payload.dry_run === true,
                limit: payload.limit ? Number(payload.limit) : undefined
            });

            if (!result.dry_run && result.updated_count > 0) {
                cacheService.clearByPattern(`:${payload.period_month}:${payload.period_year}`);
            }

            return {
                success: true,
                message: "Manual adjustment sync status seeder selesai",
                data: result
            };
        } catch (e: any) {
            logError(CATEGORY, "[PayrollRoutes] manual-adjustment/seed-sync-status error:", e);
            set.status = 500;
            return { success: false, error: e.message || "Internal server error" };
        }
    }, {
        body: t.Object({
            period_month: t.Number(),
            period_year: t.Number(),
            division_code: t.Optional(t.String()),
            estate: t.Optional(t.String()),
            gang_code: t.Optional(t.String()),
            emp_code: t.Optional(t.String()),
            adjustment_type: t.Optional(t.String()),
            adjustment_types: t.Optional(t.Array(t.String())),
            adjustment_name: t.Optional(t.String()),
            ids: t.Optional(t.Array(t.Number())),
            sync_status: t.Optional(t.String()),
            created_by: t.Optional(t.String()),
            only_if_adtrans_exists: t.Optional(t.Boolean()),
            dry_run: t.Optional(t.Boolean()),
            limit: t.Optional(t.Number())
        })
    })
