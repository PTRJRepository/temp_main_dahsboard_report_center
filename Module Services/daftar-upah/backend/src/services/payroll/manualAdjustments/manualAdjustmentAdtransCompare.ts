/**
 * @module backend/src/services/payroll/manualAdjustments/manualAdjustmentAdtransCompare.ts
 * @purpose ADTRANS comparison/sync methods extracted from ManualAdjustmentService facade.
 *            checkAdtransDirectly, resolveEmpCodesByGang, listAdtransDocIds,
 *            compareAdtransWithAdjustments, reverseCompareAdtransWithAdjustments, syncAdtransToAdjustments.
 * @input Period, division, gang, emp codes, filters, sync options.
 * @output ADTRANS totals, doc-id lists, forward/reverse comparison reports, sync results.
 * @depends ../../../db/client#Database, ../../../config#Config, ../../manualAdjustmentService (ensureManualAdjustmentIdentitySchema),
 *            ../../employeeIdentityResolverService, ../../config/DivisionConfigService, ./manualAdjustmentHelpers,
 *            ./manualAdjustmentQueries, ./manualAdjustmentSync, ./manualAdjustmentAdtrans, ../adtransDocDescMapping,
 *            ./autoBufferAdcodeMap
 * @sideeffect Reads PR_ADTRANS / PR_ADTRANS_ARC (db_ptrj); writes payroll_manual_adjustments (extend_db_ptrj) on sync.
 * @tests backend/src/services/manualAdjustmentService.test.ts
 */

import { Database } from "../../../db/client";
import { Config } from "../../../config";
import { employeeIdentityResolverService } from "../../employeeIdentityResolverService";
import { divisionConfigService } from "../../config/DivisionConfigService";
import { manualAdjustmentService } from "../../manualAdjustmentService";
import { normalizeAutoBufferAdjustmentName } from "./autoBufferAdcodeMap";
import {
    normalizeIdentityValue,
    normalizeText,
    mergeStoredAdjustmentComparison,
    adtransDetailMatchesManualAdjustment,
    sumAdtransDetails,
    toComparableCompareAmount
} from "./manualAdjustmentHelpers";
import type {
    AdtransDocDescDetail,
    StoredAdjustmentComparison
} from "./manualAdjustmentHelpers";
import {
    selectComparisonAdjustments,
    selectReverseComparisonAdjustments,
    insertAutoBufferAdjustment,
    updateAutoBufferAdjustmentAmount
} from "./manualAdjustmentQueries";
import {
    selectAdtransCompareDetails,
    selectAdtransCompareTotals,
    selectAdtransDirectlyDuplicates,
    selectAdtransDirectlyTotals,
    selectGangMemberEmpCodes,
    selectGangScopedEmployeeIdentity
} from "./manualAdjustmentSync";
import {
    buildAdtransDuplicateReport,
    DEFAULT_ADTRANS_COMPARE_FILTERS,
    normalizeAdtransCheckOptions,
    resolveAdtransCheckFilters,
    resolveAdtransLocCode,
    buildAdtransSqlCondition,
    buildAdtransSqlPatterns,
    buildAdtransDocDescDetails,
    buildSpecificDocDescSqlPatterns,
    matchesAdtransFilter
} from "./manualAdjustmentAdtrans";
import type {
    AdtransCheckOptions,
    AdtransDocIdLookupInput,
    AdtransComparisonItem,
    ReverseAdtransComparisonItem
} from "./manualAdjustmentAdtrans";
import { normalizeAdtransFilter } from "../adtransDocDescMapping";

/**
 * Checks PR_ADTRANS (and ARC) directly for specific employee adjustments.
 * Uses PhyMonth and PhyYear to map to the real calendar month.
 */
