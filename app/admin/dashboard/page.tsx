"use client";

import { useState, useEffect } from "react";

interface Transaction {
  id: string;
  transactionRef: string;
  totalEscrow: number;
  itemAmount: number;
  waybillAmount: number;
  status: "PENDING_DEPOSIT" | "ESCROW_LOCKED" | "DISPATCHED" | "DELIVERED" | "RELEASED" | "DISPUTED" | "REFUNDED";
  disputeFault?: "SELLER_FAULT" | "BUYER_FAULT" | null;
  disputeReason?: string | null;
  buyerPhone: string;
  sellerPhone: string;
  createdAt: string;
  seller: {
    name: string;
    accountNumber: string;
    bankName: string;
  };
}

export default function AdminDashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");
  const [selectedDispute, setSelectedDispute] = useState<Transaction | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      // Endpoint returning all transactions for admin review
      const res = await fetch("/api/admin/transactions");
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
      }
    } catch (err) {
      console.error("Failed to load admin transactions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveDispute = async (resolution: "RELEASE_TO_SELLER" | "REFUND_BUYER") => {
    if (!selectedDispute) return;
    setActionLoading(true);
    setActionMessage(null);

    try {
      const res = await fetch("/api/admin/resolve-dispute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionRef: selectedDispute.transactionRef,
          resolution,
          adminNote,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Resolution failed");

      setActionMessage({
        type: "success",
        text: `Successfully resolved ${selectedDispute.transactionRef} as ${resolution}`,
      });

      // Refresh data & close modal after delay
      setTimeout(() => {
        setSelectedDispute(null);
        setAdminNote("");
        setActionMessage(null);
        fetchTransactions();
      }, 1500);

    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Metrics Calculations
  const totalVolume = transactions.reduce((sum, t) => sum + t.totalEscrow, 0);
  const lockedVolume = transactions
    .filter((t) => ["ESCROW_LOCKED", "DISPATCHED", "DELIVERED"].includes(t.status))
    .reduce((sum, t) => sum + t.totalEscrow, 0);
  const disputedCount = transactions.filter((t) => t.status === "DISPUTED").length;
  const releasedCount = transactions.filter((t) => t.status === "RELEASED").length;

  const filteredTransactions = transactions.filter((t) => {
    if (filter === "ALL") return true;
    return t.status === filter;
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              🛡️ TrustShip Admin Operations
            </h1>
            <p className="text-sm text-slate-400">System Monitoring, Dispute Arbitration & Financial Rails</p>
          </div>
          <button
            onClick={fetchTransactions}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition"
          >
            🔄 Refresh Feeds
          </button>
        </div>

        {/* Executive Metrics Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl">
            <span className="text-xs font-semibold text-slate-400 uppercase">Total Escrow Volume</span>
            <p className="text-2xl font-bold text-white mt-1">₦{totalVolume.toLocaleString()}</p>
          </div>
          <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl">
            <span className="text-xs font-semibold text-blue-400 uppercase">Active Locked Funds</span>
            <p className="text-2xl font-bold text-blue-400 mt-1">₦{lockedVolume.toLocaleString()}</p>
          </div>
          <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl">
            <span className="text-xs font-semibold text-red-400 uppercase">Pending Disputes</span>
            <p className="text-2xl font-bold text-red-400 mt-1">{disputedCount}</p>
          </div>
          <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl">
            <span className="text-xs font-semibold text-emerald-400 uppercase">Successful Releases</span>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{releasedCount}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 border-b border-slate-800 pb-3">
          {["ALL", "DISPUTED", "ESCROW_LOCKED", "DELIVERED", "RELEASED", "REFUNDED"].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filter === status
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Transactions Table */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-800 text-xs font-semibold uppercase text-slate-400">
              <tr>
                <th className="p-4">Ref</th>
                <th className="p-4">Total (₦)</th>
                <th className="p-4">Buyer Phone</th>
                <th className="p-4">Seller Phone</th>
                <th className="p-4">Status</th>
                <th className="p-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-500">Loading operational data...</td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-500">No transactions match this filter.</td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-800/80 transition">
                    <td className="p-4 font-mono text-xs text-white">{tx.transactionRef}</td>
                    <td className="p-4 font-semibold text-white">₦{tx.totalEscrow.toLocaleString()}</td>
                    <td className="p-4 text-slate-400">{tx.buyerPhone}</td>
                    <td className="p-4 text-slate-400">{tx.sellerPhone}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        tx.status === "DISPUTED" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                        tx.status === "RELEASED" ? "bg-emerald-500/20 text-emerald-400" :
                        tx.status === "ESCROW_LOCKED" ? "bg-blue-500/20 text-blue-400" :
                        "bg-slate-700 text-slate-300"
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="p-4">
                      {tx.status === "DISPUTED" ? (
                        <button
                          onClick={() => setSelectedDispute(tx)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded transition"
                        >
                          Arbitrate
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">N/A</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Dispute Arbitration Drawer / Modal */}
        {selectedDispute && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
              <div className="flex justify-between items-start border-b border-slate-700 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-white">Arbitrate Dispute</h3>
                  <p className="text-xs font-mono text-slate-400">{selectedDispute.transactionRef}</p>
                </div>
                <button
                  onClick={() => setSelectedDispute(null)}
                  className="text-slate-400 hover:text-white text-xl font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="bg-slate-900/60 p-4 rounded-xl space-y-2 text-xs border border-slate-700/50">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Locked Escrow:</span>
                  <span className="font-bold text-white">₦{selectedDispute.totalEscrow.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Claimed Fault:</span>
                  <span className="font-semibold text-red-400">{selectedDispute.disputeFault || "UNSPECIFIED"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Dispute Reason:</span>
                  <span className="text-slate-200">{selectedDispute.disputeReason || "None provided"}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Admin Audit Note</label>
                <textarea
                  rows={3}
                  placeholder="State the reason for ruling in favor of buyer or seller..."
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              {actionMessage && (
                <div className={`p-3 rounded-lg text-xs font-medium ${
                  actionMessage.type === "success" ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
                }`}>
                  {actionMessage.text}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  disabled={actionLoading}
                  onClick={() => handleResolveDispute("RELEASE_TO_SELLER")}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg transition disabled:opacity-50"
                >
                  Rule Seller (Pay Out)
                </button>
                <button
                  disabled={actionLoading}
                  onClick={() => handleResolveDispute("REFUND_BUYER")}
                  className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white font-semibold text-xs rounded-lg transition disabled:opacity-50"
                >
                  Rule Buyer (Refund)
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}