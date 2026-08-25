import { Database } from "../db/client";
import { ADTRANS_DYNAMIC_PREMI_PATTERNS, mapAdtransPremiField, normalizeAdtransPotonganField, normalizeKnownAdtransPremiField } from "./payroll/adtransDocDescMapping";
import { Config } from "../config";
import { gangService } from "./gangService";
import { lemburCalculator } from "./lemburCalculator";
import { EmployeeEstateService } from "./employeeEstateService";
import { currentPeriodService } from "./currentPeriodService";
import { PayrollComponentMetadata } from "../types/payroll/PayrollComponent";
import { harvesterService } from "./harvesterService";
import { historyDatabaseService } from "./historyDatabaseService";
// [FIX] Removed static import to prevent circular dependency
// import { lemburService, premiService, tunjanganService, potonganService, pph21TerService, payrollComponentRegistry } from "./payroll";
import { gajiPokokService } from "./payroll/components/GajiPokokService";
import { manualAdjustmentService } from "./manualAdjustmentService";
import { employeeHrDataService } from "./employeeHrDataService";
import { divisionDefinition } from "./divisionDefinition";
import { employeeGangHistoryService } from "./employeeGangHistoryService";
import { OtherIncomesService } from "./otherIncomesService";
import { calculateAllCaruman, getCarumanForPph21 } from './carumanDefinitions';
import { cacheService } from "./cacheService";
// PTKP mapping - Single Source of Truth
import { mapBerasRateToPTKP, mapPTKPToTER } from './payroll/formulas/PTKPMapper';
import { calculateMasaKerjaDisplay, deriveInitialSpsiMember } from "../utils/payrollProfileRules";
import { debug, info, warn, error as logError } from "../utils/logger";
import { PayrollCalculator } from "./payroll/components/PayrollCalculator";
import { applyManualAdjustmentsToEmployee } from "./payroll/manualAdjustments/manualAdjustmentApplier";
import type { ManualAdjustmentFieldSyncMeta } from "./payroll/manualAdjustments/manualAdjustmentApplier";
import { toManualAdjustmentFieldName } from "./payroll/manualAdjustments/manualAdjustmentNaming";
import { payrollAutoBufferService, resolveSyncFrameColor } from "./payroll/payrollAutoBufferService";
import { divisionConfigService } from "./config/DivisionConfigService";
import { buildLeaveSqlExpressions } from "./payroll/extractors/leaveRules";
import { processInBatches } from "../utils/batchProcessor";
import {
    resolvePayrollDivisionCodeForScope,
    resolvePayrollGangPrefixForDivision
} from "../utils/payrollGangScope";
import {
    attachPayrollPeriodAdjustmentNotes,
    resolveAdjustedJabatanJumlah,
    shouldForcePotPph21ToTer
} from "../utils/payrollPeriodAdjustments";
import {
    getCanonicalOtherIncomeType,
    sumOtherIncomeByCanonicalType
} from "../utils/otherIncomeCanonical";

