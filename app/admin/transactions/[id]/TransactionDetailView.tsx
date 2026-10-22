'use client';

// Transaction detail: summary + REAL timeline (from recorded events only),
// webhook history, disputes, refunds and payouts.

import { useEffect, useState } from 'react';

interface Detail {
  piiMasked: boolean;
  pinVisible: boolean;
  transaction: any;
  timeline: any[];
  webhooks: any[];
  disputes: any[];
  refunds: any[];
  payouts: any[];
}

const naira = (n: number) => `₦${Number(n).toLocaleString()}`;

const STATUS_TONE: Record<string, string> = {
  PENDING_SELLER_ACCEPTANCE: 'bg-slate-700 text-slate-200',
  PENDING_PAYMENT: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  PENDING_AGREEMENT: 'bg-slate-700 text-slate-200',
  PENDING_DEPOSIT: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  ESCROW_LOCKED: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  DISPATCHED: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30',
  DELIVERED: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
  COMPLETED: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  DISPUTE_OPEN: 'bg-red-500/20 text-red-300 border border-red-500/30',
  REFUNDED: 'bg-slate-700 text-slate-200',
  CANCELLED: 'bg-slate-700 text-slate-400',
};

const EVENT_ICON: Record<string, string> = {
  ESCROW_CREATED: '🆕',
  SELLER_NOTIFIED: '📣',
  PAYMENT_INITIATED: '🔗',
  PAYMENT_VERIFIED: '✅',
  ESCROW_FUNDED: '🔒',
  DELIVERY_INITIATED: '🚚',
  DELIVERY_REPORTED: '📦',
  BUYER_CONFIRMED: '🤝',
  DISPUTE_OPENED: '⚠️',
  DISPUTE_UPDATED: '📝',
  REFUND_REQUESTED: '↩️',
  REFUND_COMPLETED: '💸',
  RELEASE_AUTHORIZED: '✅',
  RELEASE_COMPLETED: '🎉',
  TRANSACTION_COMPLETED: '🏁',
  WEBHOOK_RECEIVED: '📡',
  WEBHOOK_DUPLICATE: '♻️',
};

