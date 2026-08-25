/**
 * @module summaryReportService
 *
 * Extracted from SummaryService: impact report, analysis report, and mill totals
 * methods plus their exclusive private helpers. All method bodies are copied
 * verbatim from the facade; `this.X()` calls that stay on the facade are
 * rerouted to the `summaryService` singleton.
 */
import { Database } from "../db/client";
import { divisionConfigService } from "./config/DivisionConfigService";
import { join } from "path";
import { file } from "bun";
import { thumbprintService } from "./thumbprintService";
import { luasAreaService } from "./luasAreaService";
import { debug, warn, error as logError } from "../utils/logger";
import {
    selectLuasHektarFromDb,
    selectLatestAggregationDynamicPremi,
    selectPayrollHistoryHeaders,
    selectAggregationTonaseRows,
    selectMillTotalsFromVenus,
} from "./payroll/summary/summaryQueries";
import { summaryService, DivisionSummary } from "./summaryService";

const CATEGORY = "SummaryService";

export class SummaryReportService {
    private static instance: SummaryReportService;

    private constructor() {}

    public static getInstance(): SummaryReportService {
        if (!SummaryReportService.instance) {
            SummaryReportService.instance = new SummaryReportService();
        }
        return SummaryReportService.instance;
    }

    public async getDivisionLuasHektar(): Promise<Record<string, number>> {
        try {
            // Read from area_produktif.json file
            const areaFile = file(join(process.cwd(), "data", "area_produktif.json"));
            if (await areaFile.exists()) {
                const areaData = await areaFile.json() as any[];
                const map: Record<string, number> = {};
                for (const item of areaData) {
                    const div = (item.divisi || '').trim();
                    if (div) {
                        map[div] = parseFloat(item.luas_hektar) || 0;
                    }
                }
                return map;
            }
        } catch (e) {
            warn(CATEGORY, "Failed to load area_produktif.json, falling back to database:", e);
        }

        // Fallback to database if file doesn't exist
        const rows = await selectLuasHektarFromDb(summaryService.extendDb);
        const map: Record<string, number> = {};
        for (const r of rows) map[r.Divisi.trim()] = r.Luas_Hektar ? parseFloat(r.Luas_Hektar) : 0;
        return map;
    }

    public async getDynamicPremiInsentifPanen(month: number, year: number): Promise<Record<string, { insentif_panen: number }>> {
        const { gangDivMap, gangDescs } = await summaryService.getMetadataForAggregation();
        const rows = await selectLatestAggregationDynamicPremi(summaryService.extendDb, month, year);

        const result: Record<string, any> = {};
        for (const row of rows) {
            const gangCode = row.gang_code?.trim().toUpperCase() || '';
            const rawLoc = gangDivMap[gangCode] || row.division_code?.trim().toUpperCase() || '';
            const sourceLoc = divisionConfigService.resolveCode(rawLoc);
            const gangDesc = gangDescs[gangCode] || '';

            // Unified gang→virtual-division resolution (source-aware + pattern-only fallback)
            const virtualDiv = divisionConfigService.resolveGangDivision(gangCode, sourceLoc, gangDesc, new Set(Object.keys(gangDivMap)));

            const div = virtualDiv || sourceLoc;

            if (!div || div === 'ALL' || div === 'UNKNOWN') continue;
            try {
                // Try dynamic_premi_data first
                let data = null;
                if (row.dynamic_premi_data) {
                    data = typeof row.dynamic_premi_data === 'string' ? JSON.parse(row.dynamic_premi_data) : row.dynamic_premi_data;
                }

                // If not found or empty, try informasi_tambahan (for December/January data compatibility)
                if ((!data || !Array.isArray(data) || data.length === 0) && row.informasi_tambahan) {
                    try {
                        data = typeof row.informasi_tambahan === 'string' ? JSON.parse(row.informasi_tambahan) : row.informasi_tambahan;
                    } catch (e) {
                        // ignore parse error for informasi_tambahan
                    }
                }

                let total = 0;
                if (Array.isArray(data)) {
                    for (const item of data) {
                        const h = (item.header || "").toUpperCase();
                        if (h.includes('INSENTIF') && h.includes('PANEN')) total += parseFloat(item.total || 0);
                    }
                }
                if (!result[div]) result[div] = { insentif_panen: 0 };
                result[div].insentif_panen += total;
            } catch (e) { }
        }
        return result;
    }

