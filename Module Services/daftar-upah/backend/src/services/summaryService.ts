import { Database } from "../db/client";
import { divisionDefinition } from "./divisionDefinition";
import { divisionConfigService } from "./config/DivisionConfigService";
import { gangService } from "./gangService";
import { join } from "path";
import { file } from "bun";
import { Config } from "../config";
import { thumbprintService } from "./thumbprintService";
import { deductionAdjustmentService } from "./deductionAdjustmentService";
import { luasAreaService } from "./luasAreaService";
import { divisionOverrideService } from "./divisionOverrideService";
import { currentPeriodService } from "./currentPeriodService";
import { debug, info, warn, error as logError } from "../utils/logger";
import {
    selectDivisiDescriptions,
    selectHistoryGangRows,
    selectGangDescriptions,
    selectLatestAggregationRows,
    selectDivisionSummaryRows,
    selectLatestAggregationDynamicPremi,
    selectPayrollHistoryHeaders,
    selectAggregationTonaseRows,
    selectDivisionTonase,
    selectLuasHektarFromDb,
    selectDistinctPeriods,
    selectDistinctPeriodsByGangCodes,
    selectGangSummaryRow,
    selectGangLemburDetails,
    updateGangCellValue,
    selectMillTotalsFromVenus,
    selectPremiTypesFromHistory,
} from "./payroll/summary/summaryQueries";
import { SummaryReportService } from "./summaryReportService";

const CATEGORY = "SummaryService";

export interface DivisionSummary {
    division_code: string;
    description: string;
    total_premi: number;
    total_premi_excluding_special: number;  // Total premi excluding insentif, kinerja, prunning
    total_employees: number;
    total_hk: number;
    total_upah_bersih: number;
    total_upah_kotor?: number;
    total_pph21: number;
    total_spsi: number;
    total_lembur: number;
    total_gangs: number;
    total_premi_brondol: number;
    total_premi_prunning: number;
    total_premi_insentif: number;  // Insentif Panen from dynamic_premi
    total_premi_kinerja: number;   // Kinerja from dynamic_premi
    total_koreksi: number;         // Koreksi from dynamic_premi
    dynamic_premi_data?: string;   // JSON string from DB
    total_ffb_weight: number;
    total_weight_tbs: number;      // TBS weight from database
    informasi_tambahan: string;    // Additional info from database
    thumb_print: number;
    total_manual: number;
    selisih: number;
    is_subtotal: boolean;
    is_grand_total: boolean;
    group: string;
    [key: string]: any;
}

export class SummaryService {
    private static instance: SummaryService;
    private db: Database;
    public extendDb: Database;
    public millDb: Database;

    // Flag to redirect origin DB queries to history DB (extend_db_ptrj)
    // When true, HR_GANG etc. are queried from extend_db_ptrj instead of db_ptrj
    private _useHistoryDb: boolean = false;

    private constructor() {
        // Use db_ptrj for HR tables (HR_GANG, HR_EMPLOYEE, etc.)
        // Use extend_db_ptrj for aggregation history
        this.db = Database.getInstance(undefined, Config.DB_PROFILE);
        this.extendDb = Database.getInstance("extend_db_ptrj", Config.DB_EXTEND_PROFILE);
        this.millDb = Database.getMillInstance();
    }

    /**
     * Set whether to use history DB (extend_db_ptrj) for ALL queries,
     * including HR_GANG lookups that normally go to origin db_ptrj.
     * This prevents load on origin DB when history mode is active.
     */
    public setUseHistoryDb(useHistory: boolean): void {
        this._useHistoryDb = useHistory;
        debug(CATEGORY, `useHistoryDb set to: ${useHistory}`);
    }

    /**
     * Returns the appropriate DB instance for queries that normally go to origin db_ptrj.
     * When useHistoryDb is true, returns extendDb instead.
     */
    private getDbForQuery(): Database {
        return this._useHistoryDb ? this.extendDb : this.db;
    }

    public static getInstance(): SummaryService {
        if (!SummaryService.instance) {
            SummaryService.instance = new SummaryService();
        }
        return SummaryService.instance;
    }

    /**
     * Clear all in-memory caches (No-op as caches are removed)
     */
    public clearCache(): void {
        debug(CATEGORY, "[SummaryService] Cache cleared request received (Cache is disabled)");
    }

    public async loadJsonData(filename: string): Promise<any> {
        try {
            const path = join(process.cwd(), "data", filename);
            const f = file(path);
            if (await f.exists()) {
                return await f.json();
            }
            return null;
        } catch (e) {
            logError(CATEGORY, `Failed to load JSON ${filename}:`, e);
            return null;
        }
    }

    private async loadThumbprintData(month: number, year: number): Promise<Record<string, number>> {
        return await thumbprintService.getThumbprintData(month, year);
    }

    /**
     * Optimized single-shot metadata fetching for aggregation.
     * Returns a map of gang-to-division canonical mappings, gang descriptions, and division descriptions.
     */
    public async getMetadataForAggregation(): Promise<{ 
        gangDivMap: Record<string, string>, 
        gangDescs: Record<string, string>,
        divDescs: Record<string, string>
    }> {
        try {
            // Parallelize lookup queries
            const [divDescRows, gangRows] = await Promise.all([
                selectDivisiDescriptions(this.extendDb),
                selectHistoryGangRows(this.extendDb)
            ]);

            const gangDivMap: Record<string, string> = {};
            const gangDescs: Record<string, string> = {};
            const divDescs: Record<string, string> = {};

            // 1. Base division mappings from config
            const allDivisions = divisionConfigService.getAllDivisionsForAPI();
            for (const div of allDivisions) {
                const canonical = div.code.toUpperCase();
                gangDivMap[canonical] = canonical;
                divDescs[canonical] = div.name;
                for (const alias of div.aliases) {
                    gangDivMap[alias.toUpperCase()] = canonical;
                }
            }

            // 2. Load division descriptions from DB
            for (const row of divDescRows) {
                if (row.Divisi) {
                    divDescs[row.Divisi.trim().toUpperCase()] = (row.Description || row.Divisi).trim();
                }
            }

            // 3. Load gang-to-division (loc_code) and gang descriptions from history
            for (const row of gangRows) {
                const gc = row.gang_code?.trim().toUpperCase();
                const lc = row.loc_code?.trim().toUpperCase();
                const gd = row.gang_description?.trim();
                if (gc) {
                    if (lc) gangDivMap[gc] = divisionConfigService.resolveCode(lc);
                    if (gd) gangDescs[gc] = gd;
                }
            }

            return { gangDivMap, gangDescs, divDescs };
        } catch (e) {
            logError(CATEGORY, "Failed to get metadata for aggregation:", e);
            return { gangDivMap: {}, gangDescs: {}, divDescs: {} };
        }
    }

