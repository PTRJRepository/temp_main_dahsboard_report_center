/**
 * @module backend/src/api/taxReport.excelRoutes.ts
 * @purpose Excel download route group for /tax-report: monthly/excel, monthly/excel/progressive,
 *            monthly/excel/fast, monthly/excel/dom.
 * @input Query: year, month, division, gang, gangPrefix, use_history, snapshot_version, value_priority_mode;
 *            DOM POST receives employee rows from frontend.
 * @output Excel binary (xlsx) as Response with Content-Disposition attachment header.
 * @depends ./taxReport.shared (getUserFromHeader, resolveTaxExcelScopeLabels, sanitizeForFilename),
 *            ../services/{taxReportService, taxReportExcelService, ptkpTaxService, employeeEstateService,
 *            historyDatabaseService, summaryService}, ../utils/{taxReportQuery, taxReportIdentity, taxDomExportRows,
 *            payrollPeriodAdjustments, otherIncomeCanonical}
 * @sideeffect Reads payroll data via DataExtractorService; forces Bun.gc after large Excel generation.
 * @tests none — Excel endpoints exercised manually / via frontend.
 */
import { Elysia, t } from "elysia";
import { info, warn, error as logError } from "../utils/logger";
const CATEGORY = "TaxReportExcelRoutes";
import { divisionConfigService } from "../services/config/DivisionConfigService";
import { taxReportService, TAX_COMPONENT_METADATA } from "../services/taxReportService";
import { generateMonthlyTaxExcel } from "../services/taxReportExcelService";
import { ptkpTaxService } from "../services/ptkpTaxService";
import { EmployeeEstateService } from "../services/employeeEstateService";
import { historyDatabaseService } from "../services/historyDatabaseService";
import { resolveMonthlyTaxQuery } from "../utils/taxReportQuery";
import { collectNikLookupKeys, resolveReportIdentity, applyReportIdentity } from "../utils/taxReportIdentity";
import { prepareDomTaxExcelRows } from "../utils/taxDomExportRows";
import {
    attachPayrollPeriodAdjustmentNotes,
    resolveAdjustedJabatanJumlah,
    shouldForcePotPph21ToTer
} from "../utils/payrollPeriodAdjustments";
import { getCanonicalOtherIncomeType } from "../utils/otherIncomeCanonical";

/**
 * Shared row helpers for the progressive + fast Excel handlers.
 * Previously defined identically inside both handlers.
 */
const createTaxRowHelpers = {
    deriveJabatanFromGang: (gangCode: string): string => {
        if (!gangCode || gangCode.trim().length === 0) return 'Karyawan';
        const lastChar = gangCode.trim().slice(-1).toUpperCase();
        switch (lastChar) {
            case 'H': return 'Karyawan Panen';
            case 'P': return 'Karyawan Percobaan';
            case 'T': return 'Operator';
            case 'N': return 'Karyawan Nursery';
            case 'G': return 'Kerani Gudang';
            case 'M': return 'Karyawan Perawatan';
            default: return 'Karyawan';
        }
    },
    extractParentName: (rawName: string): { empName: string; parentName: string } => {
        const match = rawName.match(/^(.+?)\s*\((.+?)\)\s*$/);
        if (match) return { empName: match[1].trim(), parentName: match[2].trim() };
        return { empName: rawName, parentName: '' };
    },
    normalizePremiKey: (key: string): string => {
        return String(key).toUpperCase().replace(/_/g, ' ').trim();
    }
};
import {
    getUserFromHeader,
    resolveTaxExcelScopeLabels,
    sanitizeForFilename
} from "./taxReport.shared";

