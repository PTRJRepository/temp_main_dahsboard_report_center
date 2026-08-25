/**
 * Contract tests for DivisionConfigService — the single source of truth for
 * division aliases, virtual divisions, gang resolution and LocCode mapping.
 *
 * These tests pin the public contract so refactors of the service (or callers
 * migrating off legacy wrappers like divisionDefinition/gangService maps) cannot
 * silently change division behavior.
 */
import { describe, expect, test } from "bun:test";
import { divisionConfigService, DivisionConfigService } from "./DivisionConfigService";

describe("DivisionConfigService — resolveCode (alias → canonical)", () => {
    test("resolves canonical codes to themselves", () => {
        for (const code of ["PG1A", "PG1B", "PG2A", "PG2B", "PGE", "AB1", "AB2", "ARA", "ARC", "DME", "IJL"]) {
            expect(divisionConfigService.resolveCode(code)).toBe(code);
        }
    });

    test("resolves HR LocCode aliases (P1A → PG1A, AB1 → AB1)", () => {
        expect(divisionConfigService.resolveCode("P1A")).toBe("PG1A");
        expect(divisionConfigService.resolveCode("P1B")).toBe("PG1B");
        expect(divisionConfigService.resolveCode("P2A")).toBe("PG2A");
        expect(divisionConfigService.resolveCode("P2B")).toBe("PG2B");
        expect(divisionConfigService.resolveCode("AB1")).toBe("AB1");
        expect(divisionConfigService.resolveCode("AB2")).toBe("AB2");
    });

    test("resolves legacy/external aliases (ARB1, AREC, INFRA, HMC, AMC, NURSERY)", () => {
        expect(divisionConfigService.resolveCode("ARB1")).toBe("AB1");
        expect(divisionConfigService.resolveCode("ARB2")).toBe("AB2");
        expect(divisionConfigService.resolveCode("AREC")).toBe("ARC");
        expect(divisionConfigService.resolveCode("INFRA")).toBe("INF");
        expect(divisionConfigService.resolveCode("NURSERY")).toBe("NRS");
        expect(divisionConfigService.resolveCode("HMC")).toBe("WKS_AR");
        expect(divisionConfigService.resolveCode("AMC")).toBe("WKS_PG");
    });

    test("is case-insensitive and trims input", () => {
        expect(divisionConfigService.resolveCode("  pg1a  ")).toBe("PG1A");
        expect(divisionConfigService.resolveCode("hMc")).toBe("WKS_AR");
    });

    test("returns normalized input for unknown codes (no throw)", () => {
        expect(divisionConfigService.resolveCode("XYZ")).toBe("XYZ");
        expect(divisionConfigService.resolveCode("")).toBe("");
    });
});

describe("DivisionConfigService — getLocCode (division → HR_GANG LocCode)", () => {
    test("PG1A..PG2B map to their short LocCodes", () => {
        expect(divisionConfigService.getLocCode("PG1A")).toBe("P1A");
        expect(divisionConfigService.getLocCode("PG1B")).toBe("P1B");
        expect(divisionConfigService.getLocCode("PG2A")).toBe("P2A");
        expect(divisionConfigService.getLocCode("PG2B")).toBe("P2B");
    });

    test("divisions whose code equals LocCode map to themselves", () => {
        expect(divisionConfigService.getLocCode("AB1")).toBe("AB1");
        expect(divisionConfigService.getLocCode("AB2")).toBe("AB2");
        expect(divisionConfigService.getLocCode("ARC")).toBe("ARC");
        expect(divisionConfigService.getLocCode("DME")).toBe("DME");
        expect(divisionConfigService.getLocCode("IJL")).toBe("IJL");
    });

    test("accepts aliases: ARB1 → AB1, HMC → WKS_AR (payroll.lockedRoutes contract)", () => {
        expect(divisionConfigService.getLocCode("ARB1")).toBe("AB1");
        expect(divisionConfigService.getLocCode("HMC")).toBe("WKS_AR");
        expect(divisionConfigService.getLocCode("AMC")).toBe("WKS_PG");
        expect(divisionConfigService.getLocCode("P1A")).toBe("P1A");
    });

    test("unknown input falls back to normalized input", () => {
        expect(divisionConfigService.getLocCode("XYZ")).toBe("XYZ");
    });
});

