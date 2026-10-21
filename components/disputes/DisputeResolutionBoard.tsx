'use client';

// components/disputes/DisputeResolutionBoard.tsx
//
// Split-view moderation workspace for a single dispute.
//
// Layout:
//   left  — buyer vs seller statement panels + chat-style evidence log
//   right — stage rail with the validated transition actions
//
// Evidence images open in an interactive lightbox. Because WhatsApp media ids
// are not directly fetchable by the browser, images render from a resolved URL
// when the API supplies one and fall back to a labelled placeholder otherwise —
// the board never shows a broken image.

import { useMemo, useState } from 'react';

export interface DisputeEvidenceItem {
  id: string;
  kind: string;
  caption: string | null;
  uploaderPhone: string;
  whatsappMediaId: string;
  mimeType: string | null;
  createdAt: string;
  /** Optional signed/browser-usable URL for image or video preview. */
  mediaUrl?: string | null;
}

export interface DisputeCaseView {
  transactionId: string;
  transactionRef: string;
  stage: string;
  status: string;
  disputeFault: string | null;
  itemTitle: string | null;
  itemAmount: number;
  currency: string;
  totalEscrow: number;
  buyerPhone: string;
  sellerPhone: string;
  statements: { buyer: string | null; seller: string | null };
  evidence: DisputeEvidenceItem[];
}

export interface DisputeResolutionBoardProps {
  dispute: DisputeCaseView;
  /** Called with the chosen stage so the parent performs the POST. */
  onTransition: (input: { stage: string; reason?: string; fault?: string }) => Promise<void>;
  busy?: boolean;
  className?: string;
}

const PIPELINE = ['AWAITING_EVIDENCE', 'IN_MEDIATION', 'ARBITRATION_PENDING', 'RESOLVED'];

const STAGE_META: Record<string, { label: string; pill: string; dot: string }> = {
  AWAITING_EVIDENCE: {
    label: 'Awaiting Evidence',
    pill: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-400',
  },
  IN_MEDIATION: {
    label: 'In Mediation',
    pill: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-400',
  },
  ARBITRATION_PENDING: {
    label: 'Arbitration Pending',
    pill: 'bg-purple-50 text-purple-700 border-purple-200',
    dot: 'bg-purple-400',
  },
  RESOLVED: {
    label: 'Resolved',
    pill: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-400',
  },
};

function stageMeta(stage: string) {
  return STAGE_META[stage] ?? STAGE_META.AWAITING_EVIDENCE;
}

const KIND_ICON: Record<string, string> = {
  IMAGE: '🖼️',
  VIDEO: '🎬',
  DOCUMENT: '📄',
};

