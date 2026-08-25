/**
 * @module backend/src/services/manualAdjustmentService.ts
 * @purpose Facade for manual-adjustment CRUD, identity, sync compute, ADTRANS compare.
 * @input ManualAdjustment payloads, period/gang/division filters, ADTRANS options.
 * @output ManualAdjustment rows, grouped API rows, sync/match status, compare reports.
 * @depends ./payroll/manualAdjustments/manualAdjustmentQueries, ./payroll/manualAdjustments/manualAdjustmentSync,
 *            ./payroll/manualAdjustments/manualAdjustmentHelpers, Config.DB_EXTEND_*, Database.getInstance
 * @sideeffect Reads/writes payroll_manual_adjustments (extend_db_ptrj); reads PR_ADTRANS (db_ptrj).
 * @tests backend/src/services/manualAdjustmentService.test.ts
 */

import { Database } from "../db/client";
import { employeeIdentityResolverService } from "./employeeIdentityResolverService";
import { Config } from "../config";
import { divisionConfigService } from "./config/DivisionConfigService";
import { taskCodeOptionService } from "./taskCodeOptionService";
import { premiumDefinitionService } from "./premiumDefinitionService";
import { EmployeeEstateService } from "./employeeEstateService";
import {
    normalizeManualAdjustmentDivisionCode,
    normalizeStoredAdjustmentName,
    shouldDeleteStoredAdjustment
} from "./payroll/manualAdjustments/manualAdjustmentNaming";
import {
    containsPphDeductionText,
    resolvePotonganBersihHutangTaskCode
} from "./payroll/manualAdjustments/potonganBersihTaskCode";
import { normalizeAutoBufferAdjustmentName } from "./payroll/manualAdjustments/autoBufferAdcodeMap";
import {
    updatePipeDelimitedSyncAndMatchStatus,
    updatePipeDelimitedSyncStatus
} from "../utils/manualAdjustmentRemarkParser";
import {
    buildAdtransDocDescSqlCondition,
    buildAdtransDocDescSqlPatterns,
    matchesAdtransDocDescFilter,
    normalizeAdtransFilter,
    normalizeAdtransPotonganField,
    mapAdtransPremiField
} from "./payroll/adtransDocDescMapping";
import {
    buildNormalizedSqlNameExpression,
    deleteAdjustmentById,
    deleteAdjustmentColumnRows,
    deleteOtherIncomeById,
    insertAdjustment,
    insertAutoBufferAdjustment,
    insertOtherIncome,
    selectAdjustmentById,
    selectAdjustmentColumnIds,
    selectAdjustmentNameOptions,
    selectAdjustments,
    selectComparisonAdjustments,
    selectConversionCollision,
    selectConversionSourceRows,
    selectEstateJabatanByEmpCode,
    selectExistingAdjustmentId,
    selectOtherIncomeByEmpCode,
    selectOtherIncomeByNik,
    selectReverseComparisonAdjustments,
    selectSyncStatusCandidates,
    updateAdjustment,
    updateAdjustmentRemarks,
    updateAutoBufferAdjustmentAmount,
    updateConvertedAdjustment,
    updateOtherIncome
} from "./payroll/manualAdjustments/manualAdjustmentQueries";
import {
    fetchAdtransSyncDetails,
    selectAdtransCompareDetails,
    selectAdtransCompareTotals,
    selectAdtransDirectlyDuplicates,
    selectAdtransDirectlyTotals,
    selectEmployeeIdentityByNameAndGang,
    selectGangMemberEmpCodes,
    selectGangScopedEmployeeIdentity,
    selectHistoryEmployeeIdentity
} from "./payroll/manualAdjustments/manualAdjustmentSync";
import {
    buildManualAdjustmentApiResponseRows,
    buildGroupedManualAdjustmentResponse,
    buildManualAdjustmentDetailItems,
    buildManualAdjustmentRemarks,
    buildManualAdjustmentResponseMetadataFields,
    computeManualAdjustmentSyncStatuses,
    deriveDivisionCodeFromGangCode,
    isNumericNik,
    KOREKSI_DEFAULT_AD_CODE,
    KOREKSI_DEFAULT_TASK_DESC,
    normalizeIdentityValue,
    normalizeManualAdjustmentForSave,
    normalizeManualAdjustmentPresetCode,
    normalizeManualAdjustmentSyncTypes,
    normalizeStringList,
    normalizeSyncStatus,
    normalizeText,
    parseManualAdjustmentMetadataValue,
    remapMetadata,
    resolveDetailTotalSync,
    resolveManualAdjustmentAdCode,
    resolveManualAdjustmentDefinitionAdCodeFields,
    resolveManualAdjustmentPresetCode,
    resolveManualAdjustmentResponseAdCodeFields,
    resolveManualAdjustmentSyncTargetAmount,
    seedPlaceholderMetadata,
    serializeManualAdjustmentMetadata,
    sortByText,
    sumAdtransDetails,
    toComparableCompareAmount,
    toNumericAmount,
    validateManualAdjustmentAdCode,
    validatePremiumAdjustmentDefinition,
    buildPremiumTransactionRecordGroupKey,
    normalizeSearchWords,
    scoreTaskCodeOption,
    expectedTaskDescPrefix,
    shouldUseHutangTaskCodeForPotonganBersih,
    mergeStoredAdjustmentComparison,
    adtransDetailMatchesManualAdjustment
} from "./payroll/manualAdjustments/manualAdjustmentHelpers";
import type {
    AdtransDocDescDetail,
    ManualAdjustmentSyncAdtransDetail,
    StoredAdjustmentComparison
} from "./payroll/manualAdjustments/manualAdjustmentHelpers";

export type { AdtransDocDescDetail, ManualAdjustmentSyncAdtransDetail, StoredAdjustmentComparison } from "./payroll/manualAdjustments/manualAdjustmentHelpers";
export { buildManualAdjustmentRemarks, computeManualAdjustmentSyncStatuses, manualAdjustmentRequiresAdCode, buildManualAdjustmentApiResponseRows, buildGroupedManualAdjustmentResponse } from "./payroll/manualAdjustments/manualAdjustmentHelpers";
export type {
    AdtransCheckOptions,
    AdtransDocIdLookupInput,
    AdtransComparisonItem,
    ReverseAdtransComparisonItem,
    AdtransDuplicateSourceRow
} from "./payroll/manualAdjustments/manualAdjustmentAdtrans";
export {
    buildAdtransDuplicateReport,
    DEFAULT_ADTRANS_COMPARE_FILTERS,
    getManualAdjustmentDivisionCodeVariants,
    normalizeAdtransCheckOptions,
    resolveAdtransCheckFilters,
    resolveAdtransLocCode,
    buildAdtransSqlCondition,
    buildAdtransSqlPattern,
    buildAdtransSqlPatterns,
    buildAdtransDocDescDetails,
    buildSpecificDocDescSqlPatterns,
    matchesAdtransFilter,
    matchesAdtransDuplicateFilter,
    matchesSpecificAdtransDocDesc,
    mapAdjustmentTypeToAdtransFilters,
    inferAdtransFiltersFromDocDescFilters,
    normalizeAdtransDivisionLocCode,
    normalizeAdtransDuplicateAmount,
    normalizeAdtransDuplicateDocDesc,
    hasAdtransDuplicateAmount
} from "./payroll/manualAdjustments/manualAdjustmentAdtrans";
import {
    buildAdtransDuplicateReport,
    DEFAULT_ADTRANS_COMPARE_FILTERS,
    getManualAdjustmentDivisionCodeVariants,
    normalizeAdtransCheckOptions,
    resolveAdtransCheckFilters,
    resolveAdtransLocCode,
    buildAdtransSqlCondition,
    buildAdtransSqlPattern,
    buildAdtransSqlPatterns,
    buildAdtransDocDescDetails,
    buildSpecificDocDescSqlPatterns,
    matchesAdtransFilter,
    matchesAdtransDuplicateFilter,
    matchesSpecificAdtransDocDesc,
    mapAdjustmentTypeToAdtransFilters,
    inferAdtransFiltersFromDocDescFilters,
    normalizeAdtransDivisionLocCode,
    normalizeAdtransDuplicateAmount,
    normalizeAdtransDuplicateDocDesc,
    hasAdtransDuplicateAmount
} from "./payroll/manualAdjustments/manualAdjustmentAdtrans";
import type {
    AdtransCheckOptions,
    AdtransDocIdLookupInput,
    AdtransComparisonItem,
    ReverseAdtransComparisonItem,
    AdtransDuplicateSourceRow
} from "./payroll/manualAdjustments/manualAdjustmentAdtrans";
import {
    checkAdtransDirectly,
    listAdtransDocIds,
    compareAdtransWithAdjustments,
    reverseCompareAdtransWithAdjustments,
    syncAdtransToAdjustments
} from "./payroll/manualAdjustments/manualAdjustmentAdtransCompare";

