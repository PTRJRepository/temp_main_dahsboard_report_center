import { User, UserRole } from "../types/user";
import { divisionDefinition } from "../services/divisionDefinition";

/**
 * Division scoping untuk role terbatas (KERANI).
 * KERANI HANYA boleh melihat divisi yang di-izinkan (ada di user.divisions).
 * Admin/Visitor/User legacy tidak di-scope; user tanpa auth (null) dianggap legacy (tidak di-scope).
 */

export function isKerani(user: User | null | undefined): boolean {
    return !!user && user.role === UserRole.KERANI;
}

/** Resolve daftar divisi yang di-izinkan utk kerani (canonical), null jika tidak dibatasi. */
export function resolvedAllowedDivisions(user: User | null | undefined): string[] | null {
    if (!isKerani(user)) return null;
    const divs = (user!.divisions || [])
        .map(d => divisionDefinition.resolveDivisionCode(String(d).trim().toUpperCase()))
        .filter(Boolean);
    return divs.length ? [...new Set(divs)] : null;
}

/**
 * Paksa divisi yang diminta menjadi divisi izin utk kerani.
 * Return undefined bila kerani tanpa divisi izin (biarkan filter legacy).
 */
export function enforceDivisionScope(user: User | null | undefined, requested: string | undefined): string | undefined {
    const allowed = resolvedAllowedDivisions(user);
    if (!allowed) return requested;
    return allowed[0];
}

/**
 * Cek apakah user diizinkan mengakses divisiCode tertentu.
 * Non-kerani selalu diizinkan. Kerani hanya bila canonical cocok dengan divisi izinnya.
 */
export function canAccessDivision(user: User | null | undefined, requested: string | undefined): boolean {
    if (!isKerani(user)) return true;
    const allowed = resolvedAllowedDivisions(user);
    if (!allowed || !requested) return false;
    const canonical = divisionDefinition.resolveDivisionCode(String(requested).trim().toUpperCase());
    return allowed.includes(canonical);
}

/** Filter array objek ({ division_code | division | code }) hanya ke divisi izin utk kerani. */
export function filterRowsByAllowedDivision<T extends Record<string, any>>(
    user: User | null | undefined,
    rows: T[]
): T[] {
    const allowed = resolvedAllowedDivisions(user);
    if (!allowed || !Array.isArray(rows)) return rows;
    return rows.filter(row => {
        const code = String(row?.division_code ?? row?.division ?? row?.code ?? "").trim().toUpperCase();
        if (!code) return true;
        return allowed.includes(divisionDefinition.resolveDivisionCode(code));
    });
}
