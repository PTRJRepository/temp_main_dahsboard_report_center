/**
 * @module backend/src/services/payroll/manualAdjustments/manualAdjustmentHelpers.ts
 * @purpose Pure (no-DB, no-service) helper functions for manual-adjustment names, ad_code fields,
 *             structured metadata, detail-item building, preset mapping, and sync/compare normalization.
 * @input ManualAdjustment payloads, metadata JSON, remarks text, ADTRANS detail rows.
 * @output normalized names/ad_codes, metadata JSON totals, detail items, sync-compare texts/types.
 * @depends ../../manualAdjustmentService (types only), ./manualAdjustmentNaming, ./potonganBersihTaskCode,
 *             ./autoBufferAdcodeMap, ../../../utils/manualAdjustmentRemarkParser,
 *             ./adtransDocDescMapping, ../../../../premiumDefinitionService (pure, JSON-backed),
 *             ./taskCodeOptionService (type only)
 * @sideeffect None — pure transforms. No DB, no writes.
 * @tests backend/src/services/manualAdjustmentService.test.ts
 */

import type {
    ManualAdjustment,
    ManualAdjustmentDetailItem,
    ManualAdjustmentApiResponseRow,
    GroupedManualAdjustmentResponse,
    GroupedManualAdjustmentItem,
    GroupedManualAdjustmentEmployee,
    GroupedManualAdjustmentGang,
    GroupedManualAdjustmentDivision
} from "../../manualAdjustmentService";
import { normalizeStoredAdjustmentName } from "./manualAdjustmentNaming";
import {
    containsPphDeductionText,
    resolvePotonganBersihHutangTaskCode
} from "./potonganBersihTaskCode";
import { normalizeAutoBufferAdjustmentName } from "./autoBufferAdcodeMap";
import {
    inferManualAdjustmentAdCodeFromRemarks,
    parsePipeDelimitedRemarks,
    updatePipeDelimitedSyncAndMatchStatus
} from "../../../utils/manualAdjustmentRemarkParser";
import {
    matchesAdtransDocDescFilter,
    normalizeAdtransFilter
} from "../adtransDocDescMapping";
import { premiumDefinitionService } from "../../premiumDefinitionService";
import type { TaskCodeOption } from "../../taskCodeOptionService";

// ── shared row/compare types ───────────────────────────────────────────────

export type AdtransDocDescDetail = {
    doc_desc: string;
    doc_id: string | null;
    amount: number;
};

export type ManualAdjustmentSyncAdtransDetail = AdtransDocDescDetail & {
    emp_code: string;
};

export type StoredAdjustmentComparison = {
    amount: number;
    remarks: string;
    gang_code: string;
    adjustment_name: string;
};

/**
 * @helper matchesAdtransFilter
 * @pure true
 * @input docDesc: string, filter: string
 * @output boolean (delegates to matchesAdtransDocDescFilter)
 */
function matchesAdtransFilter(docDesc: string, filter: string): boolean {
    return matchesAdtransDocDescFilter(docDesc, filter);
}

export const KOREKSI_PREFIX = "KOREKSI";
export const KOREKSI_DEFAULT_AD_CODE = "DE0004";
export const KOREKSI_DEFAULT_TASK_DESC = "(DE) POTONGAN PREMI";

/**
 * @helper normalizeText
 * @pure true
 * @input value: unknown
 * @output string (trimmed)
 */
export function normalizeText(value: unknown): string {
    return String(value || '').trim();
}

/**
 * @helper normalizeIdentityValue
 * @pure true
 * @input value: unknown
 * @output string (uppercase, trimmed)
 */
export function normalizeIdentityValue(value: unknown): string {
    return normalizeText(value).toUpperCase();
}

/**
 * @helper isNumericNik
 * @pure true
 * @input value: unknown
 * @output boolean (true when 10+ digit numeric)
 */
export function isNumericNik(value: unknown): boolean {
    return /^\d{10,}$/.test(normalizeIdentityValue(value));
}

/**
 * @helper toNumericAmount
 * @pure true
 * @input value: unknown
 * @output number (finite amount or 0)
 */
export function toNumericAmount(value: unknown): number {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : 0;
}

/**
 * @helper normalizeSubblokCode
 * @pure true
 * @input value: unknown
 * @output string (alphanumeric only)
 */
export function normalizeSubblokCode(value: unknown): string {
    return normalizeText(value).replace(/[^0-9A-Za-z]/g, "");
}

/**
 * @helper deriveDivisionCodeFromGangCode
 * @pure true
 * @input value: unknown (gang code)
 * @output string (first two letters space-joined)
 */
export function deriveDivisionCodeFromGangCode(value: unknown): string {
    const normalized = normalizeIdentityValue(value).replace(/[^0-9A-Z]/g, "");
    const code = normalized.slice(0, 2);
    return code ? code.split("").join(" ") : "";
}

/**
 * @helper normalizeStringList
 * @pure true
 * @input values: unknown
 * @output string[] (flattened, trimmed, non-empty)
 */
export function normalizeStringList(values?: unknown): string[] {
    const rawValues = Array.isArray(values) ? values : values == null ? [] : [values];
    return rawValues
        .flatMap((value) => String(value || "").split(","))
        .map((value) => normalizeText(value))
        .filter(Boolean);
}

/**
 * @helper removeLeadingWordPrefix
 * @pure true
 * @input value: unknown, prefix: string
 * @output string (prefix-stripped, case-insensitive)
 */
export function removeLeadingWordPrefix(value: unknown, prefix: string): string {
    return normalizeText(value).replace(new RegExp(`^${prefix}\\s*`, "i"), "").trim();
}

// ── ad_code / task_desc normalization ─────────────────────────────────────

/**
 * @helper shouldUseHutangTaskCodeForPotonganBersih
 * @pure true
 * @input data: ManualAdjustment, adjustmentName?: string
 * @output boolean
 */
export function shouldUseHutangTaskCodeForPotonganBersih(data: ManualAdjustment, adjustmentName?: string): boolean {
    const type = normalizeText(data.adjustment_type).toUpperCase();
    if (type !== "POTONGAN_BERSIH") return false;

    return !containsPphDeductionText([
        adjustmentName || data.adjustment_name,
        data.ad_code,
        data.task_code,
        data.base_task_code,
        data.task_desc,
        data.remarks
    ].join(" "));
}

/**
 * @helper buildPotonganBersihHutangAdCodePart
 * @pure true
 * @input mapping: ReturnType<typeof resolvePotonganBersihHutangTaskCode>
 * @output string
 */
export function buildPotonganBersihHutangAdCodePart(mapping: ReturnType<typeof resolvePotonganBersihHutangTaskCode>): string {
    return `${mapping.ad_code} - ${mapping.task_desc}`;
}

/**
 * @helper normalizePotonganBersihHutangRemarks
 * @pure true
 * @input remarks: ManualAdjustment["remarks"], mapping
 * @output ManualAdjustment["remarks"]
 */
export function normalizePotonganBersihHutangRemarks(
    remarks: ManualAdjustment["remarks"],
    mapping: ReturnType<typeof resolvePotonganBersihHutangTaskCode>
): ManualAdjustment["remarks"] {
    const text = normalizeText(remarks);
    if (!text || !text.includes("|")) return remarks;

    const segments = text.split("|").map((segment) => segment.trim());
    if (segments.length < 2) return remarks;

    segments[1] = buildPotonganBersihHutangAdCodePart(mapping);
    return segments.join(" | ");
}

