/**
 * @module backend/src/services/payroll/manualAdjustments/manualAdjustmentAdtrans.ts
 * @purpose Pure (no-DB) ADTRANS compare/check helpers: filter normalization, LocCode resolution,
 *             SQL pattern building, duplicate detection, and per-employee comparison row building.
 * @input ADTRANS rows (duplicate source rows, detail rows), check options, filters, division codes.
 * @output normalized filters, SQL patterns/conditions, duplicate report, comparison item rows.
 * @depends ../adtransDocDescMapping, ../../config/DivisionConfigService, ./manualAdjustmentNaming,
 *             ./manualAdjustmentHelpers, ../../manualAdjustmentService (types only)
 * @sideeffect None — pure transforms. No DB, no writes.
 * @tests backend/src/services/manualAdjustmentService.test.ts
 */
import type { ManualAdjustment } from "../../manualAdjustmentService";
import { normalizeManualAdjustmentDivisionCode } from "./manualAdjustmentNaming";
import {
    normalizeText,
    normalizeIdentityValue,
    normalizeStringList
} from "./manualAdjustmentHelpers";
import type {
    AdtransDocDescDetail,
    ManualAdjustmentSyncAdtransDetail
} from "./manualAdjustmentHelpers";
import {
    matchesAdtransDocDescFilter,
    buildAdtransDocDescSqlPatterns,
    buildAdtransDocDescSqlCondition,
    normalizeAdtransFilter
} from "../adtransDocDescMapping";
import { divisionConfigService } from "../../config/DivisionConfigService";

export interface AdtransDuplicateSourceRow {
    id: number;
    doc_id: string;
    doc_date: string;
    doc_desc: string;
    emp_code: string;
    emp_name: string;
    amount: number;
}

type AdtransDocDescDetailWithCategory = ManualAdjustmentSyncAdtransDetail & {
    category: string;
};

export interface AdtransCheckOptions {
    adjustmentTypes?: string[];
    adjustmentNames?: string[];
    docDescs?: string[];
}

export interface AdtransDocIdLookupInput extends AdtransCheckOptions {
    periodMonth: number;
    periodYear: number;
    empCodes?: string[];
    filters?: string[];
    divisionCode?: string;
    gangCode?: string;
}

type NormalizedAdtransCheckOptions = {
    adjustmentTypes: string[];
    adjustmentNames: string[];
    docDescs: string[];
    docDescFilters: string[];
};

export interface AdtransComparisonItem {
    emp_code: string;
    stored_emp_identifier?: string | null;
    category: string;
    adjustment_name: string;
    source_amount: number;
    stored_amount: number | null;
    db_ptrj_amount?: number;
    extend_db_ptrj_amount?: number | null;
    diff: number | null;
    status: 'MATCH' | 'MISMATCH' | 'MISSING';
    db_ptrj_doc_desc_details?: AdtransDocDescDetail[];
    extend_db_ptrj_remarks?: string | null;
    gang_code: string | null;
    remarks: string | null;
}

export interface ReverseAdtransComparisonItem {
    emp_code: string;
    stored_emp_identifier: string | null;
    category: string;
    adjustment_name: string;
    stored_amount: number;
    source_amount: number;
    db_ptrj_amount?: number;
    extend_db_ptrj_amount?: number;
    diff: number;
    status: 'MATCH' | 'MISMATCH' | 'EXTRA_IN_ADJUSTMENTS';
    db_ptrj_doc_desc_details?: AdtransDocDescDetail[];
    extend_db_ptrj_remarks?: string | null;
    gang_code: string | null;
    division_code: string | null;
    remarks: string | null;
}

export function matchesAdtransFilter(docDesc: string, filter: string): boolean {
    return matchesAdtransDocDescFilter(docDesc, filter);
}

export function normalizeAdtransDivisionLocCode(divisionCode: string): string {
    const normalized = divisionCode.trim().toUpperCase();
    const locCodeMap: Record<string, string> = {
        PG1A: 'P1A',
        PG1B: 'P1B',
        PG2A: 'P2A',
        PG2B: 'P2B',
        ARB1: 'AB1',
        ARB2: 'AB2',
        AREC: 'ARC',
        PLASMA1A: 'P1A',
        PLASMA1B: 'P1B',
        PLASMA2A: 'P2A',
        PLASMA2B: 'P2B',
        '1A': 'P1A',
        '1B': 'P1B',
        '2A': 'P2A',
        '2B': 'P2B'
    };

    return locCodeMap[normalized] || normalized;
}

/**
 * Resolve a division code (real or virtual) to the LocCode used in PR_ADTRANS.
 * Virtual divisions (e.g. NRS, INF, WKS_AR) have a sourceDivision (e.g. PG1B, PG1A, AB2)
 * that maps to the actual LocCode in db_ptrj.
 */
export function resolveAdtransLocCode(divisionCode: string): string {
    const resolved = divisionCode.trim().toUpperCase();
    const sourceDivision = divisionConfigService.getSourceDivision(resolved);
    if (sourceDivision) {
        return normalizeAdtransDivisionLocCode(sourceDivision);
    }
    return normalizeAdtransDivisionLocCode(resolved);
}

