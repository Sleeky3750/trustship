'use client';

// Fraud prevention dashboard: stat grid + flagged transaction table with the
// shared RiskBadge and an inline "Recompute" action.

import { useCallback, useEffect, useState } from 'react';
import RiskBadge from '@/components/risk/RiskBadge';

interface FlaggedRow {
  id: string;
  transactionRef: string;
  itemTitle: string | null;
  itemAmount: number;
  currency: string;
  status: string;
  riskLevel: string | null;
  riskScore: number | null;
  buyerPhone: string;
  sellerPhone: string;
  createdAt: string;
}

interface RiskStats {
  total: number;
  high: number;
  medium: number;
  low: number;
  unscored: number;
  openDisputes: number;
  disputeRatio: number;
  scored: number;
}

const EMPTY_STATS: RiskStats = {
  total: 0,
  high: 0,
  medium: 0,
  low: 0,
  unscored: 0,
  openDisputes: 0,
  disputeRatio: 0,
  scored: 0,
};

export default function RiskView() {
  const [stats, setStats] = useState<RiskStats>(EMPTY_STATS);
  const [flagged, setFlagged] = useState<FlaggedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyRef, setBusyRef] = useState<string | null>(null);
  const [liveAssessment, setLiveAssessment] = useState<{
    transactionRef: string;
    level: string;
    score: number;
    summary: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/risk');
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load risk data');
      setStats({ ...EMPTY_STATS, ...data.stats });
      setFlagged(data.flagged || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load risk data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const recompute = async (transactionRef: string) => {
    setBusyRef(transactionRef);
    setLiveAssessment(null);
    try {
      const res = await fetch('/api/admin/risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionRef }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Recompute failed');
      setLiveAssessment({
        transactionRef,
        level: data.assessment.level,
        score: data.assessment.score,
        summary: data.assessment.summary,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recompute failed');
    } finally {
      setBusyRef(null);
    }
  };

  const reviewRate = stats.total > 0 ? ((stats.high + stats.medium) / stats.total) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Fraud Risk Overview</h1>
        <p className="text-sm text-slate-400 mt-1">
          Risk signals across the escrow portfolio and the transactions flagged for review.
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-xs font-semibold text-red-300">
          {error}
        </div>
      )}

      {/* Metric grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'High risk', value: stats.high, tone: 'text-red-600' },
          { label: 'Medium risk', value: stats.medium, tone: 'text-amber-600' },
          { label: 'Low risk', value: stats.low, tone: 'text-emerald-600' },
          { label: 'Open disputes', value: stats.openDisputes, tone: 'text-purple-600' },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {card.label}
            </p>
            <p className={`text-3xl font-bold mt-2 ${card.tone}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Transactions monitored
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.total}</p>
          <p className="text-[11px] text-slate-400 mt-1">
            {stats.scored} scored · {stats.unscored} unscored
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Flagged for review
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {stats.high + stats.medium}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">{reviewRate.toFixed(1)}% of portfolio</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Dispute ratio
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {(stats.disputeRatio * 100).toFixed(1)}%
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {stats.openDisputes} open of {stats.total}
          </p>
        </div>
      </div>

      {liveAssessment && (
        <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-xs">
          <span className="font-semibold text-blue-800">
            {liveAssessment.transactionRef} → {liveAssessment.level} ({liveAssessment.score})
          </span>
          <span className="text-blue-700"> · {liveAssessment.summary}</span>
        </div>
      )}

      {/* Flagged transactions */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">Flagged transactions</h2>
          <p className="text-xs text-slate-500">
            High and medium risk rows, highest score first.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                <th className="py-3 px-4">Reference</th>
                <th className="py-3 px-4">Item</th>
                <th className="py-3 px-4">Parties</th>
                <th className="py-3 px-4">Risk</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    Loading risk data…
                  </td>
                </tr>
              ) : flagged.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    No transactions are currently flagged.
                  </td>
                </tr>
              ) : (
                flagged.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-700">
                      {row.transactionRef}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-800 font-medium truncate max-w-[160px]">
                        {row.itemTitle || '—'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {row.currency} {Number(row.itemAmount).toLocaleString('en-NG')}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      <div>B: {row.buyerPhone}</div>
                      <div className="text-slate-400">S: {row.sellerPhone}</div>
                    </td>
                    <td className="py-3 px-4">
                      <RiskBadge level={row.riskLevel} score={row.riskScore} showScore />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        disabled={busyRef === row.transactionRef}
                        onClick={() => recompute(row.transactionRef)}
                        className="rounded-xl border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition"
                      >
                        {busyRef === row.transactionRef ? 'Scoring…' : 'Recompute'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
