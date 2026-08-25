import { describe, expect, it } from "bun:test";
import { enforceDivisionScope, filterRowsByAllowedDivision, isKerani, canAccessDivision } from "./divisionScope";
import { UserRole, User } from "../types/user";

function kerani(divisions: string[]): User {
    return {
        id: 1,
        username: "kerani",
        email: "k@x.com",
        full_name: "Kerani",
        role: UserRole.KERANI,
        divisions,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
    };
}

function admin(): User {
    return {
        id: 2,
        username: "admin",
        email: "a@x.com",
        full_name: "Admin",
        role: UserRole.ADMIN,
        divisions: [],
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
    };
}

describe("divisionScope", () => {
    it("mengenali role kerani", () => {
        expect(isKerani(kerani(["PG1A"]))).toBe(true);
        expect(isKerani(admin())).toBe(false);
        expect(isKerani(null)).toBe(false);
    });

    it("kerani dipaksa ke divisi izin (termasuk alias/virtual)", () => {
        const k = kerani(["WKS_AR"]);
        expect(enforceDivisionScope(k, "ALL")).toBe("WKS_AR");
        expect(enforceDivisionScope(k, "ARA")).toBe("WKS_AR");
        // alias HMC resolve ke WKS_AR
        expect(enforceDivisionScope(k, "HMC")).toBe("WKS_AR");
    });

    it("non-kerani tidak di-scope", () => {
        expect(enforceDivisionScope(admin(), "ALL")).toBe("ALL");
        expect(enforceDivisionScope(admin(), "ARA")).toBe("ARA");
        expect(enforceDivisionScope(null, "ARA")).toBe("ARA");
    });

    it("canAccessDivision: kerani hanya divisi izin", () => {
        const k = kerani(["PG1A"]);
        expect(canAccessDivision(k, "PG1A")).toBe(true);
        expect(canAccessDivision(k, "P1A")).toBe(true); // alias
        expect(canAccessDivision(k, "ARA")).toBe(false);
        expect(canAccessDivision(admin(), "ARA")).toBe(true);
    });

    it("filterRowsByAllowedDivision menyaring baris all-division utk kerani", () => {
        const rows = [
            { division_code: "PG1A" },
            { division: "ARA" },
            { code: "WKS_AR" }
        ];
        const k = kerani(["PG1A"]);
        expect(filterRowsByAllowedDivision(k, rows).map(r => r.division_code ?? r.division ?? r.code))
            .toEqual(["PG1A"]);
        expect(filterRowsByAllowedDivision(admin(), rows)).toHaveLength(3);
    });
});