    public async getAllDivisionsPremiTotals(month: number, year: number, includeVirtual: boolean = true): Promise<DivisionSummary[]> {
        const startTime = Date.now();
        debug(CATEGORY, `Computing totals for ${month}-${year} directly from database...`);

        // Optimized Metadata Lookup
        const { gangDivMap, gangDescs, divDescs } = await this.getMetadataForAggregation();

        // Fetch per-gang rows - direct table access (no version_index column exists)
        // Include ALL gangs (AMC, HMC, B2N, INF, INT included) - STEP 2 will extract virtual divisions

        // Parallelize independent data fetches (DB query + thumbprint + backfill + tonase)
        const [rows, thumbprintData, backfillData, tonaseFromMill] = await Promise.all([
            selectLatestAggregationRows(this.extendDb, month, year),
            this.loadThumbprintData(month, year),
            this.getBackfillData(month, year),
            this.fetchTonaseFromMill(month, year)
        ]);

        // Type for aggregation bucket
        type AggBucket = {
            total_premi: number; total_employees: number; total_hk: number;
            total_upah_bersih: number; total_upah_kotor: number; total_pph21: number; total_spsi: number;
            total_lembur: number; gang_codes: Set<string>;
            total_premi_brondol: number; total_premi_prunning: number;
            total_premi_insentif: number; total_premi_kinerja: number;
            total_koreksi: number; total_ffb_weight: number; total_weight_tbs: number;
            total_hari_kerja: number;
        };

        const createEmptyBucket = (): AggBucket => ({
            total_premi: 0, total_employees: 0, total_hk: 0, total_hari_kerja: 0,
            total_upah_bersih: 0, total_upah_kotor: 0, total_pph21: 0, total_spsi: 0,
            total_lembur: 0, gang_codes: new Set(),
            total_premi_brondol: 0, total_premi_prunning: 0,
            total_premi_insentif: 0, total_premi_kinerja: 0,
            total_koreksi: 0, total_ffb_weight: 0, total_weight_tbs: 0
        });

        const addRowToBucket = (bucket: AggBucket, row: any, gangCode: string) => {
            bucket.total_premi += parseFloat(row.total_premi || 0);
            bucket.total_employees += parseInt(row.total_employees || 0);
            bucket.total_hk += parseFloat(row.total_hk || 0);
            // [HK-KEHADIRAN] total_hari_kerja = HK hadir (efektif), PISAH dari total_hk.
            // JANGAN fallback ke total_hk bila kolom 0/absent — biarkan 0 supaya HK libur tidak nol palsu.
            bucket.total_hari_kerja += parseFloat(row.total_hari_kerja ?? 0);
            bucket.total_upah_bersih += parseFloat(row.total_upah_bersih || 0);
            bucket.total_upah_kotor += parseFloat(row.total_upah_kotor || 0);
            bucket.total_pph21 += parseFloat(row.total_pph21 || 0);
            bucket.total_spsi += parseFloat(row.total_spsi || 0);
            bucket.total_lembur += parseFloat(row.total_lembur || 0);
            bucket.gang_codes.add(gangCode);
            bucket.total_premi_brondol += parseFloat(row.total_premi_brondol || 0);
            bucket.total_premi_prunning += parseFloat(row.total_premi_prunning || 0);
            bucket.total_premi_insentif += parseFloat(row.total_premi_insentif || 0);
            bucket.total_premi_kinerja += parseFloat(row.total_premi_kinerja || 0);
            bucket.total_koreksi += parseFloat(row.total_koreksi || 0);
            // Tonase is seeded as a division-level value on each gang row.
            // Keep the division value once instead of multiplying it by gang count.
            bucket.total_ffb_weight = Math.max(bucket.total_ffb_weight, parseFloat(row.total_ffb_weight || 0));
            bucket.total_weight_tbs = Math.max(bucket.total_weight_tbs, parseFloat(row.total_weight_tbs || 0));
        };

        // STEP 1: Aggregate ALL gangs to their REAL division (from HR_GANG LocCode)
        const realDivAgg: Record<string, AggBucket> = {};
        // Also track per-gang raw data for virtual division computation
        const gangRowData: { gangCode: string; sourceLoc: string; gangDesc: string; row: any }[] = [];

        for (const row of rows) {
            const gangCode = row.gang_code?.trim().toUpperCase() || '';
            if (!gangCode) continue;

            const storedDivCode = row.division_code?.trim().toUpperCase() || '';
            const rawLoc = gangDivMap[gangCode] || storedDivCode;
            const gangDesc = gangDescs[gangCode] || '';
            
            // To prevent duplication, we must find the PARENT (source) real division for this gang.
            // Even if the gang is virtual, we aggregate it to the real division first in Step 1,
            // then Step 2/3 extracts and subtracts it.
            let sourceLoc = divisionConfigService.resolveCode(rawLoc);
            
            // If the resolved location is already a virtual division (like INF), 
            // we must find its source real division (like PG1A) so subtraction works.
            const virtualDivCode = divisionDefinition.getVirtualDivisionForGang(gangCode, sourceLoc, gangDesc);
            if (virtualDivCode) {
                const config = divisionDefinition.getVirtualDivisionConfig(virtualDivCode);
                if (config?.sourceDivision) {
                    sourceLoc = divisionConfigService.resolveCode(config.sourceDivision);
                }
            }
            
            if (!sourceLoc || sourceLoc === 'ALL' || sourceLoc === 'UNKNOWN') continue;

            gangRowData.push({ gangCode, sourceLoc, gangDesc, row });

            // Always aggregate to real division (canonical)
            if (!realDivAgg[sourceLoc]) {
                realDivAgg[sourceLoc] = createEmptyBucket();
            }
            addRowToBucket(realDivAgg[sourceLoc], row, gangCode);
        }

        debug(CATEGORY, `Step 1 - Real divisions found: ${Object.keys(realDivAgg).join(', ')}`);

        // STEP 2: Build virtual division rows by extracting matching gangs from real divisions
        // Virtual divisions: INF (from P1A), NRS (from P1B), WKS_PG (from P1A), WKS_AR (from AB2)
        // ARC and MILL are detected as "virtual" but are actually real divisions with their own LocCode
        const virtualDivAgg: Record<string, AggBucket> = {};
        const virtualGangAssignments: Record<string, Set<string>> = {}; // virtualDiv -> Set<gangCode>

        console.log(`[SummaryService] STEP 2 - Processing ${gangRowData.length} gangs for virtual division extraction`);
        console.log(`[SummaryService] STEP 2 - Sample gangs: ${gangRowData.slice(0, 5).map(g => g.gangCode).join(', ')}`);
        
        // Log if virtual gangs exist in the data
        const virtualGangsInData = gangRowData.filter(g => ['AMC', 'HMC', 'B2N', 'INF', 'INT'].includes(g.gangCode));
        console.log(`[SummaryService] STEP 2 - Virtual gangs found in data: ${virtualGangsInData.map(g => `${g.gangCode}(${g.sourceLoc})`).join(', ') || 'NONE'}`);

        // Virtual division codes that should be extracted
        const virtualDivisionCodes = new Set(divisionConfigService.getVirtualDivisions().map(d => d.code));

        // For each gang, check if it belongs to a virtual division (excluding WORKSHOP which is computed)
        for (const { gangCode, sourceLoc, gangDesc, row } of gangRowData) {
            const virtualDiv = divisionConfigService.resolveGangDivision(gangCode, sourceLoc, gangDesc, new Set(Object.keys(gangDivMap)));

            // Log specific virtual gang candidates
            if (['AMC', 'HMC', 'B2N', 'INF', 'INT'].includes(gangCode) || 
                ['INF', 'NRS', 'WKS_PG', 'WKS_AR'].includes(virtualDiv || '')) {
                console.log(`[SummaryService] 🔍 ${gangCode.padEnd(8)} (source=${sourceLoc.padEnd(6)}, desc=${gangDesc.padEnd(30)}) → virtualDiv=${virtualDiv || 'NONE'}`);
            }

            // Skip ARC and MILL - they are real divisions, should not be extracted as virtual
            // Skip WORKSHOP - it's computed from WKS_PG + WKS_AR
            if (virtualDiv === 'WORKSHOP' || virtualDiv === 'ARC' || virtualDiv === 'MILL') continue;

            if (virtualDiv) {
                if (!virtualDivAgg[virtualDiv]) {
                    virtualDivAgg[virtualDiv] = createEmptyBucket();
                }
                addRowToBucket(virtualDivAgg[virtualDiv], row, gangCode);

                if (!virtualGangAssignments[virtualDiv]) {
                    virtualGangAssignments[virtualDiv] = new Set();
                }
                virtualGangAssignments[virtualDiv].add(gangCode);
                
                console.log(`[SummaryService] ✅ ${gangCode} (source=${sourceLoc}) → ${virtualDiv}`);
            }
        }

        console.log(`[SummaryService] STEP 2 - Virtual divisions built: ${Object.keys(virtualDivAgg).join(', ')}`);
        for (const [vd, gangs] of Object.entries(virtualGangAssignments)) {
            const bucket = virtualDivAgg[vd];
            console.log(`[SummaryService]   ${vd}: ${gangs.size} gangs, emp=${bucket.total_employees}, upah=${bucket.total_upah_bersih.toFixed(0)}`);
        }

        // STEP 3: Subtract virtual gang data from parent real divisions
        // So P1A doesn't double-count INF/WKS_PG gangs, P1B doesn't double-count NRS gangs, etc.
        const subtractBucket = (parent: AggBucket, child: AggBucket, childGangs: Set<string>) => {
            parent.total_premi -= child.total_premi;
            parent.total_employees -= child.total_employees;
            parent.total_hk -= child.total_hk;
            parent.total_hari_kerja -= child.total_hari_kerja;
            parent.total_upah_bersih -= child.total_upah_bersih;
            parent.total_pph21 -= child.total_pph21;
            parent.total_spsi -= child.total_spsi;
            parent.total_lembur -= child.total_lembur;
            parent.total_premi_brondol -= child.total_premi_brondol;
            parent.total_premi_prunning -= child.total_premi_prunning;
            parent.total_premi_insentif -= child.total_premi_insentif;
            parent.total_premi_kinerja -= child.total_premi_kinerja;
            parent.total_koreksi -= child.total_koreksi;
            // Remove gang codes from parent
            for (const gc of childGangs) {
                parent.gang_codes.delete(gc);
            }
        };

        // Map virtual divisions to their source real divisions for subtraction
        // Using canonical codes directly since everything is already normalized
        const virtualToSourceMap: Record<string, string> = {
            'INF': 'PG1A',
            'NRS': 'PG1B',
            'WKS_PG': 'PG1A',
            'WKS_AR': 'AB2'
        };

        debug(CATEGORY, `Step 3 - Before subtraction:`);
        debug(CATEGORY, `  virtualDivAgg keys: ${Object.keys(virtualDivAgg).join(', ')}`);
        debug(CATEGORY, `  virtualToSourceMap entries: ${Object.keys(virtualToSourceMap).join(', ')}`);

        for (const [virtDiv, sourceDiv] of Object.entries(virtualToSourceMap)) {
            if (virtualDivAgg[virtDiv] && realDivAgg[sourceDiv]) {
                const childGangs = virtualGangAssignments[virtDiv] || new Set();
                debug(CATEGORY, `  Subtracting ${virtDiv} (${childGangs.size} gangs) from ${sourceDiv}`);
                subtractBucket(realDivAgg[sourceDiv], virtualDivAgg[virtDiv], childGangs);
                debug(CATEGORY, `    ${sourceDiv} after: emp=${realDivAgg[sourceDiv].total_employees}, upah=${realDivAgg[sourceDiv].total_upah_bersih}`);
            } else {
                debug(CATEGORY, `  ⚠️  Skipping ${virtDiv}→${sourceDiv}: virtualDivAgg[${virtDiv}]=${!!virtualDivAgg[virtDiv]}, realDivAgg[${sourceDiv}]=${!!realDivAgg[sourceDiv]}`);
            }
        }

        // STEP 4: Build computed virtual divisions that don't come from gang patterns
        
        // WORKSHOP = WKS_PG + WKS_AR (sum both workshop virtual divisions)
        if (virtualDivAgg['WKS_PG'] || virtualDivAgg['WKS_AR']) {
            if (!virtualDivAgg['WORKSHOP']) {
                virtualDivAgg['WORKSHOP'] = createEmptyBucket();
            }
            const workshopBucket = virtualDivAgg['WORKSHOP'];
            
            if (virtualDivAgg['WKS_PG']) {
                const wksPg = virtualDivAgg['WKS_PG'];
                workshopBucket.total_premi += wksPg.total_premi;
                workshopBucket.total_employees += wksPg.total_employees;
                workshopBucket.total_hk += wksPg.total_hk;
                workshopBucket.total_hari_kerja += wksPg.total_hari_kerja;
                workshopBucket.total_upah_bersih += wksPg.total_upah_bersih;
                workshopBucket.total_pph21 += wksPg.total_pph21;
                workshopBucket.total_spsi += wksPg.total_spsi;
                workshopBucket.total_lembur += wksPg.total_lembur;
                workshopBucket.total_premi_brondol += wksPg.total_premi_brondol;
                workshopBucket.total_premi_prunning += wksPg.total_premi_prunning;
                workshopBucket.total_premi_insentif += wksPg.total_premi_insentif;
                workshopBucket.total_premi_kinerja += wksPg.total_premi_kinerja;
                workshopBucket.total_koreksi += wksPg.total_koreksi;
                workshopBucket.total_ffb_weight += wksPg.total_ffb_weight;
                workshopBucket.total_weight_tbs += wksPg.total_weight_tbs;
                wksPg.gang_codes.forEach(gc => workshopBucket.gang_codes.add(gc));
            }
            
            if (virtualDivAgg['WKS_AR']) {
                const wksAr = virtualDivAgg['WKS_AR'];
                workshopBucket.total_premi += wksAr.total_premi;
                workshopBucket.total_employees += wksAr.total_employees;
                workshopBucket.total_hk += wksAr.total_hk;
                workshopBucket.total_hari_kerja += wksAr.total_hari_kerja;
                workshopBucket.total_upah_bersih += wksAr.total_upah_bersih;
                workshopBucket.total_pph21 += wksAr.total_pph21;
                workshopBucket.total_spsi += wksAr.total_spsi;
                workshopBucket.total_lembur += wksAr.total_lembur;
                workshopBucket.total_premi_brondol += wksAr.total_premi_brondol;
                workshopBucket.total_premi_prunning += wksAr.total_premi_prunning;
                workshopBucket.total_premi_insentif += wksAr.total_premi_insentif;
                workshopBucket.total_premi_kinerja += wksAr.total_premi_kinerja;
                workshopBucket.total_koreksi += wksAr.total_koreksi;
                workshopBucket.total_ffb_weight += wksAr.total_ffb_weight;
                workshopBucket.total_weight_tbs += wksAr.total_weight_tbs;
                wksAr.gang_codes.forEach(gc => workshopBucket.gang_codes.add(gc));
            }
            
            debug(CATEGORY, `Step 4 - WORKSHOP computed: ${workshopBucket.gang_codes.size} gangs, premi=${workshopBucket.total_premi}`);
        }



        // STEP 5: NRS — data already correctly extracted from P1B in Step 3.
        // Previously this zeroed out all NRS financial fields, causing data loss.
        // The subtraction in Step 3 already handles proper separation.
        if (virtualDivAgg['NRS']) {
            const nrs = virtualDivAgg['NRS'];
            debug(CATEGORY, `Step 5 - NRS retained: premi=${nrs.total_premi}, lembur=${nrs.total_lembur}, upah=${nrs.total_upah_bersih}`);
        }

        // STEP 6: Merge real + virtual into final divAgg for result building
        const divAgg: Record<string, AggBucket> = { ...realDivAgg };
        
        debug(CATEGORY, `Step 6 - includeVirtual=${includeVirtual}, realDivAgg keys: ${Object.keys(realDivAgg).join(', ')}`);
        debug(CATEGORY, `Step 6 - virtualDivAgg keys: ${Object.keys(virtualDivAgg).join(', ')}`);
        
        // Only include virtual divisions if requested
        if (includeVirtual) {
            // Add virtual divisions that were built in STEP 2
            for (const [vd, bucket] of Object.entries(virtualDivAgg)) {
                // To prevent duplication in the report, we skip the aggregate 'WORKSHOP' 
                // if we are already showing individual WKS_PG / WKS_AR rows.
                if (vd === 'WORKSHOP' && (virtualDivAgg['WKS_PG'] || virtualDivAgg['WKS_AR'])) {
                    debug(CATEGORY, `Step 6 - ⏭️  Skipping aggregate WORKSHOP to avoid duplication with ${Object.keys(virtualDivAgg).filter(k => k.startsWith('WKS_')).join(', ')}`);
                    continue;
                }

                // MERGE if already exists in realDivAgg (to prevent "double" entries if gang was born in virtual div)
                if (divAgg[vd]) {
                    Object.keys(bucket).forEach(key => {
                        const k = key as keyof AggBucket;
                        if (k === 'gang_codes') {
                            (bucket[k] as Set<string>).forEach((gc: string) => {
                                (divAgg[vd].gang_codes).add(gc);
                            });
                        } else if (typeof bucket[k] === 'number') {
                            (divAgg[vd][k] as number) += (bucket[k] as number) || 0;
                        }
                    });
                    debug(CATEGORY, `Step 6 - 🔀 Merged virtual ${vd} into existing real bucket: emp=${divAgg[vd].total_employees}`);
                } else {
                    divAgg[vd] = bucket;
                    debug(CATEGORY, `Step 6 - ✅ Added virtual ${vd} to report: emp=${bucket.total_employees}`);
                }
            }
            
            debug(CATEGORY, `Step 6 - After adding from virtualDivAgg: ${Object.keys(divAgg).join(', ')}`);
            
            // Ensure ALL expected virtual divisions exist (even if empty)
            // This guarantees they appear in the report
            const expectedVirtualDivs = ['INF', 'NRS', 'WKS_PG', 'WKS_AR', 'MILL'];
            for (const vd of expectedVirtualDivs) {
                if (!divAgg[vd]) {
                    divAgg[vd] = createEmptyBucket();
                    debug(CATEGORY, `Step 6 - ✅ Created empty virtual division: ${vd}`);
                } else {
                    debug(CATEGORY, `Step 6 - ⏭️  ${vd} already exists with data, skipping creation`);
                }
            }
            
            // WORKSHOP row is skipped here because WKS_PG and WKS_AR already represent the data.
            // If we needed a single Workshop row, we would hide the others.
            // Since the user reported "duplication", we remove the aggregate version.
        } else {
            debug(CATEGORY, `Step 6 - includeVirtual=false, skipping virtual divisions`);
        }

        // Step 6.5: Normalize division codes (convert aliases like PG1A -> P1A)
        const normalizedDivAgg: Record<string, AggBucket> = {};
        const aliasMap: Record<string, string> = {
            'PG1A': 'P1A', 'P1a': 'P1A', 'pg1a': 'P1A', 'PLASMA1A': 'P1A',
            'PG1B': 'P1B', 'P1b': 'P1B', 'pg1b': 'P1B', 'PLASMA1B': 'P1B',
            'PG2A': 'P2A', 'P2a': 'P2A', 'pg2a': 'P2A', 'PLASMA2A': 'P2A',
            'PG2B': 'P2B', 'P2b': 'P2B', 'pg2b': 'P2B', 'PLASMA2B': 'P2B',
        };
        
        for (const [divCode, bucket] of Object.entries(divAgg)) {
            const normalizedCode = aliasMap[divCode] || divCode;
            if (normalizedDivAgg[normalizedCode]) {
                // Merge if already exists
                Object.keys(bucket).forEach(key => {
                    const k = key as keyof AggBucket;
                    if (k === 'gang_codes') {
                        (bucket[k] as Set<string>).forEach((gc: string) => {
                            (normalizedDivAgg[normalizedCode][k] as Set<string>).add(gc);
                        });
                    } else if (typeof bucket[k] === 'number') {
                        (normalizedDivAgg[normalizedCode][k] as number) += (bucket[k] as number);
                    }
                });
            } else {
                normalizedDivAgg[normalizedCode] = bucket;
            }
        }

        // Remove any real divisions that have zero or negative employees after subtraction
        // BUT always keep certain divisions even if they have 0 employees
        const keepAlways = new Set([
            'P1A', 'P1B', 'ARC', 'MILL',  // Real divisions
            'INF', 'NRS', 'WKS_PG', 'WKS_AR'  // Virtual divisions
        ]);
        for (const div of Object.keys(normalizedDivAgg)) {
            if (!keepAlways.has(div) && normalizedDivAgg[div].total_employees <= 0 && normalizedDivAgg[div].total_upah_bersih <= 0 && normalizedDivAgg[div].gang_codes.size === 0) {
                delete normalizedDivAgg[div];
            }
        }

        debug(CATEGORY, `Step 6.5 - Final divisions after normalization: ${Object.keys(normalizedDivAgg).join(', ')} `);

        const results: DivisionSummary[] = [];

        // Define order for sorting: Real divisions first, then Virtual in specified order
        const virtualOrder = divisionDefinition.VIRTUAL_DIVISION_ORDER;
        const sortedDivs = Object.keys(normalizedDivAgg).sort((a, b) => {
            const idxA = virtualOrder.indexOf(a);
            const idxB = virtualOrder.indexOf(b);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return 1; // Virtuals at bottom
            if (idxB !== -1) return -1;
            return a.localeCompare(b);
        });

        for (const div of sortedDivs) {
            const row = normalizedDivAgg[div];
            let totalPremi = row.total_premi;
            let totalLembur = row.total_lembur;

            // Apply Backfill if needed
            const backfill = backfillData[div];
            if (backfill) {
                if (totalLembur === 0 && backfill.lembur > 0) totalLembur = backfill.lembur;
                if (totalPremi === 0) {
                    totalPremi = backfill.pruning + backfill.insentif + backfill.kinerja;
                }
            }

            // Total premi displayed as-is from database (includes brondol and all static premiums)
            // Koreksi is NOT subtracted — total premi matches daftar upah total
            const totalPremiDisplay = totalPremi;

            const upah = row.total_upah_bersih;
            const thumbValue = thumbprintData[div] || 0;
            const selisih = thumbValue > 0 ? (upah - thumbValue) : 0;
            
            // Get description, exactly as resolved (canonical) or alias
            const description = divDescs[div] || div;

            // [HK-KEHADIRAN] total_hk = jumlah_hk (raw, SEMUA hari). total_hari_kerja = HK hadir (efektif).
            // JANGAN timpa total_hk dengan total_hari_kerja — itu bikin HK libur = 0.
            // Divisor cost/HK pakai total_hari_kerja (hadir), BUKAN total_hk.
            const hkHadir = Number(row.total_hari_kerja ?? 0);
            results.push({
                division_code: div,
                description: description,
                total_premi: totalPremiDisplay,
                total_premi_excluding_special: totalPremiDisplay,
                total_employees: row.total_employees,
                total_hk: Number(row.total_hk ?? 0),
                total_hari_kerja: hkHadir,
                total_upah_bersih: upah,
                total_upah_kotor: row.total_upah_kotor,
                total_pph21: row.total_pph21,
                total_spsi: row.total_spsi,
                total_lembur: totalLembur,
                total_gangs: row.gang_codes.size,
                total_premi_brondol: row.total_premi_brondol,
                total_premi_prunning: row.total_premi_prunning,
                total_premi_insentif: row.total_premi_insentif,
                total_premi_kinerja: row.total_premi_kinerja,
                total_koreksi: row.total_koreksi,
                total_ffb_weight: tonaseFromMill[div] ?? Math.max(row.total_ffb_weight, row.total_weight_tbs),
                total_weight_tbs: tonaseFromMill[div] ?? Math.max(row.total_ffb_weight, row.total_weight_tbs),
                informasi_tambahan: '',
                thumb_print: thumbValue,
                total_manual: upah,
                selisih: selisih,
                is_subtotal: false,
                is_grand_total: false,
                group: div.charAt(0)
            });
        }

        let finalResults = await deductionAdjustmentService.applyAdjustmentsToDivisionData(month, year, results);
        finalResults = await divisionOverrideService.applyOverridesToDivisionData(
            month,
            year,
            finalResults,
            ['total_upah_bersih', 'total_premi', 'total_lembur', 'total_pph21', 'total_spsi', 'total_employees', 'total_hk']
        );

        debug(CATEGORY, `getAllDivisionsPremiTotals completed in ${Date.now() - startTime}ms`);

        return finalResults;
    }