export const excelRoutes = new Elysia()
    .derive(async ({ headers }) => {
        const user = await getUserFromHeader(headers);
        return { currentUser: user };
    })
    .onBeforeHandle(({ currentUser, set }) => {
        if (!currentUser) {
            set.status = 401;
            return { message: "Unauthorized" };
        }
    })

    // ========================================================
    // GET /tax-report/monthly/excel
    // Download Monthly PPH21 tax report as Excel with formulas
    // Uses the same source-selection contract as Daftar Upah via use_history
    // ========================================================
    .get("/monthly/excel", async ({ query, set, currentUser }) => {
        try {
            const resolved = resolveMonthlyTaxQuery(query as any, currentUser);

            info(CATEGORY, `[TaxReport Excel] Request: year=${resolved.year}, month=${resolved.month}, division=${resolved.division}, gang=${resolved.gang}`);

            if (!resolved.hasValidPeriod) {
                set.status = 400;
                return { error: "Invalid year or month parameter" };
            }

            const data = await taxReportService.getMonthlyTaxReport(
                resolved.year,
                resolved.month,
                resolved.division,
                resolved.gang,
                resolved.gangPrefix,
                resolved.useHistoryDb,
                resolved.snapshotVersion,
                resolved.valuePriorityMode
            );

            info(CATEGORY, `[TaxReport Excel] Data fetched: ${data?.employees?.length || 0} employees`);

            if (!data || data.employees.length === 0) {
                set.status = 404;
                return { error: "No data available for the selected period" };
            }

            const gangLabel = resolved.gang || resolved.gangPrefix || 'ALL';
            const scopeLabels = await resolveTaxExcelScopeLabels({
                division: resolved.division || 'ALL',
                gang: resolved.gang,
                gangPrefix: resolved.gangPrefix,
                employees: data.employees
            });

            // Generate Excel Buffer (pass premiKeys for dynamic column headers)
            const excelBuffer = await generateMonthlyTaxExcel(data, resolved.year, resolved.month, resolved.division || 'ALL', gangLabel, data.premiKeys, scopeLabels);

            info(CATEGORY, `[TaxReport Excel] Excel generated: ${excelBuffer?.length || 0} bytes, type: ${typeof excelBuffer}`);

            if (!excelBuffer || excelBuffer.length === 0) {
                set.status = 500;
                return { error: "Failed to generate Excel buffer" };
            }

            const filename = `PPH21_${scopeLabels.filenameDivision}_${scopeLabels.filenameGang}_${resolved.month}_${resolved.year}.xlsx`;
            set.headers["Content-Type"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            set.headers["Content-Disposition"] = `attachment; filename="${filename}"`;

            return excelBuffer;
        } catch (error: any) {
            logError(CATEGORY, "[TaxReport] Error generating Excel report:", error);
            set.status = 500;
            return { error: error.message || "Failed to generate Excel report" };
        }
    }, {
        query: t.Object({
            year: t.String(),
            month: t.String(),
            division: t.Optional(t.String()),
            gang: t.Optional(t.String()),
            gangPrefix: t.Optional(t.String()),
            use_history: t.Optional(t.String()),
            snapshot_version: t.Optional(t.String()),
            value_priority_mode: t.Optional(t.String())
        })
    })

    // ========================================================
    // GET /tax-report/monthly/excel/progressive
    // Download Monthly PPH21 using progressive extraction (avoids timeout)
    // Uses dataExtractorService.extractPayrollDataProgressive() with the same source policy as Daftar Upah
    // ========================================================
    .get("/monthly/excel/progressive", async ({ query, set, currentUser }) => {
        try {
            const resolved = resolveMonthlyTaxQuery(query as any, currentUser);
            let division = resolved.division;
            const gang = resolved.gang;
            const gangPrefix = resolved.gangPrefix;

            info(CATEGORY, `[TaxReport Excel Progressive] Request: year=${resolved.year}, month=${resolved.month}, division=${division}, gang=${gang}, gangPrefix=${gangPrefix}, useHistory=${resolved.useHistoryDb}, snapshotVersion=${resolved.snapshotVersion ?? 'latest'}, valuePriorityMode=${resolved.valuePriorityMode}`);

            if (!resolved.hasValidPeriod) {
                set.status = 400;
                return { error: "Invalid year or month parameter" };
            }

            // Import services here to avoid circular deps
            const { DataExtractorService } = await import("../services/dataExtractorService");
            const { Config } = await import("../config");
            const { mapPTKPToTER } = await import("../services/ptkpTaxService");
            const { getCarumanForPph21 } = await import("../services/carumanDefinitions");
            const { EmployeeEstateService } = await import("../services/employeeEstateService");
            const { OtherIncomesService } = await import("../services/otherIncomesService");
            const { ptkpTaxService } = await import("../services/ptkpTaxService");

            const dataExtractor = DataExtractorService.getInstance();

            // Resolve virtual division
            let effectiveDivision = division;
            let effectiveGangPrefix = gangPrefix;
            if (division && divisionConfigService.isVirtualDivision(division)) {
                const sourceDivisions = divisionConfigService.getSourceDivisions(division);
                effectiveDivision = sourceDivisions[0];
                if (!effectiveGangPrefix) {
                    const vDef = divisionConfigService.getDivision(division);
                    const alphaMatch = vDef?.gangPattern?.source.match(/[\/\^]?([A-Za-z]+)/);
                    if (alphaMatch && alphaMatch[1]) {
                        effectiveGangPrefix = alphaMatch[1];
                    }
                }
                info(CATEGORY, `[TaxReport Excel Progressive] Virtual division ${division} resolved to ${effectiveDivision}`);
            }

            // Get PTKP data
            const ptkpMaster = await ptkpTaxService.getPtkpByYear(resolved.year);
            const ptkpMap = new Map<string, string>();
            for (const p of ptkpMaster) {
                ptkpMap.set(p.emp_code.trim(), p.ptkp_status);
            }

            // Get jabatan map
            const jabatanMap: Record<string, string> = {};
            try {
                const jobTitlesResult = await EmployeeEstateService.getEmployeeJobsWithNik();
                if (jobTitlesResult && jobTitlesResult.empcodeMap) {
                    for (const [empCode, jabatan] of Object.entries(jobTitlesResult.empcodeMap)) {
                        jabatanMap[empCode] = jabatan || '';
                    }
                }
            } catch (e) {
                warn(CATEGORY, '[TaxReport Excel Progressive] Failed to get jabatan map:', e);
            }

            // Get other incomes for the year
            const dbOtherIncomesYear = await OtherIncomesService.getIncomesForYear(resolved.year, effectiveDivision, gang);
            const dbIncomeByMonthNik = new Map<string, { thr: number; bonus: number; kontan: number; custom: number }>();
            for (const inc of dbOtherIncomesYear) {
                if (inc.is_taxable) {
                    const nikKeys = collectNikLookupKeys(inc);
                    const type = getCanonicalOtherIncomeType(inc);
                    const amt = Number(inc.amount) || 0;
                    for (const nik of nikKeys) {
                        const monthKey = `${inc.period_month}_${nik}`;
                        if (!dbIncomeByMonthNik.has(monthKey)) dbIncomeByMonthNik.set(monthKey, { thr: 0, bonus: 0, kontan: 0, custom: 0 });
                        const mData = dbIncomeByMonthNik.get(monthKey)!;
                        if (type === 'THR') mData.thr += amt;
                        else if (type === 'KONTAN') mData.kontan += amt;
                        else if (type === 'BONUS') mData.bonus += amt;
                        else mData.custom += amt;
                    }
                }
            }

            // Helper: derive jabatan from gang code
            const deriveJabatanFromGang = createTaxRowHelpers.deriveJabatanFromGang;

            // Helper: extract parent name from parentheses
            const extractParentName = createTaxRowHelpers.extractParentName;

            // Helper: normalize premi key
            const normalizePremiKey = createTaxRowHelpers.normalizePremiKey;

            // Determine the gang code to use
            // If user selected a specific gang (e.g., "F1BHL"), use that gang
            // Otherwise use "ALL" with gangPrefix to get all gangs in the division
            const targetGangCode = gang && gang.trim() !== '' && gang !== 'ALL' ? gang.trim().toUpperCase() : "ALL";

            info(CATEGORY, `[TaxReport Excel Progressive] Target gang: ${targetGangCode} (user selected: ${gang})`);

            // Collect all employees from progressive stream
            const allEmployees: any[] = [];
            const processedEmpCodes = new Set<string>();

            // Use progressive extraction - filter by specific gang if selected
            const progressiveStream = dataExtractor.extractPayrollDataProgressive(
                resolved.month, resolved.year, targetGangCode, effectiveDivision,
                Config.DB_PROFILE, targetGangCode === "ALL" ? effectiveGangPrefix : undefined, resolved.useHistoryDb, resolved.snapshotVersion, resolved.valuePriorityMode
            );

            for await (const chunk of progressiveStream) {
                // Accumulate all employees from all phases
                for (const [gangCode, gangEmployees] of chunk.gangs) {
                    // If user selected a specific gang, only process that gang
                    if (targetGangCode !== "ALL" && gangCode.toUpperCase() !== targetGangCode) {
                        continue;
                    }
                    for (const emp of gangEmployees) {
                        const dedupKey = (emp.emp_code || emp.nik || emp.actual_nik || '').trim().toUpperCase();
                        if (dedupKey && !processedEmpCodes.has(dedupKey)) {
                            processedEmpCodes.add(dedupKey);
                            allEmployees.push(emp);
                        }
                    }
                }
                info(CATEGORY, `[TaxReport Excel Progressive] Stream phase ${chunk.phase}: accumulated ${allEmployees.length} employees`);
            }

            info(CATEGORY, `[TaxReport Excel Progressive] Total accumulated: ${allEmployees.length} employees`);

            if (allEmployees.length === 0) {
                set.status = 404;
                return { error: "No data available for the selected period" };
            }

            // Filter active employees (jumlah_hk > 0 OR Income > 0)
            // This matches the filtering logic in the Wages Report UI (PayrollAggregator).
            const activeEmployees = allEmployees.filter((r: any) => {
                const hk = Number(r.jumlah_hk || r.hk || 0);
                const hasIncome = Number(r.jumlah_upah_kotor || 0) > 0;
                return hk > 0 || hasIncome;
            });

            info(CATEGORY, `[TaxReport Excel Progressive] Active employees (HK > 0 OR Income > 0): ${activeEmployees.length}`);

            // Transform to MonthlyTaxRow format
            const employees: any[] = [];
            let totalPph21 = 0;
            const brondolSubKeys = ['BRONDOL LOOSEFRUIT', 'BRONDOL TOTAL', 'BRONDOL ADTRANS',
                'BRONDOL_LOOSEFRUIT', 'BRONDOL_TOTAL', 'BRONDOL_ADTRANS',
                'brondol_loosefruit', 'brondol_total', 'brondol_adtrans',
                'brondol loosefruit', 'brondol total', 'brondol adtrans'];
            const skipKeys = ['koreksi', 'KOREKSI', 'total', 'TOTAL'];

            for (let idx = 0; idx < activeEmployees.length; idx++) {
                const row = activeEmployees[idx];
                const empCodeTrimmed = (row.emp_code || '').trim();
                const masterPtkp = ptkpMap.get(empCodeTrimmed) || row.status_ptkp || 'TK/0';
                const kategoriTer = mapPTKPToTER(masterPtkp);

                const gajiPokokAktual = row.gaji_pokok_aktual || row.gaji_pokok || 0;
                const upahDasar = row.upah_dasar || 0;
                const tunjanganBeras = row.beras_jumlah || 0;
                const tunjanganJabatan = row.jabatan_jumlah || 0;
                const tunjanganMasaKerja = row.masa_kerja_jumlah || 0;
                const tunjanganLembur = row.lembur_jumlah || 0;
                const totalPremi = row.total_premi || 0;

                const pph21Caruman = getCarumanForPph21(upahDasar, tunjanganMasaKerja);
                const astek084 = pph21Caruman.astek_majikan_084;
                const bpjsKesehatanMajikan4Pct = pph21Caruman.bpjs_kes_majikan_4;
                const carumanBase = pph21Caruman.base;

                const penghasilanBruto = Number(row.penghasilan_bruto) || 0;
                // [FIXED 2026-04-08] Prioritize pph21_ter to match UI "Pajak" column exactly
                const pph21 = Number(row.pph21_ter) || Number(row.pot_pph21) || 0;
                const tarifPajakTer = Number(row.tarif_pajak_ter) || 0;
                totalPph21 += pph21;

                const reportIdentity = resolveReportIdentity(row);
                const rawEmpNikForBonus = String(reportIdentity.new_nik || reportIdentity.nik || row.nik_ktp || row.nik || '').trim().toUpperCase();

                // Build other incomes
                let empOtherIncomes: { type: string; name: string; amount: number }[] = [];
                for (const [key, mData] of dbIncomeByMonthNik) {
                    const [mStr, nikStr] = key.split('_');
                    if (nikStr === rawEmpNikForBonus && parseInt(mStr) === resolved.month) {
                        if (mData.thr > 0) empOtherIncomes.push({ type: 'THR', name: 'THR', amount: mData.thr });
                        if (mData.bonus > 0) empOtherIncomes.push({ type: 'BONUS', name: 'PENDAPATAN BONUS', amount: mData.bonus });
                        if (mData.kontan > 0) empOtherIncomes.push({ type: 'KONTAN', name: 'KONTANAN', amount: mData.kontan });
                        if (mData.custom > 0) empOtherIncomes.push({ type: 'CUSTOM', name: 'Custom', amount: mData.custom });
                    }
                }

                const empThrAmount = empOtherIncomes.filter((i: any) => i.type === 'THR').reduce((s: number, i: any) => s + i.amount, 0);
                const empBonusAmount = empOtherIncomes.filter((i: any) => i.type === 'BONUS').reduce((s: number, i: any) => s + i.amount, 0);
                const empKontanAmount = empOtherIncomes.filter((i: any) => i.type === 'KONTAN').reduce((s: number, i: any) => s + i.amount, 0);
                const empOtherIncomeAmount = empOtherIncomes.filter((i: any) => i.type === 'CUSTOM').reduce((s: number, i: any) => s + i.amount, 0);

                // Build premi detail
                const premiDetail: Record<string, number> = {};
                let consolidatedBrondol = 0;
                let hasBrondolFromDetail = false;

                if (row.premi && typeof row.premi === 'object' && !Array.isArray(row.premi)) {
                    for (const [key, value] of Object.entries(row.premi)) {
                        const val = Number(value) || 0;
                        if (val <= 0) continue;
                        if (skipKeys.includes(key)) continue;
                        const upperKey = normalizePremiKey(key);
                        if (brondolSubKeys.some(bk => upperKey === bk.toUpperCase())) {
                            consolidatedBrondol += val;
                            continue;
                        }
                        if (upperKey === 'BRONDOL') {
                            consolidatedBrondol += val;
                            hasBrondolFromDetail = true;
                            continue;
                        }
                        premiDetail[upperKey] = (premiDetail[upperKey] || 0) + val;
                    }
                }

                if (row.premi_detail && typeof row.premi_detail === 'object' && !Array.isArray(row.premi_detail)) {
                    for (const [key, value] of Object.entries(row.premi_detail)) {
                        const val = Number(value) || 0;
                        if (val <= 0) continue;
                        const upperKey = normalizePremiKey(key);
                        if (brondolSubKeys.some(bk => upperKey === bk.toUpperCase())) {
                            consolidatedBrondol += val;
                            continue;
                        }
                        if (upperKey === 'BRONDOL' && !hasBrondolFromDetail) {
                            consolidatedBrondol += val;
                            hasBrondolFromDetail = true;
                            continue;
                        }
                        if (!premiDetail[upperKey]) {
                            premiDetail[upperKey] = val;
                        }
                    }
                }

                const brondolFinal = consolidatedBrondol > 0 ? consolidatedBrondol : (row.premi_brondol || 0);
                if (brondolFinal > 0) {
                    premiDetail['BRONDOL'] = brondolFinal;
                }

                // Resolve jabatan
                let resolvedJabatan = jabatanMap[empCodeTrimmed] || '';
                if (!resolvedJabatan) {
                    resolvedJabatan = deriveJabatanFromGang(row.gang_code || '');
                }

                const { empName, parentName } = extractParentName(row.nama || row.emp_name || '');

                employees.push({
                    no: idx + 1,
                    emp_code: row.emp_code,
                    emp_name: empName,
                    parent_name: parentName,
                    nik: reportIdentity.nik,
                    new_nik: reportIdentity.new_nik,
                    npwp: reportIdentity.npwp,
                    alamat: reportIdentity.alamat,
                    jabatan: resolvedJabatan,
                    gender: String(row.jenis_kelamin || row.gender || '1'),
                    status_ptkp: masterPtkp,
                    kategori_ter: kategoriTer,
                    gang_code: row.gang_code || '',
                    upah_kotor: row.jumlah_upah_kotor || row.upah_kotor || 0,
                    penghasilan_bruto: row.penghasilan_bruto || penghasilanBruto,
                    tarif_pajak_ter: row.tarif_pajak_ter || tarifPajakTer,
                    pph21_ter: pph21,
                    pot_pph21: row.pot_pph21 || 0,
                    hk: row.jumlah_hk || row.hk || 0,
                    gaji_pokok_aktual: gajiPokokAktual,
                    koreksi_hk: row.koreksi_hk || 0,
                    tunjangan_beras: tunjanganBeras,
                    tunjangan_jabatan: tunjanganJabatan,
                    tunjangan_masa_kerja: tunjanganMasaKerja,
                    tunjangan_lembur: tunjanganLembur,
                    total_tunjangan: row.total_tunjangan || 0,
                    premi_detail: premiDetail,
                    premi_brondol: row.premi_brondol || 0,
                    premi_pph: row.premi_pph || 0,
                    total_premi: totalPremi,
                    pot_spsi: row.pot_spsi || 0,
                    pot_koreksi: row.pot_koreksi || 0,
                    total_potongan_kotor: row.pot_koreksi || 0,
                    bpjs_kes_majikan: bpjsKesehatanMajikan4Pct,
                    astek_jht_majikan: astek084,
                    other_incomes: empOtherIncomes,
                    thr_amount: empThrAmount,
                    exgratia_amount: empBonusAmount,
                    bonus_amount: empBonusAmount,
                    kontanan_amount: empKontanAmount,
                    pendapatan_thr: empThrAmount,
                    pendapatan_bonus: empBonusAmount,
                    pendapatan_kontan: empKontanAmount,
                    other_income_amount: empOtherIncomeAmount,
                    pendapatan_tidak_tetap_thp: empThrAmount + empBonusAmount + empKontanAmount + empOtherIncomeAmount,
                    upah_dasar: upahDasar,
                    gaji_pokok_ideal: row.gaji_pokok_ideal || 0,
                    carumanBase: carumanBase
                });
            }

            info(CATEGORY, `[TaxReport Excel Progressive] Transformed ${employees.length} employees, total_pph21=${totalPph21}`);

            const gangLabel = gang || gangPrefix || 'ALL';
            const scopeLabels = await resolveTaxExcelScopeLabels({
                division: division || 'ALL',
                gang,
                gangPrefix,
                employees
            });

            // Generate Excel
            const excelBuffer = await generateMonthlyTaxExcel(
                { employees, period: { month: resolved.month, year: resolved.year }, total_pph21: totalPph21 },
                resolved.year, resolved.month, division || 'ALL', gangLabel, undefined, scopeLabels
            );

            if (!excelBuffer || excelBuffer.length === 0) {
                set.status = 500;
                return { error: "Failed to generate Excel buffer" };
            }

            const filename = `PPH21_${scopeLabels.filenameDivision}_${scopeLabels.filenameGang}_${resolved.month}_${resolved.year}.xlsx`;
            set.headers["Content-Type"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            set.headers["Content-Disposition"] = `attachment; filename="${filename}"`;

            return excelBuffer;
        } catch (error: any) {
            logError(CATEGORY, "[TaxReport Excel Progressive] Error:", error);
            set.status = 500;
            return { error: error.message || "Failed to generate Excel report" };
        }
    }, {
        query: t.Object({
            year: t.String(),
            month: t.String(),
            division: t.Optional(t.String()),
            gang: t.Optional(t.String()),
            gangPrefix: t.Optional(t.String()),
            use_history: t.Optional(t.String()),
            snapshot_version: t.Optional(t.String()),
            value_priority_mode: t.Optional(t.String())
        })
    })

    // ========================================================
    // GET /tax-report/monthly/excel/fast
    // FAST tax report using DataExtractorService (same as Daftar Upah)
    // Respects use_history parameter to ensure data consistency with Daftar Upah
    // ========================================================
    .get("/monthly/excel/fast", async ({ query, set, currentUser }) => {
        try {
            const startTime = Date.now();
            const resolved = resolveMonthlyTaxQuery(query as any, currentUser);
            const year = resolved.year;
            const month = resolved.month;
            const division = resolved.division;
            const gang = resolved.gang;
            const gangPrefix = resolved.gangPrefix;
            const useHistoryDb = resolved.useHistoryDb;
            const snapshotVersion = resolved.snapshotVersion;
            const valuePriorityMode = resolved.valuePriorityMode;

            info(CATEGORY, `[TaxReport Excel FAST] Request: year=${year}, month=${month}, division=${division}, gang=${gang}, useHistory=${useHistoryDb}, snapshotVersion=${snapshotVersion ?? 'latest'}, valuePriorityMode=${valuePriorityMode}`);

            if (!resolved.hasValidPeriod) {
                set.status = 400;
                return { error: "Invalid year or month parameter" };
            }

            // Import services
            const { mapPTKPToTER } = await import("../services/ptkpTaxService");
            const { getCarumanForPph21 } = await import("../services/carumanDefinitions");
            const { EmployeeEstateService } = await import("../services/employeeEstateService");
            const { OtherIncomesService } = await import("../services/otherIncomesService");
            const { ptkpTaxService } = await import("../services/ptkpTaxService");
            const { DataExtractorService } = await import("../services/dataExtractorService");
            const { Config } = await import("../config");

            // Resolve gang/division
            const targetGangCode = gang && gang.trim() !== '' && gang !== 'ALL' ? gang.trim().toUpperCase() : undefined;

            info(CATEGORY, `[TaxReport Excel FAST] Using DataExtractorService (same as Daftar Upah): gang=${targetGangCode || 'ALL'}, division=${division || 'ALL'}, prefix=${gangPrefix || 'none'}, useHistory=${useHistoryDb}, snapshotVersion=${snapshotVersion ?? 'latest'}, valuePriorityMode=${valuePriorityMode}`);

            // Use DataExtractorService EXACTLY like Daftar Upah - same data source, same logic
            // This ensures Excel export matches exactly what appears in Daftar Upah
            const extractorResult = await DataExtractorService.getInstance().extractPayrollData(
                month, year,
                targetGangCode || "ALL",
                division,
                null,
                Config.DB_PROFILE,
                false, // skipDetailRecords
                useHistoryDb, // Use the same useHistoryDb parameter as Daftar Upah
                gangPrefix,
                false,  // skipHarvest [FIXED 2026-04-08]: Must match UI logic
                false,
                snapshotVersion,
                valuePriorityMode
            );

            if (!extractorResult.data_rows || extractorResult.data_rows.length === 0) {
                logError(CATEGORY, `[TaxReport Excel FAST] No data returned from DataExtractorService!`);
                set.status = 404;
                return { error: "No data available for the selected period" };
            }

            const historyData = {
                data_rows: extractorResult.data_rows,
                dynamic_premi_headers: extractorResult.dynamic_premi_headers || [],
                dynamic_potongan_headers: extractorResult.dynamic_potongan_headers || [],
                premi_title_map: extractorResult.premi_title_map || {},
                potongan_title_map: extractorResult.potongan_title_map || {},
                meta: {
                    execution_time_ms: 0,
                    row_count: extractorResult.data_rows.length,
                    is_history_snapshot: Boolean(extractorResult.meta?.is_history_snapshot),
                    snapshot_version: extractorResult.meta?.snapshot_version ?? null,
                    requested_snapshot_version: extractorResult.meta?.requested_snapshot_version ?? null,
                    available_snapshot_versions: extractorResult.meta?.available_snapshot_versions ?? []
                }
            };
            info(CATEGORY, `[TaxReport Excel FAST] DataExtractor: ${historyData.data_rows.length} rows, same as Daftar Upah`);

            // Effective division for other incomes lookup
            const effectiveDivisionForSecondary = division;

            // Get PTKP data
            info(CATEGORY, `[TaxReport Excel FAST] Fetching PTKP data for year ${year}...`);
            const ptkpMaster = await ptkpTaxService.getPtkpByYear(year);
            const ptkpMap = new Map<string, string>();
            for (const p of ptkpMaster) {
                ptkpMap.set(p.emp_code.trim(), p.ptkp_status);
            }
            info(CATEGORY, `[TaxReport Excel FAST] PTKP map has ${ptkpMap.size} entries`);

            // COLLECT unique emp_codes for optimized lookups
            const allInitialEmpCodes = Array.from(new Set(extractorResult.data_rows.map(r => (r.emp_code || '').trim()).filter(Boolean)));
            info(CATEGORY, `[TaxReport Excel FAST] Found ${allInitialEmpCodes.length} unique employee codes`);

            // Get jabatan map (OPTIMIZED with filter)
            const jabatanMap: Record<string, string> = {};
            try {
                info(CATEGORY, `[TaxReport Excel FAST] Fetching jabatan for ${allInitialEmpCodes.length} employees...`);
                const jobTitlesResult = await EmployeeEstateService.getEmployeeJobsWithNik(allInitialEmpCodes);
                if (jobTitlesResult && jobTitlesResult.empcodeMap) {
                    for (const [empCode, jabatan] of Object.entries(jobTitlesResult.empcodeMap)) {
                        jabatanMap[empCode] = jabatan || '';
                    }
                }
                info(CATEGORY, `[TaxReport Excel FAST] Jabatan map has ${Object.keys(jabatanMap).length} entries`);
            } catch (e: any) {
                warn(CATEGORY, '[TaxReport Excel FAST] Failed to get jabatan map:', e?.message || e);
            }

            // Get other incomes for the year
            info(CATEGORY, `[TaxReport Excel FAST] Fetching other incomes for year ${year}, division ${effectiveDivisionForSecondary}...`);
            const dbOtherIncomesYear = await OtherIncomesService.getIncomesForYear(year, effectiveDivisionForSecondary, gang);
            info(CATEGORY, `[TaxReport Excel FAST] Found ${dbOtherIncomesYear.length} other income records`);
            
            const dbIncomeByMonthNik = new Map<string, { thr: number; bonus: number; kontan: number; custom: number }>();
            for (const inc of dbOtherIncomesYear) {
                if (inc.is_taxable) {
                    const nikKeys = collectNikLookupKeys(inc);
                    const type = getCanonicalOtherIncomeType(inc);
                    const amt = Number(inc.amount) || 0;
                    for (const nik of nikKeys) {
                        const monthKey = `${inc.period_month}_${nik}`;
                        if (!dbIncomeByMonthNik.has(monthKey)) dbIncomeByMonthNik.set(monthKey, { thr: 0, bonus: 0, kontan: 0, custom: 0 });
                        const mData = dbIncomeByMonthNik.get(monthKey)!;
                        if (type === 'THR') mData.thr += amt;
                        else if (type === 'KONTAN') mData.kontan += amt;
                        else if (type === 'BONUS') mData.bonus += amt;
                        else mData.custom += amt;
                    }
                }
            }
            info(CATEGORY, `[TaxReport Excel FAST] Other incomes by month/NIK: ${dbIncomeByMonthNik.size} entries`);

            // Shared row helpers (deduped from progressive + fast handlers)
            const { deriveJabatanFromGang, normalizePremiKey, extractParentName } = createTaxRowHelpers;

            // Premi consolidation helpers
            const brondolSubKeys = ['BRONDOL LOOSEFRUIT', 'BRONDOL TOTAL', 'BRONDOL ADTRANS',
                'BRONDOL_LOOSEFRUIT', 'BRONDOL_TOTAL', 'BRONDOL_ADTRANS',
                'brondol_loosefruit', 'brondol_total', 'brondol_adtrans',
                'brondol loosefruit', 'brondol total', 'brondol adtrans'];
            const skipKeys = ['koreksi', 'KOREKSI', 'total', 'TOTAL'];

            const isBrondolSubKey = (key: string): boolean => {
                const upper = normalizePremiKey(key);
                return brondolSubKeys.some(bk => upper === bk.toUpperCase());
            };

            // [DE-DUPLICATION] Use a Map to focus on the LATEST record per employee (Append-Insert handling)
            // This prevents "accumulated" duplicate data from being summed erroneously.
            // We assume the extractor returns rows in natural insertion order (oldest first).
            const employeeMap = new Map<string, any>();
            for (const r of historyData.data_rows) {
                const hk = Number(r.jumlah_hk || r.hk || 0);
                const hasIncome = Number(r.jumlah_upah_kotor || 0) > 0;
                
                if (hk > 0 || hasIncome) {
                    const key = (r.emp_code || r.nik || r.actual_nik || '').trim().toUpperCase();
                    if (key) {
                        // Always overwrite with the last record seen (Latest Wins)
                        employeeMap.set(key, r);
                    }
                }
            }

            const activeEmployees = Array.from(employeeMap.values());
            info(CATEGORY, `[TaxReport Excel FAST] Rows from Extractor: ${historyData.data_rows.length}`);
            info(CATEGORY, `[TaxReport Excel FAST] De-duplicated down to ${activeEmployees.length} unique employees (LATEST VERSION ONLY).`);

            info(CATEGORY, `[TaxReport Excel FAST] Active employees (HK > 0 OR Income > 0): ${activeEmployees.length}`);

            // Transform to MonthlyTaxRow format — ALIGNED with progressive endpoint & Excel generator
            info(CATEGORY, `[TaxReport Excel FAST] Starting employee transformation...`);
            const employees: any[] = [];
            let totalPph21 = 0;

            for (let idx = 0; idx < activeEmployees.length; idx++) {
                try {
                    const row = activeEmployees[idx];
                    const empCodeTrimmed = (row.emp_code || '').trim();
                    const masterPtkp = ptkpMap.get(empCodeTrimmed) || row.status_ptkp || 'TK/0';
                    const kategoriTer = mapPTKPToTER(masterPtkp);

                // [DEBUG] Log first row to help diagnose premi data
                if (idx === 0) {
                    info(CATEGORY, `[TaxReport FAST DEBUG] First row keys (sample):`, 
                        Object.keys(row).filter(k => k.includes('pph') || k.includes('premi') || k.includes('pot') || k.includes('beras') || k.includes('bruto') || k.includes('brondol')));
                    info(CATEGORY, `[TaxReport FAST DEBUG] row.premi type=${typeof row.premi}, keys=${row.premi ? Object.keys(row.premi) : 'N/A'}`);
                    info(CATEGORY, `[TaxReport FAST DEBUG] row.premi_detail type=${typeof row.premi_detail}, keys=${row.premi_detail && typeof row.premi_detail === 'object' ? Object.keys(row.premi_detail) : 'N/A'}`);
                    info(CATEGORY, `[TaxReport FAST DEBUG] row.premi_brondol=${row.premi_brondol}, row.total_premi=${row.total_premi}`);
                    // Log all premi_* flat keys
                    const premiFlat = Object.entries(row).filter(([k]) => k.startsWith('premi_')).map(([k,v]) => `${k}=${v}`);
                    info(CATEGORY, `[TaxReport FAST DEBUG] Flat premi_* fields: [${premiFlat.join(', ')}]`);
                }

                const gajiPokokAktual = row.gaji_pokok_aktual || row.gaji_pokok || 0;
                const upahDasar = row.upah_dasar || 0;
                const tunjanganBeras = row.beras_jumlah || 0;
                const tunjanganJabatan = row.jabatan_jumlah || 0;
                const tunjanganMasaKerja = row.masa_kerja_jumlah || 0;
                const tunjanganLembur = row.lembur_jumlah || 0;
                const totalPremi = row.total_premi || 0;

                const pph21Caruman = getCarumanForPph21(upahDasar, tunjanganMasaKerja);
                const astek084 = pph21Caruman.astek_majikan_084;
                const bpjsKesehatanMajikan4Pct = pph21Caruman.bpjs_kes_majikan_4;
                const carumanBase = pph21Caruman.base;

                // [ALIGNMENT] Use values EXACTLY from Daftar Upah (same logic as progressive & monthly endpoints)
                const penghasilanBruto = Number(row.penghasilan_bruto) || 0;
                // [FIXED 2026-04-08] Prioritize pph21_ter to match UI "Pajak" column exactly
                const pph21 = Number(row.pph21_ter) || Number(row.pot_pph21) || 0;
                const tarifPajakTer = Number(row.tarif_pajak_ter) || 0;
                totalPph21 += pph21;

                const reportIdentity = resolveReportIdentity(row);

                // Other incomes for this employee this month
                const rawEmpNikForBonus = String(reportIdentity.new_nik || reportIdentity.nik || row.nik_ktp || row.nik || '').trim().toUpperCase();
                const monthKey = `${month}_${rawEmpNikForBonus}`;
                const empOtherIncome = dbIncomeByMonthNik.get(monthKey) || { thr: 0, bonus: 0, kontan: 0, custom: 0 };
                const empThrAmount = empOtherIncome.thr;
                const empBonusAmount = empOtherIncome.bonus;
                const empKontanAmount = empOtherIncome.kontan;
                const empOtherIncomeAmount = empOtherIncome.custom;

                // Build other incomes array for this employee
                let empOtherIncomes: { type: string; name: string; amount: number }[] = [];
                if (empThrAmount > 0) empOtherIncomes.push({ type: 'THR', name: 'THR', amount: empThrAmount });
                if (empBonusAmount > 0) empOtherIncomes.push({ type: 'BONUS', name: 'PENDAPATAN BONUS', amount: empBonusAmount });
                if (empKontanAmount > 0) empOtherIncomes.push({ type: 'KONTAN', name: 'KONTANAN', amount: empKontanAmount });
                if (empOtherIncomeAmount > 0) empOtherIncomes.push({ type: 'LAIN', name: 'Pendapatan Lain', amount: empOtherIncomeAmount });

                // Get job title
                let resolvedJabatan = jabatanMap[empCodeTrimmed] || row.jabatan || row.jabatan_estate || '';
                if (!resolvedJabatan) {
                    resolvedJabatan = deriveJabatanFromGang(row.gang_code || '');
                }

                // Extract parent name from parentheses
                const rawName = row.nama || row.emp_name || '';
                const { empName, parentName } = extractParentName(rawName);

                // ============================================================
                // Build premiDetail: extract ALL individual premi items
                // DataExtractor stores premi in row.premi as nested object
                // Keys can be: premi_angkut, premi_pruning, brondol, etc.
                // ============================================================
                const premiDetail: Record<string, number> = {};

                // SOURCE 1: row.premi (nested object from DataExtractor - PRIMARY)
                if (row.premi && typeof row.premi === 'object' && !Array.isArray(row.premi)) {
                    for (const [key, value] of Object.entries(row.premi)) {
                        const val = Number(value) || 0;
                        if (val <= 0) continue;
                        if (skipKeys.includes(key)) continue;
                        
                        // Strip 'premi_' prefix if present, then normalize
                        const cleanKey = key.replace(/^premi_/i, '');
                        const upperKey = normalizePremiKey(cleanKey);
                        
                        // Skip brondol — handled separately below as single entry
                        if (upperKey === 'BRONDOL' || isBrondolSubKey(cleanKey)) continue;
                        
                        premiDetail[upperKey] = (premiDetail[upperKey] || 0) + val;
                    }
                }

                // SOURCE 2: row.premi_detail (from history database — only if SOURCE 1 was empty)
                if (Object.keys(premiDetail).length === 0) {
                    let parsedPremiDetail: Record<string, any> | null = null;
                    const rawPremiDetail = row.premi_detail;
                    if (rawPremiDetail && typeof rawPremiDetail === 'object' && !Array.isArray(rawPremiDetail)) {
                        parsedPremiDetail = rawPremiDetail;
                    } else if (rawPremiDetail && typeof rawPremiDetail === 'string') {
                        try { parsedPremiDetail = JSON.parse(rawPremiDetail); } catch (_) {}
                    }
                    if (parsedPremiDetail) {
                        for (const [key, value] of Object.entries(parsedPremiDetail)) {
                            const val = Number(value) || 0;
                            if (val <= 0) continue;
                            if (skipKeys.includes(key)) continue;
                            const cleanKey = key.replace(/^premi_/i, '');
                            const upperKey = normalizePremiKey(cleanKey);
                            if (upperKey === 'BRONDOL' || isBrondolSubKey(cleanKey)) continue;
                            if (!premiDetail[upperKey]) { premiDetail[upperKey] = val; }
                        }
                    }
                }

                // SOURCE 3: row.premi_* flattened fields (final fallback)
                if (Object.keys(premiDetail).length === 0) {
                    for (const [key, value] of Object.entries(row)) {
                        if (!key.startsWith('premi_')) continue;
                        if (['premi_brondol', 'premi_brondol_total', 'premi_brondol_loosefruit', 
                             'premi_brondol_adtrans', 'premi_pph', 'premi_detail', 'premi_details',
                             'premi_koreksi'].includes(key)) continue;
                        const val = Number(value) || 0;
                        if (val <= 0) continue;
                        const cleanKey = key.replace(/^premi_/, '');
                        const label = normalizePremiKey(cleanKey);
                        if (label === 'BRONDOL' || isBrondolSubKey(cleanKey)) continue;
                        if (!premiDetail[label]) { premiDetail[label] = val; }
                    }
                }

                // BRONDOL: single source — use premi_brondol_total (already consolidated by DataExtractor)
                // This ensures brondol appears exactly ONCE, not duplicated
                const brondolFinal = Number(row.premi_brondol_total) || Number(row.premi_brondol) || 0;
                if (brondolFinal > 0) {
                    premiDetail['BRONDOL'] = brondolFinal;
                }

                // [DEBUG] Log premiDetail for first employee
                if (idx === 0) {
                    info(CATEGORY, `[TaxReport FAST DEBUG] First employee premiDetail:`, JSON.stringify(premiDetail));
                    info(CATEGORY, `[TaxReport FAST DEBUG] brondolFinal=${brondolFinal}, premi_brondol_total=${row.premi_brondol_total}, premi_brondol=${row.premi_brondol}`);
                }

                // ============================================================
                // Build employee object with CORRECT field names matching
                // MonthlyTaxRow interface & taxReportExcelService.ts expectations
                // ============================================================
                employees.push({
                    no: idx + 1,
                    emp_code: empCodeTrimmed,
                    emp_name: empName,                          // Was: nama (Excel reads emp_name)
                    parent_name: parentName,                    // Was: missing
                    nik: reportIdentity.nik,
                    new_nik: reportIdentity.new_nik,
                    npwp: reportIdentity.npwp,                  // Was: missing
                    alamat: reportIdentity.alamat,              // Was: missing
                    jabatan: resolvedJabatan,
                    gender: String(row.jenis_kelamin || row.gender || '1'), // Was: missing
                    status_ptkp: masterPtkp,
                    kategori_ter: kategoriTer,
                    gang_code: row.gang_code || '',
                    
                    // Struktur Upah
                    hk: Number(row.jumlah_hk || row.hk) || 0,  // Was: missing (Excel reads hk)
                    upah_dasar: Number(upahDasar),
                    gaji_pokok_ideal: row.gaji_pokok_ideal || 0,
                    gaji_pokok_aktual: Number(gajiPokokAktual),
                    koreksi_hk: row.koreksi_hk || 0,            // Was: missing
                    
                    // Tunjangan — correct field names for Excel generator
                    tunjangan_beras: Number(tunjanganBeras),
                    tunjangan_jabatan: Number(tunjanganJabatan),
                    tunjangan_masa_kerja: Number(tunjanganMasaKerja),
                    tunjangan_lembur: Number(tunjanganLembur),   // Was: lembur (Excel reads tunjangan_lembur)
                    total_tunjangan: Number(row.total_tunjangan) || 0,
                    
                    // Premi — with detail breakdown
                    premi_detail: premiDetail,                   // Was: missing (critical for premi columns)
                    premi_brondol: row.premi_brondol || brondolFinal || 0, // Was: missing
                    premi_pph: row.premi_pph || 0,               // Was: missing
                    total_premi: Number(totalPremi),
                    
                    // Potongan
                    pot_spsi: row.pot_spsi || 0,                 // Was: missing
                    pot_koreksi: row.pot_koreksi || 0,           // Was: missing
                    total_potongan_kotor: row.pot_koreksi || 0,
                    
                    // Jaminan Majikan — correct field names
                    bpjs_kes_majikan: Number(bpjsKesehatanMajikan4Pct), // Was: bpjs_kes_m
                    astek_jht_majikan: Number(astek084),                // Was: astek_m
                    
                    // Kalkulasi PPH21 — values from Daftar Upah
                    upah_kotor: row.jumlah_upah_kotor || row.upah_kotor || 0, // Was: missing
                    penghasilan_bruto: Number(penghasilanBruto),
                    tarif_pajak_ter: tarifPajakTer,
                    pph21_ter: Number(pph21),
                    pot_pph21: Number(row.pot_pph21) || 0,
                    
                    // Pendapatan Lainnya
                    thr_amount: empThrAmount,                    // Was: missing
                    exgratia_amount: empBonusAmount,
                    bonus_amount: empBonusAmount,
                    kontanan_amount: empKontanAmount,
                    pendapatan_thr: empThrAmount,
                    pendapatan_bonus: empBonusAmount,
                    pendapatan_kontan: empKontanAmount,
                    other_incomes: empOtherIncomes,
                    pendapatan_tidak_tetap_thp: empThrAmount + empBonusAmount + empKontanAmount + empOtherIncomeAmount,
                    
                    // GL Metadata — use TAX_COMPONENT_METADATA directly (DataExtractor doesn't provide this)
                    component_metadata: TAX_COMPONENT_METADATA,
                });
                } catch (empError: any) {
                    const empCode = activeEmployees[idx]?.emp_code || 'unknown';
                    logError(CATEGORY, `[TaxReport Excel FAST] Error transforming employee ${empCode} (index ${idx}):`, empError?.message || empError);
                    // Continue with next employee instead of failing completely
                }
            }

            info(CATEGORY, `[TaxReport Excel FAST] Transformed ${employees.length} employees, total_pph21=${totalPph21} in ${Date.now() - startTime}ms`);

            const gangLabel = gang || gangPrefix || 'ALL';
            const scopeLabels = await resolveTaxExcelScopeLabels({
                division: division || 'ALL',
                gang,
                gangPrefix,
                employees
            });

            // Generate Excel
            info(CATEGORY, `[TaxReport Excel FAST] Calling generateMonthlyTaxExcel with ${employees.length} employees...`);
            try {
                const excelBuffer = await generateMonthlyTaxExcel(
                    { employees, period: { month, year }, total_pph21: totalPph21 },
                    year, month, division || 'ALL', gangLabel, undefined, scopeLabels
                );
                info(CATEGORY, `[TaxReport Excel FAST] generateMonthlyTaxExcel returned buffer length=${excelBuffer?.length || 0}`);

                if (!excelBuffer || excelBuffer.length === 0) {
                    logError(CATEGORY, '[TaxReport Excel FAST] Excel buffer is empty!');
                    set.status = 500;
                    return { error: "Failed to generate Excel buffer - empty" };
                }

                info(CATEGORY, `[TaxReport Excel FAST] Total time: ${Date.now() - startTime}ms`);

                // Ensure we have a proper Buffer
                const finalBuffer = Buffer.isBuffer(excelBuffer) ? excelBuffer : Buffer.from(excelBuffer);

                if (!finalBuffer || finalBuffer.length === 0) {
                    logError(CATEGORY, '[TaxReport Excel FAST] Excel buffer is empty after conversion!');
                    set.status = 500;
                    return { error: "Failed to generate Excel - empty buffer" };
                }

                const filename = `PPH21_${scopeLabels.filenameDivision}_${scopeLabels.filenameGang}_${month}_${year}.xlsx`;
                info(CATEGORY, `[TaxReport Excel FAST] Returning file: ${filename} (${finalBuffer.length} bytes)`);

                // Set headers and return a native Response object
                // returning Response directly is more robust in Bun for binary data
                return new Response(finalBuffer, {
                    status: 200,
                    headers: {
                        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        "Content-Disposition": `attachment; filename="${filename}"`,
                        "Content-Length": String(finalBuffer.length),
                        "Access-Control-Expose-Headers": "Content-Disposition"
                    }
                });
            } catch (excelError: any) {
                logError(CATEGORY, '[TaxReport Excel FAST] Excel generation failed:', excelError);
                logError(CATEGORY, '[TaxReport Excel FAST] Stack:', excelError?.stack);
                set.status = 500;
                return { error: "Excel generation failed: " + (excelError?.message || String(excelError)) };
            }
        } catch (error: any) {
            logError(CATEGORY, `[TaxReport Excel FAST ERROR]`, error);
            set.status = 500;
            return { 
                error: "Internal Server Error", 
                details: error?.message || "Unknown error",
                stack: error?.stack
            };
        } finally {
            // Memory Cleaner: Bebaskan memory secara paksa setelah pemrosesan objek JSON/Excel yang besar
            try {
                if (typeof Bun !== 'undefined' && Bun.gc) {
                    Bun.gc(true); // Force synchronous GC in Bun
                } else if (global && global.gc) {
                    global.gc(); // Fallback for Node.js
                }
            } catch (e) {
                // Ignore GC errors
            }
        }
    }, {
        query: t.Object({
            year: t.String(),
            month: t.String(),
            division: t.Optional(t.String()),
            gang: t.Optional(t.String()),
            gangPrefix: t.Optional(t.String()),
            use_history: t.Optional(t.String()),
            snapshot_version: t.Optional(t.String()),
            value_priority_mode: t.Optional(t.String())
        })
    })

    // ========================================================
    // POST /tax-report/monthly/excel/dom
    // Generates Tax Report directly from frontend DOM details
    // [REVISED] Use DOM data directly from UI PAJAK section
    // Only fetch premi_detail and THR from backend (not in UI table)
    // ========================================================
    .post("/monthly/excel/dom", async ({ body, set }) => {
        const t0 = performance.now();
        try {
            const { year, month, division, gang, gangPrefix, employees, premiKeys } = body as any;

            if (!year || !month || !employees || !Array.isArray(employees)) {
                set.status = 400;
                return { error: "Invalid payload: year, month, and employees are required" };
            }
            const y = parseInt(year);
            const m = parseInt(month);

            info(CATEGORY, `[TaxReport DOM FAST] Request: ${division}/${gang || gangPrefix || 'ALL'} ${m}/${y}, ${employees.length} employees`);

            // Debug: Log first employee structure
            if (employees.length > 0) {
                const firstEmp = employees[0];
                info(CATEGORY, '[TaxReport DOM FAST] First employee keys:', Object.keys(firstEmp).join(', '));
                info(CATEGORY, '[TaxReport DOM FAST] First employee pph21_ter:', firstEmp.pph21_ter, 'pot_pph21:', firstEmp.pot_pph21);
                info(CATEGORY, '[TaxReport DOM FAST] First employee emp_code:', firstEmp.emp_code, 'nama:', firstEmp.nama);
            }

            const empCodes = employees.map((emp: any) => (emp.emp_code || emp.ID_KARYAWAN || '').trim().toUpperCase()).filter(Boolean);

            if (empCodes.length > 0) {
                const historyIdentityByEmpCode = await historyDatabaseService.getHistoryTaxIdentityByEmpCodes(m, y, empCodes);
                employees.forEach((emp: any) => {
                    const empCode = (emp.emp_code || emp.ID_KARYAWAN || '').trim().toUpperCase();
                    Object.assign(emp, applyReportIdentity(emp, historyIdentityByEmpCode.get(empCode)));
                });
                info(CATEGORY, `[TaxReport DOM FAST] Applied tax identity overrides for ${historyIdentityByEmpCode.size}/${empCodes.length} employees`);
            } else {
                employees.forEach((emp: any) => Object.assign(emp, applyReportIdentity(emp)));
            }

            // ─────────────────────────────────────────────────────────
            // Build Excel rows from the already-rendered DOM payload.
            // Avoid re-querying premium data here; the UI row is the source for this export.
            // ─────────────────────────────────────────────────────────
            const metaToInject = TAX_COMPONENT_METADATA;
            const preparedDomRows = prepareDomTaxExcelRows(employees, Array.isArray(premiKeys) ? premiKeys : [], metaToInject);
            const excelEmployees = preparedDomRows.employees;
            for (const emp of excelEmployees) {
                emp.tunjangan_jabatan = resolveAdjustedJabatanJumlah(emp, { month: m, year: y, divisionCode: division }, Number(emp.tunjangan_jabatan ?? emp.jabatan_jumlah ?? 0));
                emp.jabatan_jumlah = emp.tunjangan_jabatan;
                if (shouldForcePotPph21ToTer(emp, { month: m, year: y, divisionCode: division })) {
                    emp.pot_pph21 = Number(emp.pph21_ter || 0);
                    emp.pph21 = emp.pot_pph21;
                }
                attachPayrollPeriodAdjustmentNotes(emp, { month: m, year: y, divisionCode: division });
            }
            const totalPph21 = preparedDomRows.totalPph21;
            info(CATEGORY, `[TaxReport DOM FAST] Prepared DOM rows: employees=${excelEmployees.length}, totalPph21=${totalPph21}`);

            // Debug: Log first 3 employees' pph21 values
            excelEmployees.slice(0, 3).forEach((emp, idx) => {
                info(CATEGORY, `[TaxReport DOM FAST] Employee ${idx+1}: emp_code=${emp.emp_code}, nama=${emp.nama}, pph21_ter=${emp.pph21_ter}, pot_pph21=${emp.pot_pph21}`);
            });

            const gangLabel = gang || gangPrefix || 'ALL';
            const scopeLabels = await resolveTaxExcelScopeLabels({
                division: division || 'ALL',
                gang,
                gangPrefix,
                employees: excelEmployees
            });

            // Debug: Log first employee before Excel generation
            if (excelEmployees.length > 0) {
                const firstEmp = excelEmployees[0];
                info(CATEGORY, '[TaxReport DOM FAST] Before Excel generation - first emp:', {
                    emp_code: firstEmp.emp_code,
                    nama: firstEmp.nama,
                    emp_name: firstEmp.emp_name,
                    pph21_ter: firstEmp.pph21_ter,
                    pot_pph21: firstEmp.pot_pph21,
                    premi_detail: firstEmp.premi_detail ? Object.keys(firstEmp.premi_detail) : 'NONE',
                    total_premi: firstEmp.total_premi
                });
            }

            let excelBuffer: Buffer | undefined;

            try {
                excelBuffer = await generateMonthlyTaxExcel(
                    { employees: excelEmployees as any, period: { month: m, year: y }, total_pph21: totalPph21 },
                    y, m,
                    division || 'ALL',
                    gangLabel,
                    premiKeys || [],
                    scopeLabels
                );
                info(CATEGORY, `[TaxReport Excel DOM] generateMonthlyTaxExcel completed: ${excelBuffer?.length || 0} bytes`);
            } catch (excelGenError: any) {
                logError(CATEGORY, '[TaxReport Excel DOM] Excel generation FAILED:', excelGenError);
                logError(CATEGORY, '[TaxReport Excel DOM] Stack trace:', excelGenError?.stack);
                set.status = 500;
                return {
                    error: "Excel generation failed",
                    details: excelGenError?.message || "Unknown error during Excel generation",
                    stack: process.env.NODE_ENV === 'development' ? excelGenError?.stack : undefined
                };
            }

            if (!excelBuffer || excelBuffer.length === 0) {
                logError(CATEGORY, '[TaxReport Excel DOM] Excel buffer is empty!');
                set.status = 500;
                return { error: "Failed to generate Excel buffer" };
            }

            const totalMs = (performance.now() - t0).toFixed(0);
            const filename = `PPH21_DOM_${scopeLabels.filenameDivision}_${scopeLabels.filenameGang}_${m}_${y}.xlsx`;
            info(CATEGORY, `[TaxReport DOM FAST] ✅ Done in ${totalMs}ms — ${filename} (${excelBuffer.length} bytes)`);

            // Set headers and return a native Response object
            return new Response(excelBuffer, {
                status: 200,
                headers: {
                    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "Content-Disposition": `attachment; filename="${filename}"`,
                    "Content-Length": String(excelBuffer.length),
                    "Access-Control-Expose-Headers": "Content-Disposition"
                }
            });
        } catch (error: any) {
            logError(CATEGORY, "[TaxReport DOM] Error generating Excel report from DOM:", error);
            set.status = 500;
            return { error: error.message || "Failed to generate Excel report from DOM" };
        } finally {
            // Memory Cleaner: Bebaskan memory secara paksa setelah pemrosesan objek JSON/Excel yang besar
            try {
                if (typeof Bun !== 'undefined' && Bun.gc) {
                    Bun.gc(true); // Force synchronous garbage collection in Bun
                } else if (global && global.gc) {
                    global.gc(); // Fallback for Node.js if --expose-gc is used
                }
            } catch (e) {
                // Abaikan error misal gc tidak tersedia
            }
        }
    });
