export function getEmployeeRows(rows = []) {
    return Array.isArray(rows)
        ? rows.filter((row) => row?.type === 'employee')
        : [];
}

function toFiniteNumber(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

// [HK-KEHADIRAN] Report mana pun yang pakai divisor HK HANYA boleh pakai HK kehadiran.
// HK kehadiran = hari_kerja_efektif (jumlah_hk − cuti_minggu − cuti_nasional) atau hari_kerja.
// JANGAN pakai jumlah_hk/total_hk sebagai divisor biaya per HK.
function resolveAttendanceDays(row = {}) {
    // Prioritas: kehadiran = hari_kerja_efektif (sudah HK hadir). Baru hari_kerja. jumlah_hk JANGAN untuk cost/HK.
    const candidates = [row.hari_kerja_efektif, row.kehadiran, row.hari_kerja];
    for (const candidate of candidates) {
        const numeric = toFiniteNumber(candidate);
        if (numeric !== null && numeric > 0) {
            return numeric;
        }
    }
    // Fallback terakhir: jumlah_hk hanya untuk menampilkan HK total, bukan untuk divisor per-HK — caller harus hindari division.
    return null;
}

export function resolveJabatanRate(row = {}) {
    const existingRate = toFiniteNumber(row.jabatan_rate);
    if (existingRate !== null && existingRate > 0) {
        return existingRate;
    }

    const jabatanJumlah = toFiniteNumber(row.jabatan_jumlah);
    const attendanceDays = resolveAttendanceDays(row);

    // resolveAttendanceDays prioritizes hari_kerja_efektif > kehadiran > hari_kerja (HK hadir).
    // For jabatan_rate derivation (not cost/HK), fall back to jumlah_hk if no hadir field exists.
    const fallbackDays = attendanceDays !== null ? attendanceDays : toFiniteNumber(row.jumlah_hk);

    if (jabatanJumlah === null || fallbackDays === null || fallbackDays === 0) {
        return existingRate;
    }

    return jabatanJumlah / fallbackDays;
}

export function buildEmployeeRowMap(rows = []) {
    const result = {};

    getEmployeeRows(rows).forEach((row) => {
        const key = String(row.emp_code || row.nik || '').trim().toUpperCase();
        if (key) {
            result[key] = row;
        }
    });

    return result;
}

export function buildSelectedEmployeeRowMap(rows = [], selectedCodes = []) {
    const employeeMap = buildEmployeeRowMap(rows);
    const result = {};

    (Array.isArray(selectedCodes) ? selectedCodes : []).forEach((code) => {
        const key = String(code || '').trim().toUpperCase();
        if (key && employeeMap[key]) {
            result[key] = employeeMap[key];
        }
    });

    return result;
}

function normalizeEmployeeCode(value) {
    return String(value || '').trim();
}

function uniqueEmployeeCodes(codes = []) {
    const seen = new Set();
    const result = [];

    (Array.isArray(codes) ? codes : []).forEach((code) => {
        const normalized = normalizeEmployeeCode(code);
        const key = normalized.toUpperCase();
        if (key && !seen.has(key)) {
            seen.add(key);
            result.push(normalized);
        }
    });

    return result;
}

export function buildPayslipEmployeeRowMap(rows = [], selectedCodes = []) {
    const explicitSelection = uniqueEmployeeCodes(selectedCodes);
    if (explicitSelection.length > 0) {
        return buildSelectedEmployeeRowMap(rows, explicitSelection);
    }

    return buildEmployeeRowMap(rows);
}

export function resolvePayslipEmployeeCodes(selectedCodes = [], rows = []) {
    const explicitSelection = uniqueEmployeeCodes(selectedCodes);
    if (explicitSelection.length > 0) {
        return explicitSelection;
    }

    return uniqueEmployeeCodes(
        getEmployeeRows(rows).map((row) => row.emp_code || row.nik || row.NIK || row.new_nik)
    );
}
