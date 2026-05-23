/**
 * FavoriteButton.tsx
 * Toggleable favorite / bookmark button with animated feedback and persistence hint.
 */

import React, { useState, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FavoriteButtonProps {
  /** Whether the item is currently favorited */
  isFavorite: boolean;
  /** Called when the user toggles the favorite state */
  onToggle: (isFavorite: boolean) => void;
  /** Size: 'sm' | 'md' | 'lg' (default 'md') */
  size?: 'sm' | 'md' | 'lg';
  /** Show a tooltip label */
  label?: string;
  /** Additional CSS class for the button */
  className?: string;
  /** Disable the button */
  disabled?: boolean;
  /** Add an aria-label suffix (e.g. a query name) */
  ariaLabelSuffix?: string;
  /** Use a heart icon instead of star */
  variant?: 'star' | 'heart' | 'bookmark';
  /** Color when favorited (Tailwind text color) */
  activeColor?: string;
  /** Color when not favorited */
  inactiveColor?: string;
  /** Auto-apply animation on toggle */
  animate?: boolean;
  /** HTML button type */
  type?: 'button' | 'submit' | 'reset';
}

// ─── Icons ───────────────────────────────────────────────────────────────────

const StarIcon: React.FC<{ filled: boolean; className?: string }> = ({ filled, className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={filled ? 0 : 2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

const HeartIcon: React.FC<{ filled: boolean; className?: string }> = ({ filled, className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={filled ? 0 : 2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const BookmarkIcon: React.FC<{ filled: boolean; className?: string }> = ({ filled, className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={filled ? 0 : 2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * FavoriteButton — animated toggle button for favoriting / bookmarking items.
 *
 * @example
 * <FavoriteButton
 *   isFavorite={isSaved}
 *   onToggle={(v) => setIsSaved(v)}
 *   variant="star"
 * />
 */
export const FavoriteButton: React.FC<FavoriteButtonProps> = ({
  isFavorite,
  onToggle,
  size = 'md',
  label,
  className = '',
  disabled = false,
  ariaLabelSuffix,
  variant = 'star',
  activeColor = 'text-amber-500',
  inactiveColor = 'text-slate-300',
  animate = true,
  type = 'button',
}) => {
  const [animating, setAnimating] = useState(false);
  const [pressed, setPressed] = useState(false);

  const sizeConfig = {
    sm: { btn: 'h-7 w-7', icon: 'h-3.5 w-3.5', text: 'text-xs' },
    md: { btn: 'h-9 w-9', icon: 'h-4.5 w-4.5', text: 'text-sm' },
    lg: { btn: 'h-11 w-11', icon: 'h-5 w-5', text: 'text-base' },
  };
  const cfg = sizeConfig[size];

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (disabled) return;

      if (animate) {
        setAnimating(true);
        setTimeout(() => setAnimating(false), 400);
      }

      setPressed(true);
      setTimeout(() => setPressed(false), 150);

      onToggle(!isFavorite);
    },
    [disabled, animate, isFavorite, onToggle]
  );

  const colorClass = isFavorite ? activeColor : inactiveColor;

  const iconProps = {
    filled: isFavorite,
    className: `${cfg.icon} ${colorClass} transition-colors duration-200 ${
      animating ? 'scale-125 rotate-12' : pressed ? 'scale-90' : 'scale-100'
    }`,
  };

  const ariaLabel = `Favorite${ariaLabelSuffix ? ` ${ariaLabelSuffix}` : ''} — ${isFavorite ? 'favorited' : 'not favorited'}`;

  return (
    <button
      type={type}
      onClick={handleClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={isFavorite}
      title={label ?? (isFavorite ? 'Remove from favorites' : 'Add to favorites')}
      className={`
        inline-flex items-center justify-center rounded-full
        transition-all duration-150 cursor-pointer
        focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-100 active:bg-slate-200'}
        ${cfg.btn}
        ${className}
      `}
    >
      {variant === 'star' && <StarIcon {...iconProps} />}
      {variant === 'heart' && <HeartIcon {...iconProps} />}
      {variant === 'bookmark' && <BookmarkIcon {...iconProps} />}
      {label && (
        <span className={`${cfg.text} ml-1.5 font-medium text-slate-600`}>
          {label}
        </span>
      )}
    </button>
  );
};

export default FavoriteButton;