import {
    applyJoinDateSourcesToEmployees,
    attachManualAdjustmentMetadata,
    attachManualAdjustmentSourceComparisons,
    attachManualAdjustmentValueSourceComparison,
    buildLatestHistoryJoinDateQuery,
    buildLatestProfileJoinDateQuery,
    buildLatestValueJoinDateQuery,
    buildManualAdjustmentIdentityIndex,
    filterRowsExcludedFromDivision,
    getManualAdjustmentsForEmployee,
    normalizePayrollValuePriorityMode,
    pickStaticPotonganForManualBuffer,
    pickStaticPremiForManualBuffer,
    registerManualAdjustmentMetadataDynamicHeaders,
    resolveManualAdjustmentDbPtrjCompareAmount,
    resolveManualAdjustmentFetchGangCode,
    resolveManualAdjustmentSourcePolicy,
    shouldKeepPayrollRowAfterEffectiveHkFilter,
} from "./payroll/extract/extractHelpers";
export * from "./payroll/extract/extractHelpers";
import { extractPayrollCore } from "./payroll/extract/extractCore";
import {
    getEmployeesFallbackLive,
    getEmployees as getEmployeesQuery,
    getAttendance as getAttendanceQuery,
    getCuti as getCutiQuery,
    getPremi as getPremiQuery,
    getPotongan as getPotonganQuery,
    getLemburDetailsFromCalculator as getLemburDetailsFromCalculatorQuery,
    getLemburDetailsWithTaskBreakdown as getLemburDetailsWithTaskBreakdownQuery,
    getLemburDetails as getLemburDetailsQuery,
    getTunjanganAmount as getTunjanganAmountQuery,
    getLemburFromDocDesc as getLemburFromDocDescQuery,
    getBerasFromDocDesc as getBerasFromDocDescQuery,
    getUpahPokok as getUpahPokokQuery,
    normalizePremiName as normalizePremiNameQuery,
    normalizePotonganName as normalizePotonganNameQuery,
    getBunchesBatch as getBunchesBatchQuery,
    getBrondol as getBrondolQuery,
    getPositionHistory as getPositionHistoryQuery,
    getTaskCodes as getTaskCodesQuery,
} from "./payroll/extract/extractQueries";
import type { EmployeeRow, CutiData, LemburData, LemburDataWithDetails } from "./payroll/extract/extractQueries";

const CATEGORY = "DataExtractor";

interface ShortageDetail {
    date: string;
    day_name: string;
    actual_hours: number;
    target_hours: number;
    shortage_hours: number;
}

interface ExcessDetail {
    date: string;
    day_name: string;
    actual_hours: number;
    target_hours: number;
    excess_hours: number;
}

