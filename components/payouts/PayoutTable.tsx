'use client';

// components/payouts/PayoutTable.tsx
//
// Admin payout queue.
//
// Searchable + status-filterable, with colour-coded status pills and an inline
// "Retry Payout" action for FAILED rows (the error text is surfaced in a
// hover tooltip rather than truncated away).

import { useMemo, useState } from 'react';

export interface PayoutRow {
  id: string;
  transactionRef: string;
  amount: number;
  accountNumber: string;
  bankCode: string;
  status: string;
  retryCount: number;
  errorMessage: string | null;
  providerRef: string | null;
  processedAt: string | null;
  createdAt: string;
}

export interface PayoutTableProps {
  payouts: PayoutRow[];
  /** Retry handler — only offered when the viewer may manage payouts. */
  onRetry?: (payoutId: string) => Promise<void> | void;
  canManage?: boolean;
  busyId?: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  loading?: boolean;
  className?: string;
}

const STATUS_PILLS: Record<string, { classes: string; label: string }> = {
  SUCCESS: { classes: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Success' },
  PROCESSING: { classes: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Processing' },
  PENDING: { classes: 'bg-slate-100 text-slate-600 border-slate-200', label: 'Pending' },
  FAILED: { classes: 'bg-red-50 text-red-700 border-red-200', label: 'Failed' },
};

function formatAmount(amount: number): string {
  return `₦${Number(amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

export default function PayoutTable({
  payouts,
  onRetry,
  canManage = false,
  busyId = null,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  loading = false,
  className = '',
}: PayoutTableProps) {
  const [expandedError, setExpandedError] = useState<string | null>(null);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return payouts.filter((p) => {
      const matchesStatus = !statusFilter || p.status === statusFilter;
      const matchesTerm =
        !term ||
        p.transactionRef.toLowerCase().includes(term) ||
        p.accountNumber.includes(term) ||
        (p.providerRef || '').toLowerCase().includes(term);
      return matchesStatus && matchesTerm;
    });
  }, [payouts, search, statusFilter]);

  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 p-4 border-b border-slate-100">
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search reference, account or provider ref…"
          className="flex-1 min-w-[220px] rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
        >
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PROCESSING">Processing</option>
          <option value="SUCCESS">Success</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              <th className="py-3 px-4">Reference</th>
              <th className="py-3 px-4">Amount</th>
              <th className="py-3 px-4">Destination</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Retries</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-400">
                  Loading payouts…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-400">
                  No payouts in the queue.
                </td>
              </tr>
            ) : (
              rows.map((p) => {
                const pill = STATUS_PILLS[p.status] || STATUS_PILLS.PENDING;
                const isFailed = p.status === 'FAILED';
                const isBusy = busyId === p.id;

                return (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4">
                      <div className="font-mono text-[11px] text-slate-700">{p.transactionRef}</div>
                      {p.providerRef && (
                        <div className="font-mono text-[10px] text-slate-400 truncate max-w-[180px]">
                          {p.providerRef}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800 whitespace-nowrap">
                      {formatAmount(p.amount)}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      <div className="font-mono">{p.accountNumber}</div>
                      <div className="text-[10px] text-slate-400">{p.bankCode}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold border ${pill.classes}`}
                        title={isFailed ? p.errorMessage || 'Payout failed' : undefined}
                      >
                        {pill.label}
                      </span>
                      {isFailed && p.errorMessage && (
                        <button
                          type="button"
                          onClick={() => setExpandedError(expandedError === p.id ? null : p.id)}
                          className="block mt-1 text-[10px] font-semibold text-red-600 hover:text-red-700 hover:underline"
                        >
                          {expandedError === p.id ? 'Hide error' : 'View error'}
                        </button>
                      )}
                      {expandedError === p.id && p.errorMessage && (
                        <p className="mt-1 max-w-[240px] rounded-lg bg-red-50 border border-red-100 px-2 py-1.5 text-[10px] text-red-700">
                          {p.errorMessage}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{p.retryCount}</td>
                    <td className="py-3 px-4 text-right">
                      {(p.status === 'FAILED' || p.status === 'PENDING') && canManage && onRetry ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => onRetry(p.id)}
                          className="rounded-xl border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition"
                        >
                          {isBusy ? 'Retrying…' : 'Retry Payout'}
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