export {
    checkAdtransDirectly,
    listAdtransDocIds,
    compareAdtransWithAdjustments,
    reverseCompareAdtransWithAdjustments,
    syncAdtransToAdjustments
} from "./payroll/manualAdjustments/manualAdjustmentAdtransCompare";

export async function resolveManualAdjustmentPresetMapping(data: ManualAdjustment, adjustmentName: string): Promise<Partial<ManualAdjustment>> {
    const adjustmentType = normalizeText(data.adjustment_type).toUpperCase();
    if (adjustmentType === "POTONGAN_KOTOR") {
        return {
            ad_code: KOREKSI_DEFAULT_AD_CODE,
            task_code: KOREKSI_DEFAULT_AD_CODE,
            base_task_code: KOREKSI_DEFAULT_AD_CODE,
            task_desc: KOREKSI_DEFAULT_TASK_DESC
        };
    }

    if (shouldUseHutangTaskCodeForPotonganBersih(data, adjustmentName)) {
        return resolvePotonganBersihHutangTaskCode(data.division_code);
    }

    if (resolveManualAdjustmentPresetCode(data)) return {};

    const prefix = expectedTaskDescPrefix(data.adjustment_type);
    if (!prefix) return {};

    const searchWords = normalizeSearchWords(`${adjustmentName} ${data.remarks || ""}`);
    let options = await taskCodeOptionService.searchOptions({
        search: searchWords[0] || undefined,
        divisionCode: data.division_code,
        limit: 100
    });
    let matchingOptions = options.filter((option) => normalizeText(option.task_desc).toUpperCase().startsWith(prefix));
    if (!matchingOptions.length) {
        options = await taskCodeOptionService.searchOptions({
            divisionCode: data.division_code,
            limit: 100
        });
        matchingOptions = options.filter((option) => normalizeText(option.task_desc).toUpperCase().startsWith(prefix));
    }
    const candidates = matchingOptions.length ? matchingOptions : options;
    const sorted = [...candidates].sort((a, b) => scoreTaskCodeOption(b, searchWords) - scoreTaskCodeOption(a, searchWords));
    const selected = sorted[0];
    if (!selected?.ad_code) return {};

    return {
        ad_code: selected.ad_code,
        task_code: selected.task_code,
        base_task_code: selected.base_task_code || selected.ad_code,
        task_desc: selected.task_desc
    };
}

export interface ManualAdjustment {
    id?: number;
    period_month: number;
    period_year: number;
    nik?: string;       // Real NIK (KTP) - primary identifier
    emp_code: string;   // Emp code (B0065, etc.) - for lookup
    emp_name?: string;
    jabatan?: string;
    jabatan_estate?: string;
    gang_code: string;
    division_code?: string;
    adjustment_type: 'PREMI' | 'POTONGAN_KOTOR' | 'POTONGAN_BERSIH' | 'PENDAPATAN_LAINNYA' | 'AUTO_BUFFER';
    adjustment_name: string;
    amount: number;
    remarks?: string | null;
    metadata_json?: string | null;  // JSON string containing detail items (blok/exp/kendaraan)
    ad_code?: string;
    task_code?: string;
    base_task_code?: string;
    task_desc?: string;
    force_insert?: boolean;
    created_at?: Date;
    created_by?: string;
    updated_at?: Date;
    updated_by?: string;
}

type ResolvedManualAdjustmentIdentity = {
    empCode: string;
    nik: string | null;
    empName: string | null;
    originalIdentifier: string;
};

export type ManualAdjustmentDetailItem = Record<string, unknown> & {
    detail_type: string;
    amount: number;
};

export type GroupedManualAdjustmentItem = Omit<ManualAdjustment, "nik" | "emp_name" | "division_code" | "metadata_json"> & {
    nik: string | null;
    emp_name: string | null;
    estate: string;
    estate_code: string;
    division_code: string;
    metadata_json: string | null;
    metadata_json_raw?: string | null;
    ad_code: string;
    ad_code_desc: string;
    ad_desc: string;
    task_desc: string;
    metadata: unknown | null;
    metadata_parse_error: string | null;
    detail_items: ManualAdjustmentDetailItem[];
    // ponytail: computed ADTRANS sync fields propagated from verification pass
    // (set conditionally by callers; absent when verification did not run).
    sync_status?: string | null;
    match_status?: string | null;
    is_stale?: boolean | null;
    adtrans_amount?: number | null;
    diff?: number | null;
    target_amount?: number | null;
    has_adtrans?: boolean | null;
};

export type GroupedManualAdjustmentPremiumTransaction = ManualAdjustmentDetailItem & {
    transaction_index: number;
    adjustment_id: number | null;
    record_group_key: string;
    record_action: "NEW" | "ADD";
    record_detail_index: number;
    record_detail_count: number;
    adjustment_type: string;
    adjustment_name: string;
    emp_code: string;
    nik: string | null;
    emp_name: string | null;
    gang_code: string;
    estate: string;
    estate_code: string;
    division_code: string;
    ad_code: string;
    ad_code_desc: string;
    ad_desc: string;
    task_desc: string;
    // ponytail: computed real-time sync/match dari GET recompute_sync=true, propagated ke grouped premium_transactions
    //  supaya agent filter mismatch via computed field (bukan remarks baked stale).
    sync_status?: string | null;
    match_status?: string | null;
    is_stale?: boolean | null;
    adtrans_amount?: number | null;
    diff?: number | null;
    target_amount?: number | null;
    has_adtrans?: boolean | null;
};

export type GroupedManualAdjustmentEmployee = {
    emp_code: string;
    nik: string | null;
    emp_name: string | null;
    gang_code: string;
    estate: string;
    estate_code: string;
    division_code: string;
    adjustment_count: number;
    premium_count: number;
    total_amount: number;
    premium_total: number;
    adjustments: GroupedManualAdjustmentItem[];
    premiums: GroupedManualAdjustmentItem[];
    premium_transactions: GroupedManualAdjustmentPremiumTransaction[];
};

export type GroupedManualAdjustmentGang = {
    gang_code: string;
    estate: string;
    estate_code: string;
    division_code: string;
    employee_count: number;
    adjustment_count: number;
    premium_count: number;
    total_amount: number;
    premium_total: number;
    employees: GroupedManualAdjustmentEmployee[];
};

export type GroupedManualAdjustmentDivision = {
    estate: string;
    estate_code: string;
    employee_count: number;
    gang_count: number;
    adjustment_count: number;
    premium_count: number;
    total_amount: number;
    premium_total: number;
    gangs: GroupedManualAdjustmentGang[];
};

export type GroupedManualAdjustmentResponse = {
    summary: {
        division_count: number;
        gang_count: number;
        employee_count: number;
        adjustment_count: number;
    };
    divisions: GroupedManualAdjustmentDivision[];
};

export type ManualAdjustmentApiResponseRow = Omit<ManualAdjustment, "nik" | "emp_name" | "division_code" | "ad_code" | "metadata_json"> & {
    nik: string | null;
    emp_name: string | null;
    gang_code: string;
    estate: string;
    estate_code: string;
    division_code: string;
    metadata_json: string | null;
    metadata_json_raw?: string | null;
    metadata: unknown | null;
    metadata_parse_error: string | null;
    detail_items: ManualAdjustmentDetailItem[];
    ad_code: string;
    ad_code_desc: string;
    ad_desc: string;
    task_desc: string;
    // recompute real-time vs ADTRANS (optional, saat GET recompute_sync=true)
    sync_status?: string | null;
    match_status?: string | null;
    target_amount?: number | null;
    adtrans_amount?: number | null;
    diff?: number | null;
    is_stale?: boolean | null;
    has_adtrans?: boolean | null;
    baked_sync?: string | null;
    baked_match?: string | null;
};