export async function checkAdtransDirectly(
    periodMonth: number,
    periodYear: number,
    empCodes: string[] = [],
    filters: string[] = [],
    divisionCode?: string,
    options?: AdtransCheckOptions
): Promise<any> {
    const dbMain = Database.getInstance(); // db_ptrj
    const normalizedOptions = normalizeAdtransCheckOptions(options);
    const normalizedFilters = resolveAdtransCheckFilters(filters, normalizedOptions);

    if (normalizedFilters.length === 0) {
        return [];
    }

    const normalizedEmpCodes = (empCodes || []).map((empCode) => empCode.trim()).filter(Boolean);
    // Virtual divisions (NRS, INF, WKS_AR, etc.) resolve to their source division's LocCode
    const normalizedDivisionCode = divisionCode ? resolveAdtransLocCode(divisionCode) : '';
    const scopeClauses: string[] = [];
    const scopeParams: any[] = [];

    if (normalizedEmpCodes.length > 0) {
        scopeClauses.push(`RTRIM(t.EmpCode) IN (${normalizedEmpCodes.map(() => '?').join(',')})`);
        scopeParams.push(...normalizedEmpCodes);
    }

    if (normalizedDivisionCode) {
        scopeClauses.push(`UPPER(RTRIM(t.LocCode)) = ?`);
        scopeParams.push(normalizedDivisionCode);
    }

    if (scopeClauses.length === 0) {
        return [];
    }

    const scopeSql = `(${scopeClauses.join(' OR ')})`;
    const caseStatements = normalizedFilters.map((filterKey) => {
        return `SUM(CASE WHEN ${buildAdtransSqlCondition('DocDesc', filterKey)} THEN Amount ELSE 0 END) as [${filterKey}]`;
    }).join(", ");
    const specificDocDescPatterns = buildSpecificDocDescSqlPatterns(normalizedOptions);
    const specificDocDescConditions = specificDocDescPatterns
        .map(() => 'UPPER(t.DocDesc) LIKE ?')
        .join(' OR ');
    const specificDocDescWhereSql = specificDocDescConditions ? ` AND (${specificDocDescConditions})` : '';

    const duplicateDocDescConditions = normalizedFilters
        .flatMap((filter) => buildAdtransSqlPatterns(filter))
        .map(() => 'UPPER(t.DocDesc) LIKE ?')
        .join(' OR ');
    const patternParams = normalizedFilters.flatMap((filter) => buildAdtransSqlPatterns(filter));

    const syncArgs = {
        periodMonth,
        periodYear,
        empCodes: normalizedEmpCodes,
        normalizedDivisionCode,
        caseStatements,
        specificDocDescWhereSql,
        specificDocDescPatterns,
        duplicateDocDescConditions,
        patternParams
    };

    const [rows, duplicateRows] = await Promise.all([
        selectAdtransDirectlyTotals(dbMain, syncArgs),
        selectAdtransDirectlyDuplicates(dbMain, syncArgs)
    ]);

    return {
        totals: rows,
        doc_desc_details: buildAdtransDocDescDetails(duplicateRows, normalizedFilters, normalizedOptions),
        duplicate_report: buildAdtransDuplicateReport(duplicateRows, normalizedFilters, normalizedOptions)
    };
}

// ponytail: resolve emp_codes anggota gang dari HR_GANGLN. Dipakai listAdtransDocIds utk scope gang.
//  Upgrade: join langsung di checkAdtransDirectly kalau perlu (sekarang resolve + IN clause).
export async function resolveEmpCodesByGang(gangCode: string): Promise<string[]> {
    const normalizedGang = normalizeIdentityValue(gangCode);
    if (!normalizedGang) return [];
    try {
        const empCodes = await selectGangMemberEmpCodes(Database.getInstance(), normalizedGang);
        return Array.from(new Set(empCodes.map((r) => normalizeIdentityValue(r)).filter(Boolean)));
    } catch (e) {
        console.warn("[resolveEmpCodesByGang] failed:", e);
        return [];
    }
}

export async function listAdtransDocIds(input: AdtransDocIdLookupInput): Promise<string[]> {
    // ponytail: kalau gangCode set, resolve emp_codes dari HR_GANGLN gang itu,
    //  merge ke empCodes supaya checkAdtransDirectly (all DocID match filter) scope ke gang.
    //  checkAdtransDirectly sendiri gak support gang filter (PR_ADTRANS gak punya gang_code).
    let empCodes = input.empCodes || [];
    if (input.gangCode) {
        const gangEmps = await resolveEmpCodesByGang(input.gangCode);
        if (gangEmps.length > 0) {
            const merged = new Set<string>([...empCodes.map((e) => e.trim().toUpperCase()), ...gangEmps]);
            empCodes = Array.from(merged);
        }
    }
    const result = await manualAdjustmentService.checkAdtransDirectly(
        input.periodMonth,
        input.periodYear,
        empCodes,
        input.filters || [],
        input.divisionCode,
        {
            adjustmentTypes: input.adjustmentTypes || [],
            adjustmentNames: input.adjustmentNames || [],
            docDescs: input.docDescs || []
        }
    );

    const details = Array.isArray(result) ? [] : (result?.doc_desc_details || []);
    const seenDocIds = new Set<string>();
    const docIds: string[] = [];

    for (const detail of details) {
        const docId = normalizeText(detail?.doc_id);
        if (!docId || seenDocIds.has(docId)) continue;

        seenDocIds.add(docId);
        docIds.push(docId);
    }

    return docIds;
}

