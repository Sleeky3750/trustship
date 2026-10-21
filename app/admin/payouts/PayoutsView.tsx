'use client';

// Payout queue screen: stat pills over the shared PayoutTable.

import { useCallback, useEffect, useState } from 'react';
import PayoutTable, { type PayoutRow } from '@/components/payouts/PayoutTable';

interface PayoutStats {
  PENDING: number;
  PROCESSING: number;
  SUCCESS: number;
  FAILED: number;
  total: number;
}

const STAT_CARDS: { key: keyof PayoutStats; label: string; tone: string }[] = [
  { key: 'PENDING', label: 'Pending', tone: 'text-slate-700' },
  { key: 'PROCESSING', label: 'Processing', tone: 'text-amber-700' },
  { key: 'SUCCESS', label: 'Successful', tone: 'text-emerald-700' },
  { key: 'FAILED', label: 'Failed', tone: 'text-red-700' },
];

export default function PayoutsView() {
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [stats, setStats] = useState<PayoutStats>({
    PENDING: 0,
    PROCESSING: 0,
    SUCCESS: 0,
    FAILED: 0,
    total: 0,
  });
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [enqueueRef, setEnqueueRef] = useState('');
  const [enqueueing, setEnqueueing] = useState(false);

  const fetchPayouts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/admin/payouts?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load payouts');
      setPayouts(data.payouts || []);
      setStats(data.stats || stats);
      setCanManage(!!data.canManage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payouts');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);

  const handleRetry = async (payoutId: string) => {
    setBusyId(payoutId);
    setNotice('');
    setError('');
    try {
      const res = await fetch(`/api/admin/payouts/${payoutId}/retry`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Retry failed');
      setNotice(
        data.status === 'SUCCESS'
          ? 'Payout retried and completed successfully.'
          : `Retry finished with status ${data.status}${data.error ? ` — ${data.error}` : ''}`
      );
      await fetchPayouts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleEnqueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enqueueRef.trim()) return;
    setEnqueueing(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/admin/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionRef: enqueueRef.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not queue the payout');
      setNotice(
        data.created
          ? `Queued a new payout for ${enqueueRef.trim()}.`
          : `A payout for ${enqueueRef.trim()} already exists in the queue.`
      );
      setEnqueueRef('');
      await fetchPayouts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not queue the payout');
    } finally {
      setEnqueueing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Payout Management</h1>
        <p className="text-sm text-slate-400 mt-1">
          Monitor the automated payout queue and retry failed transfers.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map((card) => (
          <div
            key={card.key}
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-6"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {card.label}
            </p>
            <p className={`text-3xl font-bold mt-2 ${card.tone}`}>{stats[card.key]}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-semibold text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs font-semibold text-emerald-700">
          {notice}
        </div>
      )}

      {/* Enqueue form (finance roles only) */}
      {canManage && (
        <form
          onSubmit={handleEnqueue}
          className="flex flex-wrap gap-3 rounded-xl bg-white border border-slate-200 shadow-sm p-4"
        >
          <input
            value={enqueueRef}
            onChange={(e) => setEnqueueRef(e.target.value)}
            placeholder="Queue a payout — enter escrow reference (TS-XXXXXXXX)"
            className="flex-1 min-w-[260px] rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={enqueueing}
            className="rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2.5 text-sm font-semibold shadow-sm transition"
          >
            {enqueueing ? 'Queueing…' : 'Queue payout'}
          </button>
        </form>
      )}

      <PayoutTable
        payouts={payouts}
        onRetry={handleRetry}
        canManage={canManage}
        busyId={busyId}
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        loading={loading}
      />
    </div>
  );
}