export type ManualAdjustmentNameOption = {
    adjustment_type: string;
    adjustment_name: string;
};

export type ManualAdjustmentSyncStatusUpdateInput = {
    periodMonth: number;
    periodYear: number;
    divisionCode?: string;
    gangCode?: string;
    empCode?: string;
    adjustmentTypes?: string[];
    adjustmentName?: string;
    ids?: number[];
    syncStatus?: string;
    updatedBy?: string;
    onlyIfAdtransExists?: boolean;
    dryRun?: boolean;
    limit?: number;
};

export type ManualAdjustmentSyncStatusRowResult = {
    id: number;
    emp_code: string;
    nik: string | null;
    emp_name: string | null;
    gang_code: string;
    estate: string;
    adjustment_type: string;
    adjustment_name: string;
    amount: number;
    target_amount: number;
    metadata_detail_total: number | null;
    adtrans_amount: number | null;
    ad_code: string;
    ad_code_desc: string;
    ad_desc: string;
    task_desc: string;
    old_sync_status: string | null;
    new_sync_status: string | null;
    match_status: string | null;
    diff: number | null;
    status: "UPDATED" | "UNCHANGED" | "SKIPPED";
    skip_reason: string | null;
    remarks_before: string | null;
    remarks_after: string | null;
    adtrans_details: AdtransDocDescDetail[];
};

export type ManualAdjustmentSyncStatusUpdateResult = {
    period_month: number;
    period_year: number;
    target_sync_status: string;
    only_if_adtrans_exists: boolean;
    dry_run: boolean;
    matched_count: number;
    eligible_count: number;
    adtrans_matched_count: number;
    updated_count: number;
    unchanged_count: number;
    skipped_count: number;
    partial_count: number;
    rows: ManualAdjustmentSyncStatusRowResult[];
};

async function resolveManualAdjustmentIdentityByContext(data: ManualAdjustment): Promise<{ emp_code: string; nik: string; emp_name: string } | null> {
    const empName = normalizeText(data.emp_name).toUpperCase();
    const gangCode = normalizeText(data.gang_code).toUpperCase();
    if (!empName || !gangCode) return null;

    const row = await selectEmployeeIdentityByNameAndGang(Database.getInstance(), { empName, gangCode });
    if (!row) return null;
    return {
        nik: normalizeIdentityValue(row.nik),
        emp_code: normalizeIdentityValue(row.emp_code),
        emp_name: normalizeIdentityValue(row.emp_name)
    };
}

async function resolveManualAdjustmentIdentityByHistory(data: ManualAdjustment): Promise<{ emp_code: string; nik: string; emp_name: string } | null> {
    const inputEmpCode = normalizeIdentityValue(data.emp_code);
    const inputNik = normalizeIdentityValue(data.nik);
    const empName = normalizeText(data.emp_name).toUpperCase();
    const gangCode = normalizeText(data.gang_code).toUpperCase();
    if (!inputEmpCode && !inputNik && (!empName || !gangCode)) return null;

    const db = Database.getInstance(Config.DB_EXTEND_DATABASE, Config.DB_EXTEND_PROFILE);
    const row = await selectHistoryEmployeeIdentity(db, {
        fallbackNik: isNumericNik(inputEmpCode) ? inputEmpCode : inputNik,
        periodMonth: data.period_month,
        periodYear: data.period_year,
        inputEmpCode,
        inputNik,
        empName,
        gangCode
    });
    if (!row) return null;
    return {
        nik: normalizeIdentityValue(row.nik),
        emp_code: normalizeIdentityValue(row.emp_code),
        emp_name: normalizeIdentityValue(row.emp_name)
    };
}

async function resolveManualAdjustmentIdentity(data: ManualAdjustment): Promise<ResolvedManualAdjustmentIdentity> {
    const inputEmpCode = normalizeIdentityValue(data.emp_code);
    const inputNik = normalizeIdentityValue(data.nik);
    const lookupIdentifier = inputEmpCode && !isNumericNik(inputEmpCode)
        ? inputEmpCode
        : inputNik || inputEmpCode;
    const fallbackIdentifier = inputNik && inputNik !== lookupIdentifier ? inputNik : inputEmpCode;
    const needsHistoryLookup = isNumericNik(inputEmpCode) || isNumericNik(inputNik);
    const identity = await employeeIdentityResolverService.resolve(lookupIdentifier)
        || (fallbackIdentifier && fallbackIdentifier !== lookupIdentifier
            ? await employeeIdentityResolverService.resolve(fallbackIdentifier)
            : null)
        || await resolveManualAdjustmentIdentityByContext(data)
        || (needsHistoryLookup ? await resolveManualAdjustmentIdentityByHistory(data) : null);

    const resolvedEmpCode = normalizeIdentityValue(identity?.emp_code)
        || (!isNumericNik(inputEmpCode) ? inputEmpCode : "");
    const resolvedNik = normalizeIdentityValue(identity?.nik)
        || (isNumericNik(inputNik) ? inputNik : isNumericNik(inputEmpCode) ? inputEmpCode : "");

    if (!resolvedEmpCode) {
        throw new Error(`NIK/EmpCode "${inputNik || inputEmpCode}" tidak bisa diresolve ke EmpCode PTRJ. Simpan dibatalkan agar payroll_manual_adjustments tetap konsisten.`);
    }

    return {
        empCode: resolvedEmpCode,
        nik: resolvedNik || null,
        empName: normalizeIdentityValue(data.emp_name || identity?.emp_name) || null,
        originalIdentifier: inputEmpCode || inputNik
    };
}

async function resolveManualAdjustmentLookupIdentity(identifier: string): Promise<{ empCode: string | null; nik: string | null; originalIdentifier: string }> {
    const normalized = normalizeIdentityValue(identifier);
    if (!normalized) return { empCode: null, nik: null, originalIdentifier: "" };

    const identity = await employeeIdentityResolverService.resolve(normalized);
    return {
        empCode: normalizeIdentityValue(identity?.emp_code) || (!isNumericNik(normalized) ? normalized : null),
        nik: normalizeIdentityValue(identity?.nik) || (isNumericNik(normalized) ? normalized : null),
        originalIdentifier: normalized
    };
}

async function enrichManualAdjustmentRowsWithJabatan(rows: ManualAdjustment[]): Promise<ManualAdjustment[]> {
    const empCodes = Array.from(new Set(rows
        .map((row) => normalizeIdentityValue(row.emp_code))
        .filter(Boolean)));
    if (empCodes.length === 0) return rows;

    try {
        const jobTitles = await EmployeeEstateService.getEmployeeJobsWithNik(empCodes);
        return rows.map((row) => {
            const existingJabatan = normalizeText(row.jabatan || row.jabatan_estate);
            const empCode = normalizeIdentityValue(row.emp_code);
            const nik = normalizeIdentityValue(row.nik);
            const resolvedJabatan = existingJabatan
                || normalizeText(jobTitles.empcodeMap[empCode])
                || normalizeText(jobTitles.nikMap[nik]);

            return resolvedJabatan ? { ...row, jabatan: resolvedJabatan } : row;
        });
    } catch (error) {
        console.warn("[ManualAdjustmentService] Could not enrich manual adjustments with jabatan:", error);
        return rows;
    }
}

export class ManualAdjustmentService {
    private static instance: ManualAdjustmentService;
    private static identitySchemaEnsured = false;

    private constructor() { }

    public static getInstance(): ManualAdjustmentService {
        if (!ManualAdjustmentService.instance) {
            ManualAdjustmentService.instance = new ManualAdjustmentService();
        }
        return ManualAdjustmentService.instance;
    }

    /**
     * Rule cutoff manual input: jika tanggal hari ini > 3, semua input manual dari mode edit diblok.
     * Berlaku untuk semua periode (bulan lalu pun diblok). Hanya block tanggal, bukan jam.
     * `now` di-inject untuk test; default hari ini.
     */
    public getManualEditAllowed(now: Date = new Date()): boolean {
        return now.getDate() <= 3;
    }