/**
 * Compare PR_ADTRANS (db_ptrj) values with payroll_manual_adjustments (extend_db_ptrj).
 * Returns per-employee per-category comparison showing source vs stored amount,
 * with match/mismatch status.
 */
export async function compareAdtransWithAdjustments(
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
    const dbPtrj = Database.getInstance(); // db_ptrj - source of truth
    const dbExtend = Database.getInstance(Config.DB_EXTEND_DATABASE, Config.DB_EXTEND_PROFILE);   // extend_db_ptrj - stored adjustments
    await manualAdjustmentService.ensureManualAdjustmentIdentitySchema(dbExtend);

    // Virtual divisions (NRS, INF, WKS_AR, etc.) resolve to their source division's LocCode
    const normalizedDivisionCode = resolveAdtransLocCode(divisionCode);
    const normalizedFilters = filters.map(normalizeAdtransFilter).filter(Boolean);

    if (normalizedFilters.length === 0) {
        return {
            division: divisionCode,
            period_month: periodMonth,
            period_year: periodYear,
            compared_categories: [],
            total_employees: 0,
            match_count: 0,
            mismatch_count: 0,
            missing_in_adjustments: 0,
            extra_in_db_ptrj: 0,
            comparisons: []
        };
    }

    // 1. Get PR_ADTRANS totals per employee per category from db_ptrj
    const caseStatements = normalizedFilters.map((filterKey) => {
        return `SUM(CASE WHEN ${buildAdtransSqlCondition('DocDesc', filterKey)} THEN Amount ELSE 0 END) as [${filterKey}]`;
    }).join(", ");
    const requestedDivision = divisionConfigService.getDivision(divisionCode);
    const virtualGangCodes = requestedDivision?.type === 'virtual'
        ? [
            requestedDivision.code,
            ...requestedDivision.aliases.filter((alias) => requestedDivision.gangPattern?.test(alias.trim().toUpperCase()))
        ].map((code) => code.trim().toUpperCase())
        : [];
    const uniqueVirtualGangCodes = Array.from(new Set(virtualGangCodes));
    const gangJoin = uniqueVirtualGangCodes.length > 0
        ? `
        LEFT JOIN HR_GANGLN gl
            ON gl.GangCode = REPLACE(REPLACE(REPLACE(t.EmpCode, ' ', ''), '-', ''), '/', '')
           AND gl.EmpCode = t.EmpCode
           AND gl.GangCode IS NOT NULL
    `
        : ``;
    const gangWhere = uniqueVirtualGangCodes.length > 0
        ? `AND UPPER(RTRIM(gl.GangCode)) IN (${uniqueVirtualGangCodes.map(() => '?').join(',')})`
        : ``;

    const adtransRows = await selectAdtransCompareTotals(dbPtrj, {
        periodMonth, periodYear, normalizedDivisionCode, caseStatements,
        uniqueVirtualGangCodes, gangJoin, gangWhere
    });

    const detailRows = await selectAdtransCompareDetails(dbPtrj, {
        periodMonth, periodYear, normalizedDivisionCode, caseStatements,
        uniqueVirtualGangCodes, gangJoin, gangWhere
    });
    const docDetailsByEmpAndCategory = new Map<string, AdtransDocDescDetail[]>();
    for (const detail of detailRows) {
        const empCode = String(detail.emp_code || '').trim().toUpperCase();
        const docDesc = String(detail.doc_desc || '').trim();
        for (const filterKey of normalizedFilters) {
            if (!matchesAdtransFilter(docDesc, filterKey)) continue;
            const key = `${empCode}|${filterKey}`;
            if (!docDetailsByEmpAndCategory.has(key)) docDetailsByEmpAndCategory.set(key, []);
            docDetailsByEmpAndCategory.get(key)!.push({
                doc_desc: docDesc,
                doc_id: detail.doc_id ? String(detail.doc_id).trim() : null,
                amount: Number(detail.amount || 0)
            });
        }
    }

    // 2. Get payroll_manual_adjustments for AUTO_BUFFER from extend_db_ptrj
    const adjustmentDivisionCodes = Array.from(new Set([
        divisionCode.trim().toUpperCase(),
        normalizedDivisionCode
    ].filter(Boolean)));
    const adjustmentRows = await selectComparisonAdjustments(dbExtend, {
        periodMonth, periodYear, divisionCodes: adjustmentDivisionCodes
    });

    const categoryToAdjustmentName: Record<string, string> = {
        'spsi': 'SPSI',
        'masa kerja': 'MASA KERJA',
        'jabatan': 'TUNJANGAN JABATAN'
    };
    const autoBufferComparableNames = new Set(Object.values(categoryToAdjustmentName));

    // 3. Build map of stored adjustments: emp_code -> category -> amount
    const storedMap = new Map<string, Map<string, StoredAdjustmentComparison>>();
    for (const row of adjustmentRows) {
        const storedIdentityKeys = Array.from(new Set([
            String(row.emp_code || '').trim().toUpperCase(),
            String(row.nik || '').trim().toUpperCase()
        ].filter(Boolean)));
        const adjustmentType = String(row.adjustment_type || '').trim().toUpperCase();
        const adjustmentName = String(row.adjustment_name || '').trim().toUpperCase();
        const normalizedAutoBufferName = normalizeAutoBufferAdjustmentName(adjustmentName);
        const comparableAdjustmentName = autoBufferComparableNames.has(normalizedAutoBufferName)
            ? normalizedAutoBufferName
            : adjustmentName;
        let category = normalizedFilters.find((filterKey) => categoryToAdjustmentName[filterKey] === comparableAdjustmentName);
        if (!category && adjustmentType === 'PREMI') category = 'premi';
        if (!category && adjustmentType === 'POTONGAN_KOTOR') category = adjustmentName.includes('KOREKSI') ? 'koreksi' : 'potongan';
        if (!category && adjustmentType === 'POTONGAN_BERSIH') category = 'potongan';
        if (!category || !normalizedFilters.includes(category)) continue;

        for (const identityKey of storedIdentityKeys) {
            if (!storedMap.has(identityKey)) storedMap.set(identityKey, new Map());
            const identityMap = storedMap.get(identityKey)!;
            const storedAdjustmentName = autoBufferComparableNames.has(comparableAdjustmentName) ? comparableAdjustmentName : adjustmentName;
            identityMap.set(category, mergeStoredAdjustmentComparison(identityMap.get(category), row, storedAdjustmentName));
        }
    }

    // 4. Map ADTRANS category to adjustment name

    // 5. Compare each employee's ADTRANS values with stored adjustments
    const comparisons: AdtransComparisonItem[] = [];
    let matchCount = 0;
    let mismatchCount = 0;
    let missingCount = 0;
    let extraInDbPtrjCount = 0;

    for (const adtransRow of adtransRows) {
        const empCode = String(adtransRow.emp_code || '').trim().toUpperCase();
        const sourceNik = String(adtransRow.nik || '').trim().toUpperCase();
        const empStored = storedMap.get(empCode) || (sourceNik ? storedMap.get(sourceNik) : undefined);

        for (const filterKey of normalizedFilters) {
            const sourceAmount = Number(adtransRow[filterKey] || 0);
            const stored = empStored?.get(filterKey);
            if (Math.abs(sourceAmount) <= 0.01 && !stored) continue;
            const adjustmentName = stored?.adjustment_name || categoryToAdjustmentName[filterKey] || filterKey.toUpperCase();

            const storedAmount = stored ? Number(stored.amount || 0) : null;

            const comparableSourceAmount = toComparableCompareAmount(filterKey, sourceAmount);
            const comparableStoredAmount = storedAmount === null ? null : toComparableCompareAmount(filterKey, storedAmount);
            const isMatch = comparableStoredAmount !== null && Math.abs(comparableSourceAmount - comparableStoredAmount) <= 0.01;
            const isMissing = storedAmount === null;
            const status: 'MATCH' | 'MISMATCH' | 'MISSING' = isMissing ? 'MISSING' : (isMatch ? 'MATCH' : 'MISMATCH');

            if (status === 'MATCH') matchCount++;
            else if (status === 'MISMATCH') mismatchCount++;
            else missingCount++;

            if (Math.abs(sourceAmount) > 0.01 && status !== 'MATCH') {
                extraInDbPtrjCount++;
            }

            comparisons.push({
                emp_code: empCode,
                stored_emp_identifier: sourceNik && sourceNik !== empCode ? sourceNik : null,
                category: filterKey,
                adjustment_name: adjustmentName,
                source_amount: sourceAmount,
                stored_amount: storedAmount,
                db_ptrj_amount: sourceAmount,
                extend_db_ptrj_amount: storedAmount,
                diff: comparableStoredAmount !== null ? comparableSourceAmount - comparableStoredAmount : null,
                status,
                db_ptrj_doc_desc_details: docDetailsByEmpAndCategory.get(`${empCode}|${filterKey}`) || [],
                extend_db_ptrj_remarks: stored?.remarks || null,
                gang_code: stored?.gang_code || null,
                remarks: stored?.remarks || null
            });
        }
    }

    return {
        division: divisionCode,
        period_month: periodMonth,
        period_year: periodYear,
        compared_categories: normalizedFilters,
        total_employees: adtransRows.length,
        match_count: matchCount,
        mismatch_count: mismatchCount,
        missing_in_adjustments: missingCount,
        extra_in_db_ptrj: extraInDbPtrjCount,
        comparisons
    };
}