export default function TransactionDetailView({ id }: { id: string }) {
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/admin/transactions/${encodeURIComponent(id)}`);
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load transaction');
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load transaction');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <div className="text-slate-400 text-sm">Loading transaction…</div>;
  if (error)
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300 text-sm">
        {error}
      </div>
    );
  if (!data) return null;

  const t = data.transaction;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white font-mono">{t.transactionRef}</h1>
          <p className="text-sm text-slate-400 mt-1">{t.itemTitle || 'Untitled item'}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_TONE[t.status] || 'bg-slate-700 text-slate-200'}`}>
          {t.status.replace(/_/g, ' ')}
        </span>
      </div>

      {data.piiMasked && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-200 text-xs">
          Customer phone numbers and bank details are masked for your role. Full PII requires the
          finance or super-admin role.
        </div>
      )}

      {/* Summary */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-4">Summary</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-sm">
          <Field label="Buyer" value={`${t.buyer.name} · ${t.buyer.phone}`} />
          <Field label="Seller" value={`${t.seller.name} · ${t.seller.phone}`} />
          <Field label="Currency" value={t.currency} />
          <Field label="Item Amount" value={naira(t.itemAmount)} />
          <Field label="Waybill" value={`${naira(t.waybillAmount)} (${t.waybillPayer})`} />
          <Field label="Platform Fee" value={naira(t.platformFee)} />
          <Field label="Gateway Fee" value={naira(t.gatewayFee)} />
          <Field label="Total Escrow" value={naira(t.totalEscrow)} />
          <Field label="Seller Payout" value={naira(t.payoutAmount)} />
          <Field label="Payment Provider" value={t.paymentProvider} />
          <Field label="Provider Txn Id" value={t.flwTransactionId || '—'} />
          <Field label="Dispatch Status" value={t.dispatchStatus} />
          <Field label="Delivery Status" value={t.deliveryStatus || '—'} />
          <Field label="Tracking" value={t.trackingNumber || '—'} />
          <Field label="Logistics Provider" value={t.logisticsProvider || '—'} />
          <Field label="Dispute Fault" value={t.disputeFault || '—'} />
          <Field label="Dispute Stage" value={t.disputeStage || '—'} />
          <Field label="Risk" value={t.riskLevel ? `${t.riskLevel} (${t.riskScore ?? '—'})` : '—'} />
          {data.pinVisible && <Field label="Release PIN" value={t.releasePin || '—'} />}
          <Field label="Seller Bank" value={`${t.seller.bankName || '—'} · ${t.seller.accountNumber}`} />
          <Field label="Created" value={new Date(t.createdAt).toLocaleString()} />
          <Field label="Updated" value={new Date(t.updatedAt).toLocaleString()} />
        </dl>
      </section>

      {/* Timeline */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-4">
          Timeline <span className="text-slate-600 normal-case font-normal">(recorded events only)</span>
        </h2>
        {data.timeline.length === 0 ? (
          <p className="text-sm text-slate-500">No recorded events for this transaction yet.</p>
        ) : (
          <ol className="relative border-l border-slate-800 ml-2 space-y-5">
            {data.timeline.map((e) => (
              <li key={e.id} className="ml-5">
                <span className="absolute -left-[9px] flex h-4 w-4 items-center justify-center text-xs">
                  {EVENT_ICON[e.type] || '•'}
                </span>
                <p className="text-sm text-slate-200">{e.message || e.type}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {e.type} · {e.actorKind}
                  {e.actorId ? ` · ${e.actorId}` : ''} · {new Date(e.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Webhook history */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-4">
          Webhook History
        </h2>
        {data.webhooks.length === 0 ? (
          <p className="text-sm text-slate-500">No webhook records for this transaction.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500 border-b border-slate-800">
                <tr>
                  <th className="py-2 pr-4">Provider</th>
                  <th className="py-2 pr-4">Event</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Attempts</th>
                  <th className="py-2 pr-4">Received</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                {data.webhooks.map((w) => (
                  <tr key={w.id} className="border-b border-slate-800/50">
                    <td className="py-2 pr-4">{w.provider}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{w.eventType || '—'}</td>
                    <td className="py-2 pr-4">
                      <span className={`text-xs ${w.status === 'FAILED' ? 'text-red-300' : 'text-emerald-300'}`}>
                        {w.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4">{w.attemptCount}</td>
                    <td className="py-2 pr-4 text-xs">{new Date(w.receivedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-[11px] text-slate-500">
          Payloads are not shown; only sanitised event summaries are exposed here.
        </p>
      </section>

      {/* Refunds */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-4">Refunds</h2>
        {data.refunds.length === 0 ? (
          <p className="text-sm text-slate-500">No refunds for this transaction.</p>
        ) : (
          <ul className="space-y-2">
            {data.refunds.map((r) => (
              <li key={r.id} className="flex items-center justify-between text-sm border-b border-slate-800/50 pb-2">
                <span className="text-slate-300">
                  {naira(r.amount)} · {r.status} · {r.reason || 'No reason'}
                </span>
                <span className="text-xs text-slate-500">
                  {r.processorRef || '—'} · {new Date(r.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Disputes */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-4">Disputes</h2>
        {data.disputes.length === 0 ? (
          <p className="text-sm text-slate-500">No disputes for this transaction.</p>
        ) : (
          <ul className="space-y-2">
            {data.disputes.map((d) => (
              <li key={d.id} className="text-sm border-b border-slate-800/50 pb-2">
                <span className="text-slate-300">
                  {d.status} · {d.category || 'Uncategorised'} · {d.description || 'No description'}
                </span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  Opened {new Date(d.createdAt).toLocaleString()}
                  {d.resolution ? ` · Resolution: ${d.resolution}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-slate-200 break-words">{value}</dd>
    </div>
  );
}