export interface PayrollRow {
    emp_code?: string;
    nik: string;
    nama: string;
    jabatan_estate?: string;
    jenis_kelamin: string;
    status_ptkp: string;
    kategori_ter: string;
    loc_code: string;
    gang_code: string;
    alamat: string;
    // Upah Dasar: Base wage rate from HR_PAYROLL.PayRate (daily rate)
    // = Gaji Pokok per Hari (rate, bukan jumlah). Sumber: HR_PAYROLL.PayRate (via GajiPokokService)
    upah_dasar: number;
    jumlah_hk: number;
    total_jam_kerja: number;
    has_shortage?: boolean;
    shortage_details?: ShortageDetail[];
    shortage_total_hours?: number;
    has_excess?: boolean;
    excess_details?: ExcessDetail[];
    excess_total_hours?: number;
    hk_warning?: string; // 'kurang_jam' | 'salah_scan' | null
    hari_kerja: number;
    gaji_pokok: number;
    kehadiran: number;
    cuti_tahunan_hari: number;
    cuti_sakit_haid_hari: number;
    cuti_minggu_hari: number;
    cuti_nasional_hari: number;
    // Task/Job Code fields
    task_code?: string;
    task_desc?: string;
    task_type?: string;
    task_uom?: string;
    beras_rate: number;
    beras_jumlah: number;
    /** Tunjangan jabatan RATE (uang/hari) from PR_ADTRANSLN where DocDesc LIKE '%JABATAN%' */
    jabatan_rate: number;
    /** Tunjangan jabatan JUMLAH (total uang) from PR_ADTRANSLN - NOT role text! */
    jabatan_jumlah: number;
    masa_kerja_tahun: number;
    masa_kerja_rate: number;
    masa_kerja_jumlah: number;
    lembur_jam: number;
    lembur_rate: number;
    lembur_jumlah: number;
    lembur_records?: Array<{
        trx_date: string;
        task_code: string;
        task_desc: string;
        day_type: string;
        hours: number;
        rate: number;
        amount: number;       // Calculated amount (from tier-based rate)
        raw_amount: number;   // Amount from PR_TASKREGLN table
        raw_rate: number;     // Rate from PR_TASKREGLN table
        meta?: PayrollComponentMetadata;
    }>;
    // Harvest / Bunches fields (for harvest gangs ending with "H")
    bunches_total?: number;
    bunches_ripe?: number;
    bunches_unripe?: number;
    bunches_underripe?: number;
    bunches_overripe?: number;
    bunches_rotten?: number;
    bunches_abnormal?: number;
    loose_fruit?: number;
    bunches_transactions?: number;
    total_tunjangan: number;
    premi_brondol: number;
    // [PHASE 2.5] Brondol dual source breakdown
    premi_brondol_loosefruit: number;  // From PR_LOOSEFRUIT
    premi_brondol_adtrans: number;     // From PR_ADTRANS (DocDesc containing BRONDOL)
    premi_brondol_total: number;        // Combined total (loosefruit + adtrans)
    premi_pph: number; // PREMI PPH - ADDED (+) to upah_bersih, not subtracted
    total_premi: number;
    premi: Record<string, number>;
    premi_details?: any[];
    jumlah_upah_kotor: number;
    // Caruman ASTEK
    pot_astek_pekerja: number;
    pot_astek_majikan: number;
    pot_astek_jumlah: number;
    // BPJS Kesehatan
    pot_bpjs_kesehatan_pekerja: number;
    pot_bpjs_kesehatan_majikan: number;
    pot_bpjs_kesehatan_jumlah: number;
    // BPJS Pensiun
    pot_bpjs_pensiun_pekerja: number;
    pot_bpjs_pensiun_majikan: number;
    pot_bpjs_pensiun_jumlah: number;
    // New fields for Penggajian Group
    gaji_pokok_ideal: number;
    gaji_pokok_aktual: number;
    koreksi_hk: number;
    // Other deductions
    pot_spsi: number;
    pot_pph21: number;
    pot_koreksi: number;
    premi_koreksi: number;
    potongan_upah_kotor_total: number;
    potongan_upah_kotor_details?: {
        koreksi: number;
        total: number;
    };
    total_potongan: number;
    total_potongan_bersih: number;
    // New calculated tax fields
    // IMPORTANT: ASTEK and BPJS Kesehatan are calculated from payrate × 30 (monthly salary), NOT from actual HK
    gaji_pokok_bulanan: number; // payrate × 30 (for ASTEK/BPJS calculation)
    astek_084: number; // ASTEK/BPJS Pensiun Majikan (0.84%) - calculated from gaji_pokok_bulanan + masa_kerja_jumlah
    bpjs_kesehatan_majikan_4_pct: number; // BPJS Kesehatan Majikan (4%) - calculated from gaji_pokok_bulanan + masa_kerja_jumlah
    penghasilan_bruto: number; // For PPH21 TER: gaji_pokok_aktual + tunjangan + lembur + premi + astek_084 + bpjs_kesehatan_majikan_4_pct
    upah_kotor_pajak: number; // Jumlah Upah Kotor + Astek + BPJS Kesehatan (untuk header/pajak)
    // PPH21 TER fields
    tarif_pajak_ter: number; // TER rate as percentage (e.g., 5 for 5%)
    pph21_ter: number; // Calculated PPH21 amount using TER method
    taxable_pendapatan_lainnya: number; // sama dengan pendapatan_lainnya (semua taxable)
    upah_bersih: number;
    pot_astek: number;
    pot_astek_maj: number;
    pot_bpjs_pekerja_total: number;
    // Other Incomes (THR, Bonus, Custom) - for display and calculation
    other_incomes?: { type: string; name: string; amount: number }[];
    // Taxable breakdown of other incomes (for PAJAK section)
    taxable_pendapatan_thr: number;
    taxable_pendapatan_bonus: number;
    taxable_pendapatan_custom: number;
    value_sync_frame?: Record<string, "red" | "green">;
    value_source_compare?: Record<string, { db_ptrj: number | string | boolean | null; active: number | string | boolean | null }>;
    manual_adjustment_metadata?: Record<string, any>;
    manual_adjustment_metadata_mismatch?: Record<string, { amount: number; detail_total: number; diff: number; reason?: string }>;
    [key: string]: any;
}

