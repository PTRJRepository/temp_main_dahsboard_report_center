/**
 * @module backend/src/api/payroll.adtransVerifyRoutes.ts
 * @purpose ADTRANS verification + sync route group for /payroll: check/compare/reverse-compare/sync-adtrans by-api-key, verify/full-granular-consistency, doc-id lookups.
 * @input POST body { period_month, period_year, division_code, emp_codes[], filters[], sync_mode, check_scope, ... } + x-api-key header (must equal Config.API_KEY_BYPASS)
 * @output JSON { success, message, data } with per-employee comparison/sync/verification results; 401 invalid api key, 400 missing required fields
 * @depends ./payroll.shared#getUserFromHeader, ../config#Config; services via dynamic import (manualAdjustmentService, payrollVerificationService, manualAdjustmentVerificationService)
 * @sideeffect sync-adtrans writes payroll_manual_adjustments (extend_db_ptrj); clears cacheService pattern after sync
 * @tests backend/src/api/payroll.manualAdjustmentByApiKey.test.ts
 */
import { Elysia, t } from "elysia";
import { Config } from "../config";
import { getUserFromHeader } from "./payroll.shared";

function parseStringArrayInput(value: unknown): string[] {
    const values = Array.isArray(value) ? value : value == null ? [] : [value];
    return values
        .flatMap((item) => String(item || "").split(","))
        .map((item) => item.trim())
        .filter(Boolean);
}

const ADTRANS_DOC_IDS_BODY_SCHEMA = t.Object({
    period_month: t.Number(),
    period_year: t.Number(),
    emp_codes: t.Optional(t.Array(t.String())),
    filters: t.Optional(t.Array(t.String())),
    adjustment_type: t.Optional(t.Union([t.String(), t.Array(t.String())])),
    adjustment_types: t.Optional(t.Array(t.String())),
    adjustment_name: t.Optional(t.Union([t.String(), t.Array(t.String())])),
    adjustment_names: t.Optional(t.Array(t.String())),
    doc_desc: t.Optional(t.Union([t.String(), t.Array(t.String())])),
    doc_descs: t.Optional(t.Array(t.String())),
    division_code: t.Optional(t.String()),
    gang_code: t.Optional(t.String())
});

async function handleAdtransDocIdsByApiKey({ body, headers, set }: {
    body: unknown;
    headers: Record<string, string | undefined>;
    set: any;
}) {
    try {
        const apiKey = headers["x-api-key"];
        if (!apiKey || apiKey !== Config.API_KEY_BYPASS) {
            set.status = 401;
            return { success: false, message: "Unauthorized - Invalid API Key" };
        }

        const data = body as any;
        const { period_month, period_year, emp_codes = [], division_code, gang_code } = data;
        const filters = parseStringArrayInput(data.filters);
        const adjustmentTypes = [
            ...parseStringArrayInput(data.adjustment_type),
            ...parseStringArrayInput(data.adjustment_types)
        ];
        const adjustmentNames = [
            ...parseStringArrayInput(data.adjustment_name),
            ...parseStringArrayInput(data.adjustment_names)
        ];
        const docDescs = [
            ...parseStringArrayInput(data.doc_desc),
            ...parseStringArrayInput(data.doc_descs)
        ];

        if (!period_month || !period_year) {
            set.status = 400;
            return { success: false, message: "period_month and period_year are required" };
        }

        if ((!Array.isArray(emp_codes) || emp_codes.length === 0) && !division_code && !gang_code) {
            set.status = 400;
            return { success: false, message: "emp_codes array, division_code, or gang_code is required" };
        }

        if (filters.length === 0 && adjustmentTypes.length === 0 && adjustmentNames.length === 0 && docDescs.length === 0) {
            set.status = 400;
            return { success: false, message: "filters, adjustment_type, adjustment_name, or doc_desc is required" };
        }

        const { manualAdjustmentService } = await import("../services/manualAdjustmentService");
        const docIds = await manualAdjustmentService.listAdtransDocIds({
            periodMonth: Number(period_month),
            periodYear: Number(period_year),
            empCodes: emp_codes,
            filters,
            divisionCode: division_code,
            gangCode: gang_code,
            adjustmentTypes,
            adjustmentNames,
            docDescs
        });

        return {
            success: true,
            count: docIds.length,
            doc_ids: docIds
        };
    } catch (e: any) {
        console.error("[PayrollRoutes] manual-adjustment/adtrans-doc-ids error:", e);
        set.status = 500;
        return { success: false, message: e.message || "Internal server error" };
    }
}