    public async getAvailablePeriods(divisionCode?: string): Promise<any[]> {
        if (divisionCode) {
            // Since division_code may be 'ALL', filter by gang_code instead
            const gangs = await divisionDefinition.getGangsForDivision(divisionCode);
            if (gangs.length > 0) {
                const gangCodes = gangs.map(g => g.gang_code);
                const rows = await selectDistinctPeriodsByGangCodes(this.extendDb, gangCodes);
                return rows.map(r => ({ period_year: r.period_year, period_month: r.period_month }));
            }
        }
        const rows = await selectDistinctPeriods(this.extendDb);
        return rows.map(r => ({ period_year: r.period_year, period_month: r.period_month }));
    }

    public async getLatestBaseDataPeriod(): Promise<{ month: number, year: number } | null> {
        try {
            // Use CurrentPeriodService to get the "Current Period" logic
            // (Latest TrxDate in ARC + 1 Month)
            const currentPeriod = await currentPeriodService.getCurrentPeriod();
            return {
                month: currentPeriod.month,
                year: currentPeriod.year
            };
        } catch (e) {
            logError(CATEGORY, "Failed to get latest base data period:", e);
            // Fallback to config default if service fails
            return {
                month: Config.DEFAULT_MONTH,
                year: Config.DEFAULT_YEAR
            };
        }
    }