/**
 * @helper normalizeManualAdjustmentForSave
 * @pure true
 * @input data: ManualAdjustment
 * @output ManualAdjustment (normalized)
 */
export function normalizeManualAdjustmentForSave(data: ManualAdjustment): ManualAdjustment {
    const type = normalizeText(data.adjustment_type).toUpperCase();
    if (type === "POTONGAN_KOTOR") {
        const suffix = removeLeadingWordPrefix(data.adjustment_name, KOREKSI_PREFIX);
        const adjustmentName = `${KOREKSI_PREFIX}${suffix ? ` ${suffix}` : ""}`.trim();

        return {
            ...data,
            adjustment_name: adjustmentName,
            ad_code: KOREKSI_DEFAULT_AD_CODE,
            task_code: KOREKSI_DEFAULT_AD_CODE,
            base_task_code: KOREKSI_DEFAULT_AD_CODE,
            task_desc: KOREKSI_DEFAULT_TASK_DESC
        };
    }

    if (shouldUseHutangTaskCodeForPotonganBersih(data)) {
        const mapping = resolvePotonganBersihHutangTaskCode(data.division_code);
        return {
            ...data,
            ad_code: mapping.ad_code,
            task_code: mapping.task_code,
            base_task_code: mapping.base_task_code,
            task_desc: mapping.task_desc,
            remarks: normalizePotonganBersihHutangRemarks(data.remarks, mapping)
        };
    }

    return data;
}

/**
 * @helper resolveManualAdjustmentAdCode
 * @pure true
 * @input data: Pick<ManualAdjustment, 'ad_code'|'base_task_code'|'task_code'>
 * @output string (uppercase)
 */
export function resolveManualAdjustmentAdCode(data: Pick<ManualAdjustment, 'ad_code' | 'base_task_code' | 'task_code'>): string {
    return normalizeText(data.ad_code || data.base_task_code || data.task_code).toUpperCase();
}

/**
 * @helper normalizeManualAdjustmentPresetCode
 * @pure true
 * @input value: unknown
 * @output string (short preset code or "")
 */
export function normalizeManualAdjustmentPresetCode(value: unknown): string {
    const normalized = normalizeText(value).toUpperCase();
    if (!normalized) return "";

    const parenthesizedCode = normalized.match(/^\(([A-Z]{2}\d[A-Z0-9_-]*)\)/);
    const code = parenthesizedCode?.[1];
    if (code !== undefined && code.length <= 50) return code;

    if (normalized.length <= 50 && /^[A-Z]{2}\d[A-Z0-9_-]*$/.test(normalized)) {
        return normalized;
    }

    return "";
}

/**
 * @helper resolveManualAdjustmentPresetCode
 * @pure true
 * @input data: Pick<ManualAdjustment, 'ad_code'|'base_task_code'|'task_code'>
 * @output string (first non-empty preset code)
 */
export function resolveManualAdjustmentPresetCode(data: Pick<ManualAdjustment, 'ad_code' | 'base_task_code' | 'task_code'>): string {
    return normalizeManualAdjustmentPresetCode(data.ad_code)
        || normalizeManualAdjustmentPresetCode(data.base_task_code)
        || normalizeManualAdjustmentPresetCode(data.task_code);
}

/**
 * @helper manualAdjustmentRequiresAdCode
 * @pure true
 * @input adjustmentType: string
 * @output boolean
 */
export function manualAdjustmentRequiresAdCode(adjustmentType: string): boolean {
    return normalizeText(adjustmentType).toUpperCase() !== 'AUTO_BUFFER';
}

/**
 * @helper isPipeDelimitedRemarks
 * @pure true
 * @input remarks: string
 * @output boolean
 */
export function isPipeDelimitedRemarks(remarks: string): boolean {
    return remarks.includes('|') && /\|\s*-?\d+\s*\|\s*sync:/i.test(remarks);
}

/**
 * @helper buildManualAdjustmentRemarks
 * @pure true
 * @input data: ManualAdjustment
 * @output string | null
 */
export function buildManualAdjustmentRemarks(data: ManualAdjustment): string | null {
    const existingRemarks = normalizeText(data.remarks);
    const adCode = resolveManualAdjustmentAdCode(data);
    const taskDesc = normalizeText(data.task_desc);

    // If remarks is already in pipe-delimited preset format, preserve it as-is
    if (existingRemarks && isPipeDelimitedRemarks(existingRemarks)) {
        return existingRemarks;
    }

    if (!adCode) {
        return existingRemarks || null;
    }

    const adCodeRemark = `AD CODE: ${adCode}${taskDesc ? ` - ${taskDesc}` : ''}`;
    if (!existingRemarks) return adCodeRemark;
    if (existingRemarks.toUpperCase().includes('AD CODE:') || existingRemarks.toUpperCase().includes('SYNC:')) return existingRemarks;

    return `${adCodeRemark}; ${existingRemarks}`;
}

/**
 * @helper validateManualAdjustmentAdCode
 * @pure true
 * @input data: ManualAdjustment
 * @output void (throws when ADCode missing)
 */
export function validateManualAdjustmentAdCode(data: ManualAdjustment): void {
    if (!manualAdjustmentRequiresAdCode(data.adjustment_type)) return;

    const remarks = normalizeText(data.remarks).toUpperCase();
    const isManualColumnRequest = remarks.includes('INIT_COLUMN') || remarks.includes('AD CODE:');
    if (!isManualColumnRequest) return;
    if (resolveManualAdjustmentAdCode(data)) return;

    throw new Error('ADCode wajib diisi untuk kolom manual adjustment selain auto buffer');
}

/**
 * @helper validatePremiumAdjustmentDefinition
 * @pure true
 * @input data: ManualAdjustment, normalizedAdjustmentName: string
 * @output void (throws on invalid premium name)
 */
export function validatePremiumAdjustmentDefinition(data: ManualAdjustment, normalizedAdjustmentName: string): void {
    if (String(data.adjustment_type || '').trim().toUpperCase() !== 'PREMI') return;
    premiumDefinitionService.validatePremiumName(normalizedAdjustmentName);
}

// ── metadata helpers ──────────────────────────────────────────────────────

/**
 * @helper serializeManualAdjustmentMetadata
 * @pure true
 * @input metadataJson: unknown
 * @output string | null
 */
export function serializeManualAdjustmentMetadata(metadataJson: unknown): string | null {
    if (!metadataJson) return null;
    return typeof metadataJson === "string" ? metadataJson : JSON.stringify(metadataJson);
}

/**
 * @helper calculateManualAdjustmentMetadataTotal
 * @pure true
 * @input metadata: any
 * @output number (sum from structured items/jumlah)
 */
export function calculateManualAdjustmentMetadataTotal(metadata: any): number {
    switch (metadata?.input_type) {
        case "blok":
            return (metadata.items || []).reduce((sum: number, item: any) => sum + (Number(item?.jumlah) || 0), 0);
        case "exp":
            return Number(metadata.jumlah) || 0;
        case "kendaraan":
            return (metadata.items || []).reduce((sum: number, item: any) => sum + (Number(item?.jumlah) || 0), 0);
        case "blok,exp":
            return (metadata.blok_items || []).reduce((sum: number, item: any) => sum + (Number(item?.jumlah) || 0), 0)
                 + (Number(metadata.expense?.jumlah) || 0);
        default:
            return 0;
    }
}