    private normalizeImpactDivisionCode(code: string): string {
        const resolved = divisionConfigService.resolveCode((code || "").trim().toUpperCase());
        const aliasMap: Record<string, string> = {
            'PG1A': 'P1A',
            'PG1B': 'P1B',
            'PG2A': 'P2A',
            'PG2B': 'P2B'
        };
        return aliasMap[resolved] || resolved;
    }

    private getInsentifPanenTotalFromDynamicPremiPayload(payload: any): number {
        if (!payload) return 0;

        let data = payload;
        if (typeof payload === "string") {
            try {
                data = JSON.parse(payload);
            } catch {
                return 0;
            }
        }

        if (Array.isArray(data)) {
            return data.reduce((sum, item) => {
                const header = (item?.header || "").toUpperCase();
                if (header.includes("INSENTIF") && header.includes("PANEN")) {
                    return sum + (parseFloat(item.total || 0) || 0);
                }
                return sum;
            }, 0);
        }

        if (typeof data === "object") {
            return parseFloat(data.premi_insentif_panen || data.premi_insentif || 0) || 0;
        }

        return 0;
    }

    private async getImpactPayrollHistoryFallback(month: number, year: number): Promise<Record<string, {
        total_employees: number;
        total_hk: number;
        total_premi_insentif: number;
    }>> {
        try {
            const { gangDivMap, gangDescs } = await summaryService.getMetadataForAggregation();
            const rows = await selectPayrollHistoryHeaders(summaryService.extendDb, month, year);

            const result: Record<string, { total_employees: number; total_hk: number; total_premi_insentif: number }> = {};

            for (const row of rows) {
                const gangCode = row.gang_code?.trim().toUpperCase() || "";
                const rawLoc = gangDivMap[gangCode] || row.division_code?.trim().toUpperCase() || "";
                const sourceLoc = divisionConfigService.resolveCode(rawLoc);
                const gangDesc = gangDescs[gangCode] || row.gang_description || "";
                const virtualDiv = divisionConfigService.resolveGangDivision(gangCode, sourceLoc, gangDesc, new Set(Object.keys(gangDivMap)));

                const div = this.normalizeImpactDivisionCode(virtualDiv || sourceLoc);
                if (!div || div === "ALL" || div === "UNKNOWN") continue;

                if (!result[div]) {
                    result[div] = { total_employees: 0, total_hk: 0, total_premi_insentif: 0 };
                }

                const dynamicInsentif = this.getInsentifPanenTotalFromDynamicPremiPayload(row.dynamic_premi_data)
                    || this.getInsentifPanenTotalFromDynamicPremiPayload(row.informasi_tambahan);

                result[div].total_employees += Number(row.total_employees || 0);
                result[div].total_hk += Number(row.total_hk || 0);
                result[div].total_premi_insentif += Number(row.total_premi_insentif || 0) || dynamicInsentif;
            }

            return result;
        } catch (e: any) {
            warn(CATEGORY, `Failed to load impact payroll-history fallback for ${month}/${year}:`, e.message);
            return {};
        }
    }

    private async getImpactTonaseHistoryFallback(month: number, year: number): Promise<Record<string, number>> {
        try {
            const rows = await selectAggregationTonaseRows(summaryService.extendDb, month, year);

            const result: Record<string, number> = {};
            for (const row of rows) {
                const div = this.normalizeImpactDivisionCode(row.division_code || "");
                if (!div || div === "ALL" || div === "UNKNOWN") continue;

                const tonase = Number(row.total_ffb_weight || row.total_weight_tbs || 0);
                if (tonase <= 0) continue;

                // Tonase seed stores the same division total on each gang row.
                result[div] = Math.max(result[div] || 0, tonase);
            }

            return result;
        } catch (e: any) {
            warn(CATEGORY, `Failed to load impact tonase fallback from extend_db_ptrj for ${month}/${year}:`, e.message);
            return {};
        }
    }