export function getManualAdjustmentDivisionCodeVariants(divisionCode: string): string[] {
    const normalized = normalizeManualAdjustmentDivisionCode(divisionCode) || normalizeText(divisionCode).toUpperCase();
    if (!normalized) return [];

    const codeGroups = [
        { match: ['1A', 'P1A', 'PG1A'], query: ['P1A', 'PG1A'] },
        { match: ['1B', 'P1B', 'PG1B'], query: ['P1B', 'PG1B'] },
        { match: ['2A', 'P2A', 'PG2A'], query: ['P2A', 'PG2A'] },
        { match: ['2B', 'P2B', 'PG2B'], query: ['P2B', 'PG2B'] },
        { match: ['AB1', 'ARB1'], query: ['AB1', 'ARB1'] },
        { match: ['AB2', 'ARB2'], query: ['AB2', 'ARB2'] },
        { match: ['ARC', 'AREC'], query: ['ARC', 'AREC'] }
    ];

    const matchedGroup = codeGroups.find((group) => group.match.includes(normalized));
    return matchedGroup ? [...matchedGroup.query] : [normalized];
}

export function buildAdtransSqlPatterns(filter: string): string[] {
    return buildAdtransDocDescSqlPatterns(filter);
}

export function buildAdtransSqlPattern(filter: string): string {
    return buildAdtransSqlPatterns(filter)[0];
}

export function buildAdtransSqlCondition(columnName: string, filter: string): string {
    return buildAdtransDocDescSqlCondition(columnName, filter);
}

export const DEFAULT_ADTRANS_COMPARE_FILTERS = ['spsi', 'masa kerja', 'jabatan', 'pph', 'premi', 'koreksi', 'potongan'];

export function normalizeAdtransDuplicateDocDesc(value: unknown): string {
    return normalizeText(value).toUpperCase().replace(/\s+/g, " ");
}

export function normalizeAdtransDuplicateAmount(value: unknown): string {
    const amount = Number(value || 0);
    return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}

export function hasAdtransDuplicateAmount(value: unknown): boolean {
    const amount = Number(value || 0);
    return Number.isFinite(amount) && Math.abs(amount) > 0.01;
}

export function normalizeAdtransCheckOptions(options?: AdtransCheckOptions): NormalizedAdtransCheckOptions {
    const adjustmentTypes = normalizeStringList(options?.adjustmentTypes).map((value) => value.toUpperCase());
    const adjustmentNames = normalizeStringList(options?.adjustmentNames);
    const docDescs = normalizeStringList(options?.docDescs);
    const docDescFilters = Array.from(new Set([...adjustmentNames, ...docDescs].map(normalizeAdtransDuplicateDocDesc).filter(Boolean)));

    return {
        adjustmentTypes,
        adjustmentNames,
        docDescs,
        docDescFilters
    };
}

export function mapAdjustmentTypeToAdtransFilters(adjustmentType: string): string[] {
    const normalized = normalizeText(adjustmentType).toUpperCase();
    const aliases: Record<string, string[]> = {
        PREMI: ["premi"],
        KOREKSI: ["koreksi"],
        POTONGAN_KOTOR: ["koreksi"],
        POTONGAN_UPAH_KOTOR: ["koreksi"],
        POTONGAN_BERSIH: ["potongan"],
        POTONGAN_UPAH_BERSIH: ["potongan"],
        SPSI: ["spsi"],
        AUTO_SPSI: ["spsi"],
        JABATAN: ["jabatan"],
        AUTO_JABATAN: ["jabatan"],
        AUTO_TUNJANGAN_JABATAN: ["jabatan"],
        MASA_KERJA: ["masa kerja"],
        AUTO_MASA_KERJA: ["masa kerja"]
    };

    return aliases[normalized] || (normalized ? [normalizeAdtransFilter(normalized)] : []);
}

export function inferAdtransFiltersFromDocDescFilters(docDescFilters: string[]): string[] {
    const filters: string[] = [];

    for (const docDesc of docDescFilters) {
        if (/^PREMI(\s|$)/.test(docDesc)) filters.push("premi");
        else if (docDesc.includes("KOREKSI")) filters.push("koreksi");
        else if (/^POT(\s|ONGAN|\b)/.test(docDesc)) filters.push("potongan");
        else if (docDesc.includes("SPSI")) filters.push("spsi");
        else if (docDesc.includes("JABATAN")) filters.push("jabatan");
        else if (docDesc.includes("MASA") && docDesc.includes("KERJA")) filters.push("masa kerja");
    }

    return Array.from(new Set(filters));
}

export function resolveAdtransCheckFilters(filters: string[] = [], options?: NormalizedAdtransCheckOptions): string[] {
    const fromFilters = normalizeStringList(filters).map(normalizeAdtransFilter).filter(Boolean);
    const fromTypes = (options?.adjustmentTypes || []).flatMap(mapAdjustmentTypeToAdtransFilters).map(normalizeAdtransFilter).filter(Boolean);
    const fromDocDesc = inferAdtransFiltersFromDocDescFilters(options?.docDescFilters || []);
    const resolved = fromFilters.length ? fromFilters : [...fromTypes, ...fromDocDesc];

    return Array.from(new Set(resolved));
}

