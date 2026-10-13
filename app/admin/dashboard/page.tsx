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
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-mono font-bold border border-blue-500/20">LIVE ENGINE</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">TrustShip Admin Portal</h1>
            <p className="text-slate-400 text-xs md:text-sm mt-1">Manage live escrow transactions, track payments, and oversee state releases.</p>
          </div>
          <button
            onClick={fetchEscrows}
            disabled={loading}
            className="inline-flex items-center justify-center px-4 py-2 border border-slate-700 rounded-xl text-sm font-medium text-slate-200 bg-slate-900 hover:bg-slate-800 transition shadow-sm"
          >
            {loading ? "Refreshing..." : "Refresh Data"}
          </button>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <p className="text-xs text-slate-400 font-medium">Total Escrow Value</p>
            <p className="text-xl font-extrabold text-white mt-1">₦382,500</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <p className="text-xs text-slate-400 font-medium">Active Transactions</p>
            <p className="text-xl font-extrabold text-white mt-1">{escrows.length}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <p className="text-xs text-slate-400 font-medium">Successful Releases</p>
            <p className="text-xl font-extrabold text-emerald-400 mt-1">128</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <p className="text-xs text-slate-400 font-medium">Active Disputes</p>
            <p className="text-xl font-extrabold text-amber-400 mt-1">0</p>
          </div>
        </div>

        {/* Transactions Table Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Escrow Transactions Management</h3>
              <p className="text-xs text-slate-400">Live multi-state transaction lifecycle monitor.</p>
            </div>
            <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-full font-mono">
              {escrows.length} total
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-left">
              <thead className="bg-slate-950/60 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Reference</th>
                  <th className="px-6 py-4">Amounts</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Parties</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs text-slate-300">
                {loading && escrows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      Loading escrow records from database...
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
                    <tr key={tx.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-6 py-4 font-medium text-blue-400 font-mono text-xs">
                        {tx.transactionRef}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-white text-sm">₦{tx.totalEscrow?.toLocaleString()}</div>
                        <div className="text-[11px] text-slate-400">Item: ₦{tx.itemAmount?.toLocaleString()} | Waybill: ₦{tx.waybillAmount?.toLocaleString()}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide ${
                          tx.status === 'RELEASED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          tx.status === 'ESCROW_LOCKED' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                          'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-300">
                        <div><span className="text-slate-500 font-medium">Buyer:</span> +{tx.buyerPhone}</div>
                        <div><span className="text-slate-500 font-medium">Seller:</span> +{tx.sellerPhone}</div>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {tx.status !== 'ESCROW_LOCKED' && tx.status !== 'RELEASED' && (
                          <button
                            onClick={() => handleAction(tx.transactionRef, 'fund')}
                            disabled={actionLoading === tx.transactionRef + 'fund'}
                            className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-semibold transition"
                          >
                            Fund
                          </button>
                        )}
                        {tx.status !== 'RELEASED' && (
                          <button
                            onClick={() => handleAction(tx.transactionRef, 'release')}
                            disabled={actionLoading === tx.transactionRef + 'release'}
                            className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold transition"
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