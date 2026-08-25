/**
 * @module backend/src/services/payroll/extract/extractHelpers.ts
 * @purpose Pure helpers for payroll extraction: value-priority mode, manual-adjustment identity/index, join-date overlay, metadata/compare routing.
 * @input PayrollValuePriorityMode strings, ManualAdjustment rows, JoinDateOverlayRow arrays, Record<string,number> premi/potongan sources.
 * @output Normalized modes/policies, filtered rows, identity indexes, comparison maps, SQL strings, dynamic header registrations.
 * @depends ../manualAdjustments/manualAdjustmentNaming#toManualAdjustmentFieldName, ../payrollAutoBufferService#resolveSyncFrameColor, ../adtransDocDescMapping#normalizeKnownAdtransPremiField, ../../config/DivisionConfigService, ../../../utils/payrollGangScope
 * @sideeffect Mutates input Set/Map/array where noted; no external I/O
 * @tests backend/src/services/dataExtractorService.manualAdjustmentMetadata.test.ts, backend/src/services/dataExtractorService.divisionExclusions.test.ts, backend/src/services/dataExtractorService.joinDateOverlay.test.ts
 */

import { divisionConfigService } from "../../config/DivisionConfigService";
import { resolvePayrollDivisionCodeForScope } from "../../../utils/payrollGangScope";
import { toManualAdjustmentFieldName } from "../manualAdjustments/manualAdjustmentNaming";
import { resolveSyncFrameColor } from "../payrollAutoBufferService";
import { normalizeKnownAdtransPremiField } from "../adtransDocDescMapping";
import type { ManualAdjustmentFieldSyncMeta } from "../manualAdjustments/manualAdjustmentApplier";

export type PayrollValuePriorityMode = "db_ptrj_only" | "non_db_ptrj";

export function normalizePayrollValuePriorityMode(value?: string | null): PayrollValuePriorityMode {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "db_ptrj_only") return "db_ptrj_only";
    return "non_db_ptrj";
}

export interface ManualAdjustmentSourcePolicy {
    applyAmounts: boolean;
    fetchRowsForMetadata: boolean;
    manualBufferOnly: boolean;
}

export function resolveManualAdjustmentSourcePolicy(value?: string | null): ManualAdjustmentSourcePolicy {
    const valuePriorityMode = normalizePayrollValuePriorityMode(value);
    const useNonDbPtrjSources = valuePriorityMode === "non_db_ptrj";
    return {
        applyAmounts: valuePriorityMode !== "db_ptrj_only",
        fetchRowsForMetadata: true,
        manualBufferOnly: useNonDbPtrjSources
    };
}

export function filterRowsExcludedFromDivision<T extends { gang_code?: any }>(
    rows: T[],
    divisionCode?: string | null
): T[] {
    const resolvedDivisionCode = resolvePayrollDivisionCodeForScope(divisionCode);
    if (!resolvedDivisionCode) return rows;

    return rows.filter((row) =>
        !divisionConfigService.isGangExcludedFromDivision(resolvedDivisionCode, row.gang_code || "")
    );
}

export function shouldKeepPayrollRowAfterEffectiveHkFilter(input: {
    jumlahHk?: unknown;
    cutiMingguHari?: unknown;
    cutiNasionalHari?: unknown;
    hasManualAdjustments?: boolean;
}): boolean {
    const effectiveHk = (Number(input.jumlahHk) || 0)
        - ((Number(input.cutiMingguHari) || 0) + (Number(input.cutiNasionalHari) || 0));
    return effectiveHk > 0 || input.hasManualAdjustments === true;
}

export function resolveManualAdjustmentFetchGangCode(gangCode?: string | null, divisionCode?: string | null): string | undefined {
    const normalizedDivision = String(divisionCode || "").trim();
    if (!normalizedDivision) {
        const normalizedGang = String(gangCode || "").trim().toUpperCase();
        return normalizedGang && normalizedGang !== "ALL" ? normalizedGang : undefined;
    }

    // Manual rows can keep an old gang_code after an employee is moved.
    // Fetch by period/division, then match against the current employee list by emp_code/nik.
    return undefined;
}

