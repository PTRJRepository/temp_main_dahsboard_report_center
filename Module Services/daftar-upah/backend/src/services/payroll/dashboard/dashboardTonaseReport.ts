/**
 * dashboardTonaseReport.ts — Tonase Analysis Report extraction.
 *
 * Extracted from DashboardService.getTonaseAnalysisReport. Builds a 5-month
 * harvest-gang deep report with authoritative tonase from division_tonase.
 *
 * Uses dashboardService for DB access and cross-service calls (getGangProduction)
 * so that test mocks on the singleton remain effective.
 */

import { divisionConfigService } from "../../config/DivisionConfigService";
import { dashboardService } from "../../dashboardService";
import {
    getPeriodWindow,
    getPeriodKey,
    getMonthName,
    selectTonaseAnalysisRows,
    selectDivisionTonase,
} from "./dashboardQueries";

type TonaseAggregationRow = {
    period_month: number;
    period_year: number;
    gang_code: string;
    division_code?: string;
    gang_description?: string;
    total_upah_bersih?: number;
    total_upah_kotor?: number;
    total_hk?: number;
    total_premi?: number;
    total_premi_brondol?: number;
    total_premi_prunning?: number;
    total_premi_insentif?: number;
    total_premi_kinerja?: number;
    total_ffb_weight?: number;
    total_weight_tbs?: number;
    total_employees?: number;
};

// -----------------------------------------------------------------------
// Local standalone helpers (copied verbatim from DashboardService privates)
// -----------------------------------------------------------------------

function toReportNumber(value: unknown): number {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
}

function roundReportNumber(value: number, decimals: number = 0): number {
    const factor = Math.pow(10, decimals);
    return Math.round((value + Number.EPSILON) * factor) / factor;
}

function safeReportRatio(numerator: number, denominator: number, decimals: number = 0): number | null {
    if (!denominator || denominator <= 0) return null;
    return roundReportNumber(numerator / denominator, decimals);
}

function classifyGangType(gangCode: string): string {
    if (!gangCode || gangCode.length === 0) return 'uncategorized';
    const lastLetter = gangCode.slice(-1).toUpperCase();
    switch (lastLetter) {
        case 'H': return 'harvesting';
        case 'T': return 'transport';
        case 'M': return 'maintenance';
        default: return 'uncategorized';
    }
}

// -----------------------------------------------------------------------
// Tonase Analysis Report
// -----------------------------------------------------------------------