function cleanNameFormat(name: string): string {
    if (!name) return '';
    return name.replace(/\([^)]*\)/g, '').replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
}

const DIVISION_TO_LOCCODE: Record<string, string> = {
    "PG1A": "P1A", "PG1B": "P1B", "PG2A": "P2A", "PG2B": "P2B",
    "DME": "DME", "ARA": "ARA", "ARB1": "AB1", "ARB2": "AB2",
    "INFRA": "INF", "ARC": "ARC", "IJL": "IJL"
};

export class DataExtractorService {
    private static instance: DataExtractorService;
    private db: Database;

    private constructor() {
        this.db = Database.getInstance();
    }

    public static getInstance(): DataExtractorService {
        if (!DataExtractorService.instance) {
            DataExtractorService.instance = new DataExtractorService();
        }
        return DataExtractorService.instance;
    }

    public async extractPayrollData(
        month: number,
        year: number,
        gangCode: string = "ALL",
        divisionCode?: string,
        specificEmpCode: string | null = null,
        serverProfile?: string,
        includeVirtualGangs: boolean = false,
        useHistoryDb?: boolean | null,
        gangPrefix?: string | null,
        skipHarvest: boolean = false,
        skipHeavyDetails: boolean = false,
        snapshotVersion?: number | null,
        valuePriorityModeInput?: string | null
    ): Promise<{
        data_rows: PayrollRow[];
        dynamic_premi_headers: string[];
        dynamic_potongan_headers: string[];
        premi_title_map: Record<string, string>;
        potongan_title_map: Record<string, string>;
        meta: {
            execution_time_ms: number;
            row_count: number;
            is_history_snapshot?: boolean;
            snapshot_version?: number | string | null;
            requested_snapshot_version?: number | string | null;
            available_snapshot_versions?: any[];
        }
    }> {
        // CP2 Task 5: non-SSE drains the shared core. The core's `complete` phase
        // already yields data_rows + dynamic headers + title maps + meta — draining it
        // assembles the legacy non-SSE shape byte-identically. Flags NON-SSE-ONLY are
        // passed so their absence in SSE defaults to current SSE (not skipping).
        const { extractPayrollCore } = await import("./payroll/extract/extractCore");
        let last: any = null;
        for await (const phase of extractPayrollCore({ db: this.db, getEmployees: this.getEmployees.bind(this) as any }, {
            month, year, gangCode, divisionCode, specificEmpCode, serverProfile,
            includeVirtualGangs, useHistoryDb, gangPrefix, skipHarvest, skipHeavyDetails,
            snapshotVersion, valuePriorityModeInput,
        })) {
            last = phase;
        }
        if (!last || last.phase !== "complete") throw new Error("extractPayrollCore did not yield complete");
        const gangsMap: Map<string, any[]> = last.gangs;
        const data_rows: any[] = [];
        for (const arr of gangsMap.values()) for (const r of arr) data_rows.push(r);
        return {
            data_rows,
            dynamic_premi_headers: last.dynamic_premi_headers || [],
            dynamic_potongan_headers: last.dynamic_potongan_headers || [],
            premi_title_map: last.dynamic_premi_titles || {},
            potongan_title_map: last.dynamic_potongan_titles || {},
            meta: last.meta as any,
        };
    }

