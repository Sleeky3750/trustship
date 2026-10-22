'use client';

// Operational overview: status counts + financial summary with explicit
// "basis" captions so no number is mistaken for proof of held money.

import { useEffect, useState } from 'react';

interface Basis {
  value: number;
  basis: string;
}

interface Overview {
  windowDays: number;
  counts: Record<string, number>;
  financials: {
    currency: string;
    totalTransactionValue: Basis;
    verifiedCollections: Basis;
    fundsHeld: Basis;
    eligibleForRelease: Basis;
    released: Basis;
    refunded: Basis;
    feesEarned: Basis;
    outstandingReconciliation: Basis;
  };
  webhookHealth: { windowDays: number; total: number; failed: number; failureRate: number };
  generatedAt: string;
}

const naira = (n: number) =>
  `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export default function OverviewView() {
  const [data, setData] = useState<Overview | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/admin/overview?days=${days}`);
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load overview');
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load overview');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [days]);

  if (loading && !data) {
    return <div className="text-slate-400 text-sm">Loading overview…</div>;
  }
  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300 text-sm">
        {error}
      </div>
    );
  }
  if (!data) return null;

  const countCards: { label: string; key: string; tone?: string }[] = [
    { label: 'Total Transactions', key: 'total' },
    { label: 'Awaiting Payment', key: 'awaitingPayment', tone: 'text-amber-300' },
    { label: 'Verified / Funded', key: 'verifiedFunded', tone: 'text-emerald-300' },
    { label: 'Awaiting Delivery', key: 'awaitingDelivery' },
    { label: 'Awaiting Buyer Confirmation', key: 'awaitingBuyerConfirmation' },
    { label: 'Active Disputes', key: 'activeDisputes', tone: 'text-red-300' },
    { label: 'Pending Refunds', key: 'pendingRefunds', tone: 'text-amber-300' },
    { label: 'Completed', key: 'completed', tone: 'text-emerald-300' },
    { label: 'Refunded', key: 'refunded' },
    { label: 'Cancelled / Failed', key: 'cancelled' },
    { label: 'Needs Attention', key: 'needsAttention', tone: 'text-amber-300' },
    { label: 'Pending Payouts', key: 'pendingPayouts' },
  ];

  const finCards: { label: string; item: Basis; accent?: string }[] = [
    { label: 'Total Transaction Value', item: data.financials.totalTransactionValue },
    { label: 'Verified Collections', item: data.financials.verifiedCollections, accent: 'text-emerald-300' },
    { label: 'Funds Held (arrangement)', item: data.financials.fundsHeld },
    { label: 'Eligible for Release', item: data.financials.eligibleForRelease },
    { label: 'Released', item: data.financials.released, accent: 'text-emerald-300' },
    { label: 'Refunded', item: data.financials.refunded },
    { label: 'Fees Earned', item: data.financials.feesEarned, accent: 'text-blue-300' },
    { label: 'Outstanding Reconciliation', item: data.financials.outstandingReconciliation, accent: 'text-amber-300' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Operational Overview</h1>
          <p className="text-sm text-slate-400 mt-1">
            Snapshot generated {new Date(data.generatedAt).toLocaleString()}
          </p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last 365 days</option>
        </select>
      </div>

      {/* Status counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {countCards.map((c) => (
          <div
            key={c.key}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm"
          >
            <p className="text-xs uppercase tracking-wide text-slate-500">{c.label}</p>
            <p className={`mt-2 text-2xl font-bold ${c.tone || 'text-white'}`}>
              {data.counts[c.key] ?? 0}
            </p>
          </div>
        ))}
      </div>

      {/* Financial summary */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Financial Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {finCards.map((f) => (
            <div
              key={f.label}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm"
            >
              <p className="text-xs uppercase tracking-wide text-slate-500">{f.label}</p>
              <p className={`mt-2 text-xl font-bold ${f.accent || 'text-white'}`}>
                {naira(f.item.value)}
              </p>
              <p className="mt-2 text-[11px] leading-snug text-slate-500">{f.item.basis}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Figures derive from recorded transaction statuses and provider settlements. A status is not
          proof that money is physically held or available — see the launch-readiness notes.
        </p>
      </div>

      {/* Webhook health */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Webhook Health</h2>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Events ({data.webhookHealth.windowDays}d)</p>
            <p className="mt-1 text-xl font-bold text-white">{data.webhookHealth.total}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Failed</p>
            <p className="mt-1 text-xl font-bold text-red-300">{data.webhookHealth.failed}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Failure Rate</p>
            <p className="mt-1 text-xl font-bold text-amber-300">
              {(data.webhookHealth.failureRate * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