    public async getImpactReportData(month: number, year: number): Promise<any> {
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;

        // Load payrates
        const payrates = await summaryService.loadJsonData('payrate.json') || {};
        const upahDasarCurr = payrates[year.toString()] || 129220;
        const upahDasarPrev = payrates[prevYear.toString()] || 129220;

        const currentData = await summaryService.getAllDivisionsPremiTotals(month, year);
        // Simplified: skipping Nov 2025 JSON override logic for now to keep code concise, falling back to DB
        // Ideally should implement full logic if Nov 2025 accuracy is critical
        const previousData = await summaryService.getAllDivisionsPremiTotals(prevMonth, prevYear);

        // IMPORTANT: Load previous month's thumbprint data from JSON for gaji_prev
        const prevThumbprintData = await thumbprintService.getThumbprintData(prevMonth, prevYear);
        debug(CATEGORY, `[ImpactReport] Loaded previous thumbprint data for ${prevYear} - ${prevMonth}: `, Object.keys(prevThumbprintData).length, "entries");

        const luasHektar = await summaryService.getDivisionLuasHektar();
        const curInsentif = await summaryService.getDynamicPremiInsentifPanen(month, year);
        const prevInsentif = await summaryService.getDynamicPremiInsentifPanen(prevMonth, prevYear);
        const prevHistoryFallback = await this.getImpactPayrollHistoryFallback(prevMonth, prevYear);
        const prevTonaseFromHistory = await this.getImpactTonaseHistoryFallback(prevMonth, prevYear);
        const prevTonaseFromComparisonSource = await summaryService.fetchTonaseFromMill(prevMonth, prevYear);
        const curTonaseFromMill = await summaryService.fetchTonaseFromMill(month, year);

        const prevLookup = new Map(previousData.map(d => [d.division_code, d]));
        const mainRows = [];
        const pruningRows = [];

        for (const curr of currentData) {
            const div = curr.division_code;
            const prev = prevLookup.get(div) || {} as Partial<DivisionSummary>;

            // Insentif: try from helper first (which looks deeply into dynamic), then fallback to main aggregation
            // Actually main aggregation now backfills it too, so curr.total_premi_insentif should be good.
            // But let's use the maximum to be safe.
            const dynamicInsCurr = curInsentif[div]?.insentif_panen || 0;
            const insCurr = Math.max(dynamicInsCurr, curr.total_premi_insentif || 0);

            // Previous Insentif
            const dynamicInsPrev = prevInsentif[div]?.insentif_panen || 0;
            const prevFallback = prevHistoryFallback[div] || {};
            const insPrev = Math.max(dynamicInsPrev, prev.total_premi_insentif || 0, prevFallback.total_premi_insentif || 0);
            const workersPrev = prev.total_employees || prevFallback.total_employees || 0;
            const hkPrev = prev.total_hk || prevFallback.total_hk || 0;
            const tbsPrev = prevTonaseFromHistory[div]
                || prevTonaseFromComparisonSource[div]
                || 0;
            const tbsCurr = curTonaseFromMill[div] ?? Math.max(curr.total_ffb_weight || 0, curr.total_weight_tbs || 0);

            // IMPORTANT: Previous month's gaji comes from THUMBPRINT JSON, not database
            const gajiPrev = prevThumbprintData[div] || 0;
            const gajiCurr = curr.total_upah_bersih;
            const gajiDiff = gajiCurr - gajiPrev;

            debug(CATEGORY, `[ImpactReport] ${div}: current_gaji = ${gajiCurr}, prev_thumbprint = ${gajiPrev}, selisih = ${gajiDiff} `);

            mainRows.push({
                estate: curr.description,
                division_code: div,
                luas_ha: luasHektar[div] || 0,
                workers_prev: workersPrev,
                workers_curr: curr.total_employees,
                workers_diff: curr.total_employees - workersPrev,
                hk_prev: hkPrev,
                hk_curr: curr.total_hk,
                premi_prev: prev.total_premi_excluding_special || 0,
                premi_curr: curr.total_premi_excluding_special,
                lembur_prev: prev.total_lembur || 0,
                lembur_curr: curr.total_lembur,
                prunning_prev: prev.total_premi_prunning || 0,
                prunning_curr: curr.total_premi_prunning,
                insentif_prev: insPrev,
                insentif_curr: insCurr,
                gaji_prev: gajiPrev, // Using thumbprint data from JSON
                gaji_curr: gajiCurr,
                gaji_diff: gajiDiff,
                tbs_prev: tbsPrev,
                tbs_curr: tbsCurr,
                tbs_diff: tbsCurr - tbsPrev,
                pct_gaji_naik_turun: gajiPrev !== 0
                    ? (gajiDiff / gajiPrev) * 100
                    : 0,
            });

            // Populate Pruning Rows (Current Month Only)
            pruningRows.push({
                estate: curr.description,
                division_code: div,
                premi_this_month: curr.total_premi_prunning || 0,
                total: curr.total_premi_prunning || 0 // Assuming Total = Premi for now as discussed
            });
        }

        // Calculate Pruning Totals
        const pruningTotals = {
            estate: "TOTAL PRUNING",
            premi_this_month: pruningRows.reduce((a, b) => a + b.premi_this_month, 0),
            total: pruningRows.reduce((a, b) => a + b.total, 0)
        };

        // Apply Luas Area adjustments to main_table
        const adjustedMainRows = await luasAreaService.applyLuasAreaAdjustments(month, year, mainRows);

        return {
            success: true,
            current_period: { month, year },
            previous_period: { month: prevMonth, year: prevYear },
            upah_dasar: upahDasarCurr, // Kept for compatibility
            upah_dasar_curr: upahDasarCurr,
            upah_dasar_prev: upahDasarPrev,

            main_table: adjustedMainRows,
            pruning_table: pruningRows,
            pruning_totals: pruningTotals,
            // hk_analysis and summary_analysis are calculated in frontend (ImpactReportPage.jsx)
            // But we pass empty objects just in case
            hk_analysis: {},
            summary_analysis: {}
        };
    }

