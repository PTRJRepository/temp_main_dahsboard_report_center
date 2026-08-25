/**
 * OtherIncomes Helpers — pure helper functions
 *
 * Extracted from otherIncomesService.ts. Contains only functions
 * with NO database side effects. All are exported as plain functions
 * (not class methods).
 *
 * @module payroll/otherIncomes/otherIncomesHelpers
 */

import { resolveCanonicalOtherIncomeType } from "../../../utils/otherIncomeCanonical";
import { resolveThrCompatibleEffectiveStartDate } from "../../../utils/payrollProfileRules";

// ─── Types ────────────────────────────────────────────────────────────────

export interface OtherIncome {
    id?: number;
    nik: string;
    new_nik?: string;
    emp_code?: string;
    emp_name: string;
    division_code?: string;
    gang_code?: string;
    jabatan?: string;
    period_year: number;
    period_month: number;
    income_type: string;
    income_name?: string;
    amount: number;
    is_paid_in_thp: boolean;
    is_taxable: boolean;
    created_at?: string;
    updated_at?: string;
    details?: any;
    religion?: string;
    original_religion?: string;
    join_date?: string;
    bank_acc_no?: string;
    bank_code?: string;
    sex?: string;
}

// ─── Functions ────────────────────────────────────────────────────────────

/**
 * @helper deduplicateIncomeRows
 * @pure true
 * @input rows: any[]
 * @output OtherIncome[] (deduplicated by period|employeeKey|canonical income type; keeps largest id when duplicates exist)
 * @description Sorts rows by id ascending, parses details_json into details, then keeps only the
 *   latest record per composite key. EmpCode wins over new_nik wins over nik for the employee key.
 *   Income type is normalized via resolveCanonicalOtherIncomeType so THR/BONUS/EXGRATIA collapse correctly.
 */
export function deduplicateIncomeRows(rows: any[]): OtherIncome[] {
    const uniqueMap = new Map<string, OtherIncome>();

    [...rows].sort((a, b) => Number(a?.id || 0) - Number(b?.id || 0)).forEach(r => {
        if (r.details_json) {
            try { r.details = JSON.parse(r.details_json); } catch { r.details = null; }
        }

        const empCodeKey = (r.emp_code || '').trim().toUpperCase();
        const newNikKey = (r.new_nik || '').trim().toUpperCase();
        const nikKey = (r.nik || '').trim().toUpperCase();
        const incomeType = resolveCanonicalOtherIncomeType(r.income_type || r.income_name);
        const periodYear = String(r.period_year || '').trim();
        const periodMonth = String(r.period_month || '').trim();
        const periodKey = periodYear || periodMonth ? `${periodYear}-${periodMonth}` : '';

        // EmpCode is the stable payroll row key when available. NIK can differ between
        // old imports and current HR data, as seen in B0097, causing double income rows.
        const employeeKey = empCodeKey || newNikKey || nikKey;
        const key = `${periodKey}|${employeeKey}|${incomeType}`;

        if (key && employeeKey) {
            // Always keep only the latest record. The sort above makes larger id win.
            uniqueMap.set(key, r);
        }
    });

    return Array.from(uniqueMap.values());
}

/**
 * @helper chunkArray
 * @pure true
 * @input array: T[], size: number
 * @output T[][] (slices of the array, each up to `size` length)
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size));
    return chunks;
}

/**
 * @helper parseDate
 * @pure true
 * @input dateStr: any (string | Date | falsy)
 * @output Date | null
 * @description Parses ISO strings and Date instances directly, then tries DD/MM/YYYY and MM/DD/YYYY
 *   permutations. Returns null for unparseable/empty input.
 */
export function parseDate(dateStr: any): Date | null {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;
    let d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
    const parts = String(dateStr).split(/[\/\-]/);
    if (parts.length === 3) {
        if (parts[2].length === 4) d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        else if (parts[0].length === 4) d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        if (!isNaN(d.getTime())) return d;
    }
    return null;
}

/**
 * @helper getLatestValidDate
 * @pure true
 * @input d1: any, d2: any
 * @output string | null (ISO date of the later of the two valid dates)
 * @description Delegates to resolveThrCompatibleEffectiveStartDate to pick the THR-compatible
 *   effective start date — latest non-empty valid date of AppJoinDate / AppJoinGrpDate.
 */
export function getLatestValidDate(d1: any, d2: any): string | null {
    return resolveThrCompatibleEffectiveStartDate(d1, d2);
}

/**
 * @helper isValidBankAccNo
 * @pure true
 * @input val: string | null | undefined
 * @output boolean
 * @description Rejects null, empty, all-zero strings, date-like patterns, and non-numeric content.
 *   After stripping dashes/spaces, the digit string must be all digits and at least 5 long.
 */
export function isValidBankAccNo(val: string | null | undefined): boolean {
    if (!val) return false;
    const trimmed = val.trim();
    if (!trimmed) return false;
    // Reject all-zero strings (e.g., '0', '00', '000')
    if (/^0+$/.test(trimmed)) return false;
    // Reject date-like patterns (e.g., '2024-01-15', '15/01/2024', 'Jan 2024')
    if (/\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/.test(trimmed)) return false;
    if (/\d{1,2}[-\/]\d{1,2}[-\/]\d{4}/.test(trimmed)) return false;
    if (/[A-Za-z]{3,}\s+\d{4}/.test(trimmed)) return false; // 'Jan 2024' etc.
    // Extract only digits
    const digitsOnly = trimmed.replace(/[-\s]/g, '');
    // Must be all digits (after removing dashes/spaces)
    if (!/^\d+$/.test(digitsOnly)) return false;
    // Bank account numbers should have at least 5 digits
    if (digitsOnly.length < 5) return false;
    return true;
}

/**
 * @helper normalizeName
 * @pure true
 * @input name: string | null | undefined
 * @output string
 * @description Strips parenthesized text, collapses whitespace, trims, and uppercases.
 *   Used for cross-source employee name matching.
 */
export function normalizeName(name: string | null | undefined): string {
    if (!name) return '';
    // Remove text inside parentheses: "ARLITA ( HASNA )" -> "ARLITA "
    let n = name.replace(/\([^)]*\)/g, '');
    // Remove extra spaces and trim
    n = n.replace(/\s+/g, ' ').trim().toUpperCase();
    return n;
}
