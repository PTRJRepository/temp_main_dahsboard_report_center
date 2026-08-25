import { createElement, Fragment } from 'react';
import { toFinitePayrollNumber } from './payrollNumericValues';
import { normalizeManualDetailInputType } from './manualDetailInputType';
import { validatePremiumDetailMetadata } from './payrollPremiumDetailEdits';
import { compareEmpCodeValues } from './employeeSort';

const toFiniteNumber = toFinitePayrollNumber;

export const formatNumber = (value) => {
    if (value === null || value === undefined) return '-';
    const n = Number(value);
    if (isNaN(n)) return '-';
    return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(n));
};

export const formatDecimal = (value) => {
    if (value === null || value === undefined) return '-';
    const n = Number(value);
    if (isNaN(n)) return '-';
    return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);
};

export const formatNegativeTotalNumber = (value) => {
    const n = Number(value) || 0;
    if (n === 0) return '-';
    return `-${formatNumber(Math.abs(n))}`;
};

export const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const clampNumber = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
export const EMPTY_CELL_STYLE = Object.freeze({});

export const getInitialViewportWidth = () => {
    if (typeof window === 'undefined') return 1920;
    return window.innerWidth || 1920;
};

// Format header label to support newlines manually across environments
export const formatHeaderLabel = (label) => {
    if (typeof label !== 'string') return label;
    if (!label.includes('\n')) return label;
    return label.split('\n').map((part, i) => (
        createElement(Fragment, { key: i },
            i > 0 && createElement('br', null),
            i === 1 ? createElement('span', { style: { fontSize: '0.72em', fontWeight: 'normal', color: '#cbd5e1' } }, part) : part
        )
    ));
};

export const VALUE_PRIORITY_MODE_STORAGE_KEY = 'payroll.value_priority_mode';

export const normalizeValuePriorityMode = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'db_ptrj_only') return 'db_ptrj_only';
    return 'non_db_ptrj';
};

export const normalizeFieldKey = (value) => String(value || '').trim().toLowerCase();

export const formatSourceCompareValue = (value) => {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'boolean') return value ? 'Ya' : 'Tidak';
    const n = Number(value);
    if (!Number.isNaN(n) && String(value).trim() !== '') return formatNumber(n);
    return String(value);
};

export const STATIC_PREMI_FIELDS = new Set(['premi_brondol']);
export const STATIC_BRONDOL_FIELD_KEYS = new Set([
    'brondol',
    'brondol_adtrans',
    'brondol_loosefruit',
    'brondol_total',
    'premi_brondol',
    'premi_brondol_adtrans',
    'premi_brondol_loosefruit',
    'premi_brondol_total'
]);
export const STATIC_BRONDOL_LABELS = new Set([
    'BRONDOL',
    'BRONDOL ADTRANS',
    'BRONDOL LOOSEFRUIT',
    'BRONDOL TOTAL',
    'PREMI BRONDOL',
    'PREMI BRONDOL ADTRANS',
    'PREMI BRONDOL LOOSEFRUIT',
    'PREMI BRONDOL TOTAL'
]);
export const STATIC_POTONGAN_FIELDS = new Set(['pot_spsi']);

export const normalizeHeaderLabel = (value) => String(value || '').trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').toUpperCase();

export const isBrondolFieldKey = (value) => {
    const normalized = normalizeFieldKey(value);
    return STATIC_BRONDOL_FIELD_KEYS.has(normalized);
};

export const isSpsiFieldKey = (value) => {
    const normalized = normalizeFieldKey(value);
    if (!normalized) return false;
    return normalized === 'spsi'
        || normalized === 'pot_spsi'
        || normalized === 'potongan_spsi'
        || normalized === 'potongan_lainnya_spsi'
        || /^potongan_.*(^|_)spsi(_|$)/.test(normalized);
};

export const isStaticPremiFieldKey = (value) => STATIC_PREMI_FIELDS.has(normalizeFieldKey(value)) || isBrondolFieldKey(value);
export const isStaticPotonganFieldKey = (value) => STATIC_POTONGAN_FIELDS.has(normalizeFieldKey(value)) || isSpsiFieldKey(value);
export const isStaticBrondolHeader = (label, field) => isBrondolFieldKey(field) || STATIC_BRONDOL_LABELS.has(normalizeHeaderLabel(label));
export const isSpsiLabel = (value) => /\bSPSI\b/i.test(String(value || ''));

export const isPremiFieldKey = (value) => normalizeFieldKey(value).startsWith('premi_') && !isStaticPremiFieldKey(value);
export const DETAIL_TOTAL_MISMATCH_PREMI_NAMES = new Set(['PREMI PRUNING', 'PREMI RAKING']);