export const adtransVerifyRoutes = new Elysia()
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
    /**
     * @route POST /payroll/manual-adjustment/check-adtrans/by-api-key
     * @description Checks PR_ADTRANS directly for given employees and specific allowance/deduction patterns
     * @access Public (with X-API-Key)
     */
    .post("/manual-adjustment/check-adtrans/by-api-key", async ({ body, headers, set }) => {
        try {
            // Verify API Key
            const apiKey = headers["x-api-key"];
            if (!apiKey || apiKey !== Config.API_KEY_BYPASS) {
                set.status = 401;
                return { success: false, message: "Unauthorized - Invalid API Key" };
            }

            const data = body as any;
            const { period_month, period_year, emp_codes = [], division_code } = data;
            const filters = parseStringArrayInput(data.filters);
            const adjustmentTypes = [
                ...parseStringArrayInput(data.adjustment_type),
                ...parseStringArrayInput(data.adjustment_types)
            ];
            const adjustmentNames = [
                ...parseStringArrayInput(data.adjustment_name),
                ...parseStringArrayInput(data.adjustment_names)
            ];
            const docDescs = [
                ...parseStringArrayInput(data.doc_desc),
                ...parseStringArrayInput(data.doc_descs)
            ];

            if (!period_month || !period_year) {
                set.status = 400;
                return { success: false, message: "period_month and period_year are required" };
            }

            if ((!Array.isArray(emp_codes) || emp_codes.length === 0) && !division_code) {
                set.status = 400;
                return { success: false, message: "emp_codes array or division_code is required" };
            }

            if (filters.length === 0 && adjustmentTypes.length === 0 && adjustmentNames.length === 0 && docDescs.length === 0) {
                set.status = 400;
                return { success: false, message: "filters, adjustment_type, adjustment_name, or doc_desc is required" };
            }

            const { manualAdjustmentService } = await import("../services/manualAdjustmentService");
            const result = await manualAdjustmentService.checkAdtransDirectly(
                Number(period_month),
                Number(period_year),
                emp_codes,
                filters,
                division_code,
                {
                    adjustmentTypes,
                    adjustmentNames,
                    docDescs
                }
            );

            return {
                success: true,
                message: "Adtrans check completed successfully",
                data: result
            };
        } catch (e: any) {
            console.error("[PayrollRoutes] manual-adjustment/check-adtrans error:", e);
            set.status = 500;
            return { success: false, message: e.message || "Internal server error" };
        }
    }, {
        body: t.Object({
            period_month: t.Number(),
            period_year: t.Number(),
            emp_codes: t.Optional(t.Array(t.String())),
            filters: t.Optional(t.Array(t.String())),
            adjustment_type: t.Optional(t.Union([t.String(), t.Array(t.String())])),
            adjustment_types: t.Optional(t.Array(t.String())),
            adjustment_name: t.Optional(t.Union([t.String(), t.Array(t.String())])),
            adjustment_names: t.Optional(t.Array(t.String())),
            doc_desc: t.Optional(t.Union([t.String(), t.Array(t.String())])),
            doc_descs: t.Optional(t.Array(t.String())),
            division_code: t.Optional(t.String())
        })
    })
    /**
     * @route POST /payroll/manual-adjustment/adtrans-doc-ids/by-api-key
     * @description Return only PR_ADTRANS/PR_ADTRANS_ARC DocID values matching selected config.
     * @access Public (with X-API-Key)
     */
    .post("/manual-adjustment/adtrans-doc-ids/by-api-key", handleAdtransDocIdsByApiKey, {
        body: ADTRANS_DOC_IDS_BODY_SCHEMA
    })
    /**
     * @route POST /payroll/manual-adjustment/adtrans-by-docid/by-api-key
     * @description Compatibility alias for automation that asks for ADTRANS records by DocID.
     * @access Public (with X-API-Key)
     */
    .post("/manual-adjustment/adtrans-by-docid/by-api-key", handleAdtransDocIdsByApiKey, {
        body: ADTRANS_DOC_IDS_BODY_SCHEMA
    })
    /**
     * @route POST /payroll/manual-adjustment/adtrans-by-doid/by-api-key
     * @description Typo-compatible alias for adtrans-by-docid.
     * @access Public (with X-API-Key)
     */
    .post("/manual-adjustment/adtrans-by-doid/by-api-key", handleAdtransDocIdsByApiKey, {
        body: ADTRANS_DOC_IDS_BODY_SCHEMA
    })
    /**
     * @route POST /payroll/manual-adjustment/compare-adtrans/by-api-key
     * @description Compare PR_ADTRANS (db_ptrj) values with payroll_manual_adjustments (extend_db_ptrj).
     *              Returns per-employee per-category comparison showing source vs stored amount.
     * @access Public (with X-API-Key)
     */
    .post("/manual-adjustment/compare-adtrans/by-api-key", async ({ body, headers, set }) => {
        try {
            const apiKey = headers["x-api-key"];
            if (!apiKey || apiKey !== Config.API_KEY_BYPASS) {
                set.status = 401;
                return { success: false, message: "Unauthorized - Invalid API Key" };
            }

            const data = body as any;
            const { period_month, period_year, division_code, filters } = data;

            if (!period_month || !period_year) {
                set.status = 400;
                return { success: false, message: "period_month and period_year are required" };
            }

            if (!division_code) {
                set.status = 400;
                return { success: false, message: "division_code is required" };
            }

            const { manualAdjustmentService } = await import("../services/manualAdjustmentService");
            const result = await manualAdjustmentService.compareAdtransWithAdjustments(
                Number(period_month),
                Number(period_year),
                division_code,
                filters || ['spsi', 'masa kerja', 'jabatan', 'premi', 'koreksi', 'potongan']
            );

            return {
                success: true,
                message: "Comparison completed successfully",
                data: result
            };
        } catch (e: any) {
            console.error("[PayrollRoutes] manual-adjustment/compare-adtrans error:", e);
            set.status = 500;
            return { success: false, message: e.message || "Internal server error" };
        }
    }, {
        body: t.Object({
            period_month: t.Number(),
            period_year: t.Number(),
            division_code: t.String(),
            filters: t.Optional(t.Array(t.String()))
        })
    })
    /**
     * @route POST /payroll/manual-adjustment/reverse-compare-adtrans/by-api-key
     * @description Compare payroll_manual_adjustments (extend_db_ptrj) values with PR_ADTRANS (db_ptrj).
     *              Returns stored AUTO_BUFFER rows that match, mismatch, or exist only in adjustments.
     * @access Public (with X-API-Key)
     */
    .post("/manual-adjustment/reverse-compare-adtrans/by-api-key", async ({ body, headers, set }) => {
        try {
            const apiKey = headers["x-api-key"];
            if (!apiKey || apiKey !== Config.API_KEY_BYPASS) {
                set.status = 401;
                return { success: false, message: "Unauthorized - Invalid API Key" };
            }

            const data = body as any;
            const { period_month, period_year, division_code, filters } = data;

            if (!period_month || !period_year) {
                set.status = 400;
                return { success: false, message: "period_month and period_year are required" };
            }

            if (!division_code) {
                set.status = 400;
                return { success: false, message: "division_code is required" };
            }

            const { manualAdjustmentService } = await import("../services/manualAdjustmentService");
            const result = await manualAdjustmentService.reverseCompareAdtransWithAdjustments(
                Number(period_month),
                Number(period_year),
                division_code,
                filters || ['spsi', 'masa kerja', 'jabatan', 'premi', 'koreksi', 'potongan']
            );

            return {
                success: true,
                message: "Reverse comparison completed successfully",
                data: result
            };
        } catch (e: any) {
            console.error("[PayrollRoutes] manual-adjustment/reverse-compare-adtrans error:", e);
            set.status = 500;
            return { success: false, message: e.message || "Internal server error" };
        }
    }, {
        body: t.Object({
            period_month: t.Number(),
            period_year: t.Number(),
            division_code: t.String(),
            filters: t.Optional(t.Array(t.String()))
        })
    })
    /**
     * @route POST /payroll/manual-adjustment/sync-adtrans/by-api-key
     * @description Sync PR_ADTRANS (db_ptrj) values into payroll_manual_adjustments (extend_db_ptrj).
     *              Only syncs items that are MISMATCH or MISSING from comparison.
     * @access Public (with X-API-Key)
     */
    .post("/manual-adjustment/sync-adtrans/by-api-key", async ({ body, headers, set }) => {
        try {
            const apiKey = headers["x-api-key"];
            if (!apiKey || apiKey !== Config.API_KEY_BYPASS) {
                set.status = 401;
                return { success: false, message: "Unauthorized - Invalid API Key" };
            }

            const data = body as any;
            const { period_month, period_year, division_code, filters, sync_mode, created_by } = data;

            if (!period_month || !period_year) {
                set.status = 400;
                return { success: false, message: "period_month and period_year are required" };
            }

            if (!division_code) {
                set.status = 400;
                return { success: false, message: "division_code is required" };
            }

            const validSyncModes = ['MISSING_ONLY', 'MISMATCH_AND_MISSING', 'ALL'];
            const syncMode = validSyncModes.includes(sync_mode) ? sync_mode : 'MISMATCH_AND_MISSING';

            const { manualAdjustmentService } = await import("../services/manualAdjustmentService");
            const { cacheService } = await import("../services/cacheService");

            const result = await manualAdjustmentService.syncAdtransToAdjustments(
                Number(period_month),
                Number(period_year),
                division_code,
                filters || ['spsi', 'masa kerja', 'jabatan', 'premi', 'koreksi', 'potongan'],
                syncMode as 'MISSING_ONLY' | 'MISMATCH_AND_MISSING' | 'ALL',
                created_by || 'sync_adtrans_api'
            );

            // Clear cache for this period
            const pattern = `:${period_month}:${period_year}`;
            cacheService.clearByPattern(pattern);

            return {
                success: true,
                message: `Sync completed: ${result.synced_count} records synced, ${result.skipped_match} matches skipped`,
                data: result
            };
        } catch (e: any) {
            console.error("[PayrollRoutes] manual-adjustment/sync-adtrans error:", e);
            set.status = 500;
            return { success: false, message: e.message || "Internal server error" };
        }
    }, {
        body: t.Object({
            period_month: t.Number(),
            period_year: t.Number(),
            division_code: t.String(),
            filters: t.Optional(t.Array(t.String())),
            sync_mode: t.Optional(t.String()),
            created_by: t.Optional(t.String())
        })
    })
    // ─── Verification Endpoints ─────────────────────────────────────────────

    /**
     * @route POST /payroll/verify/full-by-api-key
     * @description Full verification across ALL data sources (PR_ADTRANS, PR_TASKREGLN, HR_PAYROLL, HR_EMPLOYEE, manual adjustments).
     * @access Public (with X-API-Key)
     */
    .post("/verify/full-by-api-key", async ({ body, headers, set }) => {
        try {
            const apiKey = headers["x-api-key"] || headers["X-API-Key"];
            if (!apiKey || apiKey !== Config.API_KEY_BYPASS) {
                set.status = 401;
                return { success: false, error: "Invalid API key" };
            }

            const { payrollVerificationService } = await import("../services/payrollVerificationService");
            const result = await payrollVerificationService.verifyFullPayroll(
                Number(body.period_month),
                Number(body.period_year),
                String(body.division_code),
                body.gang_code || undefined,
                body.emp_codes?.length ? body.emp_codes : undefined,
                body.source_filter?.length ? body.source_filter : undefined
            );

            return { success: true, data: result };
        } catch (e: any) {
            console.error("[PayrollRoutes] verify/full error:", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        body: t.Object({
            period_month: t.Number(),
            period_year: t.Number(),
            division_code: t.String(),
            gang_code: t.Optional(t.String()),
            emp_codes: t.Optional(t.Array(t.String())),
            source_filter: t.Optional(t.Array(t.String()))
        })
    })
    /**
     * @route POST /payroll/verify/granular-adtrans/by-api-key
     * @description Granular per-DocDesc verification for PR_ADTRANS.
     * @access Public (with X-API-Key)
     */
    .post("/verify/granular-adtrans/by-api-key", async ({ body, headers, set }) => {
        try {
            const apiKey = headers["x-api-key"] || headers["X-API-Key"];
            if (!apiKey || apiKey !== Config.API_KEY_BYPASS) {
                set.status = 401;
                return { success: false, error: "Invalid API key" };
            }

            const { manualAdjustmentVerificationService } = await import("../services/manualAdjustmentVerificationService");
            const result = await manualAdjustmentVerificationService.verifyGranularAdtrans(
                Number(body.period_month),
                Number(body.period_year),
                String(body.division_code),
                body.adjustment_types || ["PREMI", "POTONGAN_KOTOR", "AUTO_BUFFER"],
                body.emp_codes?.length ? body.emp_codes : undefined,
                body.include_doc_desc_details !== false
            );

            return { success: true, data: result };
        } catch (e: any) {
            console.error("[PayrollRoutes] verify/granular-adtrans error:", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        body: t.Object({
            period_month: t.Number(),
            period_year: t.Number(),
            division_code: t.String(),
            adjustment_types: t.Optional(t.Array(t.String())),
            emp_codes: t.Optional(t.Array(t.String())),
            include_doc_desc_details: t.Optional(t.Boolean())
        })
    })
    /**
     * @route POST /payroll/verify/consistency/by-api-key
     * @description Check adjustment_name = DocDesc consistency between extend_db_ptrj and db_ptrj.
     * @access Public (with X-API-Key)
     */
    .post("/verify/consistency/by-api-key", async ({ body, headers, set }) => {
        try {
            const apiKey = headers["x-api-key"] || headers["X-API-Key"];
            if (!apiKey || apiKey !== Config.API_KEY_BYPASS) {
                set.status = 401;
                return { success: false, error: "Invalid API key" };
            }

            const { manualAdjustmentVerificationService } = await import("../services/manualAdjustmentVerificationService");
            const result = await manualAdjustmentVerificationService.verifyAdjustmentNameConsistency(
                Number(body.period_month),
                Number(body.period_year),
                String(body.division_code),
                (body.check_scope as "all" | "auto_buffer" | "manual") || "all"
            );

            return { success: true, data: result };
        } catch (e: any) {
            console.error("[PayrollRoutes] verify/consistency error:", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        body: t.Object({
            period_month: t.Number(),
            period_year: t.Number(),
            division_code: t.String(),
            check_scope: t.Optional(t.String())
        })
    })
