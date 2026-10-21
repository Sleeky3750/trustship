'use client';

// components/logistics/TrackingCard.tsx
//
// Shipment tracking timeline.
//
// Presentational + self-contained: it renders whatever timeline it is handed
// (so it can be fed by an admin fetch OR server-rendered data) and derives the
// milestone rail from TRACKING_MILESTONES so the visual order can never drift
// from the data contract.

import { TRACKING_MILESTONES, type TrackingMilestone } from '@/lib/logistics/types';

export interface TrackingEventView {
  status: string;
  description: string;
  location?: string;
  occurredAt: string;
}

export interface TrackingCardProps {
  trackingNumber?: string | null;
  provider?: string | null;
  /** Newest-first events, as returned by the tracking API. */
  events?: TrackingEventView[];
  /** Current milestone (drives the header pill + rail fill). */
  status?: string | null;
  waybillUrl?: string | null;
  estimatedDelivery?: string | null;
  className?: string;
}

const MILESTONE_LABELS: Record<TrackingMilestone, string> = {
  PICKED_UP: 'Picked Up',
  IN_TRANSIT: 'In Transit',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
};

/** Display metadata for a status string (also covers non-milestone states). */
const STATUS_STYLES: Record<string, { label: string; pill: string; dot: string }> = {
  PICKED_UP: {
    label: 'Picked Up',
    pill: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
    dot: 'bg-blue-400',
  },
  IN_TRANSIT: {
    label: 'In Transit',
    pill: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
    dot: 'bg-indigo-400',
  },
  OUT_FOR_DELIVERY: {
    label: 'Out for Delivery',
    pill: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    dot: 'bg-amber-400',
  },
  DELIVERED: {
    label: 'Delivered',
    pill: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    dot: 'bg-emerald-400',
  },
  PENDING: {
    label: 'Awaiting Pickup',
    pill: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
    dot: 'bg-slate-400',
  },
  EXCEPTION: {
    label: 'Exception',
    pill: 'bg-red-500/10 text-red-300 border-red-500/30',
    dot: 'bg-red-400',
  },
  CANCELLED: {
    label: 'Cancelled',
    pill: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    dot: 'bg-slate-500',
  },
  UNKNOWN: {
    label: 'Unknown',
    pill: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    dot: 'bg-slate-500',
  },
};

function styleFor(status?: string | null) {
  return STATUS_STYLES[(status || 'PENDING').toUpperCase()] ?? STATUS_STYLES.UNKNOWN;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-NG', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Index of the furthest milestone the shipment has reached (-1 if none). */
function reachedIndex(status?: string | null): number {
  const normalized = (status || '').toUpperCase();
  return TRACKING_MILESTONES.indexOf(normalized as TrackingMilestone);
}

export default function TrackingCard({
  trackingNumber,
  provider,
  events = [],
  status,
  waybillUrl,
  estimatedDelivery,
  className = '',
}: TrackingCardProps) {
  const current = styleFor(status);
  const reached = reachedIndex(status);
  const newestFirst = [...events].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );

  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4 ${className}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Shipment tracking
          </p>
          <h3 className="text-lg font-bold text-slate-900 mt-0.5 truncate">
            {trackingNumber || 'No waybill generated'}
          </h3>
          {provider && (
            <p className="text-xs text-slate-500 mt-0.5">Carrier: {provider}</p>
          )}
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${current.pill}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`} />
          {current.label}
        </span>
      </div>

      {/* Milestone rail */}
      {trackingNumber ? (
        <ol className="grid grid-cols-4 gap-2" aria-label="Delivery milestones">
          {TRACKING_MILESTONES.map((milestone, index) => {
            const done = reached >= index;
            const isCurrent = reached === index;
            return (
              <li key={milestone} className="flex flex-col items-center text-center gap-2">
                <div className="flex items-center w-full">
                  <span
                    className={`h-0.5 flex-1 ${index === 0 ? 'bg-transparent' : done ? 'bg-emerald-400' : 'bg-slate-200'}`}
                  />
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold transition ${
                      done
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'bg-white border-slate-300 text-slate-400'
                    } ${isCurrent ? 'ring-4 ring-emerald-500/15' : ''}`}
                  >
                    {done ? '✓' : index + 1}
                  </span>
                  <span
                    className={`h-0.5 flex-1 ${
                      index === TRACKING_MILESTONES.length - 1
                        ? 'bg-transparent'
                        : reached > index
                          ? 'bg-emerald-400'
                          : 'bg-slate-200'
                    }`}
                  />
                </div>
                <span
                  className={`text-[11px] font-semibold leading-tight ${
                    done ? 'text-slate-700' : 'text-slate-400'
                  }`}
                >
                  {MILESTONE_LABELS[milestone]}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-sm text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-xl px-4 py-6 text-center">
          Generate a waybill to start tracking this shipment.
        </p>
      )}

      {/* Meta */}
      {(estimatedDelivery || waybillUrl) && (
        <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-500">
          {estimatedDelivery && (
            <span>
              ETA{' '}
              <span className="font-semibold text-slate-700">
                {new Date(estimatedDelivery).toLocaleDateString('en-NG', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </span>
          )}
          {waybillUrl && (
            <a
              href={waybillUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
            >
              Download waybill →
            </a>
          )}
        </div>
      )}

      {/* Event log */}
      {newestFirst.length > 0 && (
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Activity
          </p>
          <ul className="space-y-3">
            {newestFirst.map((event, index) => {
              const style = styleFor(event.status);
              return (
                <li key={`${event.occurredAt}-${index}`} className="flex gap-3">
                  <span className="relative flex flex-col items-center">
                    <span className={`mt-1.5 h-2 w-2 rounded-full ${style.dot}`} />
                    {index < newestFirst.length - 1 && (
                      <span className="mt-1 w-px flex-1 bg-slate-200" />
                    )}
                  </span>
                  <div className="pb-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800">
                      {style.label}
                      {event.location && (
                        <span className="font-normal text-slate-500"> · {event.location}</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{event.description}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {formatTimestamp(event.occurredAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