/**
 * @helper resolveDetailTotalSync
 * @pure true
 * @input data: ManualAdjustment, normalizedAdjustmentName: string, metadataJsonStr: string|null, fallbackAmount: number
 * @output { amount: number; metadataJsonStr: string | null }
 */
export function resolveDetailTotalSync(data: ManualAdjustment, normalizedAdjustmentName: string, metadataJsonStr: string | null, fallbackAmount: number): { amount: number; metadataJsonStr: string | null } {
    // Only PREMI type adjustments have structured metadata
    if (String(data.adjustment_type || "").trim().toUpperCase() !== "PREMI") {
        return { amount: fallbackAmount, metadataJsonStr };
    }

    const metadata = premiumDefinitionService.parseMetadata(metadataJsonStr);
    // No metadata or plain amount type — nothing to sync
    if (!metadata || String(metadata.input_type) === "amount") {
        return { amount: fallbackAmount, metadataJsonStr };
    }

    // Sync amount for ALL detail input types (blok, exp, kendaraan, blok,exp)
    // NOT limited to specific premium names — source of truth is metadata items
    const calculatedTotal = calculateManualAdjustmentMetadataTotal(metadata);

    // Use calculated total if finite; otherwise fall back to declared total_amount
    let syncedAmount: number;
    if (Number.isFinite(calculatedTotal)) {
        syncedAmount = calculatedTotal;
    } else {
        const declaredTotal = Number((metadata as any).total_amount);
        syncedAmount = Number.isFinite(declaredTotal) ? declaredTotal : fallbackAmount;
    }

    // Always inject the synced total_amount into metadata_json so DB stays consistent
    return {
        amount: syncedAmount,
        metadataJsonStr: JSON.stringify({ ...(metadata as any), total_amount: syncedAmount })
    };
}

/**
 * Build placeholder metadata for seed action (source amount → target structured type).
 * @helper seedPlaceholderMetadata
 * @pure true
 * @input targetInputType: string, total: number, row: Pick<ManualAdjustment, "gang_code">
 * @output Record<string, unknown> | null
 */
export function seedPlaceholderMetadata(
    targetInputType: string,
    total: number,
    row: Pick<ManualAdjustment, "gang_code">
): Record<string, unknown> | null {
    const gangCode = normalizeText(row.gang_code);
    switch (targetInputType) {
        case "blok":
            return { input_type: "blok", items: [{ subblok: "", gang_code: gangCode, jumlah: total }], total_amount: total };
        case "kendaraan":
            return { input_type: "kendaraan", items: [{ nomor_kendaraan: "", expense_code: "DRIVER", jumlah: total }], total_amount: total };
        case "exp":
            return { input_type: "exp", expense_code: "", jumlah: total, total_amount: total };
        case "blok,exp":
            return { input_type: "blok,exp", blok_items: [{ subblok: "", gang_code: gangCode, jumlah: total }], expense: { expense_code: "", jumlah: 0 }, total_amount: total };
        default:
            return null;
    }
}

/**
 * Remap metadata between compatible (non-blocked) input_types.
 * @helper remapMetadata
 * @pure true
 * @input oldMetadata, fromInputType, toInputType, row, fallbackTotal
 * @output Record<string, unknown> | null
 */
export function remapMetadata(
    oldMetadata: any,
    fromInputType: string,
    toInputType: string,
    row: Pick<ManualAdjustment, "gang_code">,
    fallbackTotal: number
): Record<string, unknown> | null {
    if (!oldMetadata) {
        return seedPlaceholderMetadata(toInputType, fallbackTotal, row);
    }

    const gangCode = normalizeText(row.gang_code);
    const oldItems: any[] = Array.isArray(oldMetadata.items) ? oldMetadata.items : [];
    const oldBlokItems: any[] = Array.isArray(oldMetadata.blok_items) ? oldMetadata.blok_items : [];
    const oldExpense = oldMetadata.expense && typeof oldMetadata.expense === "object" ? oldMetadata.expense : null;
    const oldExpenseCode = normalizeText(oldExpense?.expense_code || oldMetadata.expense_code);

    switch (toInputType) {
        case "blok": {
            // Allowed from: blok, blok,exp, exp, amount. NOT from kendaraan (blocked).
            let items: any[];
            if (fromInputType === "blok") {
                items = oldItems;
            } else if (fromInputType === "blok,exp") {
                items = oldBlokItems;
            } else if (fromInputType === "exp") {
                items = [{ subblok: "", gang_code: gangCode, jumlah: toNumericAmount(oldExpense?.jumlah) || fallbackTotal }];
            } else {
                items = [{ subblok: "", gang_code: gangCode, jumlah: fallbackTotal }];
            }
            return { input_type: "blok", items, total_amount: items.reduce((s, i) => s + toNumericAmount(i.jumlah), 0) };
        }
        case "exp": {
            const jumlah = oldExpense
                ? toNumericAmount(oldExpense.jumlah)
                : oldItems.reduce((s, i) => s + toNumericAmount(i?.jumlah), 0) || fallbackTotal;
            return { input_type: "exp", expense_code: oldExpenseCode, jumlah, total_amount: jumlah };
        }
        case "kendaraan": {
            let items: any[];
            if (fromInputType === "kendaraan") {
                items = oldItems;
            } else if (fromInputType === "exp") {
                items = [{ nomor_kendaraan: "", expense_code: oldExpenseCode || "DRIVER", jumlah: toNumericAmount(oldExpense?.jumlah) || fallbackTotal }];
            } else {
                items = [{ nomor_kendaraan: "", expense_code: "DRIVER", jumlah: fallbackTotal }];
            }
            return { input_type: "kendaraan", items, total_amount: items.reduce((s, i) => s + toNumericAmount(i.jumlah), 0) };
        }
        case "blok,exp": {
            let blokItems: any[];
            if (fromInputType === "blok") {
                blokItems = oldItems;
            } else if (fromInputType === "blok,exp") {
                blokItems = oldBlokItems;
            } else if (fromInputType === "exp") {
                blokItems = [{ subblok: "", gang_code: gangCode, jumlah: toNumericAmount(oldExpense?.jumlah) || fallbackTotal }];
            } else {
                blokItems = [{ subblok: "", gang_code: gangCode, jumlah: fallbackTotal }];
            }
            const expense = { expense_code: oldExpenseCode, jumlah: 0 };
            return { input_type: "blok,exp", blok_items: blokItems, expense, total_amount: blokItems.reduce((s, i) => s + toNumericAmount(i.jumlah), 0) };
        }
        default:
            return null;
    }
}

/**
 * @helper expectedTaskDescPrefix
 * @pure true
 * @input adjustmentType: string
 * @output "(AL)" | "(DE)" | null
 */
export function expectedTaskDescPrefix(adjustmentType: string): "(AL)" | "(DE)" | null {
    const type = normalizeText(adjustmentType).toUpperCase();
    if (type === "PREMI") return "(AL)";
    if (type === "POTONGAN_KOTOR" || type === "POTONGAN_BERSIH") return "(DE)";
    return null;
}

/**
 * @helper parseManualAdjustmentMetadataValue
 * @pure true
 * @input value: unknown
 * @output { metadata: unknown | null; metadata_parse_error: string | null }
 */