    public getManualEditBlockReason(now: Date = new Date()): string {
        return `Input manual diblokir: tanggal ${now.getDate()} > 3. Edit manual hanya bisa dilakukan tanggal 1-3 setiap bulan.`;
    }

    private getDatabase(): Database {
        return Database.getInstance(Config.DB_EXTEND_DATABASE, Config.DB_EXTEND_PROFILE);
    }

    public async ensureManualAdjustmentIdentitySchema(db: Database): Promise<void> {
        if (ManualAdjustmentService.identitySchemaEnsured) return;

        await db.query(`
            IF COL_LENGTH('dbo.payroll_manual_adjustments', 'nik') IS NULL
            BEGIN
                ALTER TABLE dbo.payroll_manual_adjustments ADD nik VARCHAR(50) NULL;
            END;

            IF COL_LENGTH('dbo.payroll_manual_adjustments', 'emp_name') IS NULL
            BEGIN
                ALTER TABLE dbo.payroll_manual_adjustments ADD emp_name VARCHAR(150) NULL;
            END;

            IF COL_LENGTH('dbo.payroll_manual_adjustments', 'metadata_json') IS NULL
            BEGIN
                ALTER TABLE dbo.payroll_manual_adjustments ADD metadata_json NVARCHAR(MAX) NULL;
            END;

            IF NOT EXISTS (
                SELECT 1 FROM sys.indexes
                WHERE name = 'IX_payroll_manual_adjustments_nik'
                  AND object_id = OBJECT_ID('dbo.payroll_manual_adjustments')
            )
            BEGIN
                CREATE INDEX IX_payroll_manual_adjustments_nik
                    ON dbo.payroll_manual_adjustments (nik, period_year, period_month);
            END;
        `);

        ManualAdjustmentService.identitySchemaEnsured = true;
    }

    /**
     * Get all manual adjustments for a specific period and gang
     */
    public async getAdjustments(
        month: number,
        year: number,
        gangCode?: string,
        empCode?: string,
        divisionCode?: string,
        adjustmentType?: string,
        adjustmentName?: string,
        metadataOnly: boolean = false
    ): Promise<ManualAdjustment[]> {
        const db = this.getDatabase();
        await this.ensureManualAdjustmentIdentitySchema(db);

        let empLookup: { empCode: string | null; nik: string | null; originalIdentifier: string } | undefined;
        if (empCode) {
            empLookup = await resolveManualAdjustmentLookupIdentity(empCode);
        }

        let adjustmentTypes: string[] | undefined;
        if (adjustmentType) {
            const MANUAL_ALIAS_TYPES = ['PREMI', 'POTONGAN_KOTOR', 'POTONGAN_BERSIH', 'PENDAPATAN_LAINNYA'];
            const rawTypes = adjustmentType.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
            adjustmentTypes = rawTypes.flatMap(t =>
                t === 'MANUAL' ? MANUAL_ALIAS_TYPES : [t]
            );
        }

        const rows = await selectAdjustments(db, {
            month,
            year,
            divisionCodes: divisionCode ? getManualAdjustmentDivisionCodeVariants(divisionCode) : undefined,
            gangCode,
            empLookup,
            adjustmentTypes,
            adjustmentName,
            metadataOnly
        });
        return await enrichManualAdjustmentRowsWithJabatan(rows);
    }

    /**
     * GET manual adjustments dengan real-time sync/match recompute vs ADTRANS.
     * Mengembalikan ManualAdjustmentApiResponseRow (sudah enriched metadata + ad_code)
     * + computed sync_status/match_status/adtrans_amount/diff/is_stale.
     * remarks baked tetap dipertahankan untuk audit; computed field = source of truth real-time.
     */
    public async getAdjustmentsWithSyncRecompute(
        month: number,
        year: number,
        gangCode?: string,
        empCode?: string,
        divisionCode?: string,
        adjustmentType?: string,
        adjustmentName?: string,
        metadataOnly: boolean = false
    ): Promise<ManualAdjustmentApiResponseRow[]> {
        const rows = await this.getAdjustments(month, year, gangCode, empCode, divisionCode, adjustmentType, adjustmentName, metadataOnly);
        const apiRows = buildManualAdjustmentApiResponseRows(rows);

        if (rows.length === 0) return apiRows;

        // ponytail: batch 1 ADTRANS query untuk semua rows. onlyIfAdtransExists semantics:
        //  rows tanpa ADTRANS match -> MISS/MISMATCH (muncul sbg mismatch, sesuai req user).
        const adtransDetails = await this.fetchManualAdjustmentSyncAdtransDetails(month, year, divisionCode, rows);
        const computedMap = computeManualAdjustmentSyncStatuses(rows, adtransDetails);

        return apiRows.map((row) => {
            const id = Number(row.id);
            const computed = computedMap.get(id);
            if (!computed) return row;
            return {
                ...row,
                sync_status: computed.sync_status,
                match_status: computed.match_status,
                target_amount: computed.target_amount,
                adtrans_amount: computed.adtrans_amount,
                diff: computed.diff,
                is_stale: computed.is_stale,
                has_adtrans: computed.has_adtrans,
                baked_sync: computed.baked_sync,
                baked_match: computed.baked_match
            };
        });
    }

    /**
     * Write-back real-time sync/match remarks untuk 1 row (dipanggil saveAdjustment).
     * Best-effort: gagal silent, jangan fail save. Bangun pipe-delimited remarks bila
     * remarks existing bukan format pipe (legacy "AD CODE:" tanpa sync:/match: segment).
     */
    private async writeBackSyncStatusForId(id: number, user?: string): Promise<void> {
        try {
            if (!id) return;
            const db = this.getDatabase();
            await this.ensureManualAdjustmentIdentitySchema(db);
            const row = await selectAdjustmentById(db, id);
            if (!row) return;

            const adtransDetails = await this.fetchManualAdjustmentSyncAdtransDetails(
                Number(row.period_month), Number(row.period_year), row.division_code || undefined, [row]
            );
            const computedMap = computeManualAdjustmentSyncStatuses([row], adtransDetails);
            const computed = computedMap.get(Number(row.id));
            if (!computed) return;

            // remarks_fresh null bila remarks bukan pipe-delimited -> build pipe format fresh.
            // ponytail: format baku = "name | ad_code | amount | sync:STATUS | match:STATUS".
            let freshRemarks = computed.remarks_fresh;
            if (!freshRemarks) {
                const adCodeFields = resolveManualAdjustmentResponseAdCodeFields(row);
                const adCodePart = adCodeFields.ad_code || adCodeFields.task_desc || '';
                freshRemarks = `${normalizeStoredAdjustmentName(row.adjustment_name)} | ${adCodePart} | ${computed.target_amount} | sync:${computed.sync_status} | match:${computed.match_status}`;
            }

            // cek apakah remarks berubah
            const currentRemarks = String(row.remarks || '').trim();
            if (currentRemarks === String(freshRemarks).trim()) return;

            await updateAdjustmentRemarks(db, {
                id,
                remarks: freshRemarks,
                user: user || 'sync_writeback'
            });
        } catch (e) {
            console.warn('[writeBackSyncStatusForId] best-effort write-back failed:', e);
        }
    }