    public async getAnalysisReportData(month: number, year: number, filterType: string = 'all'): Promise<any> {
        const startTime = Date.now();
        debug(CATEGORY, `getAnalysisReportData starting for ${month}/${year}...`);

        // Get previous period
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;

        // Parallelize current + previous month fetches (biggest perf win)
        const [currentData, previousData] = await Promise.all([
            summaryService.getDivisionSummary(undefined, month, year),
            summaryService.getDivisionSummary(undefined, prevMonth, prevYear)
        ]);
        debug(CATEGORY, `getAnalysisReportData parallel fetch done in ${Date.now() - startTime}ms`);

        const currentDivs = currentData.data || [];
        const previousDivs = previousData.data || [];

        type AggregatedAnalysisDivision = {
            division_code: string;
            description: string;
            total_premi: number;
            total_lembur: number;
            source_row_count: number;
            premi_breakdown: Record<string, number>;
        };

        const normalizePremiHeader = (header: unknown): string => String(header || "").trim().toUpperCase();

        const aggregateByDivision = (rows: any[]): Map<string, AggregatedAnalysisDivision> => {
            const grouped = new Map<string, AggregatedAnalysisDivision>();

            for (const row of rows) {
                const divisionCode = String(row.division_code || "").trim().toUpperCase();
                if (!divisionCode) continue;

                const existing = grouped.get(divisionCode);
                const description = String(row.description || row.estate || "").trim();
                const bucket = existing || {
                    division_code: divisionCode,
                    description: description || divisionCode,
                    total_premi: 0,
                    total_lembur: 0,
                    source_row_count: 0,
                    premi_breakdown: {}
                };

                if (!bucket.description && description) {
                    bucket.description = description;
                }

                bucket.total_premi += Number(row.total_premi) || 0;
                bucket.total_lembur += Number(row.total_lembur) || 0;
                bucket.source_row_count += 1;

                if (Array.isArray(row._dynamic_premi_list)) {
                    for (const premi of row._dynamic_premi_list) {
                        const header = normalizePremiHeader(premi?.header);
                        if (!header) continue;
                        bucket.premi_breakdown[header] = (bucket.premi_breakdown[header] || 0) + (Number(premi?.total) || 0);
                    }
                }

                grouped.set(divisionCode, bucket);
            }

            return grouped;
        };

        const currentByDivision = aggregateByDivision(currentDivs);
        const previousByDivision = aggregateByDivision(previousDivs);

        // Collect all dynamic premi headers across all current divisions
        const premiHeadersSet = new Set<string>();
        currentByDivision.forEach((d) => {
            Object.keys(d.premi_breakdown).forEach((header) => premiHeadersSet.add(header));
        });
        const allPremiHeaders = Array.from(premiHeadersSet).sort();

        // Build premi & OT analysis table (Month-to-Month comparison)
        const premiOtRows: any[] = [];
        for (const curr of currentByDivision.values()) {
            const prev = previousByDivision.get(curr.division_code) || {
                total_premi: 0,
                total_lembur: 0,
                source_row_count: 0,
                premi_breakdown: {}
            };

            // Apply filter
            if (filterType === 'ijl' && curr.division_code !== 'IJL') continue;
            if (filterType === 'non_ijl' && curr.division_code === 'IJL') continue;

            const currPremi = Number(curr.total_premi) || 0;
            const prevPremi = Number(prev.total_premi) || 0;
            const currOt = Number(curr.total_lembur) || 0;
            const prevOt = Number(prev.total_lembur) || 0;

            premiOtRows.push({
                division_code: curr.division_code,
                estate: curr.description,
                description: curr.description,
                source_row_count: curr.source_row_count,
                prev_premi: prevPremi,
                curr_premi: currPremi,
                diff_premi: currPremi - prevPremi,
                prev_ot: prevOt,
                curr_ot: currOt,
                diff_ot: currOt - prevOt,
                // Full premi breakdown for this division (current month)
                premi_breakdown: allPremiHeaders.reduce((acc, header) => {
                    acc[header] = curr.premi_breakdown[header] || 0;
                    return acc;
                }, {} as Record<string, number>)
            });
        }

        // Calculate totals
        const sum = (arr: any[], field: string) => arr.reduce((a, b) => a + (b[field] || 0), 0);

        const currPremi = sum(premiOtRows, 'curr_premi');
        const prevPremi = sum(premiOtRows, 'prev_premi');
        const currOt = sum(premiOtRows, 'curr_ot');
        const prevOt = sum(premiOtRows, 'prev_ot');

        // Totals for the breakdown columns
        const breakdownTotals = allPremiHeaders.reduce((acc, header) => {
            acc[header] = premiOtRows.reduce((sum, row) => sum + (row.premi_breakdown[header] || 0), 0);
            return acc;
        }, {} as Record<string, number>);
        const breakdownGrandTotal = allPremiHeaders.reduce((sum, header) => sum + (breakdownTotals[header] || 0), 0);

        return {
            success: true,
            current_period: { month, year },
            previous_period: { month: prevMonth, year: prevYear },
            filter_type: filterType,
            premi_ot_table: premiOtRows,
            all_premi_headers: allPremiHeaders,
            breakdown_totals: breakdownTotals,
            breakdown_grand_total: breakdownGrandTotal,
            totals: {
                prev_premi: prevPremi,
                curr_premi: currPremi,
                diff_premi: currPremi - prevPremi,
                prev_ot: prevOt,
                curr_ot: currOt,
                diff_ot: currOt - prevOt
            }
        };
    }

    /**
     * Get Mill PKS totals from VenusHR14 database
     * Used by aggregation seeder to populate history table
     */
    public async getMillTotals(month: number, year: number): Promise<any> {
        try {
            const venusDb = Database.getVenusInstance();

            const startDate = `${year} -${month.toString().padStart(2, "0")}-01`;
            const endDate = month === 12
                ? `${year + 1}-01-01`
                : `${year} -${(month + 1).toString().padStart(2, "0")}-01`;

            // Query Mill PKS data from VenusHR14
            const rows = await selectMillTotalsFromVenus(venusDb, startDate, endDate);

            const row = rows[0] || {};

            return {
                success: true,
                month,
                year,
                division_code: 'MILL',
                total_employees: row.total_employees || 0,
                total_upah_dasar: row.total_upah_dasar || 0,
                total_hk: row.total_hk || 0,
                source: 'VenusHR14'
            };
        } catch (e: any) {
            logError(CATEGORY, "Failed to get Mill totals:", e);
            return {
                success: false,
                error: e.message,
                month,
                year,
                division_code: 'MILL'
            };
        }
    }
}