    public async extractPayrollDataWithComponents(
        month: number,
        year: number,
        gangCode: string = "ALL",
        divisionCode?: string,
        specificEmpCode: string | null = null,
        serverProfile?: string,
        useHistoryDb?: boolean | null
    ): Promise<{
        data_rows: PayrollRow[];
        components: {
            lembur: Record<string, any>;
            premi: Record<string, any>;
            tunjangan: Record<string, any>;
            potongan: Record<string, any>;
            pph21_ter: Record<string, any>;
        };
        meta: { execution_time_ms: number; row_count: number }
    }> {
        const startTime = Date.now();

        // First, get the base data using the existing method
        // Also passing includeVirtualGangs as false by default to match existing signature, and then useHistoryDb.
        const baseResult = await this.extractPayrollData(month, year, gangCode, divisionCode, specificEmpCode, serverProfile, false, useHistoryDb);

        // Then calculate components using the new component services
        const empCodes = baseResult.data_rows.map(row => row.nik);

        // [FIX] Dynamic import to prevent circular dependency
        const { payrollComponentRegistry } = await import("./payroll");

        // Calculate all components in parallel using the registry
        const componentResults = await payrollComponentRegistry.calculateAllBatch(
            empCodes.map(code => ({
                emp_code: code,
                month,
                year,
                server_profile: serverProfile,
            })),
            ['gaji_pokok', 'lembur', 'premi', 'tunjangan', 'potongan', 'pph21_ter']
        );

        // Transform results into organized structure
        const components = {
            gaji_pokok: this.transformComponentResults(componentResults, 'gaji_pokok'),
            lembur: this.transformComponentResults(componentResults, 'lembur'),
            premi: this.transformComponentResults(componentResults, 'premi'),
            tunjangan: this.transformComponentResults(componentResults, 'tunjangan'),
            potongan: this.transformComponentResults(componentResults, 'potongan'),
            pph21_ter: this.transformComponentResults(componentResults, 'pph21_ter'),
        };

        return {
            data_rows: baseResult.data_rows,
            components,
            meta: {
                execution_time_ms: Date.now() - startTime,
                row_count: baseResult.data_rows.length
            }
        };
    }

    /**
     * Transform component results from Map to organized structure
     */
    private transformComponentResults(
        allResults: Record<string, Record<string, any>>,
        componentName: string
    ): Record<string, any> {
        const result: Record<string, any> = {};

        // allResults has structure: { emp_code: { lembur: {...}, premi: {...}, ...} }
        for (const [empCode, empResults] of Object.entries(allResults)) {
            const componentResult = empResults[componentName];
            if (componentResult && componentResult.output) {
                result[empCode] = {
                    value: componentResult.output.value,
                    meta: componentResult.output.meta,
                    execution_time_ms: componentResult.execution_time_ms,
                };
            }
        }

        return result;
    }

    /**
     * Get detailed component data for a single employee
     * Returns all calculations with full metadata traceability
     */
    public async getEmployeeComponentDetails(
        empCode: string,
        month: number,
        year: number,
        serverProfile?: string
    ): Promise<{
        employee: any;
        components: {
            gaji_pokok: any;
            lembur: any;
            premi: any;
            tunjangan: any;
            potongan: any;
            pph21_ter: any;
        };
        calculation_meta: {
            period: { month: number; year: number };
            generated_at: Date;
            execution_time_ms: number;
            service_versions: Record<string, number>;
        };
    }> {
        const startTime = Date.now();

        // [FIX] Dynamic import to prevent circular dependency
        const { lemburService, premiService, tunjanganService, potonganService, pph21TerComponent, payrollComponentRegistry } = await import("./payroll");

        // Calculate all components for this employee
        const gajiPokokResult = await gajiPokokService.calculate({
            emp_code: empCode,
            month,
            year,
            server_profile: serverProfile,
        });

        const lemburResult = await lemburService.calculate({
            emp_code: empCode,
            month,
            year,
            server_profile: serverProfile,
            include_details: true,
        });

        const premiResult = await premiService.calculate({
            emp_code: empCode,
            month,
            year,
            server_profile: serverProfile,
        });

        const tunjanganResult = await tunjanganService.calculate({
            emp_code: empCode,
            month,
            year,
            server_profile: serverProfile,
        });

        // Get penghasilan_bruto from tunjangan for PPH21 calculation
        const penghasilanBruto = tunjanganResult.output.value.total.value +
            (tunjanganResult.output.value.beras?.value || 0) +
            (tunjanganResult.output.value.jabatan?.value || 0) +
            (tunjanganResult.output.value.masa_kerja?.value || 0) +
            (premiResult.output.value.total_premi || 0);

        const potonganResult = await potonganService.calculate({
            emp_code: empCode,
            month,
            year,
            server_profile: serverProfile,
            penghasilan_bruto: penghasilanBruto,
        });

        const pph21TerResult = await pph21TerComponent.calculate({
            emp_code: empCode,
            month,
            year,
            server_profile: serverProfile,
            penghasilan_bruto: penghasilanBruto,
        });

        return {
            employee: { emp_code: empCode },
            components: {
                gaji_pokok: gajiPokokResult.output,
                lembur: lemburResult.output,
                premi: premiResult.output,
                tunjangan: tunjanganResult.output,
                potongan: potonganResult.output,
                pph21_ter: pph21TerResult.output,
            },
            calculation_meta: {
                period: { month, year },
                generated_at: new Date(),
                execution_time_ms: Date.now() - startTime,
                service_versions: payrollComponentRegistry.getAllServiceVersions(),
            },
        };
    }