    public async listAdjustmentNameOptions(input: {
        periodMonth?: number;
        periodYear?: number;
        divisionCode?: string;
        gangCode?: string;
        adjustmentTypes?: string[];
        search?: string;
        metadataOnly?: boolean;
        limit?: number;
    }): Promise<ManualAdjustmentNameOption[]> {
        const db = this.getDatabase();
        await this.ensureManualAdjustmentIdentitySchema(db);

        const allowedTypes = new Set(["PREMI", "POTONGAN_KOTOR", "POTONGAN_BERSIH"]);
        const adjustmentTypes = (input.adjustmentTypes || Array.from(allowedTypes))
            .map((type) => normalizeText(type).toUpperCase())
            .filter((type) => allowedTypes.has(type));
        const resolvedTypes = adjustmentTypes.length ? Array.from(new Set(adjustmentTypes)) : Array.from(allowedTypes);
        const limit = Math.min(Math.max(Number(input.limit) || 200, 1), 500);

        return (await selectAdjustmentNameOptions(db, {
            resolvedTypes,
            periodMonth: input.periodMonth,
            periodYear: input.periodYear,
            divisionCodes: input.divisionCode ? getManualAdjustmentDivisionCodeVariants(input.divisionCode) : undefined,
            gangCode: input.gangCode ? normalizeIdentityValue(input.gangCode) : undefined,
            search: input.search ? `%${normalizeText(input.search).toUpperCase()}%` : undefined,
            metadataOnly: input.metadataOnly,
            limit
        }))
            .map((row) => ({
                adjustment_type: normalizeText(row.adjustment_type).toUpperCase(),
                adjustment_name: normalizeStoredAdjustmentName(row.adjustment_name)
            }))
            .filter((row) => row.adjustment_type && row.adjustment_name);
    }

    private async fetchManualAdjustmentSyncAdtransDetails(
        periodMonth: number,
        periodYear: number,
        divisionCode: string | undefined,
        rows: ManualAdjustment[]
    ): Promise<ManualAdjustmentSyncAdtransDetail[]> {
        const empCodes = Array.from(new Set(rows
            .map((row) => normalizeIdentityValue(row.emp_code))
            .filter(Boolean)));
        const locCodes = Array.from(new Set((divisionCode
            ? [resolveAdtransLocCode(divisionCode)]
            : rows.map((row) => resolveAdtransLocCode(normalizeText(row.division_code))))
            .filter(Boolean)));

        if (empCodes.length === 0 || locCodes.length === 0) return [];

        const rowsFromAdtrans = await fetchAdtransSyncDetails(Database.getInstance(), {
            periodMonth,
            periodYear,
            locCodes,
            empCodes
        });

        return rowsFromAdtrans.map((row) => ({
            emp_code: normalizeIdentityValue(row.emp_code),
            doc_id: row.doc_id ? normalizeText(row.doc_id) : null,
            doc_desc: normalizeText(row.doc_desc),
            amount: toNumericAmount(row.amount)
        }));
    }

    public async updateManualAdjustmentSyncStatus(input: ManualAdjustmentSyncStatusUpdateInput): Promise<ManualAdjustmentSyncStatusUpdateResult> {
        const periodMonth = Number(input.periodMonth);
        const periodYear = Number(input.periodYear);
        if (!Number.isInteger(periodMonth) || periodMonth < 1 || periodMonth > 12) {
            throw new Error("periodMonth harus 1-12");
        }
        if (!Number.isInteger(periodYear) || periodYear < 2000) {
            throw new Error("periodYear tidak valid");
        }

        const targetSyncStatus = normalizeSyncStatus(input.syncStatus || "SYNC");
        if (!targetSyncStatus) throw new Error("syncStatus wajib diisi");

        const db = this.getDatabase();
        await this.ensureManualAdjustmentIdentitySchema(db);
        const adjustmentTypes = normalizeManualAdjustmentSyncTypes(input.adjustmentTypes);
        const ids = Array.from(new Set((input.ids || [])
            .map((id) => Number(id))
            .filter((id) => Number.isInteger(id) && id > 0)));
        const limit = Math.min(Math.max(Number(input.limit) || 1000, 1), 5000);
        const empLookup = input.empCode
            ? await resolveManualAdjustmentLookupIdentity(input.empCode)
            : undefined;
        const rows = (await selectSyncStatusCandidates(db, {
            periodMonth,
            periodYear,
            adjustmentTypes,
            limit,
            divisionCodes: input.divisionCode ? getManualAdjustmentDivisionCodeVariants(input.divisionCode) : undefined,
            gangCode: input.gangCode ? normalizeIdentityValue(input.gangCode) : undefined,
            empLookup,
            adjustmentName: input.adjustmentName
                ? `%${normalizeText(input.adjustmentName).toUpperCase()}%`
                : undefined,
            ids
        })).filter((row) => {
            const type = normalizeText(row.adjustment_type).toUpperCase();
            return adjustmentTypes.includes(type);
        });
        const adtransDetails = input.onlyIfAdtransExists
            ? await this.fetchManualAdjustmentSyncAdtransDetails(periodMonth, periodYear, input.divisionCode, rows)
            : [];
        // ponytail: recompute real-time via pure fn; branch onlyIfAdtransExists=false tetap force targetSyncStatus.
        const computedMap = input.onlyIfAdtransExists
            ? computeManualAdjustmentSyncStatuses(rows, adtransDetails)
            : null;

        let eligibleCount = 0;
        let adtransMatchedCount = 0;
        let updatedCount = 0;
        let unchangedCount = 0;
        let skippedCount = 0;
        let partialCount = 0;
        const resultRows: ManualAdjustmentSyncStatusRowResult[] = [];

        for (const row of rows) {
            const id = Number(row.id);
            const empCode = normalizeIdentityValue(row.emp_code);
            const estateCode = normalizeIdentityValue(row.division_code);
            const amountInfo = resolveManualAdjustmentSyncTargetAmount(row);
            const adCodeFields = resolveManualAdjustmentResponseAdCodeFields(row);
            const initialUpdate = input.onlyIfAdtransExists
                ? null
                : updatePipeDelimitedSyncStatus(row.remarks, targetSyncStatus);
            const baseResult: ManualAdjustmentSyncStatusRowResult = {
                id,
                emp_code: empCode,
                nik: normalizeIdentityValue(row.nik) || null,
                emp_name: normalizeIdentityValue(row.emp_name) || null,
                gang_code: normalizeIdentityValue(row.gang_code),
                estate: estateCode,
                adjustment_type: normalizeText(row.adjustment_type).toUpperCase(),
                adjustment_name: normalizeStoredAdjustmentName(row.adjustment_name),
                amount: toNumericAmount(row.amount),
                target_amount: amountInfo.targetAmount,
                metadata_detail_total: amountInfo.metadataDetailTotal,
                adtrans_amount: null,
                ad_code: adCodeFields.ad_code,
                ad_code_desc: adCodeFields.ad_code_desc,
                ad_desc: adCodeFields.ad_desc,
                task_desc: adCodeFields.task_desc,
                old_sync_status: initialUpdate?.oldSyncStatus || null,
                new_sync_status: initialUpdate?.newSyncStatus || null,
                match_status: null,
                diff: null,
                status: "SKIPPED",
                skip_reason: null,
                remarks_before: row.remarks || null,
                remarks_after: null,
                adtrans_details: []
            };

            if (!id) {
                skippedCount++;
                resultRows.push({
                    ...baseResult,
                    skip_reason: "SYNC_SEGMENT_NOT_FOUND"
                });
                continue;
            }

            eligibleCount++;
            let update = initialUpdate;

            if (input.onlyIfAdtransExists) {
                const computed = computedMap?.get(id);
                // re-call parser untuk dapat old/new + changed + null-detection (remarks tanpa sync: segment)
                const reconciliationUpdate = computed
                    ? updatePipeDelimitedSyncAndMatchStatus(row.remarks, computed.sync_status, computed.match_status)
                    : null;
                update = reconciliationUpdate;
                baseResult.old_sync_status = reconciliationUpdate?.oldSyncStatus || null;
                baseResult.new_sync_status = reconciliationUpdate?.newSyncStatus || null;
                baseResult.match_status = reconciliationUpdate?.newMatchStatus || null;
                baseResult.adtrans_amount = computed?.adtrans_amount ?? null;
                baseResult.diff = computed?.diff ?? null;
                baseResult.adtrans_details = computed?.adtrans_details ?? [];

                if (!update) {
                    skippedCount++;
                    resultRows.push({
                        ...baseResult,
                        skip_reason: "SYNC_SEGMENT_NOT_FOUND"
                    });
                    continue;
                }

                if (computed?.has_adtrans) {
                    adtransMatchedCount++;
                }
            }

            if (!update) {
                skippedCount++;
                resultRows.push({
                    ...baseResult,
                    skip_reason: "SYNC_SEGMENT_NOT_FOUND"
                });
                continue;
            }

            if (!update.changed) {
                unchangedCount++;
                resultRows.push({
                    ...baseResult,
                    status: "UNCHANGED",
                    remarks_after: update.remarks
                });
                continue;
            }

            if (!input.dryRun) {
                await updateAdjustmentRemarks(db, {
                    id,
                    remarks: update.remarks,
                    user: input.updatedBy || "sync_status_api"
                });
            }

            updatedCount++;
            resultRows.push({
                ...baseResult,
                status: "UPDATED",
                remarks_after: update.remarks
            });
        }

        return {
            period_month: periodMonth,
            period_year: periodYear,
            target_sync_status: targetSyncStatus,
            only_if_adtrans_exists: !!input.onlyIfAdtransExists,
            dry_run: !!input.dryRun,
            matched_count: rows.length,
            eligible_count: eligibleCount,
            adtrans_matched_count: adtransMatchedCount,
            updated_count: updatedCount,
            unchanged_count: unchangedCount,
            skipped_count: skippedCount,
            partial_count: partialCount,
            rows: resultRows
        };
    }