export function parseManualAdjustmentMetadataValue(value: unknown): { metadata: unknown | null; metadata_parse_error: string | null } {
    if (value == null || value === "") return { metadata: null, metadata_parse_error: null };
    if (typeof value === "object") return { metadata: value, metadata_parse_error: null };

    try {
        return { metadata: JSON.parse(String(value)), metadata_parse_error: null };
    } catch (error: any) {
        return { metadata: null, metadata_parse_error: error?.message || "Invalid metadata_json" };
    }
}

// ── preset mapping search helpers ─────────────────────────────────────────

/**
 * @helper normalizeSearchWords
 * @pure true
 * @input value: unknown
 * @output string[] (filtered uppercase words)
 */
export function normalizeSearchWords(value: unknown): string[] {
    return normalizeText(value)
        .toUpperCase()
        .replace(/[^A-Z0-9]+\s*/g, " ")
        .split(" ")
        .filter((word) => word.length >= 3 && !["PREMI", "POTONGAN", "KOREKSI", "MANUAL", "EDIT", "SYNC", "MATCH"].includes(word));
}

/**
 * @helper scoreTaskCodeOption
 * @pure true
 * @input option: TaskCodeOption, searchWords: string[]
 * @output number
 */
export function scoreTaskCodeOption(option: TaskCodeOption, searchWords: string[]): number {
    const haystack = `${option.task_desc} ${option.ad_code} ${option.task_code} ${option.base_task_code || ""}`.toUpperCase();
    return searchWords.reduce((score, word) => score + (haystack.includes(word) ? 1 : 0), 0);
}

// ── ad_code detail resolver helpers ───────────────────────────────────────

/**
 * @helper isKoreksiManualAdjustment
 * @pure true
 * @input row: Pick<ManualAdjustment, "adjustment_type"|"adjustment_name">
 * @output boolean
 */
export function isKoreksiManualAdjustment(row: Pick<ManualAdjustment, "adjustment_type" | "adjustment_name">): boolean {
    const adjustmentType = normalizeText(row.adjustment_type).toUpperCase();
    const adjustmentName = normalizeText(row.adjustment_name).toUpperCase();
    return adjustmentType === "POTONGAN_KOTOR" || adjustmentName.includes(KOREKSI_PREFIX);
}

/**
 * @helper resolveKoreksiManualAdjustmentAdCodeFields
 * @pure true
 * @input none
 * @output { ad_code; ad_code_desc; ad_desc; task_desc }
 */
export function resolveKoreksiManualAdjustmentAdCodeFields(): { ad_code: string; ad_code_desc: string; ad_desc: string; task_desc: string } {
    return {
        ad_code: KOREKSI_DEFAULT_AD_CODE,
        ad_code_desc: KOREKSI_DEFAULT_TASK_DESC,
        ad_desc: KOREKSI_DEFAULT_TASK_DESC,
        task_desc: KOREKSI_DEFAULT_TASK_DESC
    };
}

export type ManualAdjustmentResponseAdCodeFields = ReturnType<typeof resolveManualAdjustmentResponseAdCodeFields>;

/**
 * @helper resolveManualAdjustmentDefinitionAdCodeFields
 * @pure true
 * @input row: ManualAdjustment
 * @output { ad_code; ad_code_desc; task_desc }
 */
export function resolveManualAdjustmentDefinitionAdCodeFields(row: ManualAdjustment): { ad_code: string | null; ad_code_desc: string | null; task_desc: string | null } {
    const adjustmentType = normalizeText(row.adjustment_type).toUpperCase();
    const definition = premiumDefinitionService.getDefinitionByName(normalizeStoredAdjustmentName(row.adjustment_name));
    if (!definition) return { ad_code: null, ad_code_desc: null, task_desc: null };

    const definitionType = normalizeText(definition.adjustment_type || "PREMI").toUpperCase();
    if (definitionType !== adjustmentType) return { ad_code: null, ad_code_desc: null, task_desc: null };

    const taskDesc = normalizeText(definition.task_desc) || null;
    const parsedDefinition = inferManualAdjustmentAdCodeFromRemarks(
        `${definition.adjustment_name} | ${normalizeText(definition.ad_code)}${taskDesc ? ` - ${taskDesc}` : ""} | 0`
    );

    return {
        ad_code: normalizeText(parsedDefinition.adCode || definition.ad_code).toUpperCase() || null,
        ad_code_desc: normalizeText(parsedDefinition.adCodeDesc || taskDesc) || null,
        task_desc: taskDesc
    };
}

/**
 * @helper resolveManualAdjustmentResponseAdCodeFields
 * @pure true
 * @input row: ManualAdjustment
 * @output ManualAdjustmentResponseAdCodeFields
 */
export function resolveManualAdjustmentResponseAdCodeFields(row: ManualAdjustment): { ad_code: string; ad_code_desc: string; ad_desc: string; task_desc: string } {
    if (isKoreksiManualAdjustment(row)) {
        return resolveKoreksiManualAdjustmentAdCodeFields();
    }

    const inferred = inferManualAdjustmentAdCodeFromRemarks(row.remarks);
    const definition = resolveManualAdjustmentDefinitionAdCodeFields(row);
    const fallbackName = normalizeStoredAdjustmentName(row.adjustment_name) || "UNKNOWN_ADJUSTMENT";
    const taskDesc = normalizeText(row.task_desc || inferred.adCodeDesc || definition.task_desc || definition.ad_code_desc || fallbackName);
    const adCodeDesc = normalizeText(row.task_desc || inferred.adCodeDesc || definition.ad_code_desc || definition.task_desc || taskDesc || fallbackName);
    const adCode = normalizeText(row.ad_code || row.base_task_code || row.task_code || inferred.adCode || definition.ad_code || taskDesc || adCodeDesc || fallbackName).toUpperCase();

    return {
        ad_code: adCode,
        ad_code_desc: adCodeDesc,
        ad_desc: adCodeDesc,
        task_desc: taskDesc
    };
}

// ── detail item builders ──────────────────────────────────────────────────

export type ManualAdjustmentDetailContext = {
    row?: ManualAdjustment;
    adCodeFields?: ManualAdjustmentResponseAdCodeFields;
};

/**
 * @helper resolveVehicleExpenseCodeFromText
 * @pure true
 * @input value: unknown
 * @output "DRIVER" | "HELPER" | null
 */
export function resolveVehicleExpenseCodeFromText(value: unknown): "DRIVER" | "HELPER" | null {
    const text = normalizeText(value).toUpperCase();
    if (!text) return null;
    if (/\bHELPER\b/.test(text)) return "HELPER";
    if (/\b(DRIVER|OPERATOR|SOPIR|SUPIR)\b/.test(text)) return "DRIVER";
    return null;
}

/**
 * @helper resolveKendaraanExpenseCode
 * @pure true
 * @input item: Record<string, unknown>, context: ManualAdjustmentDetailContext
 * @output { code; source } | null
 */
