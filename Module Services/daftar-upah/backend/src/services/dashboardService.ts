/**
 * dashboardService.ts — Dashboard/analytics/KPI aggregation facade.
 *
 * Orchestration and data-transformation layer. Every raw SQL query has been
 * extracted to {@link module:dashboardQueries} — this file only imports and
 * calls those query functions, then applies business logic / reshaping.
 *
 * @module dashboardService
 */

import { Database } from "../db/client";
import { dataExtractorService } from "./dataExtractorService";
import { Config } from "../config";
import { gangService } from "./gangService";
import {
    selectPayrollTrend,
    selectDivisionBreakdown,
    selectGangBreakdown,
    selectDivisionEfficiency,
    selectProductivityTrend,
    selectHeadcountFromHr,
    selectCostHKComparison,
    selectAvailableGangs,
    selectLatestPeriod,
    selectAvailablePeriods,
    selectDivisionsForFilter,
    selectGangsForFilter,
    selectComparisonData,
    selectAggregatedGangData,
    selectPremiAnalysis,
    selectPremiByDivision,
    selectOvertimeAnalysis,
    selectGangComparison,
    selectDriverWeights,
    selectDriverGangMapping,
    selectHarvesterBunches,
    selectWageSpikeCurrent,
    selectDivisionCostTrend,
    selectGangHistory,
    selectAllGangsTrend,
    getStartPeriod,
    getPeriodKey,
    getMonthName,
    getPeriodWindow,
    scopeGangSql,
    divisionGangSubqueryFilter,
    TonaseReportPeriod,
} from "./payroll/dashboard/dashboardQueries";
import { getTonaseAnalysisReport as getTonaseAnalysisReportExtracted } from "./payroll/dashboard/dashboardTonaseReport";

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

/**
 * Dashboard service for payroll analytics and KPI aggregation.
 *
 * Data is sourced from the daftar_upah_aggregation_history table (extend_db_ptrj).
 * Aggregated reads must select the latest row per period/gang before summing.
 */
export class DashboardService {
    private static instance: DashboardService;
    public extendDb: Database;
    private hrDb: Database;

    private constructor() {
        this.extendDb = Database.getInstance("extend_db_ptrj", Config.DB_EXTEND_PROFILE);
        this.hrDb = Database.getInstance();
    }