    /**
     * Save PENDAPATAN_LAINNYA (e.g. KONTAN) to employee_other_incomes table.
     * Uses upsert logic: update if exists (same nik/emp_code + period + income_name), insert if not.
     *
     * STORAGE STRATEGY:
     * - nik: Real NIK (KTP) - primary stable identifier for data extractor lookup
     * - emp_code: Employee code (B0065, etc.) - for emp_code-based lookup fallback
     * - Both fields stored so data extractor can find by either
     *
     * The frontend sends both `nik` (real NIK) and `emp_code` (B0065, etc.)
     * to ensure the data extractor can find the record.
     */
    private async saveOtherIncome(db: Database, data: ManualAdjustment, parsedAmount: number, user?: string): Promise<number> {
        const incomeType = data.adjustment_name; // e.g. 'KONTAN'
        const incomeName = normalizeStoredAdjustmentName(data.adjustment_name); // e.g. 'KONTAN'
        const normalizedDivisionCode = normalizeManualAdjustmentDivisionCode(data.division_code);
        // Use real NIK for nik field, emp_code for emp_code field
        const realNik = (data.nik || '').trim().toUpperCase() || (data.emp_code || '').trim().toUpperCase();
        const empCodeVal = (data.emp_code || '').trim().toUpperCase();

        console.log(`[saveOtherIncome] Saving: nik=${realNik}, emp_code=${empCodeVal}, income=${incomeName}, amount=${parsedAmount}`);

        // Check for existing record: try by nik, then by emp_code
        let existing = await selectOtherIncomeByNik(db, {
            realNik, empCode: empCodeVal, periodMonth: data.period_month, periodYear: data.period_year, incomeName
        });

        // Fallback: check by emp_code if not found by nik
        if (!existing) {
            existing = await selectOtherIncomeByEmpCode(db, {
                realNik, empCode: empCodeVal, periodMonth: data.period_month, periodYear: data.period_year, incomeName
            });
        }

        if (existing) {
            if (parsedAmount === 0) {
                await deleteOtherIncomeById(db, existing.id);
                console.log(`[saveOtherIncome] Deleted ${incomeName} for nik=${realNik}, emp_code=${empCodeVal}`);
                return existing.id;
            }
            // Update existing: store BOTH nik and emp_code for consistent lookups
            await updateOtherIncome(db, {
                realNik, empCode: empCodeVal, periodMonth: data.period_month, periodYear: data.period_year,
                incomeType, incomeName, normalizedDivisionCode, gangCode: data.gang_code, amount: parsedAmount,
                existingId: existing.id
            });
            console.log(`[saveOtherIncome] Updated ${incomeName}: nik=${realNik}, emp_code=${empCodeVal}: Rp${parsedAmount}`);
            return existing.id;
        } else {
            if (parsedAmount === 0) return 0; // Don't insert zero

            const id = await insertOtherIncome(db, {
                realNik, empCode: empCodeVal, periodMonth: data.period_month, periodYear: data.period_year,
                incomeType, incomeName, normalizedDivisionCode, gangCode: data.gang_code, amount: parsedAmount
            });
            console.log(`[saveOtherIncome] Inserted ${incomeName}: nik=${realNik}, emp_code=${empCodeVal}: Rp${parsedAmount}, ID=${id}`);
            return id ?? 0;
        }
    }