export function resolveKendaraanExpenseCode(
    item: Record<string, unknown>,
    context: ManualAdjustmentDetailContext
): { code: "DRIVER" | "HELPER"; source: string } | null {
    const candidates: Array<{ source: string; value: unknown }> = [
        { source: "metadata_jabatan", value: item.jabatan || item.jabatan_estate || item.role_jabatan || item.role || item.position || item.job_title },
        { source: "jabatan", value: context.row?.jabatan || context.row?.jabatan_estate },
        { source: "task_desc", value: context.adCodeFields?.task_desc || context.adCodeFields?.ad_code_desc },
        { source: "remarks", value: context.row?.remarks },
        { source: "adjustment_name", value: context.row?.adjustment_name },
        { source: "expense_code", value: item.expense_code }
    ];

    for (const candidate of candidates) {
        const code = resolveVehicleExpenseCodeFromText(candidate.value);
        if (code) return { code, source: candidate.source };
    }

    return null;
}

/**
 * @helper buildDetailItem
 * @pure true
 * @input detailType: string, item: Record<string, unknown>, context
 * @output ManualAdjustmentDetailItem
 */
export function buildDetailItem(
    detailType: string,
    item: Record<string, unknown>,
    context: ManualAdjustmentDetailContext = {}
): ManualAdjustmentDetailItem {
    const detailItem: ManualAdjustmentDetailItem = {
        detail_type: detailType,
        ...item,
        amount: toNumericAmount(item.amount ?? item.jumlah ?? item.total_amount)
    };

    if ("subblok" in item) {
        const rawSubblok = normalizeText(item.subblok);
        const normalizedSubblok = normalizeSubblokCode(rawSubblok);

        if (rawSubblok) {
            detailItem.subblok = normalizedSubblok;
            if (normalizedSubblok !== rawSubblok) {
                detailItem.subblok_raw = rawSubblok;
            }
        }
    }

    if (normalizeText(detailType).toLowerCase() === "kendaraan") {
        const normalizedExpense = resolveKendaraanExpenseCode(item, context);
        if (normalizedExpense) {
            const rawExpenseCode = normalizeText(item.expense_code);
            if (rawExpenseCode && rawExpenseCode.toUpperCase() !== normalizedExpense.code) {
                detailItem.expense_code_raw = rawExpenseCode;
            }
            detailItem.expense_code = normalizedExpense.code;
            detailItem.expense_code_source = normalizedExpense.source;
        }
    }

    return detailItem;
}

/**
 * @helper buildManualAdjustmentDetailItems
 * @pure true
 * @input metadata: unknown, context
 * @output ManualAdjustmentDetailItem[]
 */
export function buildManualAdjustmentDetailItems(
    metadata: unknown,
    context: ManualAdjustmentDetailContext = {}
): ManualAdjustmentDetailItem[] {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];

    const data = metadata as Record<string, any>;
    const inputType = String(data.input_type || "detail").trim() || "detail";

    if (inputType === "blok,exp") {
        const blokItems = Array.isArray(data.blok_items)
            ? data.blok_items.map((item: Record<string, unknown>) => buildDetailItem("blok", item, context))
            : [];
        const expenseItems = data.expense && typeof data.expense === "object"
            ? [buildDetailItem("exp", data.expense, context)]
            : [];
        return [...blokItems, ...expenseItems];
    }

    if (Array.isArray(data.items)) {
        return data.items
            .filter((item: unknown): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item))
            .map((item) => buildDetailItem(inputType, item, context));
    }

    if ("jumlah" in data || "amount" in data || "expense_code" in data) {
        return [buildDetailItem(inputType, data, context)];
    }

    return [];
}

/**
 * @helper omitDetailType
 * @pure true
 * @input item: ManualAdjustmentDetailItem
 * @output Record<string, unknown> (detail_type removed)
 */
export function omitDetailType(item: ManualAdjustmentDetailItem): Record<string, unknown> {
    const { detail_type, ...rest } = item;
    return rest;
}

/**
 * @helper buildNormalizedMetadataItem
 * @pure true
 * @input originalItem, detailItem
 * @output Record<string, unknown>
 */
export function buildNormalizedMetadataItem(
    originalItem: Record<string, unknown>,
    detailItem: ManualAdjustmentDetailItem | undefined
): Record<string, unknown> {
    if (!detailItem) return { ...originalItem };

    const { detail_type, amount, ...normalizedDetail } = detailItem;
    const normalizedItem: Record<string, unknown> = {
        ...originalItem,
        ...normalizedDetail
    };

    if (!("jumlah" in originalItem) && !("amount" in originalItem)) {
        normalizedItem.amount = amount;
    }

    return normalizedItem;
}

/**
 * @helper buildNormalizedManualAdjustmentMetadata
 * @pure true
 * @input metadata, detailItems
 * @output unknown | null
 */
export function buildNormalizedManualAdjustmentMetadata(
    metadata: unknown,
    detailItems: ManualAdjustmentDetailItem[]
): unknown | null {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return metadata ?? null;

    const data = metadata as Record<string, any>;
    const inputType = String(data.input_type || "detail").trim() || "detail";
    const normalizedData: Record<string, unknown> = { ...data };

    if (inputType === "blok,exp") {
        const blokDetails = detailItems.filter((item) => item.detail_type === "blok");
        normalizedData.blok_items = Array.isArray(data.blok_items)
            ? data.blok_items.map((item: Record<string, unknown>, index: number) => buildNormalizedMetadataItem(item, blokDetails[index]))
            : blokDetails.map(omitDetailType);
        const expenseItem = detailItems.find((item) => item.detail_type === "exp");
        if (expenseItem) {
            normalizedData.expense = data.expense && typeof data.expense === "object" && !Array.isArray(data.expense)
                ? buildNormalizedMetadataItem(data.expense, expenseItem)
                : omitDetailType(expenseItem);
        }
        return normalizedData;
    }

    if (Array.isArray(data.items)) {
        normalizedData.items = data.items.map((item: Record<string, unknown>, index: number) => buildNormalizedMetadataItem(item, detailItems[index]));
        return normalizedData;
    }

    if (detailItems.length === 1) {
        return buildNormalizedMetadataItem(normalizedData, detailItems[0]);
    }

    return normalizedData;
}

/**
 * @helper buildManualAdjustmentResponseMetadataFields
 * @pure true
 * @input rawMetadataJson, metadata, metadataParseError, detailItems
 * @output { metadata_json; metadata_json_raw?; metadata; metadata_parse_error }
 */
export function buildManualAdjustmentResponseMetadataFields(
    rawMetadataJson: unknown,
    metadata: unknown | null,
    metadataParseError: string | null,
    detailItems: ManualAdjustmentDetailItem[]
): {
    metadata_json: string | null;
    metadata_json_raw?: string | null;
    metadata: unknown | null;
    metadata_parse_error: string | null;
} {
    if (metadataParseError || metadata == null) {
        return {
            metadata_json: rawMetadataJson == null || rawMetadataJson === "" ? null : String(rawMetadataJson),
            metadata: null,
            metadata_parse_error: metadataParseError
        };
    }

    const normalizedMetadata = buildNormalizedManualAdjustmentMetadata(metadata, detailItems);
    const normalizedMetadataJson = normalizedMetadata == null ? null : JSON.stringify(normalizedMetadata);
    const rawMetadataString = rawMetadataJson == null || rawMetadataJson === "" ? null : String(rawMetadataJson);

    return {
        metadata_json: normalizedMetadataJson,
        metadata_json_raw: rawMetadataString && normalizedMetadataJson !== rawMetadataString ? rawMetadataString : undefined,
        metadata: normalizedMetadata,
        metadata_parse_error: null
    };
}

// ── sync compare helpers ──────────────────────────────────────────────────