export async function reverseCompareAdtransWithAdjustments(
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
    const dbExtend = Database.getInstance(Config.DB_EXTEND_DATABASE, Config.DB_EXTEND_PROFILE);
    await manualAdjustmentService.ensureManualAdjustmentIdentitySchema(dbExtend);
    const normalizedFilters = filters.map(normalizeAdtransFilter).filter(Boolean);
    const categoryToAdjustmentName: Record<string, string> = {
        'spsi': 'SPSI',
        'masa kerja': 'MASA KERJA',
        'jabatan': 'TUNJANGAN JABATAN'
    };
    const autoBufferComparableNames = new Set(Object.values(categoryToAdjustmentName));
    const autoBufferAdjustmentNames = normalizedFilters
        .filter((filterKey) => categoryToAdjustmentName[filterKey])
        .flatMap((filterKey) => {
            const name = categoryToAdjustmentName[filterKey];
            return [name, `AUTO ${name}`];
        });
    const includesManualCategories = normalizedFilters.some((filterKey) => ['premi', 'koreksi', 'potongan'].includes(filterKey));

    const normalizedDivisionCode = resolveAdtransLocCode(divisionCode);
    const adjustmentDivisionCodes = Array.from(new Set([
        divisionCode.trim().toUpperCase(),
        normalizedDivisionCode
    ].filter(Boolean)));

    const adjustmentRows = await selectReverseComparisonAdjustments(dbExtend, {
        periodMonth, periodYear, divisionCodes: adjustmentDivisionCodes,
        autoBufferAdjustmentNames, includesManualCategories
    });

    const dbPtrj = Database.getInstance();
    const ptrjEmpCodeByStoredIdentifier = new Map<string, string>();
    for (const row of adjustmentRows) {
        const storedIdentifier = String(row.emp_code || '').trim();
        if (!storedIdentifier || ptrjEmpCodeByStoredIdentifier.has(storedIdentifier)) continue;

        const gangCode = String(row.gang_code || '').trim().toUpperCase();
        let gangScopedIdentity: any = null;
        if (gangCode) {
            gangScopedIdentity = await selectGangScopedEmployeeIdentity(dbPtrj, { identifier: storedIdentifier, gangCode });
        }

        const identity = gangScopedIdentity || await employeeIdentityResolverService.resolve(storedIdentifier);
        ptrjEmpCodeByStoredIdentifier.set(storedIdentifier, identity?.emp_code || storedIdentifier.toUpperCase());
        const storedNik = String((row as any).nik || '').trim().toUpperCase();
        if (storedNik) {
            ptrjEmpCodeByStoredIdentifier.set(storedNik, identity?.emp_code || storedIdentifier.toUpperCase());
        }
    }

    // PR_ADTRANS.EmpCode is the PTRJ employee code (letter-prefixed, e.g. A0001), not numeric NIK/KTP.
    const ptrjEmpCodes = Array.from(new Set(Array.from(ptrjEmpCodeByStoredIdentifier.values()).filter(Boolean)));
    const adtransResult = ptrjEmpCodes.length > 0
        ? await checkAdtransDirectly(periodMonth, periodYear, ptrjEmpCodes, normalizedFilters, divisionCode)
        : { totals: [] };
    const sourceMap = new Map<string, any>();
    for (const row of adtransResult.totals || []) {
        sourceMap.set(String(row.emp_code || '').trim().toUpperCase(), row);
    }
    const docDetailsByEmpAndCategory = new Map<string, AdtransDocDescDetail[]>();
    for (const detail of adtransResult.doc_desc_details || []) {
        const empCode = String(detail.emp_code || '').trim().toUpperCase();
        const category = String(detail.category || '').trim();
        if (!empCode || !category) continue;

        const key = `${empCode}|${category}`;
        const detailRows = docDetailsByEmpAndCategory.get(key) || [];
        detailRows.push({
            doc_desc: String(detail.doc_desc || '').trim(),
            doc_id: detail.doc_id ? String(detail.doc_id).trim() : null,
            amount: Number(detail.amount || 0)
        });
        docDetailsByEmpAndCategory.set(key, detailRows);
    }

    const comparisons: ReverseAdtransComparisonItem[] = [];
    let matchCount = 0;
    let mismatchCount = 0;
    let extraCount = 0;

    for (const row of adjustmentRows) {
        const empCode = String(row.emp_code || '').trim();
        const ptrjEmpCode = ptrjEmpCodeByStoredIdentifier.get(empCode) || empCode.toUpperCase();
        const adjustmentName = String(row.adjustment_name || '').trim().toUpperCase();
        const adjustmentType = String(row.adjustment_type || '').trim().toUpperCase();
        const normalizedAutoBufferName = normalizeAutoBufferAdjustmentName(adjustmentName);
        const comparableAdjustmentName = autoBufferComparableNames.has(normalizedAutoBufferName)
            ? normalizedAutoBufferName
            : adjustmentName;
        let category = normalizedFilters.find((filterKey) => categoryToAdjustmentName[filterKey] === comparableAdjustmentName);
        if (!category && adjustmentType === 'PREMI') category = 'premi';
        if (!category && adjustmentType === 'POTONGAN_KOTOR') {
            category = adjustmentName.includes('KOREKSI') ? 'koreksi' : 'potongan';
        }
        if (!category && adjustmentType === 'POTONGAN_BERSIH') category = 'potongan';
        if (!category || !normalizedFilters.includes(category)) continue;

        const storedAmount = Number(row.amount || 0);
        const categoryDetails = docDetailsByEmpAndCategory.get(`${ptrjEmpCode}|${category}`) || [];
        const matchingDetails = categoryDetails.filter((detail) => adtransDetailMatchesManualAdjustment(row, {
            emp_code: ptrjEmpCode,
            doc_desc: detail.doc_desc,
            doc_id: detail.doc_id,
            amount: detail.amount
        }));
        const sourceDetails = matchingDetails.length > 0 ? matchingDetails : categoryDetails;
        const sourceAmount = matchingDetails.length > 0
            ? sumAdtransDetails(matchingDetails)
            : Number(sourceMap.get(ptrjEmpCode)?.[category] || 0);
        const comparableSourceAmount = toComparableCompareAmount(category, sourceAmount);
        const comparableStoredAmount = toComparableCompareAmount(category, storedAmount);
        const diff = comparableSourceAmount - comparableStoredAmount;
        const isMatch = Math.abs(diff) <= 0.01;
        const status: 'MATCH' | 'MISMATCH' | 'EXTRA_IN_ADJUSTMENTS' = isMatch
            ? 'MATCH'
            : comparableSourceAmount === 0 && comparableStoredAmount !== 0
                ? 'EXTRA_IN_ADJUSTMENTS'
                : 'MISMATCH';

        if (status === 'MATCH') matchCount++;
        else if (status === 'EXTRA_IN_ADJUSTMENTS') extraCount++;
        else mismatchCount++;

        comparisons.push({
            emp_code: ptrjEmpCode,
            stored_emp_identifier: empCode !== ptrjEmpCode ? empCode : null,
            category,
            adjustment_name: autoBufferComparableNames.has(comparableAdjustmentName) ? comparableAdjustmentName : adjustmentName,
            stored_amount: storedAmount,
            source_amount: sourceAmount,
            db_ptrj_amount: sourceAmount,
            extend_db_ptrj_amount: storedAmount,
            diff,
            status,
            db_ptrj_doc_desc_details: sourceDetails,
            extend_db_ptrj_remarks: row.remarks ? String(row.remarks) : null,
            gang_code: row.gang_code ? String(row.gang_code).trim() : null,
            division_code: row.division_code ? String(row.division_code).trim() : null,
            remarks: row.remarks ? String(row.remarks) : null
        });
    }

    return {
        division: divisionCode,
        period_month: periodMonth,
        period_year: periodYear,
        compared_categories: normalizedFilters,
        total_adjustments: comparisons.length,
        match_count: matchCount,
        mismatch_count: mismatchCount,
        extra_in_adjustments: extraCount,
        comparisons
    };
}

