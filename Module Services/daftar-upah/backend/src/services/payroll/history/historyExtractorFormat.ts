import { Database } from "../../../db/client";
import { employeeHrDataService } from "../../employeeHrDataService";
import { divisionConfigService } from "../../config/DivisionConfigService";
import { debug, error as logError } from "../../../utils/logger";
import { sortByEmpCode } from "../../../utils/employeeSort";
import { resolveReportIdentity } from "../../../utils/taxReportIdentity";
import {
    selectPayrollHistoryMasters,
    selectPayrollHistoryDetailsByArgs as selectPayrollHistoryDetailsByMasterIds2,
    selectHistoryReligions,
    selectLiveHrEmployees,
} from "./historyQueries";
import { historyDatabaseService } from "../../historyDatabaseService";

const CATEGORY = "HistoryDatabaseService";

export async function getHistoricalPayrollDataAsExtractorFormat(
    db: Database,
    periodMonth: number,
    periodYear: number,
    gangCode: string = "ALL",
    divisionCode?: string,
    specificEmpCode: string | null = null,
    gangPrefix?: string
): Promise<{
    data_rows: any[];
    dynamic_premi_headers: string[];
    dynamic_potongan_headers: string[];
    premi_title_map: Record<string, string>;
    potongan_title_map: Record<string, string>;
    meta: {
        execution_time_ms: number;
        row_count: number;
        is_history_snapshot: boolean;
        snapshot_version?: string | null;
        requested_snapshot_version?: string | null;
        available_snapshot_versions?: any[];
    }
} | null> {
        const startTime = Date.now();

        debug(CATEGORY, `getHistoricalPayrollDataAsExtractorFormat params: M:${periodMonth} Y:${periodYear} Gang:${gangCode} Div:${divisionCode}`);

        // Use unified mapping for consistent division handling
        let isVirtual = false;
        let virtualGangs: string[] = [];
        let divisionCodes: string[] = [];
        if (divisionCode) {
            try {
                const filter = await divisionConfigService.expandDivisionFilter(divisionCode);
                isVirtual = filter.isVirtual;
                virtualGangs = filter.gangCodes;
                // Virtual records are matched via gang codes only
                divisionCodes = filter.isVirtual ? [] : filter.divisionCodes;
            } catch (e) {
                logError(CATEGORY, "Error handling division filter:", e);
                /* fallback to original logic */
            }
        }

        const masters = await selectPayrollHistoryMasters(db, {
            periodMonth,
            periodYear,
            gangCode,
            divisionCode,
            gangPrefix,
            divisionCodes,
            virtualGangs,
            isVirtual,
        });

        if (masters.length === 0) return null; // No history data seeded yet

        const masterIds = masters.map(m => m.id);

        // Map dynamic headers
        const dynamicPremiSet = new Set<string>();
        const dynamicPotonganSet = new Set<string>();
        for (const m of masters) {
            try {
                if (m.dynamic_premi_data) {
                    const pData = JSON.parse(m.dynamic_premi_data);
                    pData.forEach((k: string) => dynamicPremiSet.add(k));
                }
                if (m.dynamic_potongan_data) {
                    const potData = JSON.parse(m.dynamic_potongan_data);
                    potData.forEach((k: string) => dynamicPotonganSet.add(k));
                }
            } catch (e) {
                logError(CATEGORY, "Error parsing dynamic headers for master_id " + m.id, e);
            }
        }

        const rawDetails = await selectPayrollHistoryDetailsByMasterIds2(db, {
            masterIds,
            gangCode,
            gangPrefix,
            divisionCode,
            divisionCodes,
            specificEmpCode,
        });
        
        // Mitigation: Filter out duplicate employees (Strict unique by NIK/EmpCode)
        const uniqueDetailsMap = new Map<string, any>();
        for (const d of rawDetails) {
            const key = (d.nik || d.emp_code || '').trim().toUpperCase();
            if (!key) continue;

            // [ALIGNMENT] Handle "Group" filtering in memory to match DataExtractorService logic
            if (gangPrefix && gangPrefix.trim() !== "" && d.gang_code) {
                const prefix = gangPrefix.trim();
                const isNumeric = /^\d+$/.test(prefix);
                const gc = (d.gang_code || '').trim().toUpperCase();
                let matches = false;
                if (isNumeric) {
                    const asistensi = gc.startsWith('K2') ? '1' : (gc.match(/\d+/)?.[0] ?? null);
                    matches = asistensi === prefix;
                } else {
                    matches = gc.startsWith(prefix.toUpperCase());
                }
                if (!matches) continue;
            }

            if (!uniqueDetailsMap.has(key)) {
                uniqueDetailsMap.set(key, d);
            }
        }
        const details = Array.from(uniqueDetailsMap.values());
        debug(CATEGORY, `History Detail Fetch for ${divisionCode}/${gangCode}: Raw=${rawDetails.length}, Unique=${details.length}`);

        // Filter details if it's a virtual division or real division needing exclusion
        let finalDetails = details;
        if (divisionCode && gangCode === "ALL") {
            const isVirtual = divisionConfigService.isVirtualDivision(divisionCode);
            if (isVirtual) {
                const virtualGangs = await divisionConfigService.getGangsForDivision(divisionCode);
                const virtualGangCodes = new Set(virtualGangs.map(g => g.gang_code.toUpperCase()));
                const filtered = details.filter((d: any) => virtualGangCodes.has(d.gang_code?.trim()?.toUpperCase()));
                debug(CATEGORY, `Virtual Division Filter (${divisionCode}): Reduced ${details.length} to ${filtered.length} rows.`);
                finalDetails = filtered.length > 0 ? filtered : details;
            } else {
                // REAL division: exclude gangs that belong to virtual divisions with exclude_from_source=true
                const filtered = [];
                for (const d of details) {
                    const gCode = d.gang_code?.trim()?.toUpperCase() || "";
                    const lCode = d.loc_code?.trim()?.toUpperCase() || d.division_code?.trim()?.toUpperCase() || "";
                    const desc = d.gang_description?.trim() || d.task_desc?.trim() || "";
                    
                    // Unified gang→virtual-division resolution (source-aware + pattern-only fallback)
                    const virtDiv = divisionConfigService.resolveGangDivision(gCode, lCode, desc);

                    if (virtDiv) {
                        const config = divisionConfigService.getDivision(virtDiv);
                        if (config?.excludeFromSource) {
                            // This gang belongs to a virtual division that should be excluded from its source
                            continue;
                        }
                    }
                    filtered.push(d);
                }
                finalDetails = filtered;
            }
        }

        const empCodesForHr = finalDetails.map((d: any) => d.emp_code?.trim()).filter(Boolean);
        const hrDataMap = await employeeHrDataService.getHrDataBulk(empCodesForHr);

        // Fetch religion from history_hr_employee if available
        const religionHistoryMap = new Map<string, string>();
        if (empCodesForHr.length > 0) {
            try {
                const relRows = await selectHistoryReligions(db, periodMonth, periodYear, empCodesForHr);
                relRows.forEach(r => religionHistoryMap.set(r.emp_code.trim().toUpperCase(), r.religion));
            } catch (e) {
                logError(CATEGORY, "Error fetching religion from history_hr_employee", e);
            }
        }

        const historyTaxIdentityMap = await historyDatabaseService.getHistoryTaxIdentityByEmpCodes(periodMonth, periodYear, empCodesForHr);

        // Fetch live HR_EMPLOYEE data for address, type, actual_nik
        const hrEmployeeMap = new Map<string, any>();
        if (empCodesForHr.length > 0) {
            try {
                const liveDb = Database.getInstance(); // Default live db holds HR_EMPLOYEE
                const liveHrRows = await selectLiveHrEmployees(liveDb, empCodesForHr);

                liveHrRows.forEach(row => {
                    hrEmployeeMap.set(row.emp_code, row);
                });
            } catch (e) {
                logError(CATEGORY, "Error fetching live HR_EMPLOYEE data", e);
            }
        }

        const normalizePremiHeader = (key: string): string => {
            const normalized = key.trim().replace(/\s+/g, "_").toUpperCase();
            return normalized.startsWith("PREMI_") ? normalized : `PREMI_${normalized}`;
        };

        const normalizePotonganHeader = (key: string): string => {
            const normalized = key.trim().replace(/\s+/g, "_").toUpperCase();
            if (normalized.startsWith("KOREKSI")) return normalized;
            return normalized.startsWith("POTONGAN_") ? normalized : `POTONGAN_${normalized}`;
        };

        const shouldTrackPremiHeader = (normalizedKey: string): boolean => {
            return normalizedKey !== "PREMI_BRONDOL" && normalizedKey !== "PREMI_KOREKSI";
        };

        const data_rows = sortByEmpCode(finalDetails.map(d => {
            const empCodeClean = d.emp_code?.trim().toUpperCase() || "";
            const hrOverride = hrDataMap.get(empCodeClean);
            const liveHr = hrEmployeeMap.get(empCodeClean);
            const historyTaxIdentity = historyTaxIdentityMap.get(empCodeClean);
            const histReligion = religionHistoryMap.get(empCodeClean);

            const reportIdentity = resolveReportIdentity({
                nik: d.nik,
                actual_nik: liveHr?.actual_nik,
                pajak_npwp: hrOverride?.npwp,
                res_address: liveHr?.res_address
            }, historyTaxIdentity);
            const finalReligion = historyTaxIdentity?.religion || histReligion || liveHr?.Religion || "01 Islam";

            const gCodeTrimmed = (d.gang_code || '').trim();
            const locCodeTrimmed = (d.loc_code || d.division_code || '').trim();
            const descTrimmed = (d.gang_description || d.task_desc || '').trim();

            const resolvedLocCode = divisionConfigService.resolveVirtualDivision(gCodeTrimmed, locCodeTrimmed, descTrimmed) || locCodeTrimmed;

            const row: any = {
                nik: reportIdentity.nik,
                new_nik: reportIdentity.new_nik,
                actual_nik: reportIdentity.actual_nik,
                pajak_npwp: reportIdentity.npwp,
                religion: finalReligion,
                res_address: reportIdentity.alamat,
                alamat: reportIdentity.alamat, // Map res_address to alamat for frontend
                hr_emp_type: liveHr?.hr_emp_type?.trim() || "",
                nama: d.emp_name,
                emp_code: d.emp_code,
                jenis_kelamin: d.gender,
                status_ptkp: d.status_ptkp,
                kategori_ter: d.kategori_ter,
                loc_code: resolvedLocCode,
                gang_code: gCodeTrimmed,
                division_code: resolvedLocCode,
                upah_dasar: parseFloat(d.upah_dasar) || 0,
                jumlah_hk: parseFloat(d.jumlah_hk) || 0,
                total_jam_kerja: parseFloat(d.total_jam_kerja) || 0,
                hari_kerja: parseFloat(d.hari_kerja) || 0,
                gaji_pokok: parseFloat(d.gaji_pokok) || 0,
                gaji_pokok_ideal: parseFloat(d.gaji_pokok_ideal) || 0,
                gaji_pokok_aktual: parseFloat(d.gaji_pokok_aktual) || 0,
                koreksi_hk: parseFloat(d.koreksi_hk) || 0,
                cuti_tahunan_hari: parseFloat(d.cuti_tahunan_hari) || 0,
                cuti_sakit_haid_hari: parseFloat(d.cuti_sakit_haid_hari) || 0,
                cuti_minggu_hari: parseFloat(d.cuti_minggu_hari) || 0,
                cuti_nasional_hari: parseFloat(d.cuti_nasional_hari) || 0,
                task_code: d.task_code,
                task_desc: d.task_desc,
                gang_description: d.gang_description,
                beras_rate: parseFloat(d.beras_rate) || 0,
                beras_jumlah: parseFloat(d.beras_jumlah) || 0,
                jabatan_rate: parseFloat(d.jabatan_rate) || 0,
                jabatan_jumlah: parseFloat(d.jabatan_jumlah) || 0,
                masa_kerja_tahun: parseFloat(d.masa_kerja_tahun) || 0,
                masa_kerja_rate: parseFloat(d.masa_kerja_rate) || 0,
                masa_kerja_jumlah: parseFloat(d.masa_kerja_jumlah) || 0,
                lembur_jam: parseFloat(d.lembur_jam) || 0,
                lembur_rate: parseFloat(d.lembur_rate) || 0,
                lembur_jumlah: parseFloat(d.lembur_jumlah) || 0,
                lembur_records: d.lembur_records ? JSON.parse(d.lembur_records) : [],
                total_tunjangan: parseFloat(d.total_tunjangan) || 0,
                premi_brondol: parseFloat(d.premi_brondol) || 0,
                premi_pph: parseFloat(d.premi_pph) || 0,
                total_premi: parseFloat(d.total_premi) || 0,
                pot_koreksi: parseFloat(d.pot_koreksi) || 0,
                pot_spsi: parseFloat(d.pot_spsi) || 0,
                pot_pph21: parseFloat(d.pot_pph21) || 0,
                pot_bpjs_kesehatan_pekerja: parseFloat(d.pot_bpjs_kesehatan_pekerja) || 0,
                pot_bpjs_kesehatan_majikan: parseFloat(d.pot_bpjs_kesehatan_majikan) || 0,
                pot_bpjs_pensiun_pekerja: parseFloat(d.pot_bpjs_pensiun_pekerja) || 0,
                pot_bpjs_pensiun_majikan: parseFloat(d.pot_bpjs_pensiun_majikan) || 0,
                pot_bpjs_pekerja_total: parseFloat(d.pot_bpjs_pekerja_total) || 0,
                pot_astek: parseFloat(d.pot_astek_pekerja) || 0,
                pot_astek_maj: parseFloat(d.pot_astek_majikan) || 0,
                total_potongan: parseFloat(d.total_potongan) || 0,
                total_potongan_bersih: parseFloat(d.total_potongan_bersih) || 0,
                jumlah_upah_kotor: parseFloat(d.jumlah_upah_kotor) || 0,
                upah_kotor_pajak: parseFloat(d.upah_kotor_pajak) || 0,
                penghasilan_bruto: parseFloat(d.penghasilan_bruto) || 0,
                tarif_pajak_ter: parseFloat(d.tarif_pajak_ter) || 0,
                pph21_ter: parseFloat(d.pph21_ter) || 0,
                upah_bersih: parseFloat(d.upah_bersih) || 0,
                shortage_details: d.shortage_details ? JSON.parse(d.shortage_details) : undefined,
                shortage_total_hours: parseFloat(d.shortage_total_hours) || 0,
                jabatan: (d.jabatan || '').trim(),
                is_spsi_member: d.is_spsi_member ?? ((d.pot_spsi || 0) > 0)
            };

            // Dynamic fields
            try {
                if (d.premi_detail) {
                    const pd = JSON.parse(d.premi_detail);
                    Object.keys(pd).forEach(k => {
                        row[k] = parseFloat(pd[k]) || 0;
                        const normalizedKey = normalizePremiHeader(k);
                        if (shouldTrackPremiHeader(normalizedKey)) {
                            dynamicPremiSet.add(normalizedKey);
                        }
                    });
                }
                if (d.potongan_detail) {
                    const pd = JSON.parse(d.potongan_detail);
                    Object.keys(pd).forEach(k => {
                        row[k] = parseFloat(pd[k]) || 0;
                        dynamicPotonganSet.add(normalizePotonganHeader(k));
                    });
                }
            } catch (e) { }

            return row;
        }));

        const premiTitles: Record<string, string> = {};
        dynamicPremiSet.forEach(k => premiTitles[k] = k.replace('PREMI_', '').replace(/_/g, ' '));

        const potonganTitles: Record<string, string> = {};
        dynamicPotonganSet.forEach(k => potonganTitles[k] = k.replace('POTONGAN_', '').replace(/_/g, ' '));

        return {
            data_rows,
            dynamic_premi_headers: Array.from(dynamicPremiSet),
            dynamic_potongan_headers: Array.from(dynamicPotonganSet),
            premi_title_map: premiTitles,
            potongan_title_map: potonganTitles,
            meta: {
                execution_time_ms: Date.now() - startTime,
                row_count: data_rows.length,
                is_history_snapshot: true
            }
        };
    }
