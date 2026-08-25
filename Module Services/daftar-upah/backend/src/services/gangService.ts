import { Database } from "../db/client";
// Config is imported dynamically in fetchGangs() to avoid circular dependency issues
import { divisionConfigService } from "./config/DivisionConfigService";

interface Gang {
    gang_code: string;
    description: string;
    loc_code?: string;
    server_profile: string;
}

export class GangService {
    private static instance: GangService;
    private db: Database;

    /**
     * Determine server profile based on LocCode or GangCode
     */
    public getServerProfile(locCode?: string, gangCode?: string): string {
        const loc = (locCode || '').trim().toUpperCase();
        const gang = (gangCode || '').trim().toUpperCase();

        if (loc === 'MILL' || loc === 'PKS' || gang.startsWith('M')) {
            return "SERVER_PROFILE_3"; // Mill Profile
        }

        return "SERVER_PROFILE_1"; // Estate Profile (Default)
    }

    private constructor() {
        this.db = Database.getInstance();
    }

    public static getInstance(): GangService {
        if (!GangService.instance) {
            GangService.instance = new GangService();
        }
        return GangService.instance;
    }

    public convertDivisionToLocCode(division: string): string {
        if (!division) return division;
        return divisionConfigService.getLocCode(division) || division;
    }


    /**
     * Convert LocCode to canonical division code.
     * Delegates to DivisionConfigService (P1A -> PG1A, AB1 -> AB1, WKS_AR -> WKS_AR, ...)
     */
    public convertLocCodeToDivision(locCode: string): string {
        if (!locCode) return locCode;
        return divisionConfigService.resolveCode(locCode);
    }

    /**
     * Get all division codes including aliases for a given division
     * Example: "AB1" returns ["AB1", "ARB1"]
     */
    public getDivisionCodesWithAliases(division: string): string[] {
        if (!division) return [];
        return divisionConfigService.getAliases(division);
    }

    /**
     * Check if a division is a virtual division
     * Uses DivisionConfigService as single source of truth
     */
    public isVirtualDivision(division: string): boolean {
        if (!division) return false;
        return divisionConfigService.isVirtualDivision(division);
    }

    /**
     * Cek apakah gang termasuk "gang percobaan" — satu-satunya gang yang boleh
     * mengubah PTKP master langsung dari CustomPayrollTable.
     * Rule (confirmed user 2026-08-03): desc mengandung "PERCOBAAN"
     * ATAU gang_code berakhiran "P" ATAU gang_code mengandung "BHL".
     */
    public isPercobaanGang(gangCode?: string | null, gangDesc?: string | null): boolean {
        const code = String(gangCode || '').trim().toUpperCase();
        const desc = String(gangDesc || '').trim().toUpperCase();
        if (!code && !desc) return false;
        return desc.includes('PERCOBAAN') || code.endsWith('P') || code.includes('BHL');
    }

    /**
     * Get gang codes for a virtual division
     * Returns ONLY the specific gang codes, not parent divisions
     * Uses DivisionConfigService for pattern matching
     */
    public async getVirtualDivisionGangs(division: string): Promise<string[]> {
        if (!division) return [];
        const gangs = await divisionConfigService.getGangsForDivision(division);
        return gangs.map(g => g.gang_code);
    }

    /**
     * Check if two codes refer to the same division
     * Example: isSameDivision('AB1', 'ARB1') -> true
     * Example: isSameDivision('HMC', 'WKS_AR') -> true
     *
     * Delegates to DivisionConfigService alias resolution (single source of truth).
     * ponytail: drops the old VIRTUAL_DIVISION_GANG_MAP gang↔division check;
     * add it back in DivisionConfigService if gang-code equivalence is ever needed here.
     */
    public isSameDivision(code1: string, code2: string): boolean {
        if (!code1 || !code2) return false;
        return divisionConfigService.resolveCode(code1) === divisionConfigService.resolveCode(code2);
    }

    /**
     * Get all aliases for a division (including canonical)
     * Uses DivisionConfigService as single source of truth
     * Example: getAllDivisionAliases('AB1') -> ['AB1', 'ARB1', 'AB-1']
     */
    public getAllDivisionAliases(division: string): string[] {
        if (!division) return [];
        return divisionConfigService.getAliases(division);
    }

    /**
     * Build SQL WHERE clause for division filtering with all aliases
     * Uses DivisionConfigService as single source of truth
     * @param divisionParam - Input division code from user
     * @param columnName - Database column name (e.g., 'division_code', 'loc_code')
     * @returns Object with sql fragment and params array
     */
    public buildDivisionWhereClause(divisionParam: string, columnName: string): { sql: string; params: string[] } {
        return divisionConfigService.buildDivisionWhereClause(divisionParam, columnName);
    }

