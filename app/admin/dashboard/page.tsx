"use client";

import { useEffect, useState } from "react";

export default function AdminDashboardPage() {
  const [escrows, setEscrows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchEscrows = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/escrows");
      const data = await res.json();
      if (data.escrows) setEscrows(data.escrows);
    } catch (err) {
      console.error("Failed to fetch escrows", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEscrows();
  }, []);

  const handleAction = async (ref: string, action: string) => {
    setActionLoading(ref + action);
    try {
      const res = await fetch(`/api/admin/escrow/${ref}/${action}`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        fetchEscrows();
      } else {
        alert(data.error || "Action failed");
      }
    } catch (err) {
      console.error("Action error", err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">TrustShip Admin Portal</h1>
            <p className="text-slate-600 mt-1">Manage live escrow transactions, track payments, and oversee state releases.</p>
          </div>
          <button
            onClick={fetchEscrows}
            disabled={loading}
            className="inline-flex items-center justify-center px-4 py-2 border border-slate-300 rounded-lg shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-100 transition"
          >
            {loading ? "Refreshing..." : "Refresh Data"}
          </button>
        </div>

        {/* Content Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">Reference</th>
                  <th className="px-6 py-3">Amounts</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Parties</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
                {loading && escrows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      Loading escrow records...
                    </td>
                  </tr>
                ) : escrows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      No escrow transactions found in the database yet.
                    </td>
                  </tr>
                ) : (
                  escrows.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-4 font-medium text-slate-900 font-mono text-xs">
                        {tx.transactionRef}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">₦{tx.totalEscrow?.toLocaleString()}</div>
                        <div className="text-xs text-slate-500">Item: ₦{tx.itemAmount} | Waybill: ₦{tx.waybillAmount}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                          tx.status === 'RELEASED' ? 'bg-emerald-100 text-emerald-800' :
                          tx.status === 'ESCROW_LOCKED' ? 'bg-blue-100 text-blue-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600">
                        <div><span className="font-medium">Buyer:</span> {tx.buyerPhone}</div>
                        <div><span className="font-medium">Seller:</span> {tx.sellerPhone}</div>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {tx.status !== 'ESCROW_LOCKED' && tx.status !== 'RELEASED' && (
                          <button
                            onClick={() => handleAction(tx.transactionRef, 'fund')}
                            disabled={actionLoading === tx.transactionRef + 'fund'}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 transition"
                          >
                            Fund
                          </button>
                        )}
                        {tx.status !== 'RELEASED' && (
                          <button
                            onClick={() => handleAction(tx.transactionRef, 'release')}
                            disabled={actionLoading === tx.transactionRef + 'release'}
                            className="px-3 py-1.5 bg-emerald-600 text-white rounded-md text-xs font-medium hover:bg-emerald-700 transition"
                          >
                            Release
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}