/**
 * @helper normalizeSyncStatus
 * @pure true
 * @input value: unknown
 * @output string (normalized status)
 */
export function normalizeSyncStatus(value: unknown): string {
    return normalizeText(value).toUpperCase().replace(/[^A-Z0-9_]/g, "_");
}

/**
 * @helper normalizeManualAdjustmentSyncTypes
 * @pure true
 * @input values?: string[]
 * @output string[]
 */
export function normalizeManualAdjustmentSyncTypes(values?: string[]): string[] {
    const allowedTypes = new Set(["PREMI", "POTONGAN_KOTOR", "POTONGAN_BERSIH", "AUTO_BUFFER"]);
    const aliases: Record<string, string> = {
        PREMI: "PREMI",
        KOREKSI: "POTONGAN_KOTOR",
        POTONGAN_KOTOR: "POTONGAN_KOTOR",
        POTONGAN_UPAH_KOTOR: "POTONGAN_KOTOR",
        POTONGAN_BERSIH: "POTONGAN_BERSIH",
        POTONGAN_UPAH_BERSIH: "POTONGAN_BERSIH",
        AUTO: "AUTO_BUFFER",
        AUTO_BUFFER: "AUTO_BUFFER"
    };

    const normalized = (values && values.length > 0 ? values : Array.from(allowedTypes))
        .flatMap((value) => String(value || "").split(","))
        .map((value) => aliases[normalizeText(value).toUpperCase()] || normalizeText(value).toUpperCase())
        .filter((value) => allowedTypes.has(value));

    return Array.from(new Set(normalized.length ? normalized : Array.from(allowedTypes)));
}

/**
 * @helper resolveManualAdjustmentAdtransCategory
 * @pure true
 * @input row: Pick<ManualAdjustment, "adjustment_type"|"adjustment_name">
 * @output string category
 */
export function resolveManualAdjustmentAdtransCategory(row: Pick<ManualAdjustment, "adjustment_type" | "adjustment_name">): string {
    const adjustmentType = normalizeText(row.adjustment_type).toUpperCase();
    const adjustmentName = normalizeText(row.adjustment_name).toUpperCase();
    if (adjustmentType === "PREMI") return "premi";
    if (adjustmentType === "POTONGAN_KOTOR") return adjustmentName.includes("KOREKSI") ? "koreksi" : "potongan";
    if (adjustmentType === "POTONGAN_BERSIH") return "potongan";
    if (adjustmentType === "AUTO_BUFFER") {
        const autoBufferName = normalizeAutoBufferAdjustmentName(adjustmentName);
        if (autoBufferName === "TUNJANGAN JABATAN") return "jabatan";
        if (autoBufferName === "MASA KERJA") return "masa kerja";
        if (autoBufferName === "SPSI") return "spsi";
        if (autoBufferName === "POTONGAN PPH") return "pph";
    }
    return "";
}

/**
 * @helper normalizeAdtransComparableText
 * @pure true
 * @input value: unknown
 * @output string (uppercase comparable)
 */
