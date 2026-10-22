'use client';

// Admin logistics board.
//
// Fleet table (searchable by reference, filterable by carrier / tracked state)
// plus the shipment timeline card and the "Generate Waybill" modal.

import { useCallback, useEffect, useMemo, useState } from 'react';
import TrackingCard, { type TrackingEventView } from '@/components/logistics/TrackingCard';
import WaybillModal, { type WaybillTarget } from '@/components/logistics/WaybillModal';

interface Shipment {
  id: string;
  transactionRef: string;
  itemTitle: string | null;
  itemAmount: number;
  currency: string;
  status: string;
  trackingNumber: string | null;
  logisticsProvider: string | null;
  waybillUrl: string | null;
  deliveryStatus: string | null;
  courierName: string | null;
  buyerPhone: string;
  sellerPhone: string;
  createdAt: string;
}

const DELIVERY_PILLS: Record<string, string> = {
  PICKED_UP: 'bg-blue-50 text-blue-700 border-blue-200',
  IN_TRANSIT: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  OUT_FOR_DELIVERY: 'bg-amber-50 text-amber-700 border-amber-200',
  DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  EXCEPTION: 'bg-red-50 text-red-700 border-red-200',
  CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200',
};

function deliveryPill(status?: string | null): string {
  return DELIVERY_PILLS[(status || '').toUpperCase()] || 'bg-slate-100 text-slate-500 border-slate-200';
}

