"use client";

import { useEffect, useState } from "react";

export default function AdminDashboardPage() {
  const [escrows, setEscrows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
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

  // Handler for Waybill Delivery Updates + WhatsApp Notification
  const handleWaybillDelivery = async (transactionRef: string) => {
    setActionLoading(transactionRef + "waybill");
    try {
      const res = await fetch("/api/escrow/waybill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionRef,
          dispatchStatus: "DELIVERED",
        }),
      });

      const data = await res.json();

      if (res.ok) {
        alert(`Waybill status updated to DELIVERED for ${transactionRef}. WhatsApp notification dispatched to buyer!`);
        fetchEscrows();
      } else {
        alert(data.error || "Waybill update failed");
      }
    } catch (err) {
      console.error("Waybill delivery error", err);
      alert("Error updating waybill status.");
    } finally {
      setActionLoading(null);
    }
  };

  // --- DYNAMIC METRICS CALCULATION ---
  const totalEscrowValue = escrows.reduce((acc, tx) => acc + (tx.totalEscrow || tx.itemAmount || 0), 0);
  const activeTransactionsCount = escrows.filter(tx => tx.status !== 'RELEASED').length;
  const successfulReleasesCount = escrows.filter(tx => tx.status === 'RELEASED').length;
  const activeDisputesCount = escrows.filter(tx => tx.status === 'DISPUTED').length;

  const filteredEscrows = escrows.filter(
    (tx) =>
      tx.transactionRef?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.buyerPhone?.includes(searchQuery) ||
      tx.sellerPhone?.includes(searchQuery)
  );

  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "trustship.app@gmail.com";

  return (
    <div className="bg-[#030611] text-slate-100 font-sans min-h-screen flex flex-col antialiased selection:bg-blue-500 selection:text-white">
      {/* NAVIGATION HEADER */}
      <header className="border-b border-slate-800/80 bg-[#070C1E]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-emerald-400 flex items-center justify-center text-white shadow-lg shadow-blue-600/20 font-black text-xl tracking-wider">
              TS
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
                TrustShip <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/20">LIVE ENGINE</span>
              </span>
              <p className="text-xs text-slate-400 hidden sm:block">Automated Escrow & WhatsApp PIN Verification</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-3 bg-[#030611]/80 border border-slate-800 rounded-xl px-4 py-1.5">
              <div className="flex items-center gap-2 border-r border-slate-800 pr-3">
                <div>
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Total Database Records</p>
                  <p className="text-xs font-bold text-slate-200">{escrows.length} Transactions</p>
                </div>
              </div>
            </div>

            <button
              onClick={fetchEscrows}
              className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-lg shadow-blue-600/25 transition-all"
            >
              {loading ? "Refreshing..." : "Refresh Data"}
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* DYNAMIC METRICS OVERVIEW CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#070C1E] border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-lg">
            <div>
              <p className="text-xs text-slate-400 font-medium">Total Escrow Value</p>
              <p className="text-xl font-extrabold text-white mt-1">₦{totalEscrowValue.toLocaleString()}</p>
              <p className="text-[11px] text-emerald-400 mt-1">Live database sum</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-lg font-bold">
              🛡️
            </div>
          </div>

          <div className="bg-[#070C1E] border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-lg">
            <div>
              <p className="text-xs text-slate-400 font-medium">Active Transactions</p>
              <p className="text-xl font-extrabold text-white mt-1">{activeTransactionsCount}</p>
              <p className="text-[11px] text-blue-400 mt-1">Pending Release</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 text-lg font-bold">
              🔄
            </div>
          </div>

          <div className="bg-[#070C1E] border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-lg">
            <div>
              <p className="text-xs text-slate-400 font-medium">Successful Releases</p>
              <p className="text-xl font-extrabold text-white mt-1">{successfulReleasesCount}</p>
              <p className="text-[11px] text-emerald-400 mt-1">Completed orders</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-lg font-bold">
              ✅
            </div>
          </div>

          <div className="bg-[#070C1E] border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-lg">
            <div>
              <p className="text-xs text-slate-400 font-medium">Active Disputes</p>
              <p className="text-xl font-extrabold text-white mt-1">{activeDisputesCount}</p>
              <p className="text-[11px] text-red-400 mt-1">Requires Admin Ruling</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 text-lg font-bold">
              ⚠️
            </div>
          </div>
        </div>

        {/* TRANSACTIONS TABLE SECTION */}
        <section className="bg-[#070C1E] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Escrow Transactions Management
                <span className="text-xs bg-slate-800 text-slate-300 font-normal px-2 py-0.5 rounded-full">{escrows.length} total</span>
              </h3>
              <p className="text-xs text-slate-400">Live multi-state transaction lifecycle monitor.</p>
            </div>

            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Ref or Phone..."
                className="bg-[#030611] border border-slate-800 text-xs text-slate-200 rounded-xl px-3 py-2 w-48 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-[#030611]/50 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                  <th className="py-3 px-4">Ref & Dates</th>
                  <th className="py-3 px-4">Parties (Buyer / Seller)</th>
                  <th className="py-3 px-4">Financial Breakdown</th>
                  <th className="py-3 px-4">Lifecycle Status</th>
                  <th className="py-3 px-4">Waybill Status</th>
                  <th className="py-3 px-4 text-center">Release PIN</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {loading && escrows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-500">Loading escrow records...</td>
                  </tr>
                ) : filteredEscrows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-500">No matching escrow transactions found.</td>
                  </tr>
                ) : (
                  filteredEscrows.map((tx) => (
                    <tr key={tx.id} className="hover:bg-[#030611]/60 transition border-b border-slate-800/40">
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-blue-400 block">{tx.transactionRef}</span>
                        <span className="text-[10px] text-slate-400">{new Date(tx.createdAt).toLocaleDateString()}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-[11px]">
                          <span className="text-slate-300 block"><strong className="text-slate-500">B:</strong> +{tx.buyerPhone}</span>
                          <span className="text-slate-400 block"><strong className="text-slate-500">S:</strong> +{tx.sellerPhone}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-white block">₦{tx.itemAmount?.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400 block">Total: ₦{tx.totalEscrow?.toLocaleString()}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide ${
                          tx.status === 'RELEASED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          tx.status === 'ESCROW_LOCKED' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                          'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          tx.dispatchStatus === 'DELIVERED' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                          'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {tx.dispatchStatus || "PENDING"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="bg-[#030611] border border-slate-800 px-2.5 py-1 rounded font-mono font-bold text-amber-400 text-xs shadow-inner">
                          {tx.releasePin || "----"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {tx.dispatchStatus !== 'DELIVERED' && (
                            <button
                              onClick={() => handleWaybillDelivery(tx.transactionRef)}
                              disabled={actionLoading === tx.transactionRef + 'waybill'}
                              className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded text-[10px] font-semibold transition"
                            >
                              {actionLoading === tx.transactionRef + 'waybill' ? "Delivering..." : "📦 Mark Delivered"}
                            </button>
                          )}

                          {tx.status !== 'ESCROW_LOCKED' && tx.status !== 'RELEASED' && (
                            <button
                              onClick={() => handleAction(tx.transactionRef, 'fund')}
                              disabled={actionLoading === tx.transactionRef + 'fund'}
                              className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded text-[10px] font-semibold transition"
                            >
                              Fund
                            </button>
                          )}
                          {tx.status !== 'RELEASED' && (
                            <button
                              onClick={() => handleAction(tx.transactionRef, 'release')}
                              disabled={actionLoading === tx.transactionRef + 'release'}
                              className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 px-2.5 py-1 rounded text-[10px] font-semibold transition"
                            >
                              Release
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* SUPPORT FOOTER */}
      <footer className="border-t border-slate-800/80 bg-[#070C1E]/50 py-6 text-center text-xs text-slate-500 mt-auto">
        <p>© {new Date().getFullYear()} TrustShip Escrow Technologies. All rights reserved.</p>
        <p className="mt-1">
          Need technical assistance? Contact{" "}
          <a href={`mailto:${supportEmail}`} className="text-blue-400 hover:underline font-medium">
            {supportEmail}
          </a>
        </p>
      </footer>
    </div>
  );
}