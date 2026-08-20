/**
 * FilterChips.tsx
 * Toggleable filter chips for multi-select filtering with active state styling.
 */

import React, { useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FilterChip {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Optional icon (ReactNode) */
  icon?: React.ReactNode;
  /** Whether this chip is disabled */
  disabled?: boolean;
  /** Metadata passed to onChange */
  meta?: Record<string, unknown>;
}

export interface FilterChipsProps {
  /** All available chips */
  chips: FilterChip[];
  /** Currently selected chip IDs */
  selected: string[];
  /** Callback when selection changes — passes all selected IDs */
  onChange: (selected: string[]) => void;
  /** Selection mode */
  mode?: 'single' | 'multi';
  /** CSS class for the container */
  className?: string;
  /** Chip size */
  size?: 'sm' | 'md' | 'lg';
  /** Allow clearing all selections */
  clearable?: boolean;
  /** Label for the "All" / clear button */
  clearLabel?: string;
  /** aria-label for the whole group */
  ariaLabel?: string;
  /** Custom renderer for a chip */
  renderChip?: (chip: FilterChip, isSelected: boolean) => React.ReactNode;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const defaultColors = [
  'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100',
  'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
  'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
  'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100',
  'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100',
  'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100',
  'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100',
  'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100',
];

const activeColors = [
  'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700',
  'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700',
  'bg-amber-600 text-white border-amber-600 hover:bg-amber-700',
  'bg-rose-600 text-white border-rose-600 hover:bg-rose-700',
  'bg-cyan-600 text-white border-cyan-600 hover:bg-cyan-700',
  'bg-violet-600 text-white border-violet-600 hover:bg-violet-700',
  'bg-slate-700 text-white border-slate-700 hover:bg-slate-800',
  'bg-teal-600 text-white border-teal-600 hover:bg-teal-700',
];

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * FilterChips — renders a row/grid of toggleable chips.
 *
 * @example
 * <FilterChips
 *   chips={[{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }]}
 *   selected={selected}
 *   onChange={setSelected}
 * />
 */
export const FilterChips: React.FC<FilterChipsProps> = ({
  chips,
  selected,
  onChange,
  mode = 'multi',
  className = '',
  size = 'md',
  clearable = false,
  clearLabel = 'Clear all',
  ariaLabel = 'Filter options',
  renderChip,
}) => {
  const handleClick = useCallback(
    (id: string) => {
      if (mode === 'single') {
        onChange(selected.includes(id) ? [] : [id]);
      } else {
        const next = selected.includes(id)
          ? selected.filter((s) => s !== id)
          : [...selected, id];
        onChange(next);
      }
    },
    [mode, selected, onChange]
  );

  const handleClear = useCallback(() => {
    onChange([]);
  }, [onChange]);

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-3 py-1.5 text-sm gap-1.5',
    lg: 'px-4 py-2 text-base gap-2',
  };

  const iconSizes = { sm: 'h-3 w-3', md: 'h-3.5 w-3.5', lg: 'h-4 w-4' };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`} role="group" aria-label={ariaLabel}>
      {chips.map((chip, index) => {
        const isSelected = selected.includes(chip.id);
        const colorIndex = index % defaultColors.length;

        const baseClasses = `
          inline-flex items-center border rounded-full font-medium
          transition-all duration-150 cursor-pointer select-none
          ${sizeClasses[size]}
          ${chip.disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}
          ${isSelected ? activeColors[colorIndex] : `${defaultColors[colorIndex]} active:scale-95`}
        `;

        if (renderChip) {
          return (
            <div key={chip.id} onClick={() => !chip.disabled && handleClick(chip.id)}>
              {renderChip(chip, isSelected)}
            </div>
          );
        }

        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => !chip.disabled && handleClick(chip.id)}
            disabled={chip.disabled}
            role="checkbox"
            aria-checked={isSelected}
            className={baseClasses}
          >
            {chip.icon && (
              <span className={`${iconSizes[size]} shrink-0`}>{chip.icon}</span>
            )}
            {chip.label}
            {isSelected && mode === 'multi' && (
              <span className="ml-0.5 opacity-70" aria-hidden="true">×</span>
            )}
          </button>
        );
      })}

      {/* Clear button */}
      {clearable && selected.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          className={`
            inline-flex items-center gap-1 px-3 py-1.5 text-sm
            text-slate-500 hover:text-red-600 hover:bg-red-50
            border border-slate-200 rounded-full
            transition-all duration-150 cursor-pointer
          `}
          aria-label={clearLabel}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
          {clearLabel}
        </button>
      )}
    </div>
  );
};

export default FilterChips;