    public async getDivisionsFromHrGang(includeVirtual: boolean = true): Promise<string[]> {
        return divisionDefinition.getAllDivisions(includeVirtual);
    }

    // --- Comparison Logic ---

    private async getBackfillData(month: number, year: number): Promise<Record<string, { pruning: number, insentif: number, kinerja: number, lembur: number }>> {
        const { gangDivMap, gangDescs } = await this.getMetadataForAggregation();
        const rows = await selectLatestAggregationDynamicPremi(this.extendDb, month, year);
        const result: Record<string, { pruning: number, insentif: number, kinerja: number, lembur: number }> = {};

        for (const row of rows) {
            const gangCode = row.gang_code?.trim().toUpperCase() || '';
            const gangDesc = gangDescs[gangCode] || '';
            // Derive division from gang_code via metadata lookup
            const rawLoc = gangDivMap[gangCode] || row.division_code?.trim().toUpperCase() || '';
            const sourceLoc = divisionConfigService.resolveCode(rawLoc);

            // Unified gang→virtual-division resolution (source-aware + pattern-only fallback)
            const virtualDiv = divisionConfigService.resolveGangDivision(gangCode, sourceLoc, gangDesc, new Set(Object.keys(gangDivMap)));
            const div = virtualDiv || sourceLoc;
            if (!div || div === 'ALL' || div === 'UNKNOWN') continue;

            // Initialize only if not exists - don't overwrite!
            if (!result[div]) {
                result[div] = { pruning: 0, insentif: 0, kinerja: 0, lembur: 0 };
            }

            // Try dynamic_premi_data first
            let dynamicPremi = null;

            if (row.dynamic_premi_data) {
                try {
                    dynamicPremi = typeof row.dynamic_premi_data === 'string' ? JSON.parse(row.dynamic_premi_data) : row.dynamic_premi_data;
                } catch (e) {
                    logError(CATEGORY, `Failed to parse dynamic_premi_data for ${div}: `, e);
                }
            }

            // Fallback to informasi_tambahan if dynamicPremi is empty (null, empty array, or empty object)
            let shouldUseFallback = !dynamicPremi;
            if (dynamicPremi) {
                if (Array.isArray(dynamicPremi) && dynamicPremi.length === 0) shouldUseFallback = true;
                else if (typeof dynamicPremi === 'object' && Object.keys(dynamicPremi).length === 0) shouldUseFallback = true;
            }

            if (shouldUseFallback && row.informasi_tambahan) {
                try {
                    dynamicPremi = typeof row.informasi_tambahan === 'string' ? JSON.parse(row.informasi_tambahan) : row.informasi_tambahan;
                } catch (e) {
                    logError(CATEGORY, `Failed to parse informasi_tambahan for ${div}: `, e);
                }
            }

            if (!dynamicPremi) continue;

            // Add debug logging for AB1 and P1A
            if (div === 'AB1' || div === 'P1A') {
                debug(CATEGORY, `getBackfillData processing ${div}: `, {
                    hasDynamicPremiData: !!row.dynamic_premi_data,
                    hasInformasiTambahan: !!row.informasi_tambahan,
                    dynamicPremiKeys: Array.isArray(dynamicPremi) ? dynamicPremi.map((d: any) => d.header) : Object.keys(dynamicPremi || {}),
                    resultBefore: result[div]
                });
            }

            if (Array.isArray(dynamicPremi)) {
                for (const item of dynamicPremi) {
                    const header = (item.header || "").toUpperCase();
                    const val = parseFloat(item.total || 0);

                    if ((header.includes("PRUN") || header.includes("PRUNING")) && !header.includes("BRONDOL")) result[div].pruning += val;
                    if ((header.includes("INSENTIF") && header.includes("PANEN"))) result[div].insentif += val;
                    if (header.includes("KINERJA")) result[div].kinerja += val;
                    if (header.includes("LEMBUR") || header.includes("OVERTIME") || header.includes("OT ")) result[div].lembur += val;
                }
            } else if (typeof dynamicPremi === 'object') {
                // Object format fallback
                if (dynamicPremi.premi_prunning) result[div].pruning += parseFloat(dynamicPremi.premi_prunning || 0);
                if (dynamicPremi.premi_insentif_panen) result[div].insentif += parseFloat(dynamicPremi.premi_insentif_panen || 0);
                // No lembur/kinerja in known object format yet, but safe to ignore if missing
            }

            // Add debug logging after processing
            if (div === 'AB1' || div === 'P1A') {
                debug(CATEGORY, `getBackfillData after processing ${div}: `, {
                    resultAfter: result[div]
                });
            }
        }
        return result;
    }