export function pickStaticPotonganForManualBuffer(source: Record<string, number>): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [key, rawValue] of Object.entries(source || {})) {
        const keyUpper = String(key).toUpperCase();
        if (keyUpper === "SPSI" || keyUpper === "PPH21" || keyUpper === "PREMI_PPH") {
            result[key] = Number(rawValue) || 0;
        }
    }
    return result;
}

function parseManualAdjustmentMetadata(value: any): any | null {
    if (!value) return null;
    try {
        return typeof value === 'string' ? JSON.parse(value) : value;
    } catch {
        return null;
    }
}

function normalizeManualAdjustmentIdentityKey(value: any): string {
    return String(value || '').trim().toUpperCase();
}

function manualAdjustmentIdentityKeys(source: any): string[] {
    const keys = [
        source?.emp_code,
        source?.nik,
        source?.new_nik,
        source?.actual_nik
    ].map(normalizeManualAdjustmentIdentityKey).filter(Boolean);
    return Array.from(new Set(keys));
}

export type ManualAdjustmentIdentityIndex = Map<string, any[]>;

export function buildManualAdjustmentIdentityIndex(adjustments: any[] = []): ManualAdjustmentIdentityIndex {
    const index: ManualAdjustmentIdentityIndex = new Map();
    for (const adjustment of adjustments || []) {
        for (const key of manualAdjustmentIdentityKeys(adjustment)) {
            const current = index.get(key) || [];
            current.push(adjustment);
            index.set(key, current);
        }
    }
    return index;
}

export function getManualAdjustmentsForEmployee(index: ManualAdjustmentIdentityIndex, employee: any): any[] {
    const result: any[] = [];
    const seen = new Set<any>();
    for (const key of manualAdjustmentIdentityKeys(employee)) {
        for (const adjustment of index.get(key) || []) {
            const dedupeKey = adjustment?.id ?? adjustment;
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            result.push(adjustment);
        }
    }
    return result;
}

export type JoinDateOverlayRow = {
    emp_code?: unknown;
    join_date?: unknown;
};

function addJoinDateRows(target: Map<string, string>, rows: JoinDateOverlayRow[] = []): void {
    for (const row of rows || []) {
        const empCode = normalizeManualAdjustmentIdentityKey(row.emp_code);
        const joinDate = row.join_date;
        if (!empCode || !joinDate || target.has(empCode)) continue;
        target.set(empCode, String(joinDate));
    }
}

export function applyJoinDateSourcesToEmployees(
    employees: Array<{ emp_code?: unknown; join_date?: any }>,
    sources: {
        profileOverrideRows?: JoinDateOverlayRow[];
        valueOverrideRows?: JoinDateOverlayRow[];
        historyRows?: JoinDateOverlayRow[];
    }
): void {
    const joinDateMap = new Map<string, string>();
    addJoinDateRows(joinDateMap, sources.profileOverrideRows);
    addJoinDateRows(joinDateMap, sources.valueOverrideRows);
    addJoinDateRows(joinDateMap, sources.historyRows);

    for (const emp of employees || []) {
        const empCode = normalizeManualAdjustmentIdentityKey(emp.emp_code);
        const joinDate = joinDateMap.get(empCode);
        if (joinDate) {
            emp.join_date = joinDate;
        }
    }
}

export function buildLatestProfileJoinDateQuery(empCodeList: string): string {
    return `
        SELECT emp_code, join_date
        FROM (
            SELECT
                RTRIM(emp_code) as emp_code,
                effective_start_date as join_date,
                ROW_NUMBER() OVER (
                    PARTITION BY RTRIM(emp_code)
                    ORDER BY update_index DESC, id DESC
                ) as rn
            FROM dbo.employee_profile_override_history
            WHERE RTRIM(emp_code) IN (${empCodeList})
              AND effective_start_date IS NOT NULL
              AND is_active_record = 1
        ) latest
        WHERE rn = 1
    `;
}

export function buildLatestValueJoinDateQuery(empCodeList: string): string {
    return `
        SELECT emp_code, join_date
        FROM (
            SELECT
                RTRIM(emp_code) as emp_code,
                text_value as join_date,
                ROW_NUMBER() OVER (
                    PARTITION BY RTRIM(emp_code)
                    ORDER BY update_index DESC, id DESC
                ) as rn
            FROM dbo.payroll_value_override_history
            WHERE RTRIM(emp_code) IN (${empCodeList})
              AND field_name = 'join_date'
              AND text_value IS NOT NULL
              AND is_active_record = 1
        ) latest
        WHERE rn = 1
    `;
}