export default function DisputeResolutionBoard({
  dispute,
  onTransition,
  busy = false,
  className = '',
}: DisputeResolutionBoardProps) {
  const [lightbox, setLightbox] = useState<DisputeEvidenceItem | null>(null);
  const [reason, setReason] = useState('');
  const [fault, setFault] = useState<string>(dispute.disputeFault || 'SELLER_FAULT');
  const [error, setError] = useState('');

  const current = stageMeta(dispute.stage);
  const currentIndex = PIPELINE.indexOf(dispute.stage);
  const isResolved = dispute.stage === 'RESOLVED';

  const nextStages = useMemo(() => {
    if (isResolved) return [];
    if (dispute.stage === 'AWAITING_EVIDENCE') {
      return ['IN_MEDIATION', 'ARBITRATION_PENDING', 'RESOLVED'];
    }
    if (dispute.stage === 'IN_MEDIATION') return ['ARBITRATION_PENDING', 'RESOLVED'];
    return ['RESOLVED'];
  }, [dispute.stage, isResolved]);

  const sortedEvidence = useMemo(
    () =>
      [...dispute.evidence].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [dispute.evidence]
  );

  const submit = async (stage: string) => {
    setError('');
    try {
      await onTransition({ stage, reason: reason || undefined, fault: fault || undefined });
      setReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the dispute');
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Dispute case
            </p>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5 truncate">
              {dispute.itemTitle || 'Escrow transaction'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">{dispute.transactionRef}</p>
          </div>
          <div className="text-right">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${current.pill}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`} />
              {current.label}
            </span>
            <p className="text-lg font-bold text-slate-900 mt-2">
              {dispute.currency} {Number(dispute.totalEscrow).toLocaleString('en-NG')}
            </p>
            <p className="text-[11px] text-slate-500">Total escrow held</p>
          </div>
        </div>

        {/* Stage rail */}
        <ol className="mt-6 grid grid-cols-4 gap-2" aria-label="Dispute stages">
          {PIPELINE.map((stage, index) => {
            const done = currentIndex >= index;
            return (
              <li key={stage} className="flex flex-col items-center gap-2 text-center">
                <div className="flex w-full items-center">
                  <span className={`h-0.5 flex-1 ${index === 0 ? 'bg-transparent' : done ? 'bg-blue-400' : 'bg-slate-200'}`} />
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold ${
                      done ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white border-slate-300 text-slate-400'
                    }`}
                  >
                    {done ? '✓' : index + 1}
                  </span>
                  <span
                    className={`h-0.5 flex-1 ${
                      index === PIPELINE.length - 1 ? 'bg-transparent' : currentIndex > index ? 'bg-blue-400' : 'bg-slate-200'
                    }`}
                  />
                </div>
                <span className={`text-[11px] font-semibold ${done ? 'text-slate-700' : 'text-slate-400'}`}>
                  {stageMeta(stage).label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: statements + evidence */}
        <div className="lg:col-span-2 space-y-6">
          {/* Side-by-side statements */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { party: 'Buyer', phone: dispute.buyerPhone, statement: dispute.statements.buyer, tone: 'blue' as const },
              { party: 'Seller', phone: dispute.sellerPhone, statement: dispute.statements.seller, tone: 'purple' as const },
            ].map(({ party, phone, statement, tone }) => (
              <div
                key={party}
                className={`rounded-xl border shadow-sm p-5 space-y-2 bg-white ${
                  tone === 'blue' ? 'border-blue-100' : 'border-purple-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">{party} statement</h3>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      tone === 'blue' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                    }`}
                  >
                    {phone}
                  </span>
                </div>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">
                  {statement || 'No statement submitted yet.'}
                </p>
              </div>
            ))}
          </div>

          {/* Evidence log */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Evidence log</h3>
              <span className="text-[11px] font-semibold text-slate-500">
                {sortedEvidence.length} item{sortedEvidence.length === 1 ? '' : 's'}
              </span>
            </div>

            {sortedEvidence.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                No evidence uploaded yet. Both parties can send photos or videos over WhatsApp.
              </p>
            ) : (
              <ul className="space-y-3">
                {sortedEvidence.map((item) => (
                  <li
                    key={item.id}
                    className="flex gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4"
                  >
                    {/* Thumbnail / kind badge */}
                    {item.kind === 'IMAGE' && item.mediaUrl ? (
                      <button
                        type="button"
                        onClick={() => setLightbox(item)}
                        className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white"
                        aria-label="Open evidence preview"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.mediaUrl}
                          alt={item.caption || 'Dispute evidence'}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ) : (
                      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-2xl">
                        {KIND_ICON[item.kind] || '📎'}
                      </span>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-slate-800">
                          {item.kind}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                          {item.uploaderPhone}
                        </span>
                      </div>
                      {item.caption && (
                        <p className="text-xs text-slate-600 mt-1">{item.caption}</p>
                      )}
                      <p className="text-[10px] text-slate-400 mt-1">
                        {new Date(item.createdAt).toLocaleString('en-NG')}
                      </p>
                    </div>

                    {item.kind === 'IMAGE' && item.mediaUrl && (
                      <button
                        type="button"
                        onClick={() => setLightbox(item)}
                        className="self-center shrink-0 rounded-xl border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-white transition"
                      >
                        View
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right: transitions */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Moderation actions</h3>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-[11px] font-semibold text-red-700">
                {error}
              </div>
            )}

            {isResolved ? (
              <p className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs font-semibold text-emerald-800">
                This dispute is resolved and closed.
              </p>
            ) : (
              <>
                <div>
                  <label
                    htmlFor="dispute-reason"
                    className="block text-xs font-semibold text-slate-600 mb-1"
                  >
                    Reason / mediation note
                  </label>
                  <textarea
                    id="dispute-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    placeholder="Required for arbitration and resolution."
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="dispute-fault"
                    className="block text-xs font-semibold text-slate-600 mb-1"
                  >
                    Fault allocation (required to resolve)
                  </label>
                  <select
                    id="dispute-fault"
                    value={fault}
                    onChange={(e) => setFault(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  >
                    <option value="SELLER_FAULT">Seller at fault — refund the buyer</option>
                    <option value="BUYER_FAULT">Buyer at fault — release to the seller</option>
                  </select>
                </div>

                <div className="space-y-2 pt-1">
                  {nextStages.map((stage) => (
                    <button
                      key={stage}
                      type="button"
                      disabled={busy}
                      onClick={() => submit(stage)}
                      className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition disabled:opacity-50 ${
                        stage === 'RESOLVED'
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : stage === 'ARBITRATION_PENDING'
                            ? 'bg-purple-600 hover:bg-purple-500 text-white'
                            : 'bg-blue-600 hover:bg-blue-500 text-white'
                      }`}
                    >
                      Move to {stageMeta(stage).label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Case facts</h3>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Transaction status</dt>
                <dd className="font-semibold text-slate-800">{dispute.status}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Current fault</dt>
                <dd className="font-semibold text-slate-800">
                  {dispute.disputeFault?.replace(/_/g, ' ') || 'Unassigned'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Item amount</dt>
                <dd className="font-semibold text-slate-800">
                  {dispute.currency} {Number(dispute.itemAmount).toLocaleString('en-NG')}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Evidence items</dt>
                <dd className="font-semibold text-slate-800">{dispute.evidence.length}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.mediaUrl || ''}
              alt={lightbox.caption || 'Dispute evidence'}
              className="max-h-[75vh] w-full rounded-xl object-contain bg-black"
            />
            <div className="mt-3 flex items-center justify-between gap-4 text-xs text-white">
              <div>
                <p className="font-semibold">{lightbox.caption || lightbox.kind}</p>
                <p className="text-white/60">
                  {lightbox.uploaderPhone} · {new Date(lightbox.createdAt).toLocaleString('en-NG')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="rounded-xl border border-white/30 px-4 py-2 font-semibold hover:bg-white/10 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