export async function getTonaseAnalysisReport(
    month: number,
    year: number,
    divisionCode?: string
): Promise<any> {
    const periods = getPeriodWindow(month, year, 5);
    const startPeriod = periods[0];
    const endPeriod = periods[periods.length - 1];

    const normalizedScope = String(divisionCode || "REBINMAS").trim().toUpperCase();
    const effectiveScope = normalizedScope === "NON_IJL" || normalizedScope === "NON-IJL"
        ? "REBINMAS"
        : normalizedScope;
    const params: any[] = [];

    let divisionFilter = "";
    if (effectiveScope !== "ALL") {
        if (effectiveScope === "IJL") {
            divisionFilter = "AND agg.division_code LIKE 'L%'";
        } else if (effectiveScope === "REBINMAS") {
            divisionFilter = "AND agg.division_code NOT LIKE 'L%'";
        } else {
            const filter = await divisionConfigService.expandDivisionFilter(effectiveScope);
            divisionFilter = `AND agg.division_code IN (${filter.divisionCodes.map(() => "?").join(",")})`;
            params.push(...filter.divisionCodes);
        }
    }

    const rows = await selectTonaseAnalysisRows(dashboardService.extendDb, {
        startYear: startPeriod.year,
        startMonth: startPeriod.month,
        endYear: endPeriod.year,
        endMonth: endPeriod.month,
        divisionFilter,
        params
    });

    // Build production map per period
    const productionByPeriod = new Map<string, Map<string, number>>();

    await Promise.all(periods.map(async (period) => {
        productionByPeriod.set(period.key, await dashboardService.getGangProduction(period.month, period.year));
    }));

    // Authoritative per-division tonase
    const divisionTonaseMap = new Map<string, number>();
    try {
        const dtRows = await selectDivisionTonase(dashboardService.extendDb);
        for (const r of dtRows || []) {
            const pk = getPeriodKey(Number(r.period_month), Number(r.period_year));
            divisionTonaseMap.set(`${pk}::${String(r.division_code).trim().toUpperCase()}`, toReportNumber(r.tonase));
        }
    } catch (e) {
        console.warn('[DashboardService] division_tonase unavailable, falling back to broadcast:', (e as Error).message);
    }

    const dtDivsByPeriod = new Map<string, Set<string>>();
    for (const key of divisionTonaseMap.keys()) {
        const sep = key.lastIndexOf('::');
        const pk = key.slice(0, sep);
        const code = key.slice(sep + 2);
        if (!dtDivsByPeriod.has(pk)) dtDivsByPeriod.set(pk, new Set());
        dtDivsByPeriod.get(pk)!.add(code);
    }
    const aggDivsByPeriod = new Map<string, Set<string>>();
    const getAuthoritativeTonase = (periodKey: string, divisionCode: string): number | null => {
        const v = divisionTonaseMap.get(`${periodKey}::${String(divisionCode || 'UNKNOWN').trim().toUpperCase()}`);
        return v === undefined ? null : v;
    };

    const periodTotals = new Map<string, any>();
    periods.forEach(period => {
        periodTotals.set(period.key, {
            period_key: period.key,
            month: period.month,
            year: period.year,
            label: period.label,
            total_tonase: 0,
            total_ffb_weight: 0,
            total_hk: 0,
            total_upah_bersih: 0,
            total_upah_kotor: 0,
            total_premi: 0,
            total_employees: 0,
            gang_count: 0,
            missing_tonase_count: 0
        });
    });

    const tonaseByPeriodDivision = new Map<string, Map<string, number[]>>();
    const selectedPeriodKey = getPeriodKey(month, year);
    const currentDivisionTotals = new Map<string, any>();
    const getCurrentDivisionTotal = (divisionCode: string) => {
        const normalizedDivisionCode = String(divisionCode || "UNKNOWN").trim().toUpperCase() || "UNKNOWN";
        if (!currentDivisionTotals.has(normalizedDivisionCode)) {
            currentDivisionTotals.set(normalizedDivisionCode, {
                division_code: normalizedDivisionCode,
                total_tonase: 0,
                total_hk: 0,
                total_upah_bersih: 0,
                total_upah_kotor: 0,
                total_premi: 0,
                total_employees: 0,
                gang_count: 0,
                upah_available: 0
            });
        }
        return currentDivisionTotals.get(normalizedDivisionCode)!;
    };
    const summarizeTonaseValues = (values: number[]) => {
        const positiveValues = values.filter(value => value > 0);
        if (positiveValues.length === 0) return 0;
        const uniqueValues = [...new Set(positiveValues.map(value => roundReportNumber(value, 4)))];
        return uniqueValues.length === 1
            ? uniqueValues[0]
            : positiveValues.reduce((sum, value) => sum + value, 0);
    };
    const currentRows: Array<TonaseAggregationRow & { effective_ffb_weight: number }> = [];
    const divisionPeriodTotals = new Map<string, Map<string, any>>();
    const getDivisionPeriodTotal = (periodKey: string, divisionCode: string) => {
        const normalizedDivisionCode = String(divisionCode || "UNKNOWN").trim().toUpperCase() || "UNKNOWN";
        if (!divisionPeriodTotals.has(periodKey)) {
            divisionPeriodTotals.set(periodKey, new Map());
        }
        const periodMap = divisionPeriodTotals.get(periodKey)!;
        if (!periodMap.has(normalizedDivisionCode)) {
            periodMap.set(normalizedDivisionCode, {
                period_key: periodKey,
                division_code: normalizedDivisionCode,
                total_tonase: 0,
                total_hk: 0,
                total_upah_bersih: 0,
                total_upah_kotor: 0,
                total_premi: 0,
                total_employees: 0,
                gang_count: 0,
                upah_available: 0
            });
        }
        return periodMap.get(normalizedDivisionCode)!;
    };
    const currentDetailRows: Array<TonaseAggregationRow & {
        effective_ffb_weight: number;
        normalized_gang_code: string;
        normalized_division_code: string;
        gang_type: string;
    }> = [];

    for (const rawRow of rows) {
        const gangCode = String(rawRow.gang_code || "").trim();
        const periodKey = getPeriodKey(Number(rawRow.period_month), Number(rawRow.period_year));
        const periodTotal = periodTotals.get(periodKey);
        if (!periodTotal) continue;

        const productionFallback = productionByPeriod.get(periodKey)?.get(gangCode) || 0;
        const dbTonase = toReportNumber(rawRow.total_ffb_weight) || toReportNumber(rawRow.total_weight_tbs);
        const effectiveTonase = dbTonase > 0 ? dbTonase : productionFallback / 1000;
        const divisionKey = String(rawRow.division_code || gangCode || "UNKNOWN").trim().toUpperCase() || "UNKNOWN";
        if (!aggDivsByPeriod.has(periodKey)) aggDivsByPeriod.set(periodKey, new Set());
        aggDivsByPeriod.get(periodKey)!.add(divisionKey);
        const isCurrentPeriod = Number(rawRow.period_month) === month && Number(rawRow.period_year) === year;
        const gangType = classifyGangType(gangCode);
        if (isCurrentPeriod) {
            currentDetailRows.push({
                ...rawRow,
                effective_ffb_weight: effectiveTonase,
                normalized_gang_code: gangCode,
                normalized_division_code: divisionKey,
                gang_type: gangType
            });
        }

        if (effectiveTonase > 0) {
            if (!tonaseByPeriodDivision.has(periodKey)) {
                tonaseByPeriodDivision.set(periodKey, new Map());
            }
            const divisionMap = tonaseByPeriodDivision.get(periodKey)!;
            const values = divisionMap.get(divisionKey) || [];
            values.push(effectiveTonase);
            divisionMap.set(divisionKey, values);
        }

        if (gangType !== "harvesting") continue;

        const totalHk = toReportNumber(rawRow.total_hk);
        const totalUpahBersih = toReportNumber(rawRow.total_upah_bersih);
        const totalUpahKotor = toReportNumber(rawRow.total_upah_kotor);
        const totalPremi = toReportNumber(rawRow.total_premi);

        periodTotal.total_hk += totalHk;
        periodTotal.total_upah_bersih += totalUpahBersih;
        periodTotal.total_upah_kotor += totalUpahKotor;
        periodTotal.total_premi += totalPremi;
        periodTotal.total_employees += toReportNumber(rawRow.total_employees);
        periodTotal.gang_count += 1;
        const divisionPeriodTotal = getDivisionPeriodTotal(periodKey, divisionKey);
        divisionPeriodTotal.total_hk += totalHk;
        divisionPeriodTotal.total_upah_bersih += totalUpahBersih;
        divisionPeriodTotal.total_upah_kotor += totalUpahKotor;
        divisionPeriodTotal.total_premi += totalPremi;
        divisionPeriodTotal.total_employees += toReportNumber(rawRow.total_employees);
        divisionPeriodTotal.gang_count += 1;
        if (effectiveTonase <= 0 && (totalHk > 0 || totalUpahBersih > 0 || totalPremi > 0)) {
            periodTotal.missing_tonase_count += 1;
        }

        if (isCurrentPeriod) {
            currentRows.push({
                ...rawRow,
                gang_code: gangCode,
                effective_ffb_weight: effectiveTonase
            });
            const divisionTotal = getCurrentDivisionTotal(divisionKey);
            divisionTotal.total_hk += totalHk;
            divisionTotal.total_upah_bersih += totalUpahBersih;
            divisionTotal.total_upah_kotor += totalUpahKotor;
            divisionTotal.total_premi += totalPremi;
            divisionTotal.total_employees += toReportNumber(rawRow.total_employees);
            divisionTotal.gang_count += 1;
            divisionTotal.upah_available = 1;
        }
    }

    for (const period of periods) {
        const periodTotal = periodTotals.get(period.key);
        if (!periodTotal) continue;

        const divisionMap = tonaseByPeriodDivision.get(period.key) || new Map();
        const dtDivs = dtDivsByPeriod.get(period.key) || new Set();
        const codes = new Set<string>([...divisionMap.keys(), ...dtDivs]);
        const aggDivs = aggDivsByPeriod.get(period.key) || new Set();

        let totalTonase = 0;
        let coveredTonase = 0;
        for (const divisionCode of codes) {
            const authoritative = getAuthoritativeTonase(period.key, divisionCode);
            const divisionTonase = authoritative !== null ? authoritative : 0;
            const hasAgg = aggDivs.has(divisionCode);
            totalTonase += divisionTonase;
            if (hasAgg) coveredTonase += divisionTonase;
            const divTotal = getDivisionPeriodTotal(period.key, divisionCode);
            divTotal.total_tonase = divisionTonase;
            divTotal.upah_available = hasAgg ? 1 : 0;
            if (period.key === selectedPeriodKey) {
                const currTotal = getCurrentDivisionTotal(divisionCode);
                currTotal.total_tonase = divisionTonase;
                currTotal.upah_available = hasAgg ? 1 : 0;
            }
        }

        periodTotal.total_tonase = totalTonase;
        periodTotal.total_ffb_weight = totalTonase;
        periodTotal.upah_covered_tonase = coveredTonase;
    }

    const trend = periods.map(period => {
        const total = periodTotals.get(period.key);
        const totalTonase = roundReportNumber(total.total_tonase, 2);
        const coveredTonase = roundReportNumber(total.upah_covered_tonase, 2);
        return {
            ...total,
            total_tonase: totalTonase,
            upah_covered_tonase: coveredTonase,
            total_ffb_weight: roundReportNumber(total.total_ffb_weight, 2),
            total_hk: roundReportNumber(total.total_hk, 2),
            total_upah_bersih: roundReportNumber(total.total_upah_bersih),
            total_upah_kotor: roundReportNumber(total.total_upah_kotor),
            total_premi: roundReportNumber(total.total_premi),
            total_employees: roundReportNumber(total.total_employees),
            upah_bersih_per_hk: safeReportRatio(total.total_upah_bersih, total.total_hk),
            upah_kotor_per_hk: safeReportRatio(total.total_upah_kotor, total.total_hk),
            premi_per_hk: safeReportRatio(total.total_premi, total.total_hk),
            upah_bersih_per_ton: safeReportRatio(total.total_upah_bersih, coveredTonase),
            upah_kotor_per_ton: safeReportRatio(total.total_upah_kotor, coveredTonase),
            premi_per_ton: safeReportRatio(total.total_premi, coveredTonase),
            premi_share: safeReportRatio(total.total_premi * 100, total.total_upah_kotor, 2)
        };
    });

    const current = trend[trend.length - 1];
    const divisionBreakdown = [...currentDivisionTotals.values()]
        .map(row => {
            const totalTonase = roundReportNumber(row.total_tonase, 2);
            const hasHarvestMetrics = row.gang_count > 0
                || row.total_hk > 0
                || row.total_upah_bersih > 0
                || row.total_premi > 0;
            return {
                division_code: row.division_code,
                total_tonase: totalTonase,
                total_hk: roundReportNumber(row.total_hk, 2),
                total_upah_bersih: roundReportNumber(row.total_upah_bersih),
                total_upah_kotor: roundReportNumber(row.total_upah_kotor),
                total_premi: roundReportNumber(row.total_premi),
                total_employees: roundReportNumber(row.total_employees),
                gang_count: row.gang_count,
                upah_available: row.upah_available === 1 || row.upah_available === true ? 1 : 0,
                upah_bersih_per_hk: hasHarvestMetrics
                    ? safeReportRatio(row.total_upah_bersih, row.total_hk)
                    : null,
                upah_kotor_per_hk: hasHarvestMetrics
                    ? safeReportRatio(row.total_upah_kotor, row.total_hk)
                    : null,
                premi_per_hk: hasHarvestMetrics
                    ? safeReportRatio(row.total_premi, row.total_hk)
                    : null,
                upah_bersih_per_ton: hasHarvestMetrics
                    ? safeReportRatio(row.total_upah_bersih, totalTonase)
                    : null,
                upah_kotor_per_ton: hasHarvestMetrics
                    ? safeReportRatio(row.total_upah_kotor, totalTonase)
                    : null,
                premi_per_ton: hasHarvestMetrics
                    ? safeReportRatio(row.total_premi, totalTonase)
                    : null,
                tonase_share: safeReportRatio(totalTonase * 100, current.total_tonase, 2),
                premi_share: hasHarvestMetrics
                    ? safeReportRatio(row.total_premi * 100, current.total_premi, 2)
                    : null
            };
        })
        .filter(row => row.total_tonase > 0 || row.total_hk > 0 || row.total_upah_bersih > 0 || row.total_premi > 0)
        .sort((a, b) => b.total_tonase - a.total_tonase || a.division_code.localeCompare(b.division_code));
    const divisionSummaryByCode = new Map(divisionBreakdown.map(row => [row.division_code, row]));
    const divisionCodes = [...new Set([
        ...divisionBreakdown.map(row => row.division_code),
        ...currentDetailRows.map(row => row.normalized_division_code)
    ])];
    const divisionDetails = divisionCodes
        .map(divisionCode => {
            const rowsInDivision = currentDetailRows.filter(row => row.normalized_division_code === divisionCode);
            const summary = divisionSummaryByCode.get(divisionCode) || {
                division_code: divisionCode,
                total_tonase: 0,
                total_hk: 0,
                total_upah_bersih: 0,
                total_upah_kotor: 0,
                total_premi: 0,
                total_employees: 0,
                gang_count: 0,
                upah_available: 0,
                upah_bersih_per_hk: null,
                upah_kotor_per_hk: null,
                premi_per_hk: null,
                upah_bersih_per_ton: null,
                upah_kotor_per_ton: null,
                premi_per_ton: null,
                tonase_share: null,
                premi_share: null
            };
            const gangRows = rowsInDivision
                .filter(row => row.gang_type === "harvesting")
                .map(row => {
                    const totalHk = toReportNumber(row.total_hk);
                    const totalUpahBersih = toReportNumber(row.total_upah_bersih);
                    const totalUpahKotor = toReportNumber(row.total_upah_kotor);
                    const totalPremi = toReportNumber(row.total_premi);
                    const totalTonase = roundReportNumber(row.effective_ffb_weight, 2);
                    return {
                        gang_code: row.normalized_gang_code,
                        gang_description: row.gang_description || row.normalized_gang_code,
                        gang_type: row.gang_type,
                        total_tonase: totalTonase,
                        total_hk: roundReportNumber(totalHk, 2),
                        total_upah_bersih: roundReportNumber(totalUpahBersih),
                        total_upah_kotor: roundReportNumber(totalUpahKotor),
                        total_premi: roundReportNumber(totalPremi),
                        total_employees: roundReportNumber(toReportNumber(row.total_employees)),
                        upah_bersih_per_hk: safeReportRatio(totalUpahBersih, totalHk),
                        upah_kotor_per_hk: safeReportRatio(totalUpahKotor, totalHk),
                        premi_per_hk: safeReportRatio(totalPremi, totalHk),
                        upah_bersih_per_ton: safeReportRatio(totalUpahBersih, totalTonase),
                        upah_kotor_per_ton: safeReportRatio(totalUpahKotor, totalTonase),
                        premi_per_ton: safeReportRatio(totalPremi, totalTonase)
                    };
                })
                .sort((a, b) => b.total_hk - a.total_hk || a.gang_code.localeCompare(b.gang_code));
            const tonaseRows = rowsInDivision
                .filter(row => row.effective_ffb_weight > 0)
                .map(row => ({
                    gang_code: row.normalized_gang_code,
                    gang_description: row.gang_description || row.normalized_gang_code,
                    gang_type: row.gang_type,
                    total_tonase: roundReportNumber(row.effective_ffb_weight, 2)
                }))
                .sort((a, b) => b.total_tonase - a.total_tonase || a.gang_code.localeCompare(b.gang_code));
            const divisionTrend = periods.map(period => {
                const periodTotal = divisionPeriodTotals.get(period.key)?.get(divisionCode) || {
                    total_tonase: 0,
                    total_hk: 0,
                    total_upah_bersih: 0,
                    total_upah_kotor: 0,
                    total_premi: 0,
                    total_employees: 0,
                    gang_count: 0
                };
                const totalTonase = roundReportNumber(periodTotal.total_tonase, 2);
                return {
                    period_key: period.key,
                    division_code: divisionCode,
                    total_tonase: totalTonase,
                    total_hk: roundReportNumber(periodTotal.total_hk, 2),
                    total_upah_bersih: roundReportNumber(periodTotal.total_upah_bersih),
                    total_upah_kotor: roundReportNumber(periodTotal.total_upah_kotor),
                    total_premi: roundReportNumber(periodTotal.total_premi),
                    total_employees: roundReportNumber(periodTotal.total_employees),
                    gang_count: periodTotal.gang_count,
                    upah_bersih_per_hk: safeReportRatio(periodTotal.total_upah_bersih, periodTotal.total_hk),
                    upah_kotor_per_hk: safeReportRatio(periodTotal.total_upah_kotor, periodTotal.total_hk),
                    premi_per_hk: safeReportRatio(periodTotal.total_premi, periodTotal.total_hk),
                    upah_bersih_per_ton: safeReportRatio(periodTotal.total_upah_bersih, totalTonase),
                    upah_kotor_per_ton: safeReportRatio(periodTotal.total_upah_kotor, totalTonase),
                    premi_per_ton: safeReportRatio(periodTotal.total_premi, totalTonase),
                    premi_share: safeReportRatio(periodTotal.total_premi * 100, periodTotal.total_upah_kotor, 2)
                };
            });

            return {
                division_code: divisionCode,
                summary,
                trend: divisionTrend,
                gang_rows: gangRows,
                tonase_rows: tonaseRows
            };
        })
        .filter(item => item.summary.total_tonase > 0 || item.gang_rows.length > 0 || item.tonase_rows.length > 0)
        .sort((a, b) => b.summary.total_tonase - a.summary.total_tonase || a.division_code.localeCompare(b.division_code));

    const knownPremiums = [
        {
            key: "brondol",
            label: "Premi Brondol",
            total_amount: currentRows.reduce((sum, row) => sum + toReportNumber(row.total_premi_brondol), 0)
        },
        {
            key: "prunning",
            label: "Premi Prunning",
            total_amount: currentRows.reduce((sum, row) => sum + toReportNumber(row.total_premi_prunning), 0)
        },
        {
            key: "insentif",
            label: "Premi Insentif",
            total_amount: currentRows.reduce((sum, row) => sum + toReportNumber(row.total_premi_insentif), 0)
        },
        {
            key: "kinerja",
            label: "Premi Kinerja",
            total_amount: currentRows.reduce((sum, row) => sum + toReportNumber(row.total_premi_kinerja), 0)
        }
    ];
    const knownPremiumTotal = knownPremiums.reduce((sum, item) => sum + item.total_amount, 0);
    const otherPremium = Math.max(current.total_premi - knownPremiumTotal, 0);
    const premiumBreakdownBase = knownPremiums
        .filter(item => item.total_amount > 0)
        .sort((a, b) => b.total_amount - a.total_amount);
    if (otherPremium > 0) {
        premiumBreakdownBase.push({
            key: "lainnya",
            label: "Premi Lainnya",
            total_amount: otherPremium
        });
    }

    const premiumBreakdown = premiumBreakdownBase.map(item => ({
        ...item,
        total_amount: roundReportNumber(item.total_amount),
        per_hk: safeReportRatio(item.total_amount, current.total_hk),
        per_ton: safeReportRatio(item.total_amount, current.upah_covered_tonase),
        share: safeReportRatio(item.total_amount * 100, current.total_premi, 2)
    }));

    const highestTonasePeriod = [...trend].sort((a, b) => b.total_tonase - a.total_tonase)[0] || current;
    let largestMovement = null;
    for (let index = 1; index < trend.length; index += 1) {
        const previous = trend[index - 1];
        const item = trend[index];
        const deltaTonase = roundReportNumber(item.total_tonase - previous.total_tonase, 2);
        const movement = {
            from_label: previous.label,
            to_label: item.label,
            delta_tonase: deltaTonase,
            delta_percent: safeReportRatio(deltaTonase * 100, previous.total_tonase, 2)
        };
        if (!largestMovement || Math.abs(movement.delta_tonase) > Math.abs(largestMovement.delta_tonase)) {
            largestMovement = movement;
        }
    }

    const previous = trend[trend.length - 2];
    const costDelta = current.upah_kotor_per_hk !== null && previous?.upah_kotor_per_hk !== null
        ? current.upah_kotor_per_hk - previous.upah_kotor_per_hk
        : null;
    const upahCoverage = current.total_tonase > 0
        ? roundReportNumber((current.upah_covered_tonase || 0) * 100 / current.total_tonase, 1)
        : null;
    const warnings: string[] = [];
    if (current.gang_count === 0) {
        warnings.push("Tidak ada data gang panen untuk periode terpilih.");
    }
    if (current.total_tonase <= 0 && current.missing_tonase_count > 0) {
        warnings.push(`Tonase belum tersedia untuk ${current.missing_tonase_count} gang panen pada periode terpilih.`);
    }
    if (current.total_hk <= 0) {
        warnings.push("Total HK gang panen nol pada periode terpilih; metrik per HK tidak tersedia.");
    }
    if (current.total_tonase <= 0) {
        warnings.push("Total tonase estate nol pada periode terpilih; metrik per ton tidak tersedia.");
    }
    const missingUpahDivs = [...currentDivisionTotals.values()].filter(v => v.total_tonase > 0 && v.upah_available !== 1);
    if (missingUpahDivs.length > 0) {
        const missingTonase = roundReportNumber(missingUpahDivs.reduce((sum, v) => sum + v.total_tonase, 0), 2);
        warnings.push(
            `${missingUpahDivs.length} divisi memproduksi ${missingTonase.toLocaleString('id-ID')} t tapi data upah belum masuk `
            + `(cakupan upah ${upahCoverage === null ? 0 : upahCoverage}%). `
            + `Metrik per ton dihitung dari ${roundReportNumber(current.upah_covered_tonase, 2).toLocaleString('id-ID')} t yang berdata upah.`
        );
    }

    return {
        meta: {
            selected_period: {
                month,
                year,
                label: `${getMonthName(month)} ${year}`
            },
            period_window: periods,
            scope: effectiveScope === "REBINMAS"
                ? "SELURUH REBINMAS"
                : effectiveScope === "ALL"
                    ? "ALL ESTATE"
                    : effectiveScope,
            gang_scope: "HARVESTING",
            tonase_source: "extend_db_ptrj.dbo.division_tonase (mill supplier, PTRJ01-09 internal)"
        },
        kpis: {
            total_tonase: current.total_tonase,
            total_ffb_weight: current.total_ffb_weight,
            upah_covered_tonase: roundReportNumber(current.upah_covered_tonase, 2),
            upah_coverage: upahCoverage,
            total_hk: current.total_hk,
            total_upah_bersih: current.total_upah_bersih,
            total_upah_kotor: current.total_upah_kotor,
            total_premi: current.total_premi,
            total_employees: current.total_employees,
            gang_count: current.gang_count,
            upah_bersih_per_hk: current.upah_bersih_per_hk,
            upah_kotor_per_hk: current.upah_kotor_per_hk,
            premi_per_hk: current.premi_per_hk,
            upah_bersih_per_ton: current.upah_bersih_per_ton,
            upah_kotor_per_ton: current.upah_kotor_per_ton,
            premi_per_ton: current.premi_per_ton,
            premi_share: current.premi_share
        },
        trend,
        division_breakdown: divisionBreakdown,
        division_details: divisionDetails,
        premium_breakdown: premiumBreakdown,
        insights: {
            highest_tonase_period: highestTonasePeriod
                ? { label: highestTonasePeriod.label, value: roundReportNumber(highestTonasePeriod.total_tonase, 2) }
                : null,
            largest_tonase_movement: largestMovement
                ? {
                    ...largestMovement,
                    value: Math.abs(largestMovement.delta_tonase),
                    direction: largestMovement.delta_tonase > 0 ? 'naik' : largestMovement.delta_tonase < 0 ? 'turun' : 'datar'
                }
                : null,
            upah_kotor_hk_trend: costDelta === null ? "unavailable" : costDelta > 0 ? "rising" : costDelta < 0 ? "falling" : "flat",
            upah_kotor_hk_delta: costDelta === null ? null : roundReportNumber(costDelta),
            premium_share: current.premi_share,
            upah_coverage: upahCoverage,
            missing_tonase_count: current.missing_tonase_count
        },
        warnings
    };
}