describe("DivisionConfigService — virtual divisions", () => {
    test("registered virtual divisions", () => {
        for (const code of ["INF", "NRS", "WKS_AR", "WKS_PG", "WORKSHOP", "MILL"]) {
            expect(divisionConfigService.isVirtualDivision(code)).toBe(true);
        }
    });

    test("real divisions are not virtual", () => {
        for (const code of ["PG1A", "PG1B", "PG2A", "PG2B", "PGE", "AB1", "AB2", "ARA", "ARC", "DME", "IJL"]) {
            expect(divisionConfigService.isVirtualDivision(code)).toBe(false);
        }
    });

    test("getSourceDivisions: real → self, virtual → source, WORKSHOP → both sources", () => {
        expect(divisionConfigService.getSourceDivisions("PG1A")).toEqual(["PG1A"]);
        expect(divisionConfigService.getSourceDivisions("INF")).toEqual(["PG1A"]);
        expect(divisionConfigService.getSourceDivisions("NRS")).toEqual(["PG1B"]);
        expect(divisionConfigService.getSourceDivisions("WKS_AR")).toEqual(["AB2"]);
        expect(divisionConfigService.getSourceDivisions("WKS_PG")).toEqual(["PG1A"]);
        expect(divisionConfigService.getSourceDivisions("WORKSHOP")).toEqual(["PG1A", "AB2"]);
    });
});

describe("DivisionConfigService — resolveGangDivision (unified 3-step)", () => {
    test("step 1: source already virtual returns the virtual code", () => {
        expect(divisionConfigService.resolveGangDivision("ANY", "WKS_AR")).toBe("WKS_AR");
        expect(divisionConfigService.resolveGangDivision("ANY", "INF")).toBe("INF");
    });

    test("step 2: explicit gang mappings (HMC/AMC/B2N) resolve regardless of source", () => {
        expect(divisionConfigService.resolveGangDivision("HMC", "AB2")).toBe("WKS_AR");
        expect(divisionConfigService.resolveGangDivision("AMC", "PG1A")).toBe("WKS_PG");
        expect(divisionConfigService.resolveGangDivision("B2N", "PG1B")).toBe("NRS");
    });

    test("step 3: pattern-only fallback skips gangs with a known real division", () => {
        // G1H is a real AB1 gang (gangPrefix G) — knownGangDivs must suppress fallback
        expect(divisionConfigService.resolveGangDivision("G1H", "AB1", undefined, new Set(["G1H"]))).toBeNull();
    });

    test("empty gang code returns null", () => {
        expect(divisionConfigService.resolveGangDivision("", "PG1A")).toBeNull();
    });
});

describe("DivisionConfigService — expandDivisionFilter (unified filter expansion)", () => {
    test("real division: canonical + aliases + source divisions", async () => {
        const filter = await divisionConfigService.expandDivisionFilter("AB1");
        expect(filter.isVirtual).toBe(false);
        expect(filter.gangCodes).toEqual([]);
        expect(filter.divisionCodes).toContain("AB1");
        expect(filter.divisionCodes).toContain("ARB1"); // alias
    });

    test("virtual division: gangCodes include DB gangs and aliases", async () => {
        const filter = await divisionConfigService.expandDivisionFilter("WKS_AR");
        expect(filter.isVirtual).toBe(true);
        expect(filter.divisionCodes).toEqual(["WKS_AR"]);
        expect(filter.gangCodes).toContain("HMC");
        expect(filter.gangCodes).toContain("WKS_AR");
    });

    test("ALL and empty input return empty filter", async () => {
        expect(await divisionConfigService.expandDivisionFilter("ALL")).toEqual({ divisionCodes: [], gangCodes: [], isVirtual: false });
        expect(await divisionConfigService.expandDivisionFilter("")).toEqual({ divisionCodes: [], gangCodes: [], isVirtual: false });
    });
});

describe("DivisionConfigService — helpers", () => {
    test("getAliases includes canonical and known aliases", () => {
        const aliases = divisionConfigService.getAliases("AB1").map(a => a.toUpperCase());
        expect(aliases).toContain("AB1");
        expect(aliases).toContain("ARB1");
    });

    test("getAllDivisionCodes returns real + virtual", () => {
        const all = divisionConfigService.getAllDivisionCodes(true);
        expect(all).toContain("PG1A");
        expect(all).toContain("WKS_AR");
        const realOnly = divisionConfigService.getAllDivisionCodes(false);
        expect(realOnly).toContain("PG1A");
        expect(realOnly).not.toContain("WKS_AR");
    });

    test("buildDivisionWhereClause includes canonical + aliases, parameterized", () => {
        const { sql, params } = divisionConfigService.buildDivisionWhereClause("AB1", "division_code");
        expect(sql).toContain("division_code IN (");
        const upper = params.map(p => String(p).toUpperCase());
        expect(upper).toContain("AB1");
        expect(upper).toContain("ARB1");
    });

    test("isGangExcludedFromDivision honors excludedGangCodes (F1BHL from ARA)", () => {
        expect(divisionConfigService.isGangExcludedFromDivision("ARA", "F1BHL")).toBe(true);
        expect(divisionConfigService.isGangExcludedFromDivision("ARA", "F1H")).toBe(false);
    });

    test("singleton: getInstance returns the same instance as the exported singleton", () => {
        expect(DivisionConfigService.getInstance()).toBe(divisionConfigService);
    });
});