    public static getInstance(): DashboardService {
        if (!DashboardService.instance) {
            DashboardService.instance = new DashboardService();
        }
        return DashboardService.instance;
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    private toReportNumber(value: unknown): number {
        const numberValue = Number(value);
        return Number.isFinite(numberValue) ? numberValue : 0;
    }

    private roundReportNumber(value: number, decimals: number = 0): number {
        const factor = Math.pow(10, decimals);
        return Math.round((value + Number.EPSILON) * factor) / factor;
    }

    private safeReportRatio(numerator: number, denominator: number, decimals: number = 0): number | null {
        if (!denominator || denominator <= 0) return null;
        return this.roundReportNumber(numerator / denominator, decimals);
    }

    private classifyGangType(gangCode: string): string {
        if (!gangCode || gangCode.length === 0) return 'uncategorized';
        const lastLetter = gangCode.slice(-1).toUpperCase();
        switch (lastLetter) {
            case 'H': return 'harvesting';
            case 'T': return 'transport';
            case 'M': return 'maintenance';
            default: return 'uncategorized';
        }
    }

    private isIJL(gangCode: string): boolean {
        return gangCode?.toUpperCase().startsWith('L') || false;
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    /**
     * Get 12-month trend for Wages, OT, Premi.
     */
    public async getPayrollTrend(endMonth: number, endYear: number, gangScope: string = 'panen'): Promise<any[]> {
        const { startMonth, startYear } = getStartPeriod(endMonth, endYear);

        const rows = await selectPayrollTrend(this.extendDb, {
            endMonth, endYear, startMonth, startYear, gangScope
        });

        return rows.map(r => {
            const tonase = this.toReportNumber(r.total_tonase);
            const wage = this.toReportNumber(r.total_wage);
            const hk = this.toReportNumber(r.total_hk);
            const hkHadir = this.toReportNumber(r.total_hari_kerja);
            const hkLibur = Math.max(0, hk - hkHadir);
            return {
                period: `${getMonthName(r.period_month)} ${r.period_year}`,
                month: r.period_month,
                year: r.period_year,
                total_wage: wage,
                total_ot: r.total_ot,
                total_premi: r.total_premi,
                total_headcount: r.total_headcount,
                total_hk: hk,
                total_hk_efektif: hkHadir,
                total_hari_kerja: hkHadir,
                total_hk_libur: hkLibur,
                total_tonase: tonase,
                cost_per_ton: tonase > 0 ? wage / tonase : null,
                cost_per_hk: hkHadir > 0 ? wage / hkHadir : null
            };
        });
    }

    /**
     * Get current month division breakdown.
     */
    public async getDivisionBreakdown(month: number, year: number, gangScope: string = 'panen'): Promise<any[]> {
        return selectDivisionBreakdown(this.extendDb, { month, year, gangScope });
    }

    /**
     * Get Top Gangs by Cost.
     */
    public async getGangBreakdown(month: number, year: number, limit: number = 15, gangScope: string = 'panen'): Promise<any[]> {
        return selectGangBreakdown(this.extendDb, { month, year, limit, gangScope });
    }

    /**
     * Get Division Efficiency (Cost vs Headcount/WorkDays).
     */
    public async getDivisionEfficiency(month: number, year: number, gangScope: string = 'panen'): Promise<any[]> {
        const rows = await selectDivisionEfficiency(this.extendDb, { month, year, gangScope });
        return rows.map((r: any) => {
            const hk = this.toReportNumber(r.total_man_days);
            const hkHadir = this.toReportNumber(r.total_hari_kerja);
            return {
                ...r,
                total_hk_efektif: hkHadir,
                total_hk_libur: Math.max(0, hk - hkHadir)
            };
        });
    }

    /**
     * Get 12-Month/Period Productivity Trend (Cost per HK).
     */
    public async getProductivityTrend(endMonth: number, endYear: number, gangScope: string = 'panen'): Promise<any[]> {
        const { startMonth, startYear } = getStartPeriod(endMonth, endYear);

        const rows = await selectProductivityTrend(this.extendDb, {
            startMonth, startYear, endMonth, endYear, gangScope
        });

        return rows.map(r => {
            const hk = this.toReportNumber(r.total_hk);
            const hkHadir = this.toReportNumber(r.total_hari_kerja);
            return {
                period: `${getMonthName(r.period_month)} ${r.period_year}`,
                costPerHk: hkHadir > 0 ? r.total_wage / hkHadir : 0,
                costPerTon: r.total_tonase > 0 ? r.total_wage / r.total_tonase : 0,
                totalHk: hk,
                totalHkEfektif: hkHadir,
                totalHkLibur: Math.max(0, hk - hkHadir),
                totalTonase: r.total_tonase
            };
        });
    }

    /**
     * Ringkasan headcount live dari master karyawan HR.
     */
    public async getHeadcountSummary(month: number, year: number): Promise<any> {
        const rows = await selectHeadcountFromHr(this.hrDb);

        const byDivisionMap = new Map<string, number>();
        const byEmpTypeMap = new Map<string, number>();
        let male = 0, female = 0;
        const joinMap = new Map<string, number>();
        const { startMonth, startYear } = getStartPeriod(month, year);

        for (const r of rows) {
            const div = (r.loc_code || '').trim() || 'UNKNOWN';
            byDivisionMap.set(div, (byDivisionMap.get(div) || 0) + 1);

            const empType = (r.hr_emp_type || '').trim().toUpperCase() || 'LAINNYA';
            byEmpTypeMap.set(empType, (byEmpTypeMap.get(empType) || 0) + 1);

            const g = String(r.gender ?? '').trim();
            if (g === '2' || g === 'P') female++; else male++;

            if (r.join_date) {
                const d = new Date(r.join_date);
                const jm = d.getMonth() + 1;
                const jy = d.getFullYear();
                const inWindow = (jy > startYear || (jy === startYear && jm >= startMonth))
                    && (jy < year || (jy === year && jm <= month));
                if (inWindow) {
                    const key = getPeriodKey(jm, jy);
                    joinMap.set(key, (joinMap.get(key) || 0) + 1);
                }
            }
        }

        const sortDesc = (a: any, b: any) => b.headcount - a.headcount;
        return {
            total: rows.length,
            by_division: [...byDivisionMap.entries()]
                .map(([division_code, headcount]) => ({ division_code, headcount }))
                .sort(sortDesc),
            by_emp_type: [...byEmpTypeMap.entries()]
                .map(([emp_type, headcount]) => ({ emp_type, headcount }))
                .sort(sortDesc),
            by_gender: [
                { gender: 'L', headcount: male },
                { gender: 'P', headcount: female }
            ],
            join_trend_12m: getPeriodWindow(month, year, 12).map(p => ({
                month: p.month,
                year: p.year,
                label: p.label,
                joined: joinMap.get(p.key) || 0
            }))
        };
    }

    /**
     * Fallback KPI headcount: bila agregasi bulan berjalan kosong (0),
     * pakai total headcount live dari master karyawan.
     */
    public withLiveHeadcountFallback(kpi: any, liveTotal: number): any {
        const fromAggregation = this.toReportNumber(kpi?.curr_headcount) > 0;
        return {
            ...kpi,
            curr_headcount: fromAggregation ? kpi.curr_headcount : this.toReportNumber(liveTotal),
            headcount_source: fromAggregation ? 'aggregation' : 'live'
        };
    }

    /**
     * Komposisi biaya per divisi dari breakdown agregasi.
     */
    public async getCostStructure(month: number, year: number, gangScope: string = 'panen'): Promise<any> {
        const rows = await this.getDivisionBreakdown(month, year, gangScope);
        const divisions = rows.map((r: any) => {
            const wage = this.toReportNumber(r.total_wage);
            const premi = this.toReportNumber(r.total_premi);
            const ot = this.toReportNumber(r.total_ot);
            const headcount = this.toReportNumber(r.headcount);
            const hk = this.toReportNumber(r.total_hk);
            const hkHadir = this.toReportNumber(r.total_hari_kerja);
            const tonase = this.toReportNumber(r.total_tonase);
            const upahAvailable = r.upah_available === 1;
            return {
                division_code: r.division_code,
                upah_pokok: Math.max(wage - premi - ot, 0),
                premi,
                lembur: ot,
                total_wage: wage,
                potongan: this.toReportNumber(r.total_potongan),
                pph21: this.toReportNumber(r.total_pph21),
                spsi: this.toReportNumber(r.total_spsi),
                bpjs_pekerja: this.toReportNumber(r.total_bpjs_pekerja),
                headcount,
                total_hk: hk,
                total_hk_efektif: hkHadir,
                total_hk_libur: Math.max(0, hk - hkHadir),
                tonase,
                cost_per_head: upahAvailable && headcount > 0 ? wage / headcount : null,
                cost_per_hk: upahAvailable && hk > 0 ? wage / hk : null,
                cost_per_ton: upahAvailable && tonase > 0 ? wage / tonase : null,
                upah_available: upahAvailable
            };
        });
        const sum = (key: string) => divisions.reduce((acc: number, d: any) => acc + (d[key] || 0), 0);
        return {
            divisions,
            totals: {
                upah_pokok: sum('upah_pokok'),
                premi: sum('premi'),
                lembur: sum('lembur'),
                total_wage: sum('total_wage'),
                potongan: sum('potongan'),
                pph21: sum('pph21'),
                spsi: sum('spsi'),
                bpjs_pekerja: sum('bpjs_pekerja'),
                headcount: sum('headcount'),
                total_hk: sum('total_hk'),
                tonase: sum('tonase')
            }
        };
    }

    /**
     * Cross-division cost/ton timeline — flat (division × month) series.
     */
    public async getDivisionCostTrend(endMonth: number, endYear: number, span = 8, gangTypes: string[] = ['harvesting']): Promise<any[]> {
        let startMonth = endMonth - (span - 1);
        let startYear = endYear;
        while (startMonth <= 0) { startMonth += 12; startYear -= 1; }

        try {
            const rows = await selectDivisionCostTrend(this.extendDb, {
                startYear, startMonth, endYear, endMonth, gangTypes
            });
            return rows.map(r => {
                const tonase = this.toReportNumber(r.total_tonase);
                const wage = this.toReportNumber(r.total_wage);
                const hk = this.toReportNumber(r.total_hk);
                const hkHadir = this.toReportNumber(r.total_hari_kerja);
                return {
                    division_code: String(r.division_code).trim().toUpperCase(),
                    period: `${getMonthName(r.period_month)} ${r.period_year}`,
                    month: r.period_month,
                    year: r.period_year,
                    wage,
                    tonase,
                    hk,
                    hk_efektif: hkHadir,
                    hk_libur: Math.max(0, hk - hkHadir),
                    cost_per_ton: tonase > 0 ? wage / tonase : null,
                    cost_per_hk: hkHadir > 0 ? wage / hkHadir : null
                };
            });
        } catch (e) {
            console.error("[DashboardService] Error getting division cost trend:", e);
            throw e;
        }
    }

    /**
     * Get Gang Wage Spikes (Anomaly Detection).
     */
    public async getWageSpikes(month: number, year: number, gangScope: string = 'panen'): Promise<any[]> {
        let prevMonth = month - 1;
        let prevYear = year;
        if (prevMonth === 0) {
            prevMonth = 12;
            prevYear = year - 1;
        }

        const [currentRows, prevRows] = await Promise.all([
            selectWageSpikeCurrent(this.extendDb, { month, year, gangScope }),
            selectWageSpikeCurrent(this.extendDb, { month: prevMonth, year: prevYear, gangScope })
        ]);

        const prevMap = new Map<string, { wage: number, hk: number }>();
        prevRows.forEach(r => {
            const hkHadir = this.toReportNumber(r.total_hari_kerja);
            prevMap.set(r.gang_code, { wage: r.total_wage, hk: hkHadir });
        });

        const anomalies: any[] = [];

        currentRows.forEach(curr => {
            const hkHadir = this.toReportNumber(curr.total_hari_kerja);
            if (hkHadir > 0) {
                const currCostPerHk = curr.total_wage / hkHadir;
                const prev = prevMap.get(curr.gang_code);

                if (prev && prev.hk > 0) {
                    const prevCostPerHk = prev.wage / prev.hk;

                    if (prevCostPerHk > 10000) {
                        const diff = currCostPerHk - prevCostPerHk;
                        const pct = (diff / prevCostPerHk) * 100;

                        if (pct > 15 && diff > 5000) {
                            anomalies.push({
                                id: curr.gang_code,
                                name: curr.gang_code,
                                currentWage: currCostPerHk,
                                previousWage: prevCostPerHk,
                                percentage: pct,
                                difference: diff,
                                gang: 'Cost/HK Spike'
                            });
                        }
                    }
                }
            }
        });

        return anomalies.sort((a, b) => b.percentage - a.percentage).slice(0, 5);
    }

    /**
     * Get Cost per HK Comparison Report.
     */
    public async getCostHKComparison(
        month: number,
        year: number,
        divisionFilter: string = 'ALL',
        gangCodes?: string[],
        gangTypeFilter?: string
    ): Promise<any> {
        try {
            let whereConditions = ['period_month = ?', 'period_year = ?'];
            const params: any[] = [month, year];

            if (divisionFilter === 'IJL') {
                whereConditions.push("gang_code LIKE 'L%'");
            } else if (divisionFilter === 'NON_IJL') {
                whereConditions.push("gang_code NOT LIKE 'L%'");
            }

            if (gangCodes && gangCodes.length > 0) {
                const gangPlaceholders = gangCodes.map(() => '?').join(',');
                whereConditions.push(`gang_code IN (${gangPlaceholders})`);
                params.push(...gangCodes);
            }

            const whereClause = whereConditions.join(' AND ');

            const rows = await selectCostHKComparison(this.extendDb, {
                month, year, whereClause, params
            });

            let gangDetails = rows.map(row => {
                const hk = this.toReportNumber(row.total_hk);
                const hkHadir = this.toReportNumber(row.total_hari_kerja);
                const costPerHK = hkHadir > 0 ? row.total_cost / hkHadir : 0;
                return {
                    gang_code: row.gang_code,
                    division_code: row.division_code,
                    gang_description: row.gang_description || '-',
                    gang_type: this.classifyGangType(row.gang_code),
                    is_ijl: this.isIJL(row.gang_code),
                    total_cost: row.total_cost,
                    total_lembur: row.total_lembur,
                    total_premi: row.total_premi,
                    total_hk: hk,
                    total_hk_efektif: hkHadir,
                    total_hk_libur: Math.max(0, hk - hkHadir),
                    cost_per_hk: Math.round(costPerHK),
                    headcount: row.headcount
                };
            });

            if (gangTypeFilter && gangTypeFilter !== 'ALL') {
                gangDetails = gangDetails.filter(g => g.gang_type === gangTypeFilter);
            }

            const summaryByType: Record<string, any> = {
                harvesting: { total_cost: 0, total_hk: 0, count: 0 },
                transport: { total_cost: 0, total_hk: 0, count: 0 },
                maintenance: { total_cost: 0, total_hk: 0, count: 0 },
                uncategorized: { total_cost: 0, total_hk: 0, count: 0 }
            };

            let grandTotalCost = 0;
            let grandTotalHK = 0;

            gangDetails.forEach(gang => {
                if (summaryByType[gang.gang_type]) {
                    summaryByType[gang.gang_type].total_cost += gang.total_cost;
                    summaryByType[gang.gang_type].total_hk += gang.total_hk_efektif;
                    summaryByType[gang.gang_type].count += 1;
                }
                grandTotalCost += gang.total_cost;
                grandTotalHK += gang.total_hk_efektif;
            });

            const summary: Record<string, any> = {};
            Object.keys(summaryByType).forEach(type => {
                const data = summaryByType[type];
                summary[type] = {
                    ...data,
                    cost_per_hk: data.total_hk > 0 ? Math.round(data.total_cost / data.total_hk) : 0
                };
            });

            return {
                success: true,
                period: `${getMonthName(month)} ${year}`,
                division_filter: divisionFilter,
                summary,
                gang_details: gangDetails.sort((a, b) => a.gang_code.localeCompare(b.gang_code)),
                grand_total: {
                    total_cost: grandTotalCost,
                    total_hk: grandTotalHK,
                    cost_per_hk: grandTotalHK > 0 ? Math.round(grandTotalCost / grandTotalHK) : 0
                }
            };
        } catch (e: any) {
            console.error("[DashboardService] Error getting cost/HK comparison:", e);
            throw e;
        }
    }

    /**
     * Get available gangs for filter dropdown.
     */
    public async getAvailableGangs(month: number, year: number): Promise<any[]> {
        try {
            const rows = await selectAvailableGangs(this.extendDb, { month, year });

            return rows.map(row => ({
                gang_code: row.gang_code,
                division_code: row.division_code,
                gang_description: row.gang_description || '-',
                gang_type: this.classifyGangType(row.gang_code),
                is_ijl: this.isIJL(row.gang_code)
            }));
        } catch (e: any) {
            console.error("[DashboardService] Error getting available gangs:", e);
            throw e;
        }
    }

    /**
     * Get Latest Available Data Period.
     */
    public async getLatestPeriod(): Promise<{ month: number, year: number }> {
        const result = await selectLatestPeriod(this.extendDb);
        if (result.length > 0) {
            return { month: result[0].period_month, year: result[0].period_year };
        }
        return { month: new Date().getMonth() + 1, year: new Date().getFullYear() };
    }

    /**
     * Get All Available Data Periods.
     */
    public async getAvailablePeriods(): Promise<{ month: number, year: number }[]> {
        const result = await selectAvailablePeriods(this.extendDb);
        return result.map(r => ({ month: r.period_month, year: r.period_year }));
    }

    /**
     * Get Filter Options (Divisions and Gangs).
     */
    public async getFilterOptions(month: number, year: number): Promise<{ divisions: string[], gangs: string[] }> {
        const [divs, gangs] = await Promise.all([
            selectDivisionsForFilter(this.extendDb, { month, year }),
            selectGangsForFilter(this.extendDb, { month, year })
        ]);

        return {
            divisions: divs.map(d => d.division_code),
            gangs: gangs.map(g => g.gang_code)
        };
    }

    /**
     * Get Comparison Data for selected entities.
     */
    public async getComparisonData(type: 'division' | 'gang', codes: string[], month: number, year: number): Promise<any[]> {
        if (!codes || codes.length === 0) return [];

        const column = type === 'division' ? 'division_code' : 'gang_code';

        const rows = await selectComparisonData(this.extendDb, { column, codes, month, year });

        return rows.map(r => {
            const hk = this.toReportNumber(r.total_hk);
            const hkHadir = this.toReportNumber(r.total_hari_kerja);
            return {
                name: r.name,
                total_wage: r.total_wage,
                total_ot: r.total_ot,
                total_hk: hk,
                total_hk_efektif: hkHadir,
                total_hk_libur: Math.max(0, hk - hkHadir),
                cost_per_hk: hkHadir > 0 ? r.total_wage / hkHadir : 0,
                headcount: r.headcount
            };
        });
    }

    /**
     * Get Aggregated Gang Data for Comprehensive Analysis.
     */
    public async getAggregatedGangData(divisionCode: string, month: number, year: number): Promise<any[]> {
        let divisionFilter = '';
        const divisionParams: any[] = [];
        if (divisionCode && divisionCode !== 'ALL') {
            const aliases = gangService.getAllDivisionAliases(divisionCode);
            divisionFilter = `AND agg.division_code IN (${aliases.map(() => '?').join(',')})`;
            divisionParams.push(...aliases);
        }

        const rows = await selectAggregatedGangData(this.extendDb, {
            month, year, divisionFilter, divisionParams
        });
        return rows.map(r => ({
            gang_code: r.gang_code,
            description: r.gang_description || r.gang_code,
            total_wage: r.total_wage,
            total_ot: r.total_ot,
            total_premi: r.total_premi,
            total_hk: r.total_hk,
            total_employees: r.headcount
        }));
    }

    /**
     * Get Premi Analysis (Breakdown by Type) - Including Dynamic Premi from JSON.
     */
    public async getPremiAnalysis(month: number, year: number, divisionCode?: string): Promise<any[]> {
        let divisionFilter = '';
        const divisionParams: any[] = [];
        if (divisionCode && divisionCode !== 'ALL') {
            const aliases = gangService.getAllDivisionAliases(divisionCode);
            divisionFilter = `AND h.division_code IN (${aliases.map(() => '?').join(',')})`;
            divisionParams.push(...aliases);
        }

        const rows = await selectPremiAnalysis(this.extendDb, {
            month, year, divisionFilter, divisionParams
        });

        if (rows.length === 0) return [];

        let totalBrondol = 0, totalPruning = 0, totalInsentif = 0, totalKinerja = 0, grandTotal = 0;
        const dynamicPremiTotals: Record<string, number> = {};

        for (const row of rows) {
            totalBrondol += row.brondol || 0;
            totalPruning += row.pruning || 0;
            totalInsentif += row.insentif || 0;
            totalKinerja += row.kinerja || 0;
            grandTotal += row.total || 0;

            if (row.dynamic_premi_data) {
                try {
                    const dynamicData = typeof row.dynamic_premi_data === 'string'
                        ? JSON.parse(row.dynamic_premi_data)
                        : row.dynamic_premi_data;

                    if (Array.isArray(dynamicData)) {
                        for (const item of dynamicData) {
                            const key = item.header || item.name || item.key || 'Unknown';
                            const value = item.total || item.value || item.amount || 0;
                            if (value > 0) {
                                dynamicPremiTotals[key] = (dynamicPremiTotals[key] || 0) + value;
                            }
                        }
                    } else if (typeof dynamicData === 'object') {
                        for (const [key, value] of Object.entries(dynamicData)) {
                            if (typeof value === 'number' && value > 0) {
                                dynamicPremiTotals[key] = (dynamicPremiTotals[key] || 0) + value;
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[DashboardService] Failed to parse dynamic_premi_data:', e);
                }
            }
        }

        const result: { name: string; value: number }[] = [
            { name: 'Brondol', value: totalBrondol },
            { name: 'Pruning', value: totalPruning },
            { name: 'Insentif', value: totalInsentif },
            { name: 'Kinerja', value: totalKinerja }
        ];

        for (const [key, value] of Object.entries(dynamicPremiTotals)) {
            const normalizedKey = key.toLowerCase().replace(/[_\s]/g, '');
            if (!['brondol', 'pruning', 'insentif', 'kinerja'].includes(normalizedKey)) {
                result.push({ name: key.replace(/_/g, ' ').toUpperCase(), value });
            }
        }

        const sumKnown = result.reduce((sum, item) => sum + item.value, 0);
        const other = grandTotal - sumKnown;
        if (other > 0) {
            result.push({ name: 'Lainnya', value: other });
        }

        return result.filter(item => item.value > 0).sort((a, b) => b.value - a.value);
    }

    /**
     * Get Premi Comparison by Division.
     */
    public async getPremiByDivision(month: number, year: number): Promise<any[]> {
        const rows = await selectPremiByDivision(this.extendDb, { month, year });

        return rows.map(r => ({
            division: r.division_code,
            brondol: r.brondol,
            pruning: r.pruning,
            insentif: r.insentif,
            kinerja: r.kinerja,
            total: r.total
        }));
    }

    /**
     * Get Overtime Analysis (Breakdown by Task Type).
     */
    public async getOvertimeAnalysis(month: number, year: number, divisionCode?: string): Promise<any[]> {
        let divisionFilter = '';
        const divisionParams: any[] = [];
        if (divisionCode && divisionCode !== 'ALL') {
            const aliases = gangService.getAllDivisionAliases(divisionCode);
            divisionFilter = `AND h.division_code IN (${aliases.map(() => '?').join(',')})`;
            divisionParams.push(...aliases);
        }

        const rows = await selectOvertimeAnalysis(this.extendDb, {
            month, year, divisionFilter, divisionParams
        });

        if (rows.length === 0) return [];

        if (divisionCode && divisionCode !== 'ALL') {
            return [{
                name: 'Total Lembur',
                value: rows[0]?.total_lembur || 0
            }];
        }

        return rows.map(r => ({
            name: r.division_code,
            value: r.total_lembur || 0
        })).filter(item => item.value > 0);
    }

    /**
     * Get Detailed Division Data (Employee List + Breakdown).
     */
    public async getDivisionDetailData(month: number, year: number, divisionCode: string): Promise<any> {
        const safeDivCode = divisionCode.replace(/[^a-zA-Z0-9]/g, '');
        const gangCondition = `g.GangCode LIKE '${safeDivCode}%'`;

        const employees = await dataExtractorService.getEmployees(gangCondition, month, year, undefined, false);

        if (!employees || employees.length === 0) {
            return { employees: [], overtimeBreakdown: [] };
        }

        const employeeList = employees.map((emp: any) => ({
            nik: emp.nik,
            emp_code: emp.emp_code,
            name: emp.nama,
            gang: emp.gang_code,
            role: emp.jabatan_estate || 'N/A',
            hk: emp.jumlah_hk || 0,
            gaji_pokok: emp.gaji_pokok_aktual || emp.gaji_pokok || 0,
            tunjangan: emp.total_tunjangan || 0,
            premi: emp.total_premi || 0,
            lembur: emp.lembur_jumlah || 0,
            potongan: emp.total_potongan_bersih || 0,
            upah_bersih: emp.upah_bersih || 0,
            lembur_jam: emp.lembur_jam || 0,
            breakdown: {
                gaji_pokok_aktual: emp.gaji_pokok_aktual || 0,
                beras_jumlah: emp.beras_jumlah || 0,
                jabatan_jumlah: emp.jabatan_jumlah || 0,
                masa_kerja_jumlah: emp.masa_kerja_jumlah || 0,
                lembur_jumlah: emp.lembur_jumlah || 0,
                total_tunjangan: emp.total_tunjangan || 0,
                total_premi: emp.total_premi || 0,
                pot_koreksi: emp.pot_koreksi || 0,
                pendapatan_lainnya: emp.pendapatan_lainnya || 0,
                pot_astek_pekerja: emp.pot_astek_pekerja || 0,
                pot_bpjs_kesehatan_pekerja: emp.pot_bpjs_kesehatan_pekerja || 0,
                pot_bpjs_pensiun_pekerja: emp.pot_bpjs_pensiun_pekerja || 0,
                pot_spsi: emp.pot_spsi || 0,
                pot_pph21: emp.pot_pph21 || 0,
                pot_premi_pph: emp.pot_premi_pph || 0,
                upah_kotor: emp.upah_kotor || 0,
                jumlah_upah_kotor: emp.jumlah_upah_kotor || 0,
                total_potongan: emp.total_potongan || 0,
                upah_bersih: emp.upah_bersih || 0
            },
            premi_items: (() => {
                const map = new Map();
                for (const d of (emp.premi_details || [])) {
                    const key = d.normalized_key || d.doc_desc || 'LAINNYA';
                    const label = d.task_desc || d.doc_desc || key;
                    const cur = map.get(key) || { key, label, amount: 0 };
                    cur.amount += Number(d.amount) || 0;
                    map.set(key, cur);
                }
                return [...map.values()].filter(x => x.amount > 0).sort((a, b) => b.amount - a.amount);
            })()
        }));

        const otMap = new Map<string, { hours: number, amount: number, count: number }>();

        employees.forEach((emp: any) => {
            if (emp.lembur_records && Array.isArray(emp.lembur_records)) {
                emp.lembur_records.forEach((rec: any) => {
                    const taskDesc = rec.task_desc || rec.task_code || 'LAINNYA';
                    const current = otMap.get(taskDesc) || { hours: 0, amount: 0, count: 0 };
                    current.hours += (rec.hours || 0);
                    current.amount += (rec.amount || 0);
                    current.count += 1;
                    otMap.set(taskDesc, current);
                });
            }
        });

        const overtimeBreakdown = Array.from(otMap.entries())
            .map(([name, data]) => ({
                name,
                value: data.amount,
                hours: data.hours,
                count: data.count
            }))
            .sort((a, b) => b.value - a.value);

        return {
            employees: employeeList,
            overtimeBreakdown
        };
    }

    /**
     * Get Gang Comparison Data with Production from Mill.
     */
    public async getGangComparison(
        month: number,
        year: number,
        divisionCode?: string,
        gangScope?: string
    ) {
        let scopeFilter = '';
        let divisionFilter = '';
        const params: any[] = [];

        if (gangScope === 'panen' || gangScope === 'maintenance' || gangScope === 'transport') {
            scopeFilter = ` AND ` + scopeGangSql('agg.gang_code', gangScope);
        }

        if (divisionCode && divisionCode !== 'ALL') {
            if (divisionCode === 'IJL') {
                divisionFilter = " AND agg.division_code LIKE 'L%'";
            } else if (divisionCode === 'NON_IJL') {
                divisionFilter = " AND agg.division_code NOT LIKE 'L%'";
            } else {
                const aliases = gangService.getAllDivisionAliases(divisionCode);
                divisionFilter = ` AND agg.division_code IN (${aliases.map(() => '?').join(',')})`;
                params.push(...aliases);
            }
        }

        const aggData = await selectGangComparison(this.extendDb, {
            month, year, scopeFilter, divisionFilter, params
        });

        const productionMap = await this.getGangProduction(month, year);
        const bunchesMap = await this.getHarvesterBunches(month, year);

        const mergedData = aggData.map(row => {
            const cleanGangCode = row.gang_code.trim();
            const realProductionKg = productionMap.get(cleanGangCode) || 0;
            const totalProduction = row.total_production_db > 0 ? row.total_production_db : realProductionKg;

            const bunchesData = bunchesMap.get(cleanGangCode);
            const totalBunches = bunchesData?.totalBunches || 0;
            const harvesterCount = bunchesData?.employeeCount || 0;

            const costPerHk = row.total_hk > 0 ? row.total_wage / row.total_hk : 0;
            const costPerTon = null;

            return {
                gang_code: cleanGangCode,
                gang_description: row.gang_description,
                gang_type: 'uncategorized',
                total_wage: row.total_wage,
                total_hk: row.total_hk,
                headcount: row.headcount,
                total_ot: row.total_ot,
                total_premi: row.total_premi,
                total_production: totalProduction,
                total_ffb_bunches: totalBunches,
                harvester_count: harvesterCount,
                cost_per_hk: costPerHk,
                cost_per_ton: costPerTon,
                cost_per_ton_note: 'Cost/ton valid per divisi, bukan per gang (tonase = properti divisi)'
            };
        });

        return mergedData.sort((a, b) => b.cost_per_hk - a.cost_per_hk);
    }

    /**
     * Fetch Production Data (NetWeight) from WM_TICKET aggregated by Transport Gang (via Driver).
     */
    public async getGangProduction(month: number, year: number): Promise<Map<string, number>> {
        const gangProduction = new Map<string, number>();
        const dbMill = Database.getMillInstance();
        const dbPayroll = Database.getInstance();

        try {
            const driverWeights = await selectDriverWeights(dbMill, { month, year });

            if (driverWeights.length === 0) return gangProduction;

            const driverCodes = [...new Set(driverWeights.map(d => d.DriverCode))];

            const driverGangMap = new Map<string, string>();

            if (driverCodes.length > 0) {
                const mappings = await selectDriverGangMapping(dbPayroll, { driverCodes });
                mappings.forEach(m => {
                    driverGangMap.set(m.EmpCode, m.GangCode);
                });
            }

            for (const dw of driverWeights) {
                const gangCode = driverGangMap.get(dw.DriverCode.trim());
                if (gangCode) {
                    const current = gangProduction.get(gangCode) || 0;
                    const weight = Number(dw.TotalWeight) || 0;
                    gangProduction.set(gangCode, current + weight);
                }
            }
        } catch (error) {
            console.error("[DashboardService] Error fetching gang production:", error);
        }

        return gangProduction;
    }

    /**
     * Get Harvester FFB Bunches Data.
     */
    private async getHarvesterBunches(month: number, year: number): Promise<Map<string, { totalBunches: number; employeeCount: number }>> {
        const gangBunches = new Map<string, { totalBunches: number; employeeCount: number }>();
        const dbHarvester = Database.getInstance();

        try {
            const rows = await selectHarvesterBunches(dbHarvester, { month, year });

            for (const row of rows) {
                const gangCode = row.GangCode?.trim() || "";
                if (gangCode) {
                    gangBunches.set(gangCode, {
                        totalBunches: row.TotalBunches || 0,
                        employeeCount: row.EmpCount || 0
                    });
                }
            }
        } catch (error) {
            console.error("[DashboardService] Error fetching harvester bunches:", error);
        }

        return gangBunches;
    }

    /**
     * Get Top and Bottom Performing Gangs.
     */
    public async getTopBottomGangs(month: number, year: number, divisionCode?: string, gangScope?: string): Promise<{ top: any[], bottom: any[] }> {
        const allGangs = await this.getGangComparison(month, year, divisionCode, gangScope);
        const validGangs = allGangs.filter(g => g.cost_per_hk > 0);
        const sortedAsc = [...validGangs].sort((a, b) => a.cost_per_hk - b.cost_per_hk);

        return {
            top: sortedAsc.slice(0, 5),
            bottom: sortedAsc.slice(-5).reverse()
        };
    }

    /**
     * Get Gang History (Last 6 Months).
     */
    public async getGangHistory(gangCode: string, endMonth: number, endYear: number): Promise<any[]> {
        const rows = await selectGangHistory(this.extendDb, { gangCode, endMonth, endYear });
        return rows.reverse();
    }

    /**
     * Get All Gangs Trend (Last 6 Months) — multi-gang comparison.
     */
    public async getAllGangsTrend(endMonth: number, endYear: number, divisionCode?: string, gangScope?: string): Promise<any[]> {
        let startYear = endYear;
        let startMonth = endMonth - 5;
        if (startMonth <= 0) {
            startYear -= 1;
            startMonth += 12;
        }

        let divisionFilter = '';
        const scopeFilter = (gangScope === 'panen' || gangScope === 'maintenance' || gangScope === 'transport')
            ? scopeGangSql('h.gang_code', gangScope) + ' AND'
            : '';
        const params: any[] = [];

        if (divisionCode && divisionCode !== 'ALL') {
            divisionFilter = ' ' + divisionGangSubqueryFilter('h.gang_code');
            params.push(divisionCode);
        }

        return selectAllGangsTrend(this.extendDb, {
            startYear, startMonth, endYear, endMonth, scopeFilter, divisionFilter, params
        });
    }

    public async getTonaseAnalysisReport(month: number, year: number, divisionCode?: string): Promise<any> {
        return getTonaseAnalysisReportExtracted(month, year, divisionCode);
    }
}

export const dashboardService = DashboardService.getInstance();