    /**
     * Save a manual adjustment (Insert or Update)
     *
     * Special handling for PENDAPATAN_LAINNYA:
     * - Saves to employee_other_incomes table (like THR, Bonus, Custom)
     * - is_paid_in_thp = false (added to gross wage, not THP)
     * - is_taxable = false (not taxable income)
     */
    public async saveAdjustment(data: ManualAdjustment, user?: string): Promise<number> {
        data = normalizeManualAdjustmentForSave(data);

        // Validate metadata_json if provided — reject invalid JSON or missing input_type
        if (data.metadata_json !== undefined && data.metadata_json !== null) {
            const rawMeta = typeof data.metadata_json === "string" ? data.metadata_json : JSON.stringify(data.metadata_json);
            if (rawMeta && typeof rawMeta === "string" && rawMeta.trim() !== "") {
                try {
                    const parsed = JSON.parse(rawMeta);
                    if (!parsed || !parsed.input_type) {
                        throw new Error("metadata_json must have an 'input_type' field");
                    }
                    // Reject unknown input_type values
                    const validInputTypes = ["amount", "blok", "exp", "kendaraan", "blok,exp"];
                    if (!validInputTypes.includes(parsed.input_type)) {
                        throw new Error(`metadata_json input_type "${parsed.input_type}" not supported. Use: ${validInputTypes.join(", ")}`);
                    }
                } catch (err: any) {
                    if (err.message.includes("input_type") || err.message.includes("not supported")) {
                        throw err;
                    }
                    throw new Error(`metadata_json is not valid JSON: ${err.message}`);
                }
            }
        }

        // Ensure amount is a valid float
        const parsedAmount = parseFloat(data.amount.toString()) || 0;
        const normalizedAdjustmentName = normalizeStoredAdjustmentName(data.adjustment_name);

        // [GUARD] Karyawan panen (gang_code berakhiran 'H', mis. J1H/J2H) seharusnya
        // mendapat PREMI INSENTIF PANEN, BUKAN PREMI KINERJA. Tolak input PREMI KINERJA
        // untuk gang-H agar kesalahan input tidak terulang.
        // EXCEPTION: mandor dan kerani boleh tetap dapat PREMI KINERJA (role non-panen).
        const gangCodeForGuard = String(data.gang_code || '').trim().toUpperCase();
        if (normalizedAdjustmentName === 'PREMI KINERJA' && gangCodeForGuard.endsWith('H')) {
            const rawJabatan = normalizeText(data.jabatan_estate || data.jabatan || '');
            let jabatanForGuard = rawJabatan;
            if (!jabatanForGuard && data.emp_code) {
                try {
                    const estateRow = await selectEstateJabatanByEmpCode(Database.getExtendedInstance(), String(data.emp_code));
                    jabatanForGuard = normalizeText(estateRow?.jabatan || '');
                } catch { /* fall through to reject if lookup fails */ }
            }
            const isMandorOrKerani = /MANDOR|KERANI|KRANI/i.test(jabatanForGuard);
            if (!isMandorOrKerani) {
                throw new Error(
                    `PREMI KINERJA tidak boleh diinput untuk karyawan panen (gang berakhiran 'H', gang=${gangCodeForGuard}). ` +
                    `Gunakan PREMI INSENTIF PANEN untuk karyawan panen. ` +
                    `Khusus mandor/kerani boleh PREMI KINERJA (jabatan terdeteksi: "${jabatanForGuard || 'tidak diketahui'}").`
                );
            }
        }
        const normalizedDivisionCode = normalizeManualAdjustmentDivisionCode(data.division_code);
        const hasMetadataJsonInput = Object.prototype.hasOwnProperty.call(data, 'metadata_json');
        let metadataJsonStr = serializeManualAdjustmentMetadata(data.metadata_json);
        const detailTotalSync = resolveDetailTotalSync(data, normalizedAdjustmentName, metadataJsonStr, parsedAmount);
        metadataJsonStr = detailTotalSync.metadataJsonStr;
        const effectiveAmount = detailTotalSync.amount;
        validatePremiumAdjustmentDefinition(data, normalizedAdjustmentName);
        validateManualAdjustmentAdCode(data);
        const remarks = buildManualAdjustmentRemarks(data);
        const db = this.getDatabase();
        await this.ensureManualAdjustmentIdentitySchema(db);
        const identity = await resolveManualAdjustmentIdentity(data);
        const empName = identity.empName;

        // --- PENDAPATAN_LAINNYA: Save to employee_other_incomes ---
        if (data.adjustment_type === 'PENDAPATAN_LAINNYA') {
            console.log(`[saveAdjustment] PENDAPATAN_LAINNYA: emp_code=${data.emp_code}, gang=${data.gang_code}, name=${normalizedAdjustmentName}, amount=${effectiveAmount}`);
            return await this.saveOtherIncome(db, { ...data, adjustment_name: normalizedAdjustmentName, remarks: remarks || undefined }, effectiveAmount, user);
        }

        // --- Standard adjustments: Save to payroll_manual_adjustments ---

        // Check if an exact match exists
        const existing = await selectExistingAdjustmentId(db, {
            periodMonth: data.period_month,
            periodYear: data.period_year,
            empCode: identity.empCode,
            nik: identity.nik,
            originalIdentifier: identity.originalIdentifier,
            adjustmentType: data.adjustment_type,
            normalizedAdjustmentName
        });

        if (existing && !data.force_insert) {
            if (shouldDeleteStoredAdjustment(effectiveAmount, data.remarks, !!metadataJsonStr)) {
                // If amount is 0, delete it from the table
                await deleteAdjustmentById(db, existing.id);
                return existing.id;
            } else {
                // Update. Preserve existing detail metadata when a regular amount edit
                // does not submit metadata_json, otherwise seeded sub-block detail is lost.
                await updateAdjustment(db, {
                    id: existing.id,
                    empCode: identity.empCode,
                    nik: identity.nik,
                    gangCode: data.gang_code,
                    divisionCode: normalizedDivisionCode,
                    amount: effectiveAmount,
                    remarks,
                    empName,
                    user: user || 'system',
                    hasMetadataJsonInput,
                    metadataJsonStr
                });
                // real-time sync/match write-back (await supaya deterministic; +2 queries, save non-hot-path)
                await this.writeBackSyncStatusForId(existing.id, user);
                return existing.id;
            }
        } else {
            if (shouldDeleteStoredAdjustment(effectiveAmount, data.remarks, !!metadataJsonStr)) return 0; // Don't insert zero

            // Insert
            const insertedId = await insertAdjustment(db, {
                periodMonth: data.period_month,
                periodYear: data.period_year,
                empCode: identity.empCode,
                nik: identity.nik,
                empName,
                gangCode: data.gang_code,
                divisionCode: normalizedDivisionCode,
                adjustmentType: data.adjustment_type,
                adjustmentName: normalizedAdjustmentName,
                amount: effectiveAmount,
                remarks,
                metadataJsonStr,
                user: user || 'system'
            });

            // Auto-save as preset for recent/history (fire-and-forget)
            try {
                const { manualAdjustmentPresetService } = await import("./manualAdjustmentPresetService");
                const mappedPresetFields = await resolveManualAdjustmentPresetMapping(data, normalizedAdjustmentName);
                const presetData = { ...data, ...mappedPresetFields };
                const presetAdCode = resolveManualAdjustmentPresetCode(presetData);
                if (presetAdCode) {
                    const presetTaskCode = normalizeManualAdjustmentPresetCode(presetData.task_code) || presetAdCode;
                    const presetBaseTaskCode = normalizeManualAdjustmentPresetCode(presetData.base_task_code) || presetAdCode;
                    await manualAdjustmentPresetService.upsertPreset({
                        adjustment_type: data.adjustment_type,
                        adjustment_name: normalizedAdjustmentName,
                        ad_code: presetAdCode,
                        task_code: presetTaskCode,
                        base_task_code: presetBaseTaskCode,
                        task_desc: presetData.task_desc,
                        division_code: data.division_code || null,
                        remarks_template: buildManualAdjustmentRemarks({
                            ...presetData,
                            adjustment_name: normalizedAdjustmentName,
                            remarks: data.remarks
                        }) || undefined
                    }, user);
                }
            } catch (e) {
                // Silent fail — preset upsert is best-effort
                console.warn('[saveAdjustment] Auto-preset upsert failed:', e);
            }

            if (insertedId) {
                // real-time sync/match write-back (await supaya deterministic)
                await this.writeBackSyncStatusForId(insertedId, user);
            }
            return insertedId ?? 0;
        }
    }

    /**
     * Delete an adjustment by id
     */
    public async deleteAdjustment(id: number): Promise<void> {
        const db = this.getDatabase();
        await deleteAdjustmentById(db, id);
    }

    public async deleteAdjustmentColumn(input: {
        period_month: number;
        period_year: number;
        division_code?: string;
        adjustment_type: string;
        adjustment_name: string;
    }): Promise<number> {
        const db = this.getDatabase();
        const normalizedAdjustmentName = normalizeStoredAdjustmentName(input.adjustment_name);
        const columnArgs = {
            periodMonth: input.period_month,
            periodYear: input.period_year,
            adjustmentType: input.adjustment_type,
            normalizedAdjustmentName,
            divisionCode: input.division_code
                ? (normalizeManualAdjustmentDivisionCode(input.division_code) || input.division_code)
                : undefined
        };
        const existing = await selectAdjustmentColumnIds(db, columnArgs);
        await deleteAdjustmentColumnRows(db, columnArgs);
        return existing.length;
    }