export function buildLatestHistoryJoinDateQuery(empCodeList: string): string {
    return `
        SELECT emp_code, join_date
        FROM (
            SELECT
                RTRIM(emp_code) as emp_code,
                join_date,
                ROW_NUMBER() OVER (
                    PARTITION BY RTRIM(emp_code)
                    ORDER BY id DESC
                ) as rn
            FROM dbo.history_hr_employee
            WHERE RTRIM(emp_code) IN (${empCodeList})
              AND join_date IS NOT NULL
        ) latest
        WHERE rn = 1
          AND join_date IS NOT NULL
    `;
}

export function pickStaticPremiForManualBuffer(source: Record<string, number>): Record<string, number> {
    const brondol = Number(
        source?.brondol
        ?? source?.premi_brondol
        ?? source?.premi_brondol_total
        ?? 0
    ) || 0;

    return brondol !== 0 ? { brondol } : {};
}

type ManualAdjustmentMetadataType = 'PREMI' | 'POTONGAN_KOTOR' | 'POTONGAN_BERSIH';
const DETAIL_TOTAL_MISMATCH_PREMI_NAMES = new Set(['PREMI PRUNING', 'PREMI RAKING']);
type PayrollValueSourceCompareMap = Record<string, { db_ptrj: number | string | boolean | null; active: number | string | boolean | null }>;
type ManualAdjustmentComparisonRow = {
    adjustment_type?: unknown;
    adjustment_name?: unknown;
    amount?: unknown;
    metadata_json?: unknown;
};

function resolveManualAdjustmentMetadataType(value: any): ManualAdjustmentMetadataType | null {
    const normalized = String(value || '').trim().toUpperCase();
    if (normalized === 'PREMI' || normalized === 'POTONGAN_KOTOR' || normalized === 'POTONGAN_BERSIH') {
        return normalized as ManualAdjustmentMetadataType;
    }
    return null;
}

export function attachManualAdjustmentMetadata(
    target: { manual_adjustment_metadata?: Record<string, any>; manual_adjustment_metadata_mismatch?: Record<string, { amount: number; detail_total: number; diff: number; reason?: string }> },
    adjustments: any[]
): void {
    for (const adjustment of adjustments || []) {
        const adjustmentType = resolveManualAdjustmentMetadataType(adjustment.adjustment_type);
        if (!adjustmentType) continue;
        const metadata = parseManualAdjustmentMetadata(adjustment.metadata_json);
        if (!metadata) continue;

        const fieldName = toManualAdjustmentFieldName(adjustmentType, String(adjustment.adjustment_name || ''));
        const amount = Number(adjustment.amount || 0);
        const detailTotal = Number(metadata.total_amount ?? amount) || 0;
        const enrichedMetadata = {
            ...metadata,
            adjustment_type: adjustmentType,
            adjustment_name: adjustment.adjustment_name,
            amount,
            detail_total: detailTotal,
            detail_matches_amount: Math.abs(amount - detailTotal) <= 0.01
        };

        target.manual_adjustment_metadata ||= {};
        target.manual_adjustment_metadata[fieldName] = enrichedMetadata;

        const shouldExposeMismatch = adjustmentType === 'PREMI'
            && DETAIL_TOTAL_MISMATCH_PREMI_NAMES.has(String(adjustment.adjustment_name || '').trim().toUpperCase())
            && Math.abs(amount) > 0.01
            && !enrichedMetadata.detail_matches_amount;

        if (shouldExposeMismatch) {
            target.manual_adjustment_metadata_mismatch ||= {};
            target.manual_adjustment_metadata_mismatch[fieldName] = {
                amount,
                detail_total: detailTotal,
                diff: detailTotal - amount,
                reason: 'Total detail terbaru berbeda dari amount lama. Untuk PREMI PRUNING/RAKING, total detail terbaru dipakai saat simpan.'
            };
        }
    }
}

