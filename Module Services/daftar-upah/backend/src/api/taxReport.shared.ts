/**
 * @module backend/src/api/taxReport.shared.ts
 * @purpose Shared helpers for tax-report routes: filename sanitization, gang-label resolution,
 *            scope-label building for Excel exports, and auth header resolution.
 * @input Gang codes, division codes, employee rows, HTTP headers.
 * @output Sanitized filenames, scope labels (division/gang display + filename), resolved User.
 * @depends ../services/gangService, ../services/summaryService, ../services/authService,
 *            ../utils/authBypass#resolveUserFromHeaders, ../types/user#User
 * @sideeffect resolveGroupGangLabelFromEmployees / resolveTaxExcelScopeLabels read gang descriptions (DB).
 * @tests none — exercised via tax-report Excel endpoints.
 */
import { AuthService } from "../services/authService";
import { User } from "../types/user";
import { gangService } from "../services/gangService";
import { summaryService } from "../services/summaryService";
import { getAuthorizationHeader, getApiKeyHeader, resolveUserFromHeaders } from "../utils/authBypass";

/**
 * Sanitize string for filename - remove/replace invalid filename characters
 */
export function sanitizeForFilename(str: string): string {
    if (!str) return '';
    return str
        .replace(/[\\/:*?"<>|]/g, '_')  // Replace invalid filename chars
        .replace(/\s+/g, '_')            // Replace spaces with underscore
        .substring(0, 50);               // Limit length
}

export type TaxExcelScopeLabels = {
    divisionLabel: string;
    gangLabel: string;
    filenameDivision: string;
    filenameGang: string;
};

const GENERIC_GANG_DESCRIPTION_WORDS = new Set([
    'gang', 'kemandoran', 'mandor', 'panen', 'rawat', 'rawatan', 'pruning', 'prunning',
    'bhl', 'harian', 'pemeliharaan', 'perawatan', 'maintenance', 'umum', 'buah',
    'brondol', 'angkut', 'muat', 'pupuk', 'semprot', 'tunas'
]);

export function getAsistensiFromGangCode(gangCode: string): string | null {
    const normalized = String(gangCode || '').trim().toUpperCase();
    if (!normalized) return null;
    if (normalized.startsWith('K2')) return '1';
    const match = normalized.match(/\d/);
    return match ? match[0] : null;
}

export function getGangGroupCode(gangCode: string): string {
    const normalized = String(gangCode || '').trim().toUpperCase();
    const match = normalized.match(/^([A-Z]+\d+)/);
    return match ? match[1] : normalized;
}

export function normalizeDescriptionWords(value: string): string[] {
    return String(value || '')
        .replace(/[()[\]{}.,;:/\\|_-]+/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
}

export function isGenericDescriptionWord(word: string): boolean {
    return GENERIC_GANG_DESCRIPTION_WORDS.has(String(word || '').toLowerCase());
}

export function isMeaningfulWords(words: string[]): boolean {
    return words.length > 0 && words.some((word) => !isGenericDescriptionWord(word));
}

export function cleanLeadingGenericDescriptionWords(words: string[]): string[] {
    const cleaned = [...words];
    while (cleaned.length > 1 && isGenericDescriptionWord(cleaned[0])) {
        cleaned.shift();
    }
    return isMeaningfulWords(cleaned) && !isGenericDescriptionWord(cleaned[0]) ? cleaned : [];
}

export function findSharedMeaningfulSuffix(wordLists: string[][]): string[] {
    if (wordLists.length < 2) return [];

    const suffixes = new Map<string, { words: string[]; rows: Set<number>; firstRow: number }>();
    wordLists.forEach((words, rowIndex) => {
        for (let length = words.length; length >= 1; length -= 1) {
            const suffix = words.slice(words.length - length);
            if (!isMeaningfulWords(suffix) || isGenericDescriptionWord(suffix[0])) continue;

            const key = suffix.join('\u0000').toLowerCase();
            const existing = suffixes.get(key) || { words: suffix, rows: new Set<number>(), firstRow: rowIndex };
            existing.rows.add(rowIndex);
            suffixes.set(key, existing);
        }
    });

    return Array.from(suffixes.values())
        .filter((item) => item.rows.size >= 2)
        .sort((a, b) => {
            if (b.words.length !== a.words.length) return b.words.length - a.words.length;
            if (b.rows.size !== a.rows.size) return b.rows.size - a.rows.size;
            return a.firstRow - b.firstRow;
        })[0]?.words || [];
}

export function buildGangDescriptionGroupLabel(rows: Array<Record<string, any>>, fallbackLabel: string): string {
    const wordLists = rows
        .map((row) => normalizeDescriptionWords(row?.gang_description || row?.description || ''))
        .filter(isMeaningfulWords);
    const sharedSuffix = findSharedMeaningfulSuffix(wordLists);
    if (sharedSuffix.length > 0) return sharedSuffix.join(' ');

    const cleaned = cleanLeadingGenericDescriptionWords(wordLists[0] || []);
    if (cleaned.length > 0) return cleaned.join(' ');

    return fallbackLabel;
}

export async function resolveGroupGangLabelFromEmployees(
    employees: Array<Record<string, any>> | undefined,
    gangPrefix: string,
    gangDescriptions: Record<string, string>
): Promise<{ code: string; description: string } | null> {
    if (!Array.isArray(employees) || employees.length === 0 || !gangPrefix || gangPrefix === 'ALL') {
        return null;
    }

    const matchingGangCodes = [...new Set(
        employees
            .map((emp) => String(emp.gang_code || '').trim().toUpperCase())
            .filter((gangCode) => gangCode && getAsistensiFromGangCode(gangCode) === gangPrefix)
    )];
    if (matchingGangCodes.length === 0) return null;

    const groupCodes = [...new Set(matchingGangCodes.map(getGangGroupCode).filter(Boolean))];
    const displayCode = groupCodes.length === 1 ? groupCodes[0] : `G${gangPrefix}`;

    const rowsWithDescriptions = await Promise.all(matchingGangCodes.map(async (gangCode) => {
        const employeeDescription = employees.find((emp) => String(emp.gang_code || '').trim().toUpperCase() === gangCode)?.gang_description;
        const mappedDescription = gangDescriptions[gangCode]?.trim() || String(employeeDescription || '').trim();
        if (mappedDescription) return { gang_code: gangCode, gang_description: mappedDescription };

        // Filter group memakai angka asistensi, tetapi nama area harus tetap diambil dari tabel gang aktual.
        const gangInfo = await gangService.getGangInfo(gangCode).catch(() => null);
        return { gang_code: gangCode, gang_description: gangInfo?.description?.trim() || '' };
    }));

    const directDescription = gangDescriptions[displayCode]?.trim() || '';
    const description = directDescription || buildGangDescriptionGroupLabel(rowsWithDescriptions, `Group ${gangPrefix}`);

    return { code: displayCode, description };
}

export async function resolveTaxExcelScopeLabels(input: {
    division?: string;
    gang?: string;
    gangPrefix?: string;
    employees?: Array<Record<string, any>>;
}): Promise<TaxExcelScopeLabels> {
    const divisionCode = (input.division || 'ALL').trim() || 'ALL';
    const gangCode = (input.gang || '').trim();
    const gangPrefix = (input.gangPrefix || '').trim();

    const [divisionDescriptions, gangDescriptions] = await Promise.all([
        summaryService.getDivisionDescriptionsMap().catch(() => ({} as Record<string, string>)),
        summaryService.getAllGangDescriptions().catch(() => ({} as Record<string, string>))
    ]);

    const divisionDescription = divisionDescriptions[divisionCode]?.trim() || '';
    const divisionLabel = divisionDescription && divisionDescription !== divisionCode
        ? `${divisionCode} - ${divisionDescription}`
        : divisionCode;
    const filenameDivision = `${divisionCode}${divisionDescription && divisionDescription !== divisionCode ? `_${sanitizeForFilename(divisionDescription)}` : ''}`;

    let displayGangCode = gangCode && gangCode !== 'ALL' ? gangCode : 'ALL';
    let gangDescription = '';

    if (gangCode && gangCode !== 'ALL') {
        gangDescription = gangDescriptions[gangCode]?.trim() || '';
        if (!gangDescription) {
            const gangInfo = await gangService.getGangInfo(gangCode).catch(() => null);
            gangDescription = gangInfo?.description?.trim() || '';
        }
    } else if (gangPrefix && gangPrefix !== 'ALL') {
        const groupLabel = await resolveGroupGangLabelFromEmployees(input.employees, gangPrefix, gangDescriptions);
        displayGangCode = groupLabel?.code || `G${gangPrefix}`;
        gangDescription = groupLabel?.description || '';
    } else if (Array.isArray(input.employees) && input.employees.length > 0) {
        const uniqueGangCodes = [...new Set(input.employees.map((emp) => String(emp.gang_code || '').trim()).filter(Boolean))];
        if (uniqueGangCodes.length === 1) {
            displayGangCode = uniqueGangCodes[0];
            gangDescription = gangDescriptions[displayGangCode]?.trim() || '';
        }
    }

    const gangLabel = gangDescription && gangDescription !== displayGangCode
        ? `${displayGangCode} - ${gangDescription}`
        : displayGangCode;
    const filenameGang = `${displayGangCode}${gangDescription && gangDescription !== displayGangCode ? `_${sanitizeForFilename(gangDescription)}` : ''}`;

    return { divisionLabel, gangLabel, filenameDivision, filenameGang };
}

const authService = AuthService.getInstance();

export async function getUserFromHeader(headers: Record<string, string | undefined>): Promise<User | null> {
    return resolveUserFromHeaders(headers, authService);
}

export { getApiKeyHeader, getAuthorizationHeader };