export function normalizeAdtransComparableText(value: unknown): string {
    return normalizeText(value)
        .toUpperCase()
        .replace(/\((AL|DE)\)/g, " ")
        .replace(/[^A-Z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * @helper buildManualAdjustmentExpectedAdtransTexts
 * @pure true
 * @input row: ManualAdjustment
 * @output string[]
 */
export function buildManualAdjustmentExpectedAdtransTexts(row: ManualAdjustment): string[] {
    const adCodeFields = resolveManualAdjustmentResponseAdCodeFields(row);
    const values = [
        adCodeFields.task_desc,
        adCodeFields.ad_code_desc,
        row.adjustment_name
    ];

    return Array.from(new Set(values
        .map(normalizeAdtransComparableText)
        .filter((value) => value.length >= 3)));
}

/**
 * @helper adtransDetailMatchesManualAdjustment
 * @pure true
 * @input row: ManualAdjustment, detail: ManualAdjustmentSyncAdtransDetail
 * @output boolean
 */
export function adtransDetailMatchesManualAdjustment(row: ManualAdjustment, detail: ManualAdjustmentSyncAdtransDetail): boolean {
    const docText = normalizeAdtransComparableText(detail.doc_desc);
    if (!docText) return false;

    const expectedTexts = buildManualAdjustmentExpectedAdtransTexts(row);
    if (expectedTexts.length > 0) {
        if (expectedTexts.some((expected) => docText.includes(expected) || expected.includes(docText))) {
            return true;
        }

        const adjustmentType = normalizeText(row.adjustment_type).toUpperCase();
        const category = resolveManualAdjustmentAdtransCategory(row);
        if (!category) return false;

        return adjustmentType === "AUTO_BUFFER"
            || adjustmentType === "POTONGAN_KOTOR"
            || adjustmentType === "POTONGAN_BERSIH"
            ? matchesAdtransFilter(detail.doc_desc, category)
            : false;
    }

    const category = resolveManualAdjustmentAdtransCategory(row);
    return category ? matchesAdtransFilter(detail.doc_desc, category) : false;
}

/**
 * @helper isDeductionCompareCategory
 * @pure true
 * @input category: string
 * @output boolean
 */
export function isDeductionCompareCategory(category: string): boolean {
    return ["spsi", "pph", "koreksi", "potongan"].includes(normalizeAdtransFilter(category));
}

/**
 * @helper toComparableCompareAmount
 * @pure true
 * @input category: string, amount: number
 * @output number (abs'd for deduction categories)
 */
export function toComparableCompareAmount(category: string, amount: number): number {
    return isDeductionCompareCategory(category) ? Math.abs(amount) : amount;
}

/**
 * @helper sumAdtransDetails
 * @pure true
 * @input details: AdtransDocDescDetail[]
 * @output number
 */
export function sumAdtransDetails(details: AdtransDocDescDetail[]): number {
    return details.reduce((sum, detail) => sum + toNumericAmount(detail.amount), 0);
}

/**
 * @helper mergeStoredAdjustmentComparison
 * @pure true
 * @input existing, row, adjustmentName
 * @output StoredAdjustmentComparison
 */
export function mergeStoredAdjustmentComparison(
    existing: StoredAdjustmentComparison | undefined,
    row: {
        amount: unknown;
        remarks?: unknown;
        gang_code?: unknown;
        adjustment_name?: unknown;
    },
    adjustmentName: string
): StoredAdjustmentComparison {
    const rowRemarks = normalizeText(row.remarks);
    const rowGangCode = normalizeText(row.gang_code);
    const rowAdjustmentName = adjustmentName || normalizeText(row.adjustment_name);
    if (!existing) {
        return {
            amount: Number(row.amount || 0),
            remarks: rowRemarks,
            gang_code: rowGangCode,
            adjustment_name: rowAdjustmentName
        };
    }

    return {
        amount: existing.amount + Number(row.amount || 0),
        remarks: [existing.remarks, rowRemarks].filter(Boolean).join(" || "),
        gang_code: existing.gang_code || rowGangCode,
        adjustment_name: Array.from(new Set([existing.adjustment_name, rowAdjustmentName].filter(Boolean))).join(", ")
    };
}

/**
 * @helper resolveManualAdjustmentSyncTargetAmount
 * @pure true
 * @input row: ManualAdjustment
 * @output { targetAmount: number; metadataDetailTotal: number | null }
 */
export function resolveManualAdjustmentSyncTargetAmount(row: ManualAdjustment): { targetAmount: number; metadataDetailTotal: number | null } {
    const parsedMetadata = parseManualAdjustmentMetadataValue(row.metadata_json);
    const detailItems = buildManualAdjustmentDetailItems(parsedMetadata.metadata);
    const detailTotal = detailItems.reduce((sum, item) => sum + toNumericAmount(item.amount), 0);

    if (detailItems.length > 0 && Math.abs(detailTotal) > 0.01) {
        return {
            targetAmount: detailTotal,
            metadataDetailTotal: detailTotal
        };
    }

    return {
        targetAmount: toNumericAmount(row.amount),
        metadataDetailTotal: detailItems.length > 0 ? detailTotal : null
    };
}

/**
 * @helper sortByText
 * @pure true
 * @input items: T[], selector
 * @output T[]
 */
export function sortByText<T>(items: T[], selector: (item: T) => unknown): T[] {
    return [...items].sort((a, b) => String(selector(a) || "").localeCompare(String(selector(b) || "")));
}

/**
 * @helper buildPremiumTransactionRecordGroupKey
 * @pure true
 * @input adjustmentId, employeeKey, groupedItem, rowOrdinal
 * @output string
 */
export function buildPremiumTransactionRecordGroupKey(
    adjustmentId: number | null,
    employeeKey: string,
    groupedItem: { adjustment_type: string; adjustment_name: string },
    rowOrdinal: number
): string {
    if (adjustmentId !== null) {
        return `adjustment:${adjustmentId}`;
    }

    const type = normalizeIdentityValue(groupedItem.adjustment_type) || "UNKNOWN_TYPE";
    const name = normalizeIdentityValue(groupedItem.adjustment_name) || "UNKNOWN_NAME";
    return `fallback:${employeeKey}|${type}|${name}|row:${rowOrdinal}`;
}

// ponytail: pure recompute sync/match status dari row + ADTRANS details.
//  Tidak tulis DB. Dipakai oleh GET recompute + write-back save + seeder (updateManualAdjustmentSyncStatus).
//  Upgrade: pindah sub-category-specific tolerance kalau logic grow.
export type ComputedManualAdjustmentSyncStatus = {
    id: number;
    sync_status: string;
    match_status: string;
    target_amount: number;
    metadata_detail_total: number | null;
    adtrans_amount: number;
    diff: number;
    adtrans_details: AdtransDocDescDetail[];
    has_adtrans: boolean;
    baked_sync: string | null;
    baked_match: string | null;
    is_stale: boolean;
    remarks_fresh: string | null;
};

/**
 * @helper computeManualAdjustmentSyncStatuses
 * @pure true
 * @input rows: ManualAdjustment[], adtransDetails: ManualAdjustmentSyncAdtransDetail[]
 * @output Map<number, ComputedManualAdjustmentSyncStatus>
 */
export function computeManualAdjustmentSyncStatuses(
    rows: ManualAdjustment[],
    adtransDetails: ManualAdjustmentSyncAdtransDetail[]
): Map<number, ComputedManualAdjustmentSyncStatus> {
    const detailsByEmpCode = new Map<string, ManualAdjustmentSyncAdtransDetail[]>();
    for (const detail of adtransDetails) {
        const empCode = normalizeIdentityValue(detail.emp_code);
        if (!detailsByEmpCode.has(empCode)) detailsByEmpCode.set(empCode, []);
        detailsByEmpCode.get(empCode)!.push(detail);
    }

    const result = new Map<number, ComputedManualAdjustmentSyncStatus>();

    for (const row of rows) {
        const id = Number(row.id);
        if (!id) continue;

        const empCode = normalizeIdentityValue(row.emp_code);
        const amountInfo = resolveManualAdjustmentSyncTargetAmount(row);
        const empDetails = detailsByEmpCode.get(empCode) || [];
        const matchingDetails = empDetails.filter((detail) => adtransDetailMatchesManualAdjustment(row, detail));
        const adtransAmountAbs = matchingDetails.reduce((sum, detail) => sum + Math.abs(toNumericAmount(detail.amount)), 0);
        const targetAmountAbs = Math.abs(toNumericAmount(amountInfo.targetAmount));
        const adtransDocDetails = matchingDetails.map((detail) => ({
            doc_desc: detail.doc_desc,
            doc_id: detail.doc_id,
            amount: detail.amount
        }));
        const hasAdtrans = matchingDetails.length > 0;
        const amountsMatch = Math.abs(adtransAmountAbs - targetAmountAbs) <= 0.01;
        const isZeroWithoutAdtransMatch = !hasAdtrans && targetAmountAbs <= 0.01 && adtransAmountAbs <= 0.01;
        const isMatch = (hasAdtrans && amountsMatch) || isZeroWithoutAdtransMatch;
        const nextSyncStatus = isMatch ? "SYNC" : hasAdtrans ? "DIFF" : "MISS";
        const nextMatchStatus = isMatch ? "MATCH" : "MISMATCH";

        const baked = parsePipeDelimitedRemarks(row.remarks);
        const reconciliation = updatePipeDelimitedSyncAndMatchStatus(row.remarks, nextSyncStatus, nextMatchStatus);

        const isStale = (baked.syncStatus !== null && baked.syncStatus !== nextSyncStatus)
            || (baked.matchStatus !== null && baked.matchStatus !== nextMatchStatus);

        result.set(id, {
            id,
            sync_status: nextSyncStatus,
            match_status: nextMatchStatus,
            target_amount: amountInfo.targetAmount,
            metadata_detail_total: amountInfo.metadataDetailTotal,
            adtrans_amount: adtransAmountAbs,
            diff: adtransAmountAbs - targetAmountAbs,
            adtrans_details: adtransDocDetails,
            has_adtrans: hasAdtrans,
            baked_sync: baked.syncStatus,
            baked_match: baked.matchStatus,
            is_stale: isStale,
            remarks_fresh: (reconciliation?.remarks ?? row.remarks) ?? null
        });
    }

    return result;
}

// ── response builders (moved from facade — pure, all deps in this module) ──

export function buildManualAdjustmentApiResponseRows(rows: ManualAdjustment[]): ManualAdjustmentApiResponseRow[] {
    return rows.map((row) => {
        const gangCode = normalizeIdentityValue(row.gang_code) || "UNKNOWN_GANG";
        const estateCode = normalizeIdentityValue(row.division_code) || "UNKNOWN_ESTATE";
        const parsedMetadata = parseManualAdjustmentMetadataValue(row.metadata_json);
        const adCodeFields = resolveManualAdjustmentResponseAdCodeFields(row);
        const detailItems = buildManualAdjustmentDetailItems(parsedMetadata.metadata, { row, adCodeFields });
        const metadataFields = buildManualAdjustmentResponseMetadataFields(
            row.metadata_json,
            parsedMetadata.metadata,
            parsedMetadata.metadata_parse_error,
            detailItems
        );

        return {
            ...row,
            emp_code: normalizeIdentityValue(row.emp_code) || "UNKNOWN_EMPLOYEE",
            nik: normalizeIdentityValue(row.nik) || null,
            emp_name: normalizeIdentityValue(row.emp_name) || null,
            gang_code: gangCode,
            estate: estateCode,
            estate_code: estateCode,
            division_code: deriveDivisionCodeFromGangCode(gangCode) || "UNKNOWN_DIVISION",
            ...metadataFields,
            detail_items: detailItems,
            ...adCodeFields
        };
    });
}

export function buildGroupedManualAdjustmentResponse(rows: ManualAdjustment[]): GroupedManualAdjustmentResponse {
    const divisionMap = new Map<string, Map<string, Map<string, GroupedManualAdjustmentEmployee>>>();

    for (const row of rows) {
        const estateCode = normalizeIdentityValue(row.division_code) || "UNKNOWN_ESTATE";
        const gangCode = normalizeIdentityValue(row.gang_code) || "UNKNOWN_GANG";
        const divisionCode = deriveDivisionCodeFromGangCode(gangCode) || "UNKNOWN_DIVISION";
        const empCode = normalizeIdentityValue(row.emp_code) || "UNKNOWN_EMPLOYEE";
        const nik = normalizeIdentityValue(row.nik) || null;
        const empName = normalizeIdentityValue(row.emp_name) || null;
        const employeeKey = `${empCode}|${nik || ""}|${empName || ""}`;

        if (!divisionMap.has(estateCode)) divisionMap.set(estateCode, new Map());
        const gangMap = divisionMap.get(estateCode)!;
        if (!gangMap.has(gangCode)) gangMap.set(gangCode, new Map());
        const employeeMap = gangMap.get(gangCode)!;

        if (!employeeMap.has(employeeKey)) {
            employeeMap.set(employeeKey, {
                emp_code: empCode,
                nik,
                emp_name: empName,
                gang_code: gangCode,
                estate: estateCode,
                estate_code: estateCode,
                division_code: divisionCode,
                adjustment_count: 0,
                premium_count: 0,
                total_amount: 0,
                premium_total: 0,
                adjustments: [],
                premiums: [],
                premium_transactions: []
            });
        }

        const employee = employeeMap.get(employeeKey)!;
        const parsedMetadata = parseManualAdjustmentMetadataValue(row.metadata_json);
        const adCodeFields = resolveManualAdjustmentResponseAdCodeFields(row);
        const detailItems = buildManualAdjustmentDetailItems(parsedMetadata.metadata, { row, adCodeFields });
        const metadataFields = buildManualAdjustmentResponseMetadataFields(
            row.metadata_json,
            parsedMetadata.metadata,
            parsedMetadata.metadata_parse_error,
            detailItems
        );
        const groupedItem: GroupedManualAdjustmentItem = {
            ...row,
            emp_code: empCode,
            nik,
            emp_name: empName,
            gang_code: gangCode,
            estate: estateCode,
            estate_code: estateCode,
            division_code: divisionCode,
            ...metadataFields,
            ...adCodeFields,
            detail_items: detailItems
        };
        const amount = toNumericAmount(row.amount);

        employee.adjustments.push(groupedItem);
        employee.adjustment_count += 1;
        employee.total_amount += amount;
        const employeeAdjustmentOrdinal = employee.adjustment_count;

        if (String(row.adjustment_type || "").toUpperCase() === "PREMI") {
            employee.premiums.push(groupedItem);
            employee.premium_count += 1;
            employee.premium_total += amount;
            const adjustmentId = typeof groupedItem.id === "number" ? groupedItem.id : null;
            const recordGroupKey = buildPremiumTransactionRecordGroupKey(adjustmentId, employeeKey, groupedItem, employeeAdjustmentOrdinal);
            const recordDetailCount = groupedItem.detail_items.length;
            groupedItem.detail_items.forEach((detailItem, detailIndex) => {
                employee.premium_transactions.push({
                    transaction_index: employee.premium_transactions.length + 1,
                    adjustment_id: adjustmentId,
                    adjustment_type: groupedItem.adjustment_type,
                    adjustment_name: groupedItem.adjustment_name,
                    emp_code: employee.emp_code,
                    nik: employee.nik,
                    emp_name: employee.emp_name,
                    gang_code: employee.gang_code,
                    estate: employee.estate,
                    estate_code: employee.estate_code,
                    division_code: employee.division_code,
                    ad_code: groupedItem.ad_code,
                    ad_code_desc: groupedItem.ad_code_desc,
                    ad_desc: groupedItem.ad_desc,
                    task_desc: groupedItem.task_desc,
                    // ponytail: propagate computed sync/match supaya agent filter mismatch via computed field.
                    sync_status: groupedItem.sync_status ?? null,
                    match_status: groupedItem.match_status ?? null,
                    is_stale: groupedItem.is_stale ?? null,
                    adtrans_amount: groupedItem.adtrans_amount ?? null,
                    diff: groupedItem.diff ?? null,
                    target_amount: groupedItem.target_amount ?? null,
                    has_adtrans: groupedItem.has_adtrans ?? null,
                    ...detailItem,
                    record_group_key: recordGroupKey,
                    record_action: detailIndex === 0 ? "NEW" : "ADD",
                    record_detail_index: detailIndex + 1,
                    record_detail_count: recordDetailCount
                });
            });
        }
    }

    const divisions: GroupedManualAdjustmentDivision[] = [];
    let gangCount = 0;
    let employeeCount = 0;

    for (const [estateCode, gangMap] of sortByText(Array.from(divisionMap.entries()), ([estate]) => estate)) {
        const gangs: GroupedManualAdjustmentGang[] = [];

        for (const [gangCode, employeeMap] of sortByText(Array.from(gangMap.entries()), ([gang]) => gang)) {
            const divisionCode = deriveDivisionCodeFromGangCode(gangCode) || "UNKNOWN_DIVISION";
            const employees = sortByText(Array.from(employeeMap.values()), (employee) => employee.emp_name || employee.emp_code)
                .map((employee) => ({
                    ...employee,
                    adjustments: sortByText(employee.adjustments, (item) => item.adjustment_name),
                    premiums: sortByText(employee.premiums, (item) => item.adjustment_name),
                    premium_transactions: [...employee.premium_transactions].sort((a, b) => a.transaction_index - b.transaction_index)
                }));

            const gang: GroupedManualAdjustmentGang = {
                gang_code: gangCode,
                estate: estateCode,
                estate_code: estateCode,
                division_code: divisionCode,
                employee_count: employees.length,
                adjustment_count: employees.reduce((sum, employee) => sum + employee.adjustment_count, 0),
                premium_count: employees.reduce((sum, employee) => sum + employee.premium_count, 0),
                total_amount: employees.reduce((sum, employee) => sum + employee.total_amount, 0),
                premium_total: employees.reduce((sum, employee) => sum + employee.premium_total, 0),
                employees
            };
            gangs.push(gang);
            gangCount += 1;
            employeeCount += employees.length;
        }

        divisions.push({
            estate: estateCode,
            estate_code: estateCode,
            employee_count: gangs.reduce((sum, gang) => sum + gang.employee_count, 0),
            gang_count: gangs.length,
            adjustment_count: gangs.reduce((sum, gang) => sum + gang.adjustment_count, 0),
            premium_count: gangs.reduce((sum, gang) => sum + gang.premium_count, 0),
            total_amount: gangs.reduce((sum, gang) => sum + gang.total_amount, 0),
            premium_total: gangs.reduce((sum, gang) => sum + gang.premium_total, 0),
            gangs
        });
    }

    return {
        summary: {
            division_count: divisions.length,
            gang_count: gangCount,
            employee_count: employeeCount,
            adjustment_count: rows.length
        },
        divisions
    };
}