    private async loadNovember2025OverrideData(): Promise<any[]> {
        const data = await this.loadJsonData("november_summary_report.json");
        return data || [];
    }

    public async getAllDivisionsComparison(month: number, year: number): Promise<any> {
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;

        debug(CATEGORY, `Starting comparison for ${month}/${year} (prev: ${prevMonth}/${prevYear})`);

        // Get current month data - may be empty if not seeded yet
        const currentData = await this.getAllDivisionsPremiTotals(month, year);
        
        // If no data exists for current month, return empty result gracefully
        if (!currentData || currentData.length === 0) {
            warn(CATEGORY, `No aggregation data found for ${month}/${year}, returning empty comparison`);
            return {
                current_period: { month, year },
                previous_period: { month: prevMonth, year: prevYear },
                kpi_summary: {
                    estate_gaji: { current: 0, previous: 0 },
                    mill_gaji: { current: 0, previous: 0 },
                    tbs_weight: { current: 0, previous: 0 },
                    total_premi: { current: 0, previous: 0 },
                    total_lembur: { current: 0, previous: 0 }
                },
                divisions: []
            };
        }

        let previousData: any[] = [];

        try {
            if (prevMonth === 11 && prevYear === 2025) {
                const override = await this.loadNovember2025OverrideData();
                if (override.length > 0) {
                    // Map override JSON to Summary structure
                    // Simplified mapping for now, assuming JSON matches what Python expected
                    // In Python code: estate_division_code -> division_code
                    previousData = override.map(item => ({
                        division_code: item.estate_division_code,
                        total_employees: item.workers || 0,
                        total_upah_bersih: item.total_upah_bersih || 0,
                        total_ffb_weight: 0, // Would need fetching from DB if critical, simplified to 0
                        total_premi: item.total_premi || 0,
                        total_lembur: item.total_lembur || 0,
                        total_premi_prunning: item.pruning || 0
                    }));
                } else {
                    previousData = await this.getAllDivisionsPremiTotals(prevMonth, prevYear);
                }
            } else {
                previousData = await this.getAllDivisionsPremiTotals(prevMonth, prevYear);
            }
        } catch (error: any) {
            warn(CATEGORY, `Failed to load previous month (${prevMonth}/${prevYear}) data:`, error.message);
            previousData = [];
        }

        // Fetch previous month's thumbprint data from JSON file
        // This will be used for the "previous month gaji" comparison
        const prevThumbprintData = await thumbprintService.getThumbprintData(prevMonth, prevYear);
        const prevTonaseFromMill = await this.fetchTonaseFromMill(prevMonth, prevYear);
        debug(CATEGORY, `Loaded previous thumbprint data for ${prevYear} - ${prevMonth}: `, Object.keys(prevThumbprintData).length, "entries");
        debug(CATEGORY, `Previous thumbprint data: `, prevThumbprintData);

        const prevLookup = new Map(previousData.map(d => [d.division_code, d]));
        const comparisonRows = [];

        for (const curr of currentData) {
            const divCode = curr.division_code;
            const prev = prevLookup.get(divCode) || {};

            const currGaji = curr.total_upah_bersih;
            // IMPORTANT: Previous month's gaji comes from THUMBPRINT JSON, not database
            const prevGaji = prevThumbprintData[divCode] || 0;
            const prevTbsWeight = prevTonaseFromMill[divCode] || 0;
            const selisih = currGaji - prevGaji;
            const trend = selisih > 0 ? "NAIK" : (selisih < 0 ? "TURUN" : "TETAP");

            debug(CATEGORY, `${divCode}: current_gaji = ${currGaji}, prev_thumbprint = ${prevThumbprintData[divCode]}, selisih = ${selisih} `);

            comparisonRows.push({
                division_code: divCode,
                description: curr.description,
                workers_previous: prev.total_employees || 0,
                workers_current: curr.total_employees,
                total_pph21_current: curr.total_pph21,
                total_spsi_current: curr.total_spsi,
                total_premi_current: curr.total_premi,
                total_prunning_current: curr.total_premi_prunning,
                total_brondol_current: curr.total_premi_brondol,
                total_insentif_current: curr.total_premi_insentif,
                total_kinerja_current: curr.total_premi_kinerja,
                total_lembur_current: curr.total_lembur,
                // Previous month premi breakdown
                total_premi_previous: prev.total_premi || 0,
                total_prunning_previous: prev.total_premi_prunning || 0,
                total_brondol_previous: prev.total_premi_brondol || 0,
                total_insentif_previous: prev.total_premi_insentif || 0,
                total_kinerja_previous: prev.total_premi_kinerja || 0,
                total_lembur_previous: prev.total_lembur || 0,
                previous_month: {
                    gaji: prevGaji, // Using thumbprint data from JSON for previous month's gaji
                    tbs_weight: prevTbsWeight,
                    thumb_print: prevThumbprintData[divCode] || 0
                },
                current_month: {
                    gaji: currGaji,
                    tbs_weight: curr.total_ffb_weight,
                    thumb_print: curr.thumb_print
                },
                selisih,
                trend
            });
        }
            // Totals
        const sumField = (rows: any[], fieldPath: string[]) => rows.reduce((acc, row) => {
            let val = row;
            for (const key of fieldPath) val = val?.[key];
            const anyRows = rows as any;
            return acc + (val || 0);
        }, 0);

        const kpiSummary = {
            estate_gaji: {
                current: sumField(comparisonRows.filter(r => r.division_code !== 'MILL'), ['current_month', 'gaji']),
                previous: sumField(comparisonRows.filter(r => r.division_code !== 'MILL'), ['previous_month', 'gaji'])
            },
            mill_gaji: {
                current: sumField(comparisonRows.filter(r => r.division_code === 'MILL'), ['current_month', 'gaji']),
                previous: sumField(comparisonRows.filter(r => r.division_code === 'MILL'), ['previous_month', 'gaji'])
            },
            tbs_weight: {
                current: sumField(comparisonRows, ['current_month', 'tbs_weight']),
                previous: sumField(comparisonRows, ['previous_month', 'tbs_weight'])
            },
            total_premi: {
                current: sumField(comparisonRows, ['total_premi_current']),
                previous: sumField(comparisonRows, ['total_premi_previous'])
            },
            total_lembur: {
                current: sumField(comparisonRows, ['total_lembur_current']),
                previous: sumField(comparisonRows, ['total_lembur_previous'])
            }
        };

        return {
            current_period: { month, year },
            previous_period: { month: prevMonth, year: prevYear },
            kpi_summary: kpiSummary,
            divisions: comparisonRows
        };
    }