/**
 * Sync PR_ADTRANS values (db_ptrj) into payroll_manual_adjustments (extend_db_ptrj).
 * Only syncs items that are MISMATCH or MISSING from comparison.
 * Returns count of synced records.
 */
export async function syncAdtransToAdjustments(
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
    const comparison = await compareAdtransWithAdjustments(periodMonth, periodYear, divisionCode, filters);
    const dbExtend = Database.getInstance(Config.DB_EXTEND_DATABASE, Config.DB_EXTEND_PROFILE);
    await manualAdjustmentService.ensureManualAdjustmentIdentitySchema(dbExtend);

    const toSync = comparison.comparisons.filter((item) => {
        if (syncMode === 'ALL') return true;
        if (syncMode === 'MISSING_ONLY') return item.status === 'MISSING';
        if (syncMode === 'MISMATCH_AND_MISSING') return item.status === 'MISMATCH' || item.status === 'MISSING';
        return false;
    });

    const syncedDetails: { emp_code: string; category: string; adjustment_name: string; old_amount: number | null; new_amount: number; action: 'INSERT' | 'UPDATE' }[] = [];
    const remarksMap: Record<string, string> = {
        'spsi': 'potongan spsi',
        'masa kerja': 'masa kerja',
        'jabatan': 'tunjangan jabatan'
    };

    for (const item of toSync) {
        const adcode = remarksMap[item.category] || item.category;
        const remarks = `${item.adjustment_name} | ${adcode} | ${item.source_amount} | sync:SYNC | match:MATCH`;
        const identity = await employeeIdentityResolverService.resolve(item.emp_code);
        const empName = identity?.emp_name || null;
        const nik = identity?.nik || null;

        if (item.status === 'MISSING' || item.stored_amount === null) {
            // INSERT - need gang_code, get from PR_ADTRANS or default
            const gangCode = item.gang_code || 'UNKNOWN';
            await insertAutoBufferAdjustment(dbExtend, {
                periodMonth, periodYear, empCode: item.emp_code, nik, empName, gangCode, divisionCode,
                adjustmentName: item.adjustment_name, amount: item.source_amount, remarks, createdBy
            });
            syncedDetails.push({
                emp_code: item.emp_code,
                category: item.category,
                adjustment_name: item.adjustment_name,
                old_amount: null,
                new_amount: item.source_amount,
                action: 'INSERT'
            });
        } else {
            // UPDATE
            await updateAutoBufferAdjustmentAmount(dbExtend, {
                periodMonth, periodYear, empCode: item.emp_code, nik, empName,
                adjustmentName: item.adjustment_name, amount: item.source_amount, remarks, updatedBy: createdBy
            });
            syncedDetails.push({
                emp_code: item.emp_code,
                category: item.category,
                adjustment_name: item.adjustment_name,
                old_amount: item.stored_amount,
                new_amount: item.source_amount,
                action: 'UPDATE'
            });
        }
    }

    return {
        division: divisionCode,
        period_month: periodMonth,
        period_year: periodYear,
        sync_mode: syncMode,
        total_compared: comparison.comparisons.length,
        synced_count: syncedDetails.length,
        skipped_match: comparison.comparisons.length - toSync.length,
        synced_details: syncedDetails
    };
}
