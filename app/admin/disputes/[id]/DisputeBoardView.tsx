'use client';

// Client wrapper that loads a dispute case and wires the board's transitions to
// the moderation API.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import DisputeResolutionBoard, {
  type DisputeCaseView,
} from '@/components/disputes/DisputeResolutionBoard';

export default function DisputeBoardView({ transactionRef }: { transactionRef: string }) {
  const [dispute, setDispute] = useState<DisputeCaseView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadCase = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/disputes/${encodeURIComponent(transactionRef)}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load dispute');
      setDispute(data.dispute);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dispute');
    } finally {
      setLoading(false);
    }
  }, [transactionRef]);

  useEffect(() => {
    loadCase();
  }, [loadCase]);

  const handleTransition = async (input: { stage: string; reason?: string; fault?: string }) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/disputes/${encodeURIComponent(transactionRef)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Transition not permitted');
      }
      if (data.dispute) setDispute(data.dispute);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Link
        href="/admin/disputes"
        className="inline-block text-xs font-semibold text-blue-400 hover:text-blue-300"
      >
        ← Back to disputes
      </Link>

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-xs font-semibold text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center text-sm text-slate-500">
          Loading dispute case…
        </div>
      ) : dispute ? (
        <DisputeResolutionBoard dispute={dispute} onTransition={handleTransition} busy={busy} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center text-sm text-slate-500">
          This dispute case could not be found.
        </div>
      )}
    </div>
  );
}
