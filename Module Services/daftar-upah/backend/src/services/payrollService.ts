import { Database } from "../db/client";
import { debug, error as logError } from "../utils/logger";
import { PayrollCalculator } from "./payroll/components/PayrollCalculator";
import { gajiPokokService } from "./payroll/components/GajiPokokService";
import { dataExtractorService } from "./dataExtractorService";
import { calculateAllCaruman, type CarumanResult } from "./carumanDefinitions";

const CATEGORY = "PayrollService";

/**
 * PayrollService - High-level payroll business operations
 * Refactored to delegate calculations to specialized component services.
 */
export class PayrollService {
    private static instance: PayrollService;
    private db: Database;

    private constructor() {
        this.db = Database.getInstance();
    }

    public static getInstance(): PayrollService {
        if (!PayrollService.instance) {
            PayrollService.instance = new PayrollService();
        }
        return PayrollService.instance;
    }

    /**
     * Get detailed payroll report for a gang
     */
    public async getGangPayrollReport(month: number, year: number, gangCode: string, divisionCode?: string) {
        return dataExtractorService.extractPayrollData(month, year, gangCode, divisionCode);
    }

    /**
     * High-level payroll calculation for the /payroll/calculate endpoint.
     * Delegates derived formulas to PayrollCalculator (single source of truth).
     */
    public calculate(
        upah_dasar: number,
        hk_count: number,
        allowances: Record<string, number> = {},
        deductions: Record<string, number> = {}
    ) {
        const berasJumlah = Number(allowances.beras) || 0;
        const jabatanJumlah = Number(allowances.jabatan) || 0;
        const masaKerjaJumlah = Number(allowances.masa_kerja) || 0;
        const lemburJumlah = Number(allowances.lembur) || 0;
        const totalPremi = Number(allowances.total_premi ?? allowances.premi) || 0;
        const pendapatanLainnya = Number(allowances.pendapatan_lainnya) || 0;

        const caruman: CarumanResult = calculateAllCaruman(upah_dasar, masaKerjaJumlah);

        return PayrollCalculator.calculate({
            gaji_pokok_aktual: upah_dasar * Math.max(0, hk_count),
            beras_jumlah: berasJumlah,
            jabatan_jumlah: jabatanJumlah,
            masa_kerja_jumlah: masaKerjaJumlah,
            lembur_jumlah: lemburJumlah,
            total_tunjangan: berasJumlah + jabatanJumlah + masaKerjaJumlah + lemburJumlah,
            total_premi: totalPremi,
            pot_koreksi: Math.abs(Number(deductions.koreksi) || 0),
            pendapatan_lainnya: pendapatanLainnya,
            pot_astek_pekerja: caruman.astek_pekerja_jht,
            pot_bpjs_kesehatan_pekerja: caruman.bpjs_kes_pekerja,
            pot_bpjs_pensiun_pekerja: caruman.bpjs_pensiun_pekerja,
            pot_spsi: Math.abs(Number(deductions.spsi) || 0),
            pot_pph21: Math.abs(Number(deductions.pph21) || 0),
            other_potongan: Math.abs(Number(deductions.other) || 0),
            pot_premi_pph: Math.abs(Number(deductions.premi_pph) || 0),
            astek_majikan: caruman.astek_majikan_total,
            bpjs_majikan: caruman.bpjs_kes_majikan
        });
    }

    /**
     * BPJS/ASTEK components for the /payroll/bpjs-calculate endpoint.
     */
    public calculateBpjsComponents(masaKerjaJumlah: number, upahDasar: number): CarumanResult {
        return calculateAllCaruman(upahDasar, masaKerjaJumlah);
    }

    /**
     * Check if payroll is finalized for a period
     */
    public async isPayrollFinalized(month: number, year: number, divisionCode: string): Promise<boolean> {
        try {
            const histDb = Database.getExtendedInstance();
            const row = await histDb.queryOne<{ is_locked: boolean }>(
                `SELECT TOP 1 is_locked FROM dbo.payroll_history_header
                 WHERE period_month = ? AND period_year = ? AND division_code = ?`,
                [month, year, divisionCode]
            );
            return !!row?.is_locked;
        } catch (e) {
            return false;
        }
    }

    /**
     * Get PayRates (upah_dasar) for multiple employees from HR_PAYROLL
     * Returns Record<empCode, payRate>
     *
     * CRITICAL: Uses TOP 1 with ORDER BY PayRate DESC to get the LATEST non-zero payrate
     * This follows the APPEND-INSERT pattern where multiple records exist per employee
     */
    public async getPayratesMap(empCodes: string[], serverProfile?: string): Promise<Record<string, number>> {
        if (!empCodes || empCodes.length === 0) return {};

        const db = serverProfile ? Database.getInstance(undefined, serverProfile) : this.db;
        const result: Record<string, number> = {};

        try {
            // Build parameterized IN clause
            const placeholders = empCodes.map(() => '?').join(',');
            const query = `
                SELECT EmpCode, PayRate
                FROM HR_PAYROLL
                WHERE RTRIM(EmpCode) IN (${placeholders})
            `;

            const rows = await db.query<{ EmpCode: string; PayRate: number }>(query, empCodes);

            // Group by empCode and pick the latest (highest/non-zero) payrate
            const empPayrates: Record<string, number[]> = {};
            for (const row of rows) {
                const empCode = row.EmpCode?.trim() || '';
                if (!empCode) continue;
                if (!empPayrates[empCode]) empPayrates[empCode] = [];
                empPayrates[empCode].push(row.PayRate || 0);
            }

            // For each employee, pick the highest non-zero payrate
            for (const empCode of empCodes) {
                const empCodeTrimmed = empCode.trim();
                const payrates = empPayrates[empCodeTrimmed] || [];
                // Filter non-zero and pick the highest
                const nonZero = payrates.filter(p => p > 0);
                if (nonZero.length > 0) {
                    result[empCodeTrimmed] = Math.max(...nonZero);
                } else {
                    result[empCodeTrimmed] = 0;
                }
            }
        } catch (e) {
            logError(CATEGORY, "getPayratesMap failed", e);
            // Return empty - caller should handle fallback to default UPJ
        }

        return result;
    }
}

export const payrollService = PayrollService.getInstance();
