/**
 * @module backend/src/api/payroll.shared.ts
 * @purpose Shared helpers for the /payroll route group modules: response slimming, auth resolution, manual-edit gate, auto-buffer seed response, adjustment-name option types.
 * @input Employee rows with heavy detail arrays, request headers, AUTO_BUFFER_ADCODE_BY_ADJUSTMENT_NAME map
 * @output SlimEmployee[] / User | null / gate { allowed, reason } / AUTO_BUFFER_SEED_ENDPOINT_ADJUSTMENTS[] / parsed option types
 * @depends ../utils/employeeSort#sortByEmpCode, ../utils/authBypass#resolveUserFromHeaders, ../services/authService, ../types/user#User, ../services/payroll/manualAdjustments/autoBufferAdcodeMap
 * @sideeffect None (pure; dynamic-imports manualAdjustmentService inside getManualEditGate)
 * @tests none — covered via mounted payrollRoutes tests (payroll.manualAdjustmentByApiKey.test.ts, payroll.lockedVerify.test.ts)
 */
import { sortByEmpCode } from "../utils/employeeSort";
import { resolveUserFromHeaders } from "../utils/authBypass";
import { AuthService } from "../services/authService";
import { User } from "../types/user";
import { AUTO_BUFFER_ADCODE_BY_ADJUSTMENT_NAME } from "../services/payroll/manualAdjustments/autoBufferAdcodeMap";

const authService = AuthService.getInstance();

/**
 * [PERFORMANCE] Strip heavy per-row array fields before sending JSON to browser.
 * Fields like shortage_details[], excess_details[], other_incomes[] are not needed
 * by the summary table but can make JSON 5-20x larger → browser "Aw, Snap!" crash.
 *
 * Notes on kept fields:
 * - has_shortage / has_excess: boolean flags, needed by table cell renderer for coloring
 * - shortage_total_hours / excess_total_hours: summary totals, needed for tooltip summary
 * - shortage_details[] / excess_details[]: REMOVED — detail arrays, not used in table view
 */
export function slimEmployee(emp: any): any {
    const { shortage_details, excess_details, other_incomes, lembur_records, ...rest } = emp;
    return rest;
}

export function sortedSlimStreamEmployees(employees: readonly any[]): any[] {
    return sortByEmpCode(employees).map((emp: any) => {
        const { _phase, _enriched, _loading, ...rest } = emp;
        return slimEmployee(rest);
    });
}

export async function getUserFromHeader(headers: Record<string, string | undefined>): Promise<User | null> {
    return resolveUserFromHeaders(headers, authService, { allowSystemToken: true });
}

export const ADJUSTMENT_NAME_OPTION_TYPES = ["PREMI", "POTONGAN_KOTOR", "POTONGAN_BERSIH"] as const;
export type AdjustmentNameOptionType = typeof ADJUSTMENT_NAME_OPTION_TYPES[number];
export const AUTO_BUFFER_SEED_ENDPOINT_ADJUSTMENTS = Object.entries(AUTO_BUFFER_ADCODE_BY_ADJUSTMENT_NAME).map(([adjustmentName, adDesc]) => ({
    adjustment_name: adjustmentName,
    ad_code: adDesc,
    ad_desc: adDesc,
    task_desc: adDesc,
    amount_source: adjustmentName === "POTONGAN PPH" ? "pph21_ter" : undefined,
    comparison_source: adjustmentName === "POTONGAN PPH" ? "pot_pph21" : undefined
}));

export function buildAutoBufferSeedEndpointResponse(result: any) {
    return {
        success: true,
        message: "Auto buffer berhasil disimpan ke payroll_manual_adjustments (AUTO_BUFFER): TUNJANGAN JABATAN, MASA KERJA, SPSI, POTONGAN PPH",
        auto_buffer_items_per_employee: AUTO_BUFFER_SEED_ENDPOINT_ADJUSTMENTS.length,
        auto_buffer_adjustments: AUTO_BUFFER_SEED_ENDPOINT_ADJUSTMENTS,
        data: result
    };
}

// Rule cutoff manual input (mode edit): jika tanggal hari ini > 3, semua input manual diblok.
// Berlaku untuk semua periode. Gate dipasang di route mutasi (manual-edit / manual-adjustment POST),
// bukan di service — sehingga jalur non-edit (preset, import, convert) tetap berjalan.
export async function getManualEditGate(): Promise<{ allowed: boolean; reason: string }> {
    const { manualAdjustmentService } = await import("../services/manualAdjustmentService");
    return {
        allowed: manualAdjustmentService.getManualEditAllowed(),
        reason: manualAdjustmentService.getManualEditBlockReason()
    };
}

export function parseAdjustmentNameOptionTypes(value?: string): { types: AdjustmentNameOptionType[]; invalid: string[] } {
    const aliases: Record<string, AdjustmentNameOptionType> = {
        PREMI: "PREMI",
        KOREKSI: "POTONGAN_KOTOR",
        POTONGAN_KOTOR: "POTONGAN_KOTOR",
        POTONGAN_UPAH_KOTOR: "POTONGAN_KOTOR",
        POTONGAN_BERSIH: "POTONGAN_BERSIH",
        POTONGAN_UPAH_BERSIH: "POTONGAN_BERSIH"
    };
    const rawTypes = String(value || "").split(",").map((item) => item.trim().toUpperCase()).filter(Boolean);
    if (rawTypes.length === 0) return { types: [...ADJUSTMENT_NAME_OPTION_TYPES], invalid: [] };

    const invalid: string[] = [];
    const types: AdjustmentNameOptionType[] = [];
    for (const rawType of rawTypes) {
        const resolved = aliases[rawType];
        if (!resolved) {
            invalid.push(rawType);
            continue;
        }
        if (!types.includes(resolved)) types.push(resolved);
    }

    return { types, invalid };
}