    /**
     * Convert a premium column from one adjustment_name to another (per-column bulk).
     * Validation gate (validatePremiumConversion) MUST pass before DB writes —
     * blocks subblok↔kendaraan semantic mismatch.
     *
     * metadata_action from validation:
     * - keep: same input_type, preserve metadata_json
     * - drop: target amount, null metadata_json, amount = old total
     * - seed: source amount → target structured, placeholder single-item metadata
     * - remap: compatible different type, restructure metadata
     *
     * Collision (to_name already exists for same emp+period+type) → skip row, amount lama tetap.
     */
    public async convertAdjustmentType(input: {
        period_month: number;
        period_year: number;
        division_code?: string;
        adjustment_type: string;
        from_adjustment_name: string;
        to_adjustment_name: string;
        updated_by?: string;
    }): Promise<{
        converted_count: number;
        skipped_collision_count: number;
        metadata_remapped_count: number;
        metadata_seeded_count: number;
        rows: Array<{ id: number; emp_code: string; status: 'CONVERTED' | 'SKIPPED_COLLISION'; metadata_action: string }>;
    }> {
        const periodMonth = Number(input.period_month);
        const periodYear = Number(input.period_year);
        if (!Number.isInteger(periodMonth) || periodMonth < 1 || periodMonth > 12) {
            throw new Error("period_month harus 1-12");
        }
        if (!Number.isInteger(periodYear) || periodYear < 2000) {
            throw new Error("period_year tidak valid");
        }

        const fromName = normalizeStoredAdjustmentName(input.from_adjustment_name);
        const toName = normalizeStoredAdjustmentName(input.to_adjustment_name);
        if (!fromName || !toName) {
            throw new Error("from_adjustment_name dan to_adjustment_name wajib diisi.");
        }
        if (fromName === toName) {
            throw new Error("from_adjustment_name dan to_adjustment_name tidak boleh sama.");
        }

        const adjustmentType = normalizeText(input.adjustment_type).toUpperCase();
        if (adjustmentType !== "PREMI") {
            throw new Error("Konversi saat ini hanya didukung untuk adjustment_type PREMI.");
        }

        // Validation gate — blocks incompatible input_type conversions
        const validation = premiumDefinitionService.validatePremiumConversion(fromName, toName);
        if (!validation.allowed) {
            throw new Error(`Konversi diblokir: ${validation.reason}`);
        }

        const targetDef = premiumDefinitionService.getDefinitionByName(toName);
        if (!targetDef) {
            throw new Error(`Definisi target "${toName}" tidak ditemukan.`);
        }

        const db = this.getDatabase();
        await this.ensureManualAdjustmentIdentitySchema(db);
        const divisionCodes = input.division_code ? getManualAdjustmentDivisionCodeVariants(input.division_code) : undefined;
        const sourceRows = await selectConversionSourceRows(db, {
            periodMonth,
            periodYear,
            adjustmentType,
            fromAdjustmentName: fromName,
            divisionCodes
        });

        const rows: Array<{ id: number; emp_code: string; status: 'CONVERTED' | 'SKIPPED_COLLISION'; metadata_action: string }> = [];
        let convertedCount = 0;
        let skippedCollisionCount = 0;
        let metadataRemappedCount = 0;
        let metadataSeededCount = 0;
        const user = input.updated_by || 'system';

        for (const row of sourceRows) {
            const rowId = Number(row.id);
            const empCode = normalizeIdentityValue(row.emp_code);
            const nik = normalizeIdentityValue(row.nik);

            // Collision check: row with to_name already exists for same (period+emp+type)
            const collision = await selectConversionCollision(db, {
                periodMonth, periodYear, adjustmentType, toAdjustmentName: toName, empCode, nik
            });

            if (collision) {
                skippedCollisionCount++;
                rows.push({ id: rowId, emp_code: empCode, status: 'SKIPPED_COLLISION', metadata_action: 'skip' });
                continue;
            }

            // Build new payload
            const oldAmount = toNumericAmount(row.amount);
            const oldMetadata = premiumDefinitionService.parseMetadata(row.metadata_json);
            const oldTotal = oldMetadata
                ? toNumericAmount(premiumDefinitionService.calculateMetadataTotal(oldMetadata))
                : oldAmount;
            const effectiveOldTotal = Number.isFinite(oldTotal) && Math.abs(oldTotal) > 0 ? oldTotal : oldAmount;

            const payload: ManualAdjustment = {
                ...row,
                period_month: periodMonth,
                period_year: periodYear,
                adjustment_type: adjustmentType,
                adjustment_name: toName,
                ad_code: targetDef.ad_code,
                task_code: targetDef.ad_code,
                base_task_code: targetDef.ad_code,
                task_desc: targetDef.task_desc,
                amount: effectiveOldTotal,
                metadata_json: row.metadata_json,
                remarks: undefined as any
            };

            let newMetadataJsonStr: string | null = row.metadata_json ?? null;

            if (validation.metadata_action === 'keep') {
                // preserve metadata, resolveDetailTotalSync rebuilds total_amount
            } else if (validation.metadata_action === 'drop') {
                newMetadataJsonStr = null;
                payload.metadata_json = null;
            } else if (validation.metadata_action === 'seed') {
                const seeded = seedPlaceholderMetadata(targetDef.input_type, effectiveOldTotal, row);
                newMetadataJsonStr = seeded ? JSON.stringify(seeded) : null;
                payload.metadata_json = (seeded as any) ?? null;
                metadataSeededCount++;
            } else if (validation.metadata_action === 'remap') {
                const remapped = remapMetadata(oldMetadata, validation.from_input_type, validation.to_input_type, row, effectiveOldTotal);
                newMetadataJsonStr = remapped ? JSON.stringify(remapped) : null;
                payload.metadata_json = (remapped as any) ?? null;
                metadataRemappedCount++;
            }

            // Rebuild remarks with target ad_code/task_desc, then sync amount/metadata total
            payload.remarks = buildManualAdjustmentRemarks(payload);
            const detailSync = resolveDetailTotalSync(payload, toName, newMetadataJsonStr, effectiveOldTotal);
            const finalAmount = detailSync.amount;
            const finalMetadataJson = detailSync.metadataJsonStr;

            await updateConvertedAdjustment(db, {
                id: rowId,
                adjustmentName: toName,
                remarks: payload.remarks ?? null,
                metadataJson: finalMetadataJson,
                amount: finalAmount,
                user
            });

            convertedCount++;
            rows.push({ id: rowId, emp_code: empCode, status: 'CONVERTED', metadata_action: validation.metadata_action });
        }

        return {
            converted_count: convertedCount,
            skipped_collision_count: skippedCollisionCount,
            metadata_remapped_count: metadataRemappedCount,
            metadata_seeded_count: metadataSeededCount,
            rows
        };
    }

    /**
     * Checks PR_ADTRANS (and ARC) directly for specific employee adjustments.
     * Uses PhyMonth and PhyYear to map to the real calendar month.
     */
    public async checkAdtransDirectly(
        periodMonth: number,
        periodYear: number,
        empCodes: string[] = [],
        filters: string[] = [],
        divisionCode?: string,
        options?: AdtransCheckOptions
    ): Promise<any> {
        return checkAdtransDirectly(periodMonth, periodYear, empCodes, filters, divisionCode, options);
    }

    // ponytail: resolve emp_codes anggota gang dari HR_GANGLN. Dipakai listAdtransDocIds utk scope gang.
    //  Upgrade: join langsung di checkAdtransDirectly kalau perlu (sekarang resolve + IN clause).
    private async resolveEmpCodesByGang(gangCode: string): Promise<string[]> {
        const { resolveEmpCodesByGang } = await import("./payroll/manualAdjustments/manualAdjustmentAdtransCompare");
        return resolveEmpCodesByGang(gangCode);
    }

    public async listAdtransDocIds(input: AdtransDocIdLookupInput): Promise<string[]> {
        return listAdtransDocIds(input);
    }

    /**
     * Compare PR_ADTRANS (db_ptrj) values with payroll_manual_adjustments (extend_db_ptrj).
     * Returns per-employee per-category comparison showing source vs stored amount,
     * with match/mismatch status.
     */
    public async compareAdtransWithAdjustments(
        periodMonth: number,
        periodYear: number,
        divisionCode: string,
        filters: string[] = DEFAULT_ADTRANS_COMPARE_FILTERS
    ): Promise<{
        division: string;
        period_month: number;
        period_year: number;
        compared_categories: string[];
        total_employees: number;
        match_count: number;
        mismatch_count: number;
        missing_in_adjustments: number;
        extra_in_db_ptrj: number;
        comparisons: AdtransComparisonItem[];
    }> {
        return compareAdtransWithAdjustments(periodMonth, periodYear, divisionCode, filters);
    }

    public async reverseCompareAdtransWithAdjustments(
        periodMonth: number,
        periodYear: number,
        divisionCode: string,
        filters: string[] = DEFAULT_ADTRANS_COMPARE_FILTERS
    ): Promise<{
        division: string;
        period_month: number;
        period_year: number;
        compared_categories: string[];
        total_adjustments: number;
        match_count: number;
        mismatch_count: number;
        extra_in_adjustments: number;
        comparisons: ReverseAdtransComparisonItem[];
    }> {
        return reverseCompareAdtransWithAdjustments(periodMonth, periodYear, divisionCode, filters);
    }

    /**
     * Sync PR_ADTRANS values (db_ptrj) into payroll_manual_adjustments (extend_db_ptrj).
     * Only syncs items that are MISMATCH or MISSING from comparison.
     * Returns count of synced records.
     */
    public async syncAdtransToAdjustments(
        periodMonth: number,
        periodYear: number,
        divisionCode: string,
        filters: string[] = DEFAULT_ADTRANS_COMPARE_FILTERS,
        syncMode: 'MISSING_ONLY' | 'MISMATCH_AND_MISSING' | 'ALL' = 'MISMATCH_AND_MISSING',
        createdBy: string = 'sync_adtrans_api'
    ): Promise<{
        division: string;
        period_month: number;
        period_year: number;
        sync_mode: string;
        total_compared: number;
        synced_count: number;
        skipped_match: number;
        synced_details: { emp_code: string; category: string; adjustment_name: string; old_amount: number | null; new_amount: number; action: 'INSERT' | 'UPDATE' }[];
    }> {
        return syncAdtransToAdjustments(periodMonth, periodYear, divisionCode, filters, syncMode, createdBy);
    }
}

export const manualAdjustmentService = ManualAdjustmentService.getInstance();