    /**
     * [TRUE LAZY LOADING] Async generator that yields employee data in phases:
     * - Phase 0 (T+0-1s): Employee names ONLY (instant render)
     * - Phase 1 (T+1-3s): + Attendance data (HK, jam kerja)
     * - Phase 2 (T+3-8s): + Overtime + Allowances
     * - Phase 3 (T+8-15s): + Premiums + Deductions
     * - Phase 4 (T+15-20s): + Final calculations (gaji bersih, etc)
     *
     * KEY: Frontend can render rows IMMEDIATELY with names, then progressively
     * update cells as data arrives. Much better UX than waiting 45s for all data.
     */
    public async *extractPayrollDataProgressive(
        month: number,
        year: number,
        gangCode: string = "ALL",
        divisionCode?: string,
        serverProfile?: string,
        gangPrefix?: string,
        useHistoryDb?: boolean | null,
        snapshotVersion?: number | null,
        valuePriorityModeInput?: string | null
    ): AsyncGenerator<{
        phase: 'identity' | 'attendance' | 'overtime' | 'premium' | 'complete';
        gangs: Map<string, any[]>;
        current_gang?: string;
        meta: {
            total_gangs: number;
            total_employees: number;
            processed_employees: number;
            progress_pct: number;
            message: string;
            // Snapshot metadata emitted by the history path (absent on live extraction)
            snapshot_version?: number | string | null;
            requested_snapshot_version?: number | string | null;
            available_snapshot_versions?: any[];
            is_history_snapshot?: boolean;
        };
        dynamic_premi_headers?: string[];
        dynamic_potongan_headers?: string[];
        dynamic_premi_titles?: Record<string, string>;
        dynamic_potongan_titles?: Record<string, string>;
    }> {
        // CP2 Task 4: SSE delegates to shared core via yield* — flags default to SSE (not skipping)
        const args = {
            month,
            year,
            gangCode,
            divisionCode,
            serverProfile,
            gangPrefix,
            useHistoryDb,
            snapshotVersion,
            valuePriorityModeInput,
            specificEmpCode: null,
            includeVirtualGangs: false,
            skipHarvest: false,
            skipHeavyDetails: false
        };
        yield* extractPayrollCore({ db: this.db, getEmployees: this.getEmployees.bind(this) } as any, args);
    }

    public async getEmployees(gangCondition: string, month: number, year: number, serverProfile?: string, isHistorical: boolean = false, gangCodeInput: string | null = null): Promise<any[]> {
        const { getEmployees } = await import("./payroll/extract/extractQueries");
        return (getEmployees as any)(this.db, gangCondition, month, year, serverProfile, isHistorical, gangCodeInput);
    }
}

export const dataExtractorService = DataExtractorService.getInstance();

