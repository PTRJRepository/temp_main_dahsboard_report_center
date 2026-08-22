/**
 * GlobalSearch.tsx
 * Full-text search bar with debouncing, keyboard shortcuts, and search suggestions.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SearchSuggestion {
  id: string;
  label: string;
  type?: 'recent' | 'suggestion' | 'result';
  icon?: React.ReactNode;
}

export interface GlobalSearchProps {
  /** Current search query */
  value?: string;
  /** Callback when user submits search */
  onSearch?: (query: string) => void;
  /** Callback when query changes (debounced) */
  onChange?: (query: string) => void;
  /** Suggestions to display in dropdown */
  suggestions?: SearchSuggestion[];
  /** Show suggestions dropdown */
  showSuggestions?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Whether search is loading */
  loading?: boolean;
  /** Debounce delay in ms */
  debounceMs?: number;
  /** CSS class for container */
  className?: string;
  /** Auto-focus on mount */
  autoFocus?: boolean;
  /** Disable the input */
  disabled?: boolean;
  /** Minimum characters before search triggers */
  minChars?: number;
  /** onKeyDown handler for custom key handling */
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  /** Callback when suggestion is clicked */
  onSuggestionClick?: (suggestion: SearchSuggestion) => void;
  /** Clear button visibility */
  showClear?: boolean;
  /** Number of results shown (for aria-live) */
  resultCount?: number;
  /** Accessible label */
  ariaLabel?: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const SearchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
);

const ClearIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
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
);

const SpinnerIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={`animate-spin ${className ?? ''}`}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth={4}
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
    />
  </svg>
);

const SuggestionItem: React.FC<{
  suggestion: SearchSuggestion;
  isActive: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}> = ({ suggestion, isActive, onClick, onMouseEnter }) => (
  <li
    role="option"
    aria-selected={isActive}
    className={`
      flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors
      ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'}
    `}
    onClick={onClick}
    onMouseEnter={onMouseEnter}
  >
    {suggestion.icon && (
      <span className={`shrink-0 ${isActive ? 'text-indigo-500' : 'text-slate-400'}`}>
        {suggestion.icon}
      </span>
    )}
    <span className="flex-1 text-sm font-medium truncate">{suggestion.label}</span>
    {suggestion.type && (
      <span
        className={`
          text-xs px-1.5 py-0.5 rounded font-medium shrink-0
          ${suggestion.type === 'recent'
            ? 'bg-amber-100 text-amber-700'
            : suggestion.type === 'suggestion'
            ? 'bg-blue-100 text-blue-700'
            : 'bg-slate-100 text-slate-500'}
        `}
      >
        {suggestion.type}
      </span>
    )}
  </li>
);

// ─── Main Component ──────────────────────────────────────────────────────────

/**
 * GlobalSearch — debounced search input with suggestions dropdown and
 * keyboard navigation (↑↓ Enter Esc).
 *
 * @example
 * <GlobalSearch
 *   value={query}
 *   onChange={setQuery}
 *   onSearch={doSearch}
 *   suggestions={suggestions}
 *   loading={isSearching}
 * />
 */
export const GlobalSearch: React.FC<GlobalSearchProps> = ({
  value: controlledValue,
  onSearch,
  onChange,
  onSuggestionClick,
  suggestions = [],
  showSuggestions = false,
  placeholder = 'Search...',
  loading = false,
  debounceMs = 300,
  className = '',
  autoFocus = false,
  disabled = false,
  minChars = 0,
  onKeyDown,
  showClear = true,
  resultCount,
  ariaLabel = 'Global search',
}) => {
  const [internalValue, setInternalValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [debouncedValue, setDebouncedValue] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Controlled vs. uncontrolled
  const query = controlledValue !== undefined ? controlledValue : internalValue;

  // Debounce
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedValue(query);
      if (onChange && query.length >= minChars) {
        onChange(query);
      }
    }, debounceMs);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query, debounceMs, minChars, onChange]);

  // Reset active index when suggestions change
  useEffect(() => {
    setActiveIndex(-1);
  }, [suggestions]);

  // Keyboard shortcut: Cmd/Ctrl+K to focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (controlledValue === undefined) setInternalValue(val);
    },
    [controlledValue]
  );

  const handleClear = useCallback(() => {
    if (controlledValue === undefined) setInternalValue('');
    onChange?.('');
    inputRef.current?.focus();
  }, [controlledValue, onChange]);

  const handleSubmit = useCallback(
    (q: string) => {
      if (q.trim().length < minChars) return;
      onSearch?.(q.trim());
    },
    [minChars, onSearch]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      onKeyDown?.(e);

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : prev
          );
          break;

        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;

        case 'Enter':
          e.preventDefault();
          if (activeIndex >= 0 && suggestions[activeIndex]) {
            onSuggestionClick?.(suggestions[activeIndex]);
          } else {
            handleSubmit(query);
          }
          break;

        case 'Escape':
          e.preventDefault();
          inputRef.current?.blur();
          setIsFocused(false);
          break;
      }
    },
    [suggestions, activeIndex, query, handleSubmit, onSuggestionClick, onKeyDown]
  );

  const handleSuggestionClick = useCallback(
    (suggestion: SearchSuggestion) => {
      onSuggestionClick?.(suggestion);
      setIsFocused(false);
    },
    [onSuggestionClick]
  );

  const isOpen =
    isFocused &&
    showSuggestions &&
    suggestions.length > 0;

  return (
    <div className={`relative w-full ${className}`} role="search">
      {/* Input wrapper */}
      <div
        className={`
          flex items-center gap-2 bg-white border rounded-xl px-4 py-2.5
          transition-all duration-150 shadow-sm
          ${isFocused ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'}
          ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-text'}
        `}
        onClick={() => !disabled && inputRef.current?.focus()}
      >
        {/* Search icon / spinner */}
        {loading ? (
          <SpinnerIcon className="h-4 w-4 text-slate-400 shrink-0" />
        ) : (
          <SearchIcon className="h-4 w-4 text-slate-400 shrink-0" />
        )}

        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 150)}
          onKeyDown={handleKeyDown}
          onSubmit={() => handleSubmit(query)}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          aria-label={ariaLabel}
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls={isOpen ? 'global-search-listbox' : undefined}
          aria-activedescendant={
            activeIndex >= 0 ? `search-option-${activeIndex}` : undefined
          }
          className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none disabled:cursor-not-allowed"
        />

        {/* Clear button */}
        {showClear && query && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="text-slate-400 hover:text-slate-600 transition-colors rounded-full p-0.5"
            aria-label="Clear search"
          >
            <ClearIcon className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Keyboard shortcut hint */}
        {!query && !loading && (
          <kbd className="hidden sm:flex items-center gap-0.5 text-xs text-slate-400 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 font-mono shrink-0">
            <span className="text-[10px]">&times;</span>K
          </kbd>
        )}
      </div>

      {/* Suggestions dropdown */}
      {isOpen && (
        <ul
          id="global-search-listbox"
          ref={listRef}
          role="listbox"
          className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50"
        >
          {suggestions.map((s, i) => (
            <SuggestionItem
              key={s.id}
              suggestion={s}
              isActive={i === activeIndex}
              onClick={() => handleSuggestionClick(s)}
              onMouseEnter={() => setActiveIndex(i)}
            />
          ))}
        </ul>
      )}

      {/* Screen-reader result count */}
      {resultCount !== undefined && (
        <p className="sr-only" aria-live="polite">
          {resultCount === 0
            ? 'No results found'
            : `${resultCount} result${resultCount !== 1 ? 's' : ''} found`}
        </p>
      )}
    </div>
  );
};

export default GlobalSearch;