export const normalizeAdjustmentNameForMismatch = (value) => String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();

export const buildManualDetailMismatchReason = (mismatch) => {
    if (!mismatch) return '';
    return mismatch.reason || `Total detail terbaru ${formatNumber(mismatch.detail_total)} berbeda dari amount awal ${formatNumber(mismatch.amount)}. Detail terbaru dipakai saat simpan.`;
};

export const buildIncompleteDetailReason = (validation) => {
    const reasons = validation?.reasons || [];
    return reasons.length ? reasons.join(' ') : 'Data detail belum lengkap.';
};

export const buildManualDetailIssueReason = ({ mismatch, validation }) => {
    if (mismatch) return `Alasan tanda merah: ${buildManualDetailMismatchReason(mismatch)}`;
    if (validation && !validation.isComplete) return `Data detail belum lengkap: ${buildIncompleteDetailReason(validation)}`;
    return '';
};

export const getVisibleManualDetailMismatch = ({ row, field, adjustmentType, adjustmentName }) => {
    const mismatch = row?.manual_adjustment_metadata_mismatch?.[field];
    if (!mismatch) return null;
    if (normalizeAdjustmentNameForMismatch(adjustmentType) !== 'PREMI') return null;
    if (!DETAIL_TOTAL_MISMATCH_PREMI_NAMES.has(normalizeAdjustmentNameForMismatch(adjustmentName))) return null;
    if (Math.abs(Number(mismatch.amount || 0)) <= 0.01) return null;
    return mismatch;
};

export const getManualDetailValidation = ({ metadata, inputType, amount, adjustmentType }) => {
    const normalizedInputType = normalizeManualDetailInputType(inputType);
    if (!normalizedInputType || normalizedInputType === 'amount') return null;
    if (!metadata) {
        return Math.abs(Number(amount || 0)) > 0.01
            ? { isComplete: false, reasons: ['Detail wajib diisi sesuai input type.'], inputType: normalizedInputType }
            : null;
    }

    const validation = validatePremiumDetailMetadata(metadata, normalizedInputType, adjustmentType);
    return validation.isComplete ? null : validation;
};

// Gang percobaan = satu-satunya gang yang boleh mengubah PTKP master
// (rule sama dengan backend gangService.isPercobaanGang, 2026-08-03)
export const isPercobaanGang = (gangCode, gangDesc) => {
    const code = String(gangCode || '').trim().toUpperCase();
    const desc = String(gangDesc || '').trim().toUpperCase();
    if (!code && !desc) return false;
    return desc.includes('PERCOBAAN') || code.endsWith('P') || code.includes('BHL');
};

export const MANUAL_CELL_DELETE_MARKER = 'DELETE_CELL';

export const buildManualCellDeleteRemarks = (name) => `${name || 'MANUAL ADJUSTMENT'} | ${MANUAL_CELL_DELETE_MARKER} | 0`;

export const isManualCellDeleteEdit = (edit) => Boolean(edit?.delete_cell)
    || (Number(edit?.value || 0) === 0 && String(edit?.remarks || '').toUpperCase().includes(MANUAL_CELL_DELETE_MARKER));

export const isAutomaticPayrollKoreksiFieldKey = (value) => normalizeFieldKey(value) === 'koreksi_hk';

export const isDynamicGrossDeductionFieldKey = (value) => {
    const normalized = normalizeFieldKey(value);
    return !isAutomaticPayrollKoreksiFieldKey(normalized) && (normalized === 'koreksi' || normalized.startsWith('koreksi_'));
};

export const isGrossDeductionFieldKey = (value) => {
    const normalized = normalizeFieldKey(value);
    return isDynamicGrossDeductionFieldKey(normalized) || normalized === 'pot_koreksi' || normalized === 'premi_koreksi' || normalized === 'potongan_upah_kotor_total';
};

