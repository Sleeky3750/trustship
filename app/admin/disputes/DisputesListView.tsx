'use client';

// Dispute queue list. Selecting a case deep-links into the split-view board at
// /admin/disputes/[ref].

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface EscrowRow {
  id: string;
  transactionRef: string;
  itemTitle: string | null;
  itemAmount: number;
  currency: string;
  status: string;
  disputeFault: string | null;
  disputeStage: string | null;
  buyerPhone: string;
  sellerPhone: string;
  createdAt: string;
}

const STAGE_PILLS: Record<string, string> = {
  AWAITING_EVIDENCE: 'bg-amber-50 text-amber-700 border-amber-200',
  IN_MEDIATION: 'bg-blue-50 text-blue-700 border-blue-200',
  ARBITRATION_PENDING: 'bg-purple-50 text-purple-700 border-purple-200',
  RESOLVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const STAGE_LABELS: Record<string, string> = {
  AWAITING_EVIDENCE: 'Awaiting Evidence',
  IN_MEDIATION: 'In Mediation',
  ARBITRATION_PENDING: 'Arbitration Pending',
  RESOLVED: 'Resolved',
};

export default function DisputesListView() {
  const [disputes, setDisputes] = useState<EscrowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/admin/escrows?status=DISPUTE_OPEN&limit=100');
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load disputes');
        if (!cancelled) setDisputes(data.escrows || []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load disputes');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = disputes.filter((d) => {
    const term = search.trim().toLowerCase();
    const matchesTerm =
      !term ||
      d.transactionRef.toLowerCase().includes(term) ||
      (d.itemTitle || '').toLowerCase().includes(term);
    const stage = d.disputeStage || 'AWAITING_EVIDENCE';
    const matchesStage = !stageFilter || stage === stageFilter;
    return matchesTerm && matchesStage;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Dispute Resolution</h1>
        <p className="text-sm text-slate-400 mt-1">
          Moderate open disputes through evidence, mediation and arbitration.
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-xs font-semibold text-red-300">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search reference or item…"
          className="flex-1 min-w-[220px] rounded-xl bg-[#070C1E] border border-slate-800 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
        />
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="rounded-xl bg-[#070C1E] border border-slate-800 px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
        >
          <option value="">All stages</option>
          <option value="AWAITING_EVIDENCE">Awaiting Evidence</option>
          <option value="IN_MEDIATION">In Mediation</option>
          <option value="ARBITRATION_PENDING">Arbitration Pending</option>
          <option value="RESOLVED">Resolved</option>
        </select>
      </div>

      <div className="bg-[#070C1E] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-[#030611]/50 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                <th className="py-3 px-4">Reference</th>
                <th className="py-3 px-4">Item</th>
                <th className="py-3 px-4">Parties</th>
                <th className="py-3 px-4">Stage</th>
                <th className="py-3 px-4">Fault</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    Loading disputes…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    No open disputes.
                  </td>
                </tr>
              ) : (
                filtered.map((d) => {
                  const stage = d.disputeStage || 'AWAITING_EVIDENCE';
                  return (
                    <tr key={d.id} className="hover:bg-[#030611]/40 transition">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-300">
                        {d.transactionRef}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-200 font-medium truncate max-w-[180px]">
                          {d.itemTitle || '—'}
                        </div>
                        <div className="text-slate-500 text-[10px]">
                          {d.currency} {Number(d.itemAmount).toLocaleString('en-NG')}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        <div>B: {d.buyerPhone}</div>
                        <div className="text-slate-500">S: {d.sellerPhone}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                            STAGE_PILLS[stage] || 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {STAGE_LABELS[stage] || stage}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {d.disputeFault?.replace(/_/g, ' ') || '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/admin/disputes/${d.transactionRef}`}
                          className="inline-block rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 text-[11px] font-semibold transition"
                        >
                          Open board
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