    /**
     * Delegate to divisionConfigService for getting all divisions
     */
    public async getAllDivisions(includeVirtual: boolean = true): Promise<string[]> {
        const divisions = divisionConfigService.getAllDivisionCodes();
        if (includeVirtual) {
            return divisions;
        }
        return divisions.filter(d => !divisionConfigService.isVirtualDivision(d));
    }

    /**
     * Backward-compatible alias used by older extractor/report code.
     */
    public async getGangsByDivision(division?: string, includeVirtual: boolean = false): Promise<Gang[]> {
        return this.fetchGangs(division, undefined, includeVirtual);
    }

    /**
     * Delegate to divisionConfigService for fetching gangs
     */
    public async fetchGangs(division?: string, search?: string, includeVirtual: boolean = false): Promise<Gang[]> {
        try {
            const { Config: Cfg } = await import("../config");
            console.log(`[GangService] fetchGangs triggered - Div: ${division}, Search: ${search}, Profile: ${Cfg.DB_PROFILE}, DB: ${Cfg.DEFAULT_DATABASE}`);

            if (!division || division === 'ALL') {
                // Return all gangs from all divisions - query HR_GANG directly
                console.log(`[GangService] ALL divisions requested, fetching all gangs from HR_GANG`);
                const allGangs = await this.fetchAllGangs();
                console.log(`[GangService] Returning ${allGangs.length} total gangs.`);
                return allGangs;
            }

            // Use DivisionConfigService for gang retrieval
            const gangs = await divisionConfigService.getGangsForDivision(division);
            console.log(`[GangService] divisionConfigService returned ${gangs.length} gangs for ${division}`);

            // Filter by search if provided
            let filtered = gangs;
            if (search) {
                const searchLower = search.toLowerCase();
                filtered = gangs.filter(g =>
                    g.gang_code.toLowerCase().includes(searchLower) ||
                    g.description?.toLowerCase().includes(searchLower)
                );
            }

            const result = filtered.map(g => ({
                gang_code: g.gang_code,
                description: g.description || '',
                loc_code: g.loc_code,
                server_profile: this.getServerProfile(g.loc_code, g.gang_code)
            }));
            console.log(`[GangService] Returning ${result.length} gangs.`);
            return result;
        } catch (e) {
            console.error("[GangService] Failed to fetch gangs:", e);
            return [];
        }
    }

    /**
     * Fetch all gangs from HR_GANGLN (for ALL divisions case)
     * Delegates to divisionConfigService.getAllGangs() for consistent results
     */
    private async fetchAllGangs(): Promise<Gang[]> {
        // Use DivisionConfigService as single source of truth
        const gangs = await divisionConfigService.getAllGangs();
        console.log(`[GangService] fetchAllGangs delegated to DivisionConfigService, returned ${gangs.length} gangs`);

        return gangs.map(g => ({
            gang_code: g.gang_code,
            description: g.description || '',
            loc_code: g.loc_code,
            server_profile: this.getServerProfile(g.loc_code, g.gang_code)
        }));
    }

    /**
     * Get gang information by gang code
     */
    public async getGangInfo(gangCode: string): Promise<any> {
        const division = divisionConfigService.resolveCode(gangCode);

        try {
            const rows = await this.db.query<{ Description: string, LocCode: string }>(`
                SELECT Description, LocCode FROM HR_GANG WHERE GangCode = ?
            `, [gangCode]);
            const row = rows[0];

            return {
                gang_code: gangCode,
                division,
                prefix: gangCode[0] || null,
                is_security: gangCode.toUpperCase().startsWith("SEC"),
                description: row?.Description?.trim() || "",
                loc_code: row?.LocCode?.trim() || ""
            };
        } catch (e) {
            return {
                gang_code: gangCode,
                division,
                prefix: gangCode[0] || null,
                is_security: gangCode.toUpperCase().startsWith("SEC"),
                description: "",
                loc_code: ""
            };
        }
    }

    /**
     * Fetch gang codes by loc code
     */
    public async fetchGangsByLocCode(locCode: string): Promise<string[]> {
        try {
            const rows = await this.db.query<{ GangCode: string }>(`
                SELECT GangCode FROM HR_GANG
                WHERE UPPER(LTRIM(RTRIM(LocCode))) = ?
                ORDER BY GangCode
            `, [locCode.toUpperCase()]);
            return rows.map(r => r.GangCode?.trim()).filter(Boolean) as string[];
        } catch (e) {
            console.error("[GangService] fetch_gangs_by_loc_code failed:", e);
            return [];
        }
    }
}

export const gangService = GangService.getInstance();