    // --- Impact / Analysis / Mill reports — delegated to SummaryReportService ---

    public async getImpactReportData(month: number, year: number): Promise<any> {
        return SummaryReportService.getInstance().getImpactReportData(month, year);
    }

    public async getAnalysisReportData(month: number, year: number, filterType: string = 'all'): Promise<any> {
        return SummaryReportService.getInstance().getAnalysisReportData(month, year, filterType);
    }

    public async getMillTotals(month: number, year: number): Promise<any> {
        return SummaryReportService.getInstance().getMillTotals(month, year);
    }

    public async getDivisionLuasHektar(): Promise<Record<string, number>> {
        return SummaryReportService.getInstance().getDivisionLuasHektar();
    }

    public async getDynamicPremiInsentifPanen(month: number, year: number): Promise<Record<string, { insentif_panen: number }>> {
        return SummaryReportService.getInstance().getDynamicPremiInsentifPanen(month, year);
    }

    /**
     * Get division descriptions as a map (API access)
     */
    public async getDivisionDescriptionsMap(): Promise<Record<string, string>> {
        const { divDescs } = await this.getMetadataForAggregation();
        return divDescs;
    }

    /**
     * Get premi headers for a specific division (LocCode)
     */
    public async getPremiHeadersForDivision(locCode: string, month: number, year: number): Promise<string[]> {
        const startDate = `${year}-${month.toString().padStart(2, "0")}-01`;
        const endDate = month === 12
            ? `${year + 1}-01-01`
            : `${year}-${(month + 1).toString().padStart(2, "0")}-01`;

        try {
            // Use extend_db_ptrj instead of db_ptrj for faster access
            const rows = await selectPremiTypesFromHistory(this.extendDb, month, year, locCode);

            // Extract unique premi types from dynamic_premi_data
            const headers: string[] = [];
            for (const row of rows) {
                if (row.DocDesc && !headers.includes(row.DocDesc)) {
                    headers.push(row.DocDesc);
                }
            }
            return headers;
        } catch (e) {
            logError(CATEGORY, "Failed to get premi headers for division:", e);
            return [];
        }
    }

