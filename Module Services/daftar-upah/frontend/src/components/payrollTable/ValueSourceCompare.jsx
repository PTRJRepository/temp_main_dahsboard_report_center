/**
 * @module frontend/src/components/payrollTable/ValueSourceCompare.jsx
 * @purpose Render active vs db_ptrj value comparison overlay for a cell.
 * @input Props: row, field, renderedValue, valuePriorityMode
 * @output JSX div with active|db_ptrj comparison display.
 * @depends react, ../../utils/payrollTableHelpers (normalizeValuePriorityMode, formatSourceCompareValue)
 * @sideeffect None (pure render)
 * @tests none — visual component
 */

import React from 'react';
import { normalizeValuePriorityMode, formatSourceCompareValue } from '../../utils/payrollTableHelpers';

/**
 * Render value source comparison (active value | db_ptrj value).
 * Only renders in db_ptrj_only mode when comparison data exists.
 */
export function ValueSourceCompare({ row, field, renderedValue, valuePriorityMode }) {
    if (normalizeValuePriorityMode(valuePriorityMode) !== 'db_ptrj_only') return renderedValue;
    const compare = row?.value_source_compare?.[field];
    if (!compare) return renderedValue;

    const dbValue = compare.db_ptrj;
    const activeValue = compare.active;
    const dbText = formatSourceCompareValue(dbValue);
    const activeText = formatSourceCompareValue(activeValue);
    const dbNumeric = Number(dbValue);
    const activeNumeric = Number(activeValue);
    const isSame = Number.isFinite(dbNumeric) && Number.isFinite(activeNumeric)
        ? Math.abs(dbNumeric - activeNumeric) <= 0.01
        : dbText === activeText;

    return (
        <div className="payroll-value-compare" title={`${activeText} | ${dbText}`}>
            <span className="payroll-value-compare__main">{renderedValue ?? '-'}</span>
            <span className={`payroll-value-compare__meta ${isSame ? 'is-match' : 'is-mismatch'}`}>
                {activeText} | {dbText}
            </span>
        </div>
    );
}