export function buildSpecificDocDescSqlPatterns(options: NormalizedAdtransCheckOptions): string[] {
    return options.docDescFilters.map((value) => `%${value}%`);
}

export function matchesSpecificAdtransDocDesc(docDesc: string, options?: NormalizedAdtransCheckOptions): boolean {
    const filters = options?.docDescFilters || [];
    if (filters.length === 0) return true;

    const normalizedDocDesc = normalizeAdtransDuplicateDocDesc(docDesc);
    return filters.some((filter) => normalizedDocDesc.includes(filter));
}

export function matchesAdtransDuplicateFilter(docDesc: string, filter: string): boolean {
    const category = normalizeAdtransFilter(filter);
    const normalizedDocDesc = normalizeAdtransDuplicateDocDesc(docDesc);

    if (category === "premi") {
        return /^PREMI(\s|$)/.test(normalizedDocDesc);
    }

    return matchesAdtransFilter(docDesc, filter);
}

export function buildAdtransDocDescDetails(
    rows: AdtransDuplicateSourceRow[],
    filters: string[],
    options?: NormalizedAdtransCheckOptions
): AdtransDocDescDetailWithCategory[] {
    const details: AdtransDocDescDetailWithCategory[] = [];

    for (const row of rows) {
        for (const filter of filters) {
            if (!matchesAdtransFilter(row.doc_desc || '', filter)) continue;
            if (!matchesSpecificAdtransDocDesc(row.doc_desc || '', options)) continue;

            details.push({
                emp_code: normalizeIdentityValue(row.emp_code),
                category: normalizeAdtransFilter(filter),
                doc_desc: normalizeText(row.doc_desc),
                doc_id: row.doc_id ? normalizeText(row.doc_id) : null,
                amount: Number(row.amount || 0)
            });
        }
    }

    return details;
}

export function buildAdtransDuplicateReport(
    rows: AdtransDuplicateSourceRow[],
    filters: string[],
    options?: AdtransCheckOptions
) {
    const groups = new Map<string, AdtransDuplicateSourceRow[]>();
    const normalizedOptions = normalizeAdtransCheckOptions(options);
    const normalizedFilters = resolveAdtransCheckFilters(filters, normalizedOptions);

    for (const row of rows) {
        if (!hasAdtransDuplicateAmount(row.amount)) continue;

        for (const filter of normalizedFilters) {
            if (!matchesAdtransDuplicateFilter(row.doc_desc || '', filter)) continue;
            if (!matchesSpecificAdtransDocDesc(row.doc_desc || '', normalizedOptions)) continue;

            const category = normalizeAdtransFilter(filter);
            // ponytail: duplicate key = emp_code + category + DocDesc (TANPA amount).
            //  Sebelumnya amount ikut key -> 2 record same emp+DocDesc beda amount -> gak kedeteksi duplikat.
            //  User mau: same DocDesc + same emp = duplikat regardless amount. Keep newest (highest id), delete rest.
            //  Upgrade: kalau perlu toleransi amount (e.g. rounding 1Rp), tambah banding amount di action decision.
            const key = [
                normalizeIdentityValue(row.emp_code),
                category,
                normalizeAdtransDuplicateDocDesc(row.doc_desc)
            ].join('|');
            const groupRows = groups.get(key) || [];
            groupRows.push(row);
            groups.set(key, groupRows);
        }
    }

    const duplicates = Array.from(groups.entries())
        .map(([key, groupRows]) => {
            const [empCode, category] = key.split('|');
            const sortedRows = [...groupRows].sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
            const keepRecord = sortedRows[sortedRows.length - 1];
            const deleteRecords = sortedRows.slice(0, -1);

            return {
                emp_code: empCode,
                emp_name: keepRecord?.emp_name || sortedRows[0]?.emp_name || '',
                category,
                doc_desc: keepRecord?.doc_desc || sortedRows[0]?.doc_desc || '',
                amount: Number(keepRecord?.amount || sortedRows[0]?.amount || 0),
                record_count: sortedRows.length,
                keep_id: keepRecord.id,
                keep_doc_id: keepRecord.doc_id,
                delete_ids: deleteRecords.map((record) => record.id),
                delete_doc_ids: deleteRecords.map((record) => record.doc_id),
                records: sortedRows.map((record) => ({
                    id: record.id,
                    doc_id: record.doc_id,
                    doc_date: record.doc_date,
                    doc_desc: record.doc_desc,
                    amount: Number(record.amount || 0),
                    action: record.id === keepRecord.id ? 'KEEP_NEWEST' : 'DELETE_OLD'
                }))
            };
        })
        .filter((duplicate) => duplicate.record_count > 1);

    return {
        duplicate_count: duplicates.length,
        duplicates
    };
}

export type { ManualAdjustment };