function normalizeManualCompareFieldIdentity(value: unknown): string {
    return String(value || '')
        .toLowerCase()
        .replace(/berondol/g, 'brondol')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function stripManualCompareFieldPrefix(value: string): string {
    return value
        .replace(/^potongan_lainnya_/, '')
        .replace(/^potongan_/, '')
        .replace(/^koreksi_/, '')
        .replace(/^premi_/, '');
}

function manualCompareFieldMatches(sourceKey: string, targetFieldName: string, adjustmentType: string): boolean {
    const source = normalizeManualCompareFieldIdentity(sourceKey);
    const target = normalizeManualCompareFieldIdentity(targetFieldName);
    if (!source || !target) return false;
    if (source === target) return true;

    if (adjustmentType === 'PREMI') {
        const sourceKnownField = normalizeKnownAdtransPremiField(source);
        const targetKnownField = normalizeKnownAdtransPremiField(target);
        if (sourceKnownField && targetKnownField && sourceKnownField === targetKnownField) {
            return true;
        }
    }

    const typePrefix = adjustmentType === 'PREMI'
        ? 'premi_'
        : adjustmentType === 'POTONGAN_KOTOR'
            ? 'koreksi_'
            : 'potongan_lainnya_';
    if (normalizeManualCompareFieldIdentity(`${typePrefix}${source}`) === target) return true;

    return stripManualCompareFieldPrefix(source) === stripManualCompareFieldPrefix(target);
}

function toManualCompareAmount(value: unknown, adjustmentType: string): number {
    const amount = Number(value) || 0;
    return adjustmentType === 'POTONGAN_KOTOR' || adjustmentType === 'POTONGAN_BERSIH'
        ? Math.abs(amount)
        : amount;
}

function resolveManualAdjustmentCompareAmount(adjustment: ManualAdjustmentComparisonRow): number {
    const metadata = parseManualAdjustmentMetadata(adjustment.metadata_json);
    return Number(metadata?.total_amount ?? adjustment.amount) || 0;
}

function buildManualAdjustmentSourceSyncMetas(adjustments: ManualAdjustmentComparisonRow[] = []): ManualAdjustmentFieldSyncMeta[] {
    const aggregated = new Map<string, ManualAdjustmentFieldSyncMeta>();

    for (const adjustment of adjustments || []) {
        const adjustmentType = resolveManualAdjustmentMetadataType(adjustment.adjustment_type);
        if (!adjustmentType) continue;

        const adjustmentName = String(adjustment.adjustment_name || '');
        const fieldName = toManualAdjustmentFieldName(adjustmentType, adjustmentName);
        const amount = toManualCompareAmount(resolveManualAdjustmentCompareAmount(adjustment), adjustmentType);
        const aggregateKey = `${adjustmentType}:${normalizeManualCompareFieldIdentity(fieldName)}`;
        const current = aggregated.get(aggregateKey);

        if (!current) {
            aggregated.set(aggregateKey, {
                fieldName,
                adjustmentType,
                adjustmentName,
                previousAmount: 0,
                finalAmount: amount,
                hadDbValue: false
            });
            continue;
        }

        current.finalAmount += amount;
        if (adjustmentName) {
            current.adjustmentName = adjustmentName;
        }
    }

    return Array.from(aggregated.values());
}

export function resolveManualAdjustmentDbPtrjCompareAmount(
    syncMeta: Pick<ManualAdjustmentFieldSyncMeta, 'fieldName' | 'adjustmentType' | 'previousAmount'> & Partial<Pick<ManualAdjustmentFieldSyncMeta, 'hadDbValue'>>,
    dbPremiSource: Record<string, number> = {},
    dbPotonganSource: Record<string, number> = {}
): number | null {
    const source = syncMeta.adjustmentType === 'PREMI' ? dbPremiSource : dbPotonganSource;
    let matchedAmount = 0;
    let matched = false;
    for (const [key, value] of Object.entries(source || {})) {
        if (manualCompareFieldMatches(key, syncMeta.fieldName, syncMeta.adjustmentType)) {
            matchedAmount += toManualCompareAmount(value, syncMeta.adjustmentType);
            matched = true;
        }
    }

    if (matched) return matchedAmount;
    if (syncMeta.hadDbValue !== false) {
        return toManualCompareAmount(syncMeta.previousAmount, syncMeta.adjustmentType);
    }

    return null;
}

export function attachManualAdjustmentValueSourceComparison(
    valueSyncFrame: Record<string, "red" | "green">,
    valueSourceCompare: PayrollValueSourceCompareMap,
    syncMeta: ManualAdjustmentFieldSyncMeta,
    dbPtrjAmount?: number | null
): void {
    const resolvedDbPtrjAmount = dbPtrjAmount === undefined
        ? syncMeta.hadDbValue === false
            ? 0
            : toManualCompareAmount(syncMeta.previousAmount, syncMeta.adjustmentType)
        : dbPtrjAmount;

    if (resolvedDbPtrjAmount === null) return;

    const syncColor = resolveSyncFrameColor(syncMeta.finalAmount, resolvedDbPtrjAmount as number);
    const compare = {
        db_ptrj: resolvedDbPtrjAmount,
        active: syncMeta.finalAmount
    };

    valueSyncFrame[syncMeta.fieldName] = syncColor;
    valueSourceCompare[syncMeta.fieldName] = compare;

    if (syncMeta.adjustmentType === 'PREMI' && !syncMeta.fieldName.startsWith('premi_')) {
        const alias = `premi_${syncMeta.fieldName}`;
        valueSyncFrame[alias] = syncColor;
        valueSourceCompare[alias] = compare;
    }

    if (syncMeta.adjustmentType !== 'PREMI') {
        const keyUpper = syncMeta.fieldName.toUpperCase();
        if (!keyUpper.startsWith('KOREKSI') && !syncMeta.fieldName.startsWith('potongan_')) {
            const alias = `potongan_${syncMeta.fieldName}`;
            valueSyncFrame[alias] = syncColor;
            valueSourceCompare[alias] = compare;
        }
    }
}

export function attachManualAdjustmentSourceComparisons(
    valueSyncFrame: Record<string, "red" | "green">,
    valueSourceCompare: PayrollValueSourceCompareMap,
    adjustments: ManualAdjustmentComparisonRow[] = [],
    dbPremiSource: Record<string, number> = {},
    dbPotonganSource: Record<string, number> = {}
): ManualAdjustmentFieldSyncMeta[] {
    const syncMetas = buildManualAdjustmentSourceSyncMetas(adjustments);

    for (const syncMeta of syncMetas) {
        attachManualAdjustmentValueSourceComparison(
            valueSyncFrame,
            valueSourceCompare,
            syncMeta,
            resolveManualAdjustmentDbPtrjCompareAmount(syncMeta, dbPremiSource, dbPotonganSource)
        );
    }

    return syncMetas;
}

export function registerManualAdjustmentMetadataDynamicHeaders(
    adjustments: any[],
    dynamicPremiSet: Set<string>,
    dynamicPotonganSet: Set<string>,
    premiTitleMap: Record<string, string>,
    potonganTitleMap: Record<string, string>
): void {
    for (const adjustment of adjustments || []) {
        const adjustmentType = resolveManualAdjustmentMetadataType(adjustment.adjustment_type);
        if (!adjustmentType) continue;

        const adjustmentName = String(adjustment.adjustment_name || '').trim();
        const fieldName = toManualAdjustmentFieldName(adjustmentType, adjustmentName);
        if (!fieldName) continue;

        if (adjustmentType === 'PREMI') {
            dynamicPremiSet.add(fieldName);
            if (adjustmentName && !premiTitleMap[fieldName]) {
                premiTitleMap[fieldName] = adjustmentName;
            }
            continue;
        }

        // ponytail: skip BPJS/SPSI/PPH dynamic — nilainya sudah masuk static pot_bpjs_*/pot_spsi/pot_pph21/pot_koreksi.
        // Kalau di-add sbg dynamic column, export SUM double-count (static + dynamic).
        const fnu = fieldName.toUpperCase();
        if (fnu.includes("BPJS") || fnu === "SPSI" || fnu === "PPH21" || fnu === "POTONGAN_PPH" || fnu === "POT_PPH" || fnu.startsWith("POTONGAN_PPH")) continue;
        dynamicPotonganSet.add(fieldName);
        if (adjustmentName && !potonganTitleMap[fieldName]) {
            potonganTitleMap[fieldName] = adjustmentName;
        }
    }
}