    public async getDivisionSummary(divisionCode?: string, month?: number, year?: number, _includeVirtual?: boolean) {
        // [FIX] Fetch gang descriptions separately (HR_GANG is in different database)
        const gangDescs = await this.getAllGangDescriptions();
        const thumbprintData = month && year ? await this.loadThumbprintData(month, year) : {};
        
        const whereClauses = ["1 = 1"];
        const params: any[] = [];

        if (divisionCode) {
            // Since division_code may be 'ALL', filter by gang_code instead
            const gangs = await divisionDefinition.getGangsForDivision(divisionCode);
            console.log(`[SummaryService] getDivisionSummary for ${divisionCode}: ${gangs.length} gangs`);
            console.log(`[SummaryService] Gang codes: [${gangs.map(g => g.gang_code).join(', ')}]`);
            
            if (gangs.length > 0) {
                const placeholders = gangs.map(() => '?').join(',');
                whereClauses.push(`gang_code IN(${placeholders})`);
                params.push(...gangs.map(g => g.gang_code));
            } else {
                // Fallback: use unified division mapping
                const aliases = gangService.getAllDivisionAliases(divisionCode);
                whereClauses.push(`division_code IN (${aliases.map(() => '?').join(',')})`);
                params.push(...aliases);
            }
        }

        if (month) {
            whereClauses.push(`period_month = ?`);
            params.push(month);
        }

        if (year) {
            whereClauses.push(`period_year = ?`);
            params.push(year);
        }

        const whereSql = whereClauses.join(" AND ");

        const rows = await selectDivisionSummaryRows(this.extendDb, whereSql, params);
        const isVirtualDivision = divisionCode ? divisionConfigService.isVirtualDivision(divisionCode) : false;
        const canonicalDivisionCode = divisionCode ? divisionConfigService.resolveCode(divisionCode) : undefined;

        // [FIX] Override gang_description with real descriptions from HR_GANG
        for (const row of rows) {
            if (row.gang_code && gangDescs[row.gang_code]) {
                row.gang_description = gangDescs[row.gang_code];
            }
            if (isVirtualDivision && canonicalDivisionCode) {
                row.division_code = canonicalDivisionCode;
            }
        }

        // Patterns to EXCLUDE from dynamic premi headers display
        // The user requested to include FULL premiums breakdown, including prunning, kinerja, insentif, and tiket.
        const excludePatterns = ['koreksi'];

        // Helper function to check if header should be excluded
        const shouldExcludeHeader = (header: string): boolean => {
            const headerLower = header.toLowerCase();
            return excludePatterns.some(pattern => headerLower.includes(pattern));
        };

        // Helper function to get dynamic premi value from a row
        const getDynamicPremiValue = (row: any, headerName: string): number => {
            if (!row._dynamic_premi_list || !Array.isArray(row._dynamic_premi_list)) return 0;
            const item = row._dynamic_premi_list.find(
                (p: any) => p.header && p.header.toLowerCase() === headerName.toLowerCase()
            );
            return item ? parseFloat(item.total || 0) : 0;
        };

        const results = rows.map(row => {
            let dynamicPremi: any[] = [];
            let backfill = {
                insentif: 0,
                kinerja: 0,
                prunning: 0,
                koreksi: 0
            };

            try {
                if (row.dynamic_premi_data) {
                    dynamicPremi = typeof row.dynamic_premi_data === 'string'
                        ? JSON.parse(row.dynamic_premi_data)
                        : row.dynamic_premi_data;
                }

                if ((!dynamicPremi || !Array.isArray(dynamicPremi) || dynamicPremi.length === 0) && row.informasi_tambahan) {
                    try {
                        dynamicPremi = typeof row.informasi_tambahan === 'string'
                            ? JSON.parse(row.informasi_tambahan)
                            : row.informasi_tambahan;
                    } catch (e) { }
                }

                if (!Array.isArray(dynamicPremi)) {
                    dynamicPremi = [];
                }

                // [FIX] Deduplicate dynamicPremi - merge all 'brondol' entries into one
                const deduplicatedPremi: any[] = [];
                const premiMap = new Map<string, number>();
                
                for (const item of dynamicPremi) {
                    const header = (item.header || '').toUpperCase().trim();
                    const total = parseFloat(item.total || 0);
                    
                    // Merge all brondol entries into one
                    if (header.includes('BRONDOL')) {
                        const existing = premiMap.get('BRONDOL') || 0;
                        premiMap.set('BRONDOL', existing + total);
                    } else {
                        // Keep other premi items as-is
                        deduplicatedPremi.push(item);
                    }
                }
                
                // Add merged brondol entry
                if (premiMap.has('BRONDOL') && premiMap.get('BRONDOL')! > 0) {
                    deduplicatedPremi.unshift({ 
                        header: 'BRONDOL', 
                        total: premiMap.get('BRONDOL') 
                    });
                }
                
                dynamicPremi = deduplicatedPremi;

                const t_brondol = parseFloat(row.total_premi_brondol || 0);
                if (t_brondol > 0) {
                    const hasBrondol = dynamicPremi.some((item: any) => item.header && item.header.toUpperCase().includes('BRONDOL'));
                    if (!hasBrondol) {
                        dynamicPremi.unshift({ header: 'PREMI BRONDOL', total: t_brondol });
                    }
                }

                if (Array.isArray(dynamicPremi)) {
                    for (const item of dynamicPremi) {
                        const val = parseFloat(item.total || 0);
                        const header = (item.header || "").toUpperCase().replace(/ /g, '_');

                        if (header.includes("INSENTIF") || header.includes("PANEN")) backfill.insentif += val;
                        if (header.includes("KINERJA")) backfill.kinerja += val;
                        if ((header.includes("PRUN") || header.includes("PRUNING")) && !header.includes("BRONDOL")) backfill.prunning += val;
                        if (header.includes("KOREKSI") && !header.includes("KOREKSI_HK")) backfill.koreksi += val;
                    }
                }
            } catch (e) { }

            const t_insentif = parseFloat(row.total_premi_insentif || 0) || backfill.insentif;
            const t_kinerja = parseFloat(row.total_premi_kinerja || 0) || backfill.kinerja;
            const t_prunning = parseFloat(row.total_premi_prunning || 0) || backfill.prunning;
            const t_koreksi = parseFloat(row.total_koreksi || 0) || backfill.koreksi;

            const rowTotalPremi = parseFloat(row.total_premi || 0);

            // As requested: total_premi should be the FULL amount from portal
            const totalPremiDisplay = rowTotalPremi;

            return {
                ...row,
                total_premi: totalPremiDisplay,
                total_premi_excluding_special: totalPremiDisplay, // Simplified as requested
                total_premi_insentif: t_insentif,
                total_premi_kinerja: t_kinerja,
                total_premi_prunning: t_prunning,
                total_koreksi: 0, // Hide koreksi as requested
                _dynamic_premi_list: dynamicPremi
            };
        });

        const upahByDivision = results.reduce((acc, row) => {
            const div = row.division_code || "";
            acc[div] = (acc[div] || 0) + Number(row.total_upah_bersih || 0);
            return acc;
        }, {} as Record<string, number>);

        const canonicalThumbprintData: Record<string, number> = {};
        for (const [key, value] of Object.entries(thumbprintData)) {
            canonicalThumbprintData[divisionConfigService.resolveCode(key)] = Number(value || 0);
        }

        for (const row of results) {
            const rawDiv = row.division_code || "";
            const div = divisionConfigService.resolveCode(rawDiv);
            const thumbValue = Number(canonicalThumbprintData[div] || 0);
            const divisionUpah = Number(upahByDivision[rawDiv] || 0);
            row.thumb_print = thumbValue;
            row.selisih = thumbValue > 0 ? divisionUpah - thumbValue : 0;
        }

        // Collect all unique headers for frontend (excluding the ones we separated)
        const allHeaders = new Set<string>();
        const filteredHeaders = new Set<string>();

        results.forEach(row => {
            if (Array.isArray(row._dynamic_premi_list)) {
                row._dynamic_premi_list.forEach((item: any) => {
                    const header = item.header;
                    if (header) {
                        allHeaders.add(header);
                        // Only add to filtered headers if not excluded
                        if (!shouldExcludeHeader(header)) {
                            filteredHeaders.add(header);
                        }
                    }
                });
            }
        });

        const headerList = Array.from(allHeaders).sort();
        const filteredHeaderList = Array.from(filteredHeaders).sort();
        
        // [FIX] Remove duplicate 'brondol' headers (case-insensitive)
        const uniqueFilteredHeaders: string[] = [];
        const seenBrondol = new Set<string>();
        for (const header of filteredHeaderList) {
            const normalized = header.toLowerCase().trim();
            if (normalized.includes('brondol')) {
                if (!seenBrondol.has('brondol')) {
                    seenBrondol.add('brondol');
                    uniqueFilteredHeaders.push(header);
                }
            } else {
                uniqueFilteredHeaders.push(header);
            }
        }

        // Attach headers to first row (convention used by frontend)
        if (results.length > 0) {
            results[0]._premi_headers = headerList;
            results[0]._premi_headers_filtered = uniqueFilteredHeaders;
        }

        // Calculate Grand Total
        const grandTotal = results.reduce((acc, row) => {
            const rowTotalPremi = Number(row.total_premi) || 0;
            const rowTotalPremiInsentif = Number(row.total_premi_insentif) || 0;
            const rowTotalPremiKinerja = Number(row.total_premi_kinerja) || 0;
            const rowTotalPremiPrunning = Number(row.total_premi_prunning) || 0;
            // total_premi_excluding_special = full total_premi (same as daftar upah)
            // No longer subtract insentif/kinerja/prunning per user request
            const rowTotalPremiExcludingSpecial = rowTotalPremi;

            return {
                total_employees: acc.total_employees + (Number(row.total_employees) || 0),
                total_hk: acc.total_hk + (Number(row.total_hk) || 0),
                total_lembur: acc.total_lembur + (Number(row.total_lembur) || 0),
                total_pph21: acc.total_pph21 + (Number(row.total_pph21) || 0),
                total_spsi: acc.total_spsi + (Number(row.total_spsi) || 0),
                total_upah_bersih: acc.total_upah_bersih + (Number(row.total_upah_bersih) || 0),
                total_premi: acc.total_premi + rowTotalPremi,
                total_premi_excluding_special: acc.total_premi_excluding_special + rowTotalPremiExcludingSpecial,
                total_premi_insentif: acc.total_premi_insentif + rowTotalPremiInsentif,
                total_premi_kinerja: acc.total_premi_kinerja + rowTotalPremiKinerja,
                total_premi_prunning: acc.total_premi_prunning + rowTotalPremiPrunning,
                total_koreksi: acc.total_koreksi + (Number(row.total_koreksi) || 0),
                thumb_print: acc.thumb_print + (Number(row.thumb_print) || 0),
                selisih: acc.selisih + (Number(row.selisih) || 0),
                // Calculate totals for each filtered dynamic premi header (using unique headers)
                dynamic_premi_totals: uniqueFilteredHeaders.reduce((dynAcc, header) => {
                    dynAcc[header] = (dynAcc[header] || 0) + getDynamicPremiValue(row, header);
                    return dynAcc;
                }, { ...(acc.dynamic_premi_totals || {}) } as Record<string, number>)
            };
        }, {
            total_employees: 0,
            total_hk: 0,
            total_lembur: 0,
            total_pph21: 0,
            total_spsi: 0,
            total_upah_bersih: 0,
            total_premi: 0,
            total_premi_excluding_special: 0,
            total_premi_insentif: 0,
            total_premi_kinerja: 0,
            total_premi_prunning: 0,
            total_koreksi: 0,
            thumb_print: 0,
            selisih: 0,
            dynamic_premi_totals: {} as Record<string, number>
        });

        let comparisonThumbprint = 0;
        if (divisionCode) {
            const canonicalSelectedDiv = divisionConfigService.resolveCode(divisionCode);
            comparisonThumbprint = Number(canonicalThumbprintData[canonicalSelectedDiv] || 0);
        } else {
            comparisonThumbprint = Object.entries(upahByDivision).reduce((sum: number, [div]) => {
                const canonicalDiv = divisionConfigService.resolveCode(div);
                return sum + Number(canonicalThumbprintData[canonicalDiv] || 0);
            }, 0);
        }
        const comparisonUpah = (Object.values(upahByDivision) as number[]).reduce((a, b) => a + Number(b || 0), 0);
        const comparisonSelisih = comparisonThumbprint > 0 ? comparisonUpah - comparisonThumbprint : 0;

        grandTotal.thumb_print = comparisonThumbprint;
        grandTotal.selisih = comparisonSelisih;

        const comparisonTotal = {
            thumb_print: comparisonThumbprint,
            selisih: comparisonSelisih,
        };

        console.log(`[SummaryService] division=${divisionCode} canonical=${canonicalDivisionCode} virtual=${isVirtualDivision} thumbprintData=${JSON.stringify(thumbprintData)} comparisonTotal=${JSON.stringify(comparisonTotal)}`);

        return {
            data: results,
            grand_total: grandTotal,
            comparison_total: comparisonTotal,
            filtered_headers: uniqueFilteredHeaders
        };
    }

