/**
 * @module frontend/src/components/payrollTable/ManualCellActions.jsx
 * @purpose Pure render components for manual-adjustment cell trigger + delete button.
 * @input Props: label, hasData, displayAmount, hasDbMetadata, mismatch, etc.
 * @output JSX button elements for manual cell edit/delete actions.
 * @depends react, ../../utils/payrollTableHelpers (formatNumber, buildManualDetailIssueReason)
 * @sideeffect None (pure render, no state)
 * @tests none — visual component, verified via build
 */

import React from 'react';
import { formatNumber, buildManualDetailIssueReason } from '../../utils/payrollTableHelpers';

/**
 * Get inline style object for manual cell trigger button based on cell state.
 * @pure true
 */
export function getManualCellTriggerStyle({ hasData, hasDbMetadata, hasFallbackMetadata, mismatch, detailValidation, incomplete, pendingDelete, disabled }) {
    const hasDetailIssue = pendingDelete || mismatch || incomplete || (detailValidation && !detailValidation.isComplete);
    return ({
        border: hasDetailIssue ? '1px solid #ef4444' : '1px solid #cbd5e1',
        background: hasDetailIssue ? '#fee2e2' : hasDbMetadata ? '#dcfce7' : hasFallbackMetadata ? '#fef3c7' : '#f8fafc',
        borderRadius: 6,
        padding: '3px 7px',
        cursor: disabled ? 'default' : 'pointer',
        fontSize: 11,
        color: hasDetailIssue ? '#b91c1c' : hasDbMetadata ? '#16a34a' : hasFallbackMetadata ? '#b45309' : '#475569',
        fontWeight: 800,
        lineHeight: 1.1,
        minWidth: hasData ? 58 : 46,
        textAlign: 'center',
        opacity: disabled ? 0.9 : 1
    });
}

/**
 * Render the manual adjustment cell trigger button.
 * Shows input/edit state with detail validation indicators.
 */
export function ManualCellTrigger({ label, hasData, displayAmount, hasDbMetadata, hasFallbackMetadata, mismatch, detailValidation, incomplete, pendingDelete, disabled, onClick }) {
    return (
        <button
            type="button"
            disabled={disabled}
            title={pendingDelete
                ? 'Nilai cell akan dihapus saat Simpan Perubahan.'
                : buildManualDetailIssueReason({
                    mismatch,
                    validation: detailValidation || (incomplete ? { isComplete: false, reasons: ['Isi field wajib sesuai input type.'] } : null)
                }) || (hasData ? 'Edit input manual adjustment' : 'Input manual adjustment')}
            onClick={(event) => {
                event.stopPropagation();
                if (disabled) return;
                onClick?.();
            }}
            style={getManualCellTriggerStyle({ hasData, hasDbMetadata, hasFallbackMetadata, mismatch, detailValidation, incomplete, pendingDelete, disabled })}
        >
            {label || (hasData ? formatNumber(displayAmount) : 'Input')}
        </button>
    );
}

/**
 * Render the delete/cancel-delete button for a manual adjustment cell.
 * Returns null if there's no data and no pending delete.
 */
export function ManualCellDeleteAction({ hasData, pendingDelete, onDelete, onCancelDelete }) {
    if (!hasData && !pendingDelete) return null;
    return (
        <button
            type="button"
            title={pendingDelete ? 'Batalkan hapus nilai cell' : 'Hapus nilai cell manual adjustment'}
            onClick={(event) => {
                event.stopPropagation();
                if (pendingDelete) {
                    onCancelDelete?.();
                } else {
                    onDelete?.();
                }
            }}
            style={{
                border: pendingDelete ? '1px solid #fca5a5' : '1px solid #fecaca',
                background: pendingDelete ? '#fee2e2' : '#fff',
                color: '#b91c1c',
                borderRadius: 6,
                padding: '3px 6px',
                cursor: 'pointer',
                fontSize: 10,
                fontWeight: 800,
                lineHeight: 1.1
            }}
        >
            {pendingDelete ? 'Batal' : 'Hapus'}
        </button>
    );
}