function formatNaira(amount: number, currency = 'NGN'): string {
  const symbol = currency === 'NGN' ? '₦' : currency === 'USD' ? '$' : '';
  return `${symbol}${Number(amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

export default function LogisticsView() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState('');
  const [trackedFilter, setTrackedFilter] = useState('');
  const [stats, setStats] = useState({ total: 0, tracked: 0, delivered: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<WaybillTarget | null>(null);

  // Timeline card state for the currently selected shipment.
  const [timeline, setTimeline] = useState<{
    trackingNumber: string;
    provider: string;
    status: string;
    events: TrackingEventView[];
    waybillUrl?: string | null;
    estimatedDelivery?: string | null;
  } | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (providerFilter) params.set('provider', providerFilter);
      if (trackedFilter) params.set('tracked', trackedFilter);
      params.set('limit', '50');

      const res = await fetch(`/api/admin/logistics?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load shipments');
      }
      setShipments(data.shipments || []);
      setStats(data.shipmentStats || { total: 0, tracked: 0, delivered: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shipments');
    } finally {
      setLoading(false);
    }
  }, [providerFilter, trackedFilter]);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return shipments;
    return shipments.filter(
      (s) =>
        s.transactionRef.toLowerCase().includes(term) ||
        (s.itemTitle || '').toLowerCase().includes(term) ||
        (s.trackingNumber || '').toLowerCase().includes(term)
    );
  }, [shipments, search]);

  const openTimeline = async (shipment: Shipment) => {
    if (!shipment.trackingNumber) return;
    setTimelineLoading(true);
    try {
      const res = await fetch(
        `/api/admin/logistics/track?trackingNumber=${encodeURIComponent(shipment.trackingNumber)}`
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setTimeline({
          trackingNumber: data.tracking.trackingNumber,
          provider: shipment.logisticsProvider || 'MOCK',
          status: data.tracking.status,
          events: data.tracking.events || [],
          waybillUrl: shipment.waybillUrl,
          estimatedDelivery: data.tracking.estimatedDelivery,
        });
      }
    } catch (err) {
      console.error('Failed to load tracking timeline', err);
    } finally {
      setTimelineLoading(false);
    }
  };

  const openWaybillModal = (shipment?: Shipment) => {
    setSelected(
      shipment
        ? {
            transactionRef: shipment.transactionRef,
            itemTitle: shipment.itemTitle,
            buyerPhone: shipment.buyerPhone,
            sellerPhone: shipment.sellerPhone,
            trackingNumber: shipment.trackingNumber,
          }
        : null
    );
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-100">Logistics &amp; Tracking</h1>
          <p className="text-sm text-slate-400 mt-1">
            Monitor automated carrier shipments, track deliveries, and issue
            manual waybill overrides when needed.
          </p>
        </div>
        <div className="flex flex-col items-start gap-1.5 sm:items-end sm:flex-shrink-0">
          <button
            type="button"
            onClick={() => openWaybillModal()}
            title="Sellers generate waybills automatically upon dispatch. Use this option only for manual support overrides."
            className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 text-sm font-semibold shadow-sm transition whitespace-nowrap"
          >
            + Manual Waybill Override
          </button>
          <p className="text-[11px] leading-tight text-slate-500 sm:text-right sm:max-w-[18rem]">
            Sellers generate waybills automatically upon dispatch. Use this
            option only for manual support overrides.
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Shipments', value: stats.total },
          { label: 'Tracked', value: stats.tracked },
          { label: 'Delivered', value: stats.delivered },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-[#070C1E] border border-slate-800 rounded-xl p-6 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {card.label}
            </p>
            <p className="text-3xl font-bold text-white mt-2">{card.value}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-xs font-semibold text-red-300">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search reference, item or tracking number…"
          className="flex-1 min-w-[220px] rounded-xl bg-[#070C1E] border border-slate-800 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
        />
        <select
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value)}
          className="rounded-xl bg-[#070C1E] border border-slate-800 px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
        >
          <option value="">All carriers</option>
          <option value="GIGL">GIG Logistics</option>
          <option value="SPEEDAF">Speedaf</option>
          <option value="DHL">DHL</option>
          <option value="CUSTOM">Custom</option>
          <option value="MOCK">Mock</option>
        </select>
        <select
          value={trackedFilter}
          onChange={(e) => setTrackedFilter(e.target.value)}
          className="rounded-xl bg-[#070C1E] border border-slate-800 px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
        >
          <option value="">All shipments</option>
          <option value="true">With waybill</option>
          <option value="false">Without waybill</option>
        </select>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Fleet table */}
        <div className="xl:col-span-2 bg-[#070C1E] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-[#030611]/50 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Item</th>
                  <th className="py-3 px-4">Carrier</th>
                  <th className="py-3 px-4">Tracking</th>
                  <th className="py-3 px-4">Delivery</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500">
                      Loading shipments…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500">
                      No shipments match your filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => (
                    <tr key={s.id} className="hover:bg-[#030611]/40 transition">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-300">
                        {s.transactionRef}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-200 font-medium truncate max-w-[160px]">
                          {s.itemTitle || '—'}
                        </div>
                        <div className="text-slate-500 text-[10px]">
                          {formatNaira(s.itemAmount, s.currency)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {s.logisticsProvider || '—'}
                      </td>
                      <td className="py-3 px-4">
                        {s.trackingNumber ? (
                          <button
                            type="button"
                            onClick={() => openTimeline(s)}
                            className="font-mono text-[11px] text-blue-400 hover:text-blue-300 hover:underline"
                          >
                            {s.trackingNumber}
                          </button>
                        ) : (
                          <span className="text-slate-600">Not booked</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold border ${deliveryPill(
                            s.deliveryStatus
                          )}`}
                        >
                          {s.deliveryStatus?.replace(/_/g, ' ') || 'PENDING'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => openWaybillModal(s)}
                          className="rounded-xl border border-slate-700 px-3 py-1.5 text-[11px] font-semibold text-slate-300 hover:bg-slate-800 transition"
                        >
                          {s.trackingNumber ? 'Re-book' : 'Generate'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Timeline panel */}
        <div className="space-y-4">
          {timelineLoading ? (
            <div className="bg-[#070C1E] rounded-xl border border-slate-800 shadow-sm p-6 text-sm text-slate-500">
              Loading timeline…
            </div>
          ) : timeline ? (
            <TrackingCard
              trackingNumber={timeline.trackingNumber}
              provider={timeline.provider}
              status={timeline.status}
              events={timeline.events}
              waybillUrl={timeline.waybillUrl}
              estimatedDelivery={timeline.estimatedDelivery}
            />
          ) : (
            <div className="bg-[#070C1E] rounded-xl border border-dashed border-slate-700 shadow-sm p-8 text-center">
              <p className="text-sm font-semibold text-slate-200">Shipment timeline</p>
              <p className="text-xs text-slate-500 mt-1">
                Select a tracking number to view its milestone timeline.
              </p>
            </div>
          )}
        </div>
      </div>

      <WaybillModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        target={selected}
        onGenerated={() => fetchShipments()}
      />
    </div>
  );
}
