'use client';

// components/logistics/WaybillModal.tsx
//
// "Generate Waybill" modal for admins (and sellers on the escrow detail page).
//
// Owns the whole booking interaction: transaction selection, carrier choice,
// optional pickup/destination overrides, then the POST and the resulting
// tracking number with a one-click clipboard copy.

import { useEffect, useState } from 'react';

export interface WaybillTarget {
  transactionRef: string;
  itemTitle?: string | null;
  buyerPhone?: string | null;
  sellerPhone?: string | null;
  trackingNumber?: string | null;
}

export interface WaybillModalProps {
  open: boolean;
  onClose: () => void;
  /** Pre-selected transaction (when opened from a specific escrow row). */
  target?: WaybillTarget | null;
  /** Called after a successful booking so the parent can refresh its list. */
  onGenerated?: (payload: { transactionRef: string; trackingNumber: string; provider: string }) => void;
}

// Mirror of LOGISTICS_PROVIDERS in lib/logistics/index.ts, inlined because that
// module pulls in Prisma and must not be imported into a Client Component.
const PROVIDERS = [
  { value: 'GIGL', label: 'GIG Logistics' },
  { value: 'SPEEDAF', label: 'Speedaf Express' },
  { value: 'DHL', label: 'DHL Express' },
  { value: 'CUSTOM', label: 'Custom Courier' },
  { value: 'MOCK', label: 'TrustShip Mock Carrier (sandbox)' },
];

export default function WaybillModal({
  open,
  onClose,
  target = null,
  onGenerated,
}: WaybillModalProps) {
  const [transactionRef, setTransactionRef] = useState(target?.transactionRef || '');
  const [provider, setProvider] = useState('MOCK');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ trackingNumber: string; provider: string; waybillUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset transient state each time the modal is opened for a new target.
  useEffect(() => {
    if (!open) return;
    setTransactionRef(target?.transactionRef || '');
    setError('');
    setResult(null);
    setCopied(false);
  }, [open, target?.transactionRef]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/admin/logistics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionRef,
          provider,
          origin: origin || undefined,
          destination: destination || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Could not generate the waybill');
      }

      setResult({
        trackingNumber: data.waybill.trackingNumber,
        provider: data.waybill.provider,
        waybillUrl: data.waybill.waybillUrl,
      });
      onGenerated?.({
        transactionRef,
        trackingNumber: data.waybill.trackingNumber,
        provider: data.waybill.provider,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate the waybill');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyTracking = async () => {
    if (!result?.trackingNumber) return;
    try {
      await navigator.clipboard.writeText(result.trackingNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Clipboard access was blocked by the browser.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="waybill-modal-title"
        className="relative w-full max-w-lg bg-white rounded-xl shadow-xl border border-slate-200 p-6 space-y-4"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="waybill-modal-title" className="text-lg font-bold text-slate-900">
              Generate waybill
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Book a shipment with a carrier and attach tracking to the escrow.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-700 transition text-xl leading-none"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-semibold text-red-700">
            {error}
          </div>
        )}

        {result ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
              <p className="text-xs font-semibold text-emerald-700">Waybill created</p>
              <p className="text-sm text-emerald-900 mt-1">
                Booked with <span className="font-semibold">{result.provider}</span>
              </p>
              <div className="mt-3 flex items-center gap-2">
                <code className="flex-1 truncate rounded-xl bg-white border border-emerald-200 px-3 py-2 text-sm font-mono text-slate-800">
                  {result.trackingNumber}
                </code>
                <button
                  type="button"
                  onClick={copyTracking}
                  className="shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 text-xs font-semibold transition"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <a
                href={result.waybillUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
              >
                Download waybill →
              </a>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setResult(null);
                    setTransactionRef('');
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Book another
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 text-xs font-semibold transition"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="waybill-ref" className="block text-xs font-semibold text-slate-600 mb-1">
                Escrow reference
              </label>
              <input
                id="waybill-ref"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                required
                placeholder="TS-XXXXXXXX"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
              {target?.itemTitle && (
                <p className="text-[11px] text-slate-500 mt-1">Item: {target.itemTitle}</p>
              )}
            </div>

            <div>
              <label htmlFor="waybill-provider" className="block text-xs font-semibold text-slate-600 mb-1">
                Carrier
              </label>
              <select
                id="waybill-provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="waybill-origin" className="block text-xs font-semibold text-slate-600 mb-1">
                  Pickup location
                </label>
                <input
                  id="waybill-origin"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="Lagos, Nigeria"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="waybill-destination" className="block text-xs font-semibold text-slate-600 mb-1">
                  Delivery location
                </label>
                <input
                  id="waybill-destination"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Abuja, Nigeria"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2 text-sm font-semibold shadow-sm transition"
              >
                {isSubmitting ? 'Generating…' : 'Generate waybill'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
