'use client';

// components/risk/RiskBadge.tsx
//
// Compact fraud-risk pill for transaction tables. Colour-coded with an icon and
// a native tooltip carrying the evaluator's explanation, so an admin can see
// why a row was flagged without leaving the table.

export type RiskBand = 'LOW' | 'MEDIUM' | 'HIGH';

export interface RiskBadgeProps {
  level?: RiskBand | string | null;
  score?: number | null;
  /** Explanation shown on hover (from the risk evaluator). */
  summary?: string | null;
  /** Show the numeric score alongside the band. */
  showScore?: boolean;
  className?: string;
}

const BAND_META: Record<RiskBand, { label: string; classes: string; icon: string }> = {
  LOW: {
    label: 'Low risk',
    classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: '✓',
  },
  MEDIUM: {
    label: 'Medium risk',
    classes: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: '!',
  },
  HIGH: {
    label: 'High risk',
    classes: 'bg-red-50 text-red-700 border-red-200',
    icon: '⚠',
  },
};

function normalize(level?: string | null): RiskBand {
  const value = (level || '').toUpperCase();
  if (value === 'HIGH' || value === 'MEDIUM' || value === 'LOW') return value;
  return 'LOW';
}

export default function RiskBadge({
  level,
  score,
  summary,
  showScore = false,
  className = '',
}: RiskBadgeProps) {
  const band = normalize(level);
  const meta = BAND_META[band];

  return (
    <span
      title={summary || meta.label}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${meta.classes} ${className}`}
    >
      <span aria-hidden="true">{meta.icon}</span>
      {meta.label}
      {showScore && typeof score === 'number' && (
        <span className="opacity-70 font-mono">{score}</span>
      )}
    </span>
  );
}