    /**
     * Get all gang descriptions from extend_db_ptrj (history_hr_gang)
     * Returns a map: gang_code -> description
     */
    public async getAllGangDescriptions(): Promise<Record<string, string>> {
        try {
            // Fetch from history_hr_gang in extend_db_ptrj
            const gangRows = await selectGangDescriptions(this.extendDb);

            // Build result map: gang_code -> description
            const result: Record<string, string> = {};
            for (const row of gangRows) {
                const gangCode = row.gang_code?.trim() || "";
                const gangDesc = row.gang_description?.trim() || "";
                result[gangCode] = gangDesc || gangCode;
            }

            return result;
        } catch (error: any) {
            logError(CATEGORY, "Failed to get gang descriptions from history_hr_gang:", error);
            return {};
        }
    }


    /**
     * Fetch tonase (FFB weight) per division from db_ptrj_mill via SERVER_PROFILE_3.
     * Queries WM_TICKET joined with PU_SUPPLIER to match by division code.
     * Returns map: divisionCode -> tonase (in tons)
     * Divisions without matching data will not have an entry (will be 0).
     */
    public async fetchTonaseFromMill(month: number, year: number): Promise<Record<string, number>> {
        // Read authoritative per-division tonase from division_tonase (mill supplier, PTRJ01-09 internal).
        // Replaces the old WM_TICKET PTRJ% scan which included IJL/plasma and double-counted via supplier-name matching.
        const result: Record<string, number> = {};
        try {
            const rows = await selectDivisionTonase(this.extendDb, month, year);

            for (const row of rows || []) {
                const div = String(row.division_code || '').trim().toUpperCase();
                const ton = Number(row.tonase) || 0;
                if (div && ton > 0) {
                    result[div] = ton;
                    debug(CATEGORY, `Tonase ${div}: ${ton.toFixed(2)} tons (division_tonase)`);
                }
            }
        } catch (error: any) {
            logError(CATEGORY, `Failed to fetch tonase from division_tonase:`, error.message);
        }
        return result;
    }

    public async updateThumbprint(month: number, year: number, divisionCode: string, value: number): Promise<boolean> {
        return await thumbprintService.updateThumbprintValue(month, year, divisionCode, value);
    }

    /**
     * Phase 2: Detailed Gang Analysis for Upah Bersih and Lembur Breakdown
     * Returns the aggregated components of Upah Bersih and ranked Lembur tasks.
     */
    public async getGangDetailedAnalysis(gangCode: string, month: number, year: number): Promise<any> {
        try {
            // 1. Fetch Summary Data for the gang
            const summaryRow = await selectGangSummaryRow(this.extendDb, gangCode, month, year);

            const summary = summaryRow[0] || null;

            // 2. Fetch Detailed Lembur Data
            // Join payroll_history_detail with payroll_history_header to filter by gang, month, year
            const detailRows = await selectGangLemburDetails(this.extendDb, gangCode, month, year);

            // Aggregate Lembur tasks
            const taskMap: Record<string, { task_code: string, task_desc: string, total_hours: number, total_amount: number }> = {};

            for (const row of detailRows) {
                if (!row.lembur_records) continue;
                try {
                    const records = typeof row.lembur_records === 'string' ? JSON.parse(row.lembur_records) : row.lembur_records;
                    for (const rec of records) {
                        const code = rec.task_code || 'UNKNOWN';
                        const desc = rec.task_desc || 'Unknown Task';
                        const hrs = parseFloat(rec.hours || 0);
                        const amt = parseFloat(rec.amount || 0);

                        if (!taskMap[code]) {
                            taskMap[code] = { task_code: code, task_desc: desc, total_hours: 0, total_amount: 0 };
                        }
                        taskMap[code].total_hours += hrs;
                        taskMap[code].total_amount += amt;
                    }
                } catch (e) {
                    logError(CATEGORY, `Failed to parse lembur_records for ${row.emp_name}:`, e);
                }
            }

            // Rank tasks by total_amount descending
            const rankedLemburTasks = Object.values(taskMap).sort((a, b) => b.total_amount - a.total_amount);

            return {
                success: true,
                gang_code: gangCode,
                month,
                year,
                summary_breakdown: summary,
                lembur_analysis: {
                    total_records: detailRows.length,
                    tasks: rankedLemburTasks
                }
            };
        } catch (e: any) {
            logError(CATEGORY, `Failed to get gang detailed analysis for ${gangCode}:`, e);
            return {
                success: false,
                error: e.message
            };
        }
    }

    /**
     * Update a single cell value in daftar_upah_aggregation_history for a specific gang
     */
    public async updateGangCell(
        month: number,
        year: number,
        gang_code: string,
        field: string,
        value: number
    ): Promise<boolean> {
        // Validate field name to prevent SQL injection
        const allowedFields = [
            'total_employees',
            'total_hk',
            'total_lembur',
            'total_spsi',
            'total_upah_bersih',
            'total_premi',
            'total_premi_insentif',
            'total_premi_kinerja',
            'total_premi_brondol',
            'total_premi_prunning',
            'total_gaji_pokok',
            'total_beras',
            'total_jabatan',
            'total_masa_kerja',
            'total_tunjangan',
            'total_upah_kotor',
            'total_potongan',
            'total_bpjs_pekerja',
            'total_bpjs_majikan',
            'total_hari_kerja',
            'total_cuti_tahunan',
            'total_cuti_sakit',
            'total_cuti_minggu',
            'total_cuti_nasional',
            'total_upah_dasar',
            'total_upah_pokok',
            'total_ffb_weight',
            'total_weight_tbs',
            'total_koreksi'
        ];

        if (!allowedFields.includes(field)) {
            throw new Error(`Invalid field: ${field}. Allowed fields: ${allowedFields.join(', ')}`);
        }

        try {
            // Update the specific field in daftar_upah_aggregation_history
            const result = await updateGangCellValue(this.extendDb, field, value, month, year, gang_code);

            const finalRes = result as any;
            if (finalRes.affectedRows === 0) {
                warn(CATEGORY, `No record found for gang ${gang_code} in ${month}/${year}`);
                return false;
            }

            info(CATEGORY, `Updated ${field}=${value} for gang ${gang_code} in ${month}/${year}`);
            return true;
        } catch (error: any) {
            logError(CATEGORY, `Failed to update gang cell:`, error);
            throw error;
        }
    }
}

export const summaryService = SummaryService.getInstance();