export const resolveGrossDeductionWithoutAutomaticHk = (row) => {
    if (!row || typeof row !== 'object') return { total: 0, excludedHk: 0 };

    const rawTotal = Math.abs(toFiniteNumber(row.potongan_upah_kotor_total));
    const potKoreksi = Math.abs(toFiniteNumber(row.pot_koreksi));
    const automaticHk = Math.abs(toFiniteNumber(row.koreksi_hk));
    let dynamicTotal = 0;

    Object.keys(row).forEach((key) => {
        if (isDynamicGrossDeductionFieldKey(key)) {
            dynamicTotal += Math.abs(toFiniteNumber(row[key]));
        }
    });

    const dynamicGross = row.potongan_upah_kotor?.dynamic;
    if (dynamicGross && typeof dynamicGross === 'object') {
        Object.entries(dynamicGross).forEach(([key, value]) => {
            if (isDynamicGrossDeductionFieldKey(key)) {
                dynamicTotal += Math.abs(toFiniteNumber(value));
            }
        });
    }

    const sourceTotal = rawTotal || potKoreksi;
    if (dynamicTotal > 0) {
        return {
            total: dynamicTotal,
            excludedHk: Math.max(0, sourceTotal - dynamicTotal)
        };
    }

    if (sourceTotal > 0 && automaticHk > 0 && Math.abs(sourceTotal - automaticHk) <= 1) {
        return { total: 0, excludedHk: sourceTotal };
    }

    return { total: sourceTotal, excludedHk: 0 };
};

export const normalizeGrossDeductionForDisplay = (row) => {
    if (!row || typeof row !== 'object') return row;
    if (row.type && !['employee', 'gang_total', 'grand_total'].includes(row.type)) return row;

    const { total, excludedHk } = resolveGrossDeductionWithoutAutomaticHk(row);
    if (total === Math.abs(toFiniteNumber(row.potongan_upah_kotor_total)) && excludedHk === 0) {
        return row;
    }

    // [FIX] Do NOT add excludedHk back to jumlah_upah_kotor
    // koreksi_hk is already embedded in gaji_pokok_aktual (from PR_TASKREGLN scan)
    // Adding excludedHk back causes double counting where koreksi_hk is counted twice:
    // once in gaji_pokok_aktual and again in the gross calculation
    // pot_koreksi is a separate deduction from POTONGAN table, not derived from koreksi_hk
    return {
        ...row,
        potongan_upah_kotor_total: total
        // REMOVED: excludedHk adjustments - koreksi_hk already in gaji_pokok_aktual
    };
};

export const isPotonganFieldKey = (value) => {
    const normalized = normalizeFieldKey(value);
    return !isStaticPotonganFieldKey(normalized) && !isGrossDeductionFieldKey(normalized) && normalized.startsWith('potongan_');
};

export const isDynamicPotonganFieldKey = (value) => isPotonganFieldKey(value) || isDynamicGrossDeductionFieldKey(value);

export const formatFallbackPremiLabel = (field) => {
    const normalized = normalizeFieldKey(field);
    if (!normalized) return String(field || '').trim().toUpperCase();

    if (normalized.startsWith('premi_')) {
        return `PREMI ${normalized.slice('premi_'.length).replace(/_/g, ' ').trim()}`.trim().toUpperCase();
    }

    return String(field || '').replace(/_/g, ' ').trim().toUpperCase();
};

export const formatFallbackPotonganLabel = (field) => {
    const normalized = normalizeFieldKey(field);
    if (!normalized) return String(field || '').trim().toUpperCase();

    if (normalized.startsWith('koreksi_')) {
        return `KOREKSI ${normalized.slice('koreksi_'.length).replace(/_/g, ' ').trim()}`.trim().toUpperCase();
    }

    if (normalized.startsWith('potongan_lainnya_')) {
        return `POTONGAN LAINNYA ${normalized.slice('potongan_lainnya_'.length).replace(/_/g, ' ').trim()}`.trim().toUpperCase();
    }

    if (normalized.startsWith('potongan_')) {
        return `POTONGAN ${normalized.slice('potongan_'.length).replace(/_/g, ' ').trim()}`.trim().toUpperCase();
    }

    return String(field || '').replace(/_/g, ' ').trim().toUpperCase();
};

export const parseMetadataObjectValue = (value) => {
    if (!value) return null;
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
};

export const resolveInitialValuePriorityMode = () => {
    try {
        if (typeof window === 'undefined') return 'non_db_ptrj';
        return normalizeValuePriorityMode(localStorage.getItem(VALUE_PRIORITY_MODE_STORAGE_KEY));
    } catch {
        return 'non_db_ptrj';
    }
};

export const comparePayrollEmployeeRows = (a, b, sortBy) => {
    if (sortBy === 'emp_code') {
        return compareEmpCodeValues(a?.emp_code, b?.emp_code);
    }

    if (sortBy === 'name') {
        return String(a?.emp_name || a?.nama || '').localeCompare(String(b?.emp_name || b?.nama || ''), 'en', {
            numeric: true,
            sensitivity: 'base'
        });
    }

    if (sortBy === 'nik') {
        return String(a?.nik || '').localeCompare(String(b?.nik || ''), 'en', {
            numeric: true,
            sensitivity: 'base'
        });
    }

    return 0;
};
