import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { SummaryCardData } from './reportTypes';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ModuleSummaryCardsProps {
  cards: SummaryCardData[];
  /** Responsive column count (default: auto grid) */
  columns?: 2 | 3 | 4;
  className?: string;
}

// ─── Color map ───────────────────────────────────────────────────────────────

const COLOR_MAP = {
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-100',
    icon: 'text-blue-500',
    value: 'text-blue-700',
    label: 'text-blue-600',
  },
  green: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-100',
    icon: 'text-emerald-500',
    value: 'text-emerald-700',
    label: 'text-emerald-600',
  },
  amber: {
    bg: 'bg-amber-50',
    border: 'border-amber-100',
    icon: 'text-amber-500',
    value: 'text-amber-700',
    label: 'text-amber-600',
  },
  red: {
    bg: 'bg-red-50',
    border: 'border-red-100',
    icon: 'text-red-500',
    value: 'text-red-700',
    label: 'text-red-600',
  },
  slate: {
    bg: 'bg-slate-50',
    border: 'border-slate-100',
    icon: 'text-slate-400',
    value: 'text-slate-700',
    label: 'text-slate-500',
  },
} as const;

// ─── Trend chip ──────────────────────────────────────────────────────────────

interface TrendChipProps {
  direction: 'up' | 'down' | 'flat';
  delta: number;
  label: string;
}

const TrendChip: React.FC<TrendChipProps> = ({ direction, delta, label }) => {
  const Icon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;
  const colorClass =
    direction === 'up'
      ? 'text-emerald-600 bg-emerald-50'
      : direction === 'down'
      ? 'text-red-600 bg-red-50'
      : 'text-slate-500 bg-slate-100';
  const sign = delta > 0 ? '+' : '';

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${colorClass}`}
      title={label}
    >
      <Icon size={11} aria-hidden="true" />
      <span>{sign}{delta}{label !== '' ? `% ${label}` : '%'}</span>
    </span>
  );
};

// ─── Single Card ─────────────────────────────────────────────────────────────

interface CardProps {
  card: SummaryCardData;
}

const SummaryCard: React.FC<CardProps> = ({ card }) => {
  const c = COLOR_MAP[card.color];

  return (
    <article
      aria-label={`${card.label}: ${card.value}${card.unit ?? ''}`}
      className={`
        relative flex flex-col gap-3 p-4 rounded-xl border
        ${c.bg} ${c.border}
        transition-shadow hover:shadow-sm
      `}
    >
      {/* Top row: icon + trend */}
      <div className="flex items-start justify-between gap-2">
        <span className={`mt-0.5 ${c.icon}`} aria-hidden="true">
          {card.icon}
        </span>
        {card.trend && (
          <TrendChip
            direction={card.trend.direction}
            delta={card.trend.delta}
            label={card.trend.label}
          />
        )}
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-bold tracking-tight ${c.value}`}>
          {card.value.toLocaleString()}
        </span>
        {card.unit && (
          <span className={`text-sm font-medium ${c.label}`}>{card.unit}</span>
        )}
      </div>

      {/* Label */}
      <p className={`text-xs font-medium ${c.label}`}>{card.label}</p>
    </article>
  );
};

// ─── Grid ─────────────────────────────────────────────────────────────────────

const COL_SPAN: Record<number, string> = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4',
};

export const ModuleSummaryCards: React.FC<ModuleSummaryCardsProps> = ({
  cards,
  columns = 4,
  className = '',
}) => {
  if (cards.length === 0) {
    return (
      <p className="text-sm text-slate-400 px-6 py-4">No summary data available.</p>
    );
  }

  return (
    <section
      aria-label="Summary metrics"
      className={`grid ${COL_SPAN[columns]} gap-4 p-6 ${className}`}
    >
      {cards.map((card) => (
        <SummaryCard key={card.id} card={card} />
      ))}
    </section>
  );
};

export default ModuleSummaryCards;
