'use client';

// Admin refund management: list + lifecycle actions (review/approve/reject/
// execute). Each action is permission-gated server-side; the UI mirrors the
// caller's permissions to avoid offering an action that will be refused.

import { useCallback, useEffect, useState } from 'react';

interface RefundRow {
  id: string;
  transactionRef: string;
  amount: number;
  currency: string;
  reason: string | null;
  status: string;
  processorRef: string | null;
  failureReason: string | null;
  requestedById: string | null;
  createdAt: string;
}

const STATUS_TONE: Record<string, string> = {
  REQUESTED: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  UNDER_REVIEW: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  APPROVED: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30',
  PROCESSING: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
  COMPLETED: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  FAILED: 'bg-red-500/20 text-red-300 border border-red-500/30',
  REJECTED: 'bg-slate-700 text-slate-300',
};

export default function RefundsView() {
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [query, setQuery] = useState('');
  const [permissions, setPermissions] = useState({
    approve: false,
    execute: false,
    request: false,
  });

  const fetchRefunds = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (statusFilter) params.set('status', statusFilter);
      if (query) params.set('q', query);
      const res = await fetch(`/api/admin/refunds?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load refunds');
      setRefunds(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load refunds');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, query]);

  useEffect(() => {
    fetchRefunds();
  }, [fetchRefunds]);

  // Resolve the caller's permissions so the UI only offers permitted actions.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/me');
        const data = await res.json();
        const role = (data?.admin?.role || '').toUpperCase();
        setPermissions({
          approve: role === 'SUPER_ADMIN' || role === 'FINANCE_ADMIN' || role === 'FINANCE',
          execute: role === 'SUPER_ADMIN' || role === 'FINANCE_ADMIN' || role === 'FINANCE',
          request: true, // all roles may request
        });
      } catch {
        /* leave defaults (deny) */
      }
    })();
  }, []);

  const act = async (id: string, action: string) => {
    if (action === 'execute') {
      const ok = window.confirm(
        'Execute this refund against the payment provider? This moves money and cannot be undone.'
      );
      if (!ok) return;
    }
    setBusyId(id);
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/admin/refunds/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action} refund`);
      setNotice(
        action === 'execute'
          ? data.message || 'Refund execution attempted.'
          : `Refund ${action}d.`
      );
      await fetchRefunds();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} refund`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Refunds</h1>
          <p className="text-sm text-slate-400 mt-1">
            A refund is only completed after the payment provider confirms it.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ref or reason"
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
          >
            <option value="">All statuses</option>
            {Object.keys(STATUS_TONE).map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-300 text-sm">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-300 text-sm">
          {notice}
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Transaction</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    Loading refunds…
                  </td>
                </tr>
              ) : refunds.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    No refunds found.
                  </td>
                </tr>
              ) : (
                refunds.map((r) => (
                  <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                    <td className="px-4 py-3 font-mono text-xs">{r.transactionRef}</td>
                    <td className="px-4 py-3">₦{r.amount.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_TONE[r.status] || 'bg-slate-700 text-slate-300'}`}>
                        {r.status.replace(/_/g, ' ')}
                      </span>
                      {r.failureReason && (
                        <span
                          className="ml-2 text-[11px] text-red-300 cursor-help"
                          title={r.failureReason}
                        >
                          ⚠
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{r.reason || '—'}</td>
                    <td className="px-4 py-3 text-xs">{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {r.status === 'REQUESTED' && (
                          <button
                            disabled={busyId === r.id}
                            onClick={() => act(r.id, 'review')}
                            className="px-2.5 py-1 rounded-lg text-xs bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-50"
                          >
                            Review
                          </button>
                        )}
                        {(r.status === 'REQUESTED' || r.status === 'UNDER_REVIEW') && permissions.approve && (
                          <>
                            <button
                              disabled={busyId === r.id}
                              onClick={() => act(r.id, 'approve')}
                              className="px-2.5 py-1 rounded-lg text-xs bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              disabled={busyId === r.id}
                              onClick={() => act(r.id, 'reject')}
                              className="px-2.5 py-1 rounded-lg text-xs bg-red-600 hover:bg-red-500 text-white disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {r.status === 'APPROVED' && permissions.execute && (
                          <button
                            disabled={busyId === r.id}
                            onClick={() => act(r.id, 'execute')}
                            className="px-2.5 py-1 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
                          >
                            Execute
                          </button>
                        )}
                        {r.status === 'APPROVED' && !permissions.execute && (
                          <span className="text-[11px] text-slate-500">Awaiting finance</span>
                        )}
                      </div>
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
