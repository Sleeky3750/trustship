"use client";

import { useEffect, useState } from "react";
import * as FontAwesome from "@fortawesome/react-fontawesome";
import {
  faExchangeAlt,
  faDownload,
  faCheck,
  faSearch,
  faTable,
  faTrash,
  faUserFriends,
  faPhone,
  faEye,
  faLock,
} from "@fortawesome/free-solid-svg-icons";

FontAwesome.library.add(
  faExchangeAlt,
  faDownload,
  faCheck,
  faTrash,
  faUserFriends,
  faPhone,
  faEye,
  faLock
);

interface EscrowTransaction {
  id: string;
  transactionRef: string;
  createdAt: Date;
  buyerPhone: string;
  sellerPhone: string;
  itemAmount: number;
  waybillAmount: number;
  totalEscrow: number;
  status: string;
  releasePin?: string;
}

/* ==========================================================
   DARK EXECUTIVE THEME COLORS & STYLES
   ========================================================== */

const statusColors = {
  PENDING_DEPOSIT: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  ESCROW_LOCKED: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  DELIVERED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  RELEASED: "bg-green-500/15 text-green-400 border-green-500/20",
  REFUNDED: "bg-red-500/15 text-red-400 border-red-500/20",
  DISPUTED: "bg-rose-500/15 text-rose-400 border-rose-500/20",
};

const terminalLogColors = {
  success: "text-emerald-400",
  error: "text-red-400",
  info: "text-cyan-400",
  warning: "text-amber-400",
};

/* ==========================================================
   COMPONENT: AdminDashboardPage
   ========================================================== */

export default function AdminDashboardPage() {
  const [escrows, setEscrows] = useState<EscrowTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewEscrowModal, setShowNewEscrowModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [editingTx, setEditingTx] = useState<EscrowTransaction | null>(null);

  const fetchEscrows = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/escrows");
      const data = await res.json();
      if (data.escrows) setEscrows(data.escrows);
    } catch (err) {
      addTerminalLog("❌ Failed to fetch escrows", "error");
      console.error("Failed to fetch escrows", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (ref: string, action: "fund" | "release") => {
    setActionLoading(ref + action);
    try {
      const res = await fetch(`/api/admin/escrow/${ref}/${action}`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        fetchEscrows();
        addTerminalLog(`✅ ${action.toUpperCase()} action completed for ${ref}`, "success");
      } else {
        alert(data.error || "Action failed");
        addTerminalLog(`❌ ${action.toUpperCase()} failed for ${ref}: ${data.error}`, "error");
      }
    } catch (err) {
      console.error("Action error", err);
      addTerminalLog(`❌ Action error for ${ref}`, "error");
    } finally {
      setActionLoading(null);
    }
  };

  // Modal handlers
  const handleNewEscrowClose = () => setShowNewEscrowModal(false);
  const handleDisputeClose = () => setShowDisputeModal(false);

  // Search filtered escrows
  const filteredEscrows = escrows.filter(
    (tx) =>
      tx.transactionRef.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.buyerPhone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.sellerPhone.toLowerCase().includes(searchQuery.toLowerCase())
  );

  /* ==========================================================
     LIVE TERMINAL CONSOLE
     ========================================================== */

  const [terminalLogs, setTerminalLogs] = useState<
    { id: number; message: string; type: "success" | "error" | "info" | "warning" }[]
  >([]);

  const addTerminalLog = (
    message: string,
    type: "success" | "error" | "info" | "warning"
  ) => {
    const id = Date.now() + Math.random();
    setTerminalLogs((prev) => {
      const updated = [...prev, { id, message, type }];
      // Keep only last 50 logs
      return updated.length > 50 ? updated.slice(-49) : updated;
    });
  };

  // Initialize sample terminal logs on mount
  useEffect(() => {
    addTerminalLog("🔄 Admin Dashboard loaded - connecting to live engine...", "info");
    addTerminalLog("✅ System nominal - all modules operational", "success");
  }, []);

  /* ==========================================================
     STATUS BADGE COMPONENT LOGIC
     ========================================================== */

  const getStatusBadgeClass = (status: string) => {
    return statusColors[status as keyof typeof statusColors] || "bg-slate-500/15 text-slate-400";
  };

  /* ==========================================================
     RELEASE PIN BADGE
     ========================================================== */

  const getReleasePinBadgeClass = (pin?: string | null) => {
    if (!pin) return "bg-slate-600/30 text-slate-300";
    return "bg-emerald-500/20 text-emerald-300 border-emerald-400/30";
  };

  /* ==========================================================
     STEP PROGRESS TRACKER
     ========================================================== */

  const stepProgress = [
    { id: 1, label: "Create Escrow", status: "completed" as const },
    { id: 2, label: "Paystack Deposit", status: "completed" as const },
    { id: 3, label: "Mark Delivered", status: "completed" as const },
    { id: 4, label: "WhatsApp PIN", status: "active" as const },
    { id: 5, label: "Automated Payout", status: "pending" as const },
  ];

  /* ==========================================================
     RENDER
     ========================================================== */

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100">
      <FontAwesome.FontAwesomeProvider>{null}</FontAwesome.FontAwesomeProvider>

      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {/* ---------- HEADER & BRAND ---------- */}
        <header className="mb-8 fade-in-up">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-navy-900 rounded-xl flex items-center justify-center">
                <FontAwesome
                  icon={faExchangeAlt}
                  className="text-[size:1.2rem] text-emerald-400"
                />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-wider text-emerald-300">
                  TrustShip LIVE ENGINE
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                  Escrow Administration & Dispute Resolution Portal
                </p>
              </div>
            </div>

            {/* Real-time status indicator */}
            <div className="flex items-center gap-2 bg-navy-900 rounded-lg px-3 py-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
              <span className="text-sm text-slate-400">LIVE</span>
            </div>
          </div>
        </header>

        {/* ---------- STATS OVERVIEW CARDS ---------- */}
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 fade-in-up"
          style="animation-delay: 0.1s"
        >
          <div>
            <div className="text-emerald-400 text-3xl font-bold" id="totalEscrowValue">
              ₦0
            </div>
            <div className="text-slate-500 text-sm">Total Escrow Value</div>
          </div>
          <div>
            <div className="text-blue-400 text-3xl font-bold" id="activeTransactions">
              0
            </div>
            <div className="text-slate-500 text-sm">Active Transactions</div>
          </div>
          <div>
            <div className="text-green-400 text-3xl font-bold" id="successRate">
              0%
            </div>
            <div className="text-slate-500 text-sm">Success Rate</div>
          </div>
          <div>
            <div className="text-rose-400 text-3xl font-bold" id="activeDisputes">
              0
            </div>
            <div className="text-slate-500 text-sm">Active Disputes</div>
          </div>
        </div>

        {/* ---------- E2E LIFECYCLE SIMULATOR BANNER ---------- */}
        <div
          className="bg-navy-900 rounded-2xl p-6 mb-8 border border-blue-500/20 shadow-xl fade-in-up"
          style="animation-delay: 0.2s"
        >
          <h2 className="text-xl font-semibold text-emerald-300 mb-4">
            <FontAwesome icon={faDownload} className="text-[size:0.8rem] mr-2" />
            E2E Lifecycle Simulator
          </h2>
          <div className="space-y-3">
            {stepProgress.map((step) => {
              const statusClass =
                step.status === "completed"
                  ? "bg-emerald-600 text-emerald-100"
                  : step.status === "active"
                  ? "bg-amber-600 text-amber-100"
                  : "bg-slate-500 text-slate-300";
              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-3 px-4 py-2 rounded-full ${
                    step.status === "completed"
                      ? "bg-emerald-500/15"
                      : step.status === "active"
                      ? "bg-amber-500/15"
                      : "bg-slate-600/20"
                  } ${statusClass}`}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold">
                    {step.id}
                  </div>
                  <span className="text-slate-400 text-sm">{step.label}</span>
                  <div className="w-1 h-1/2 rounded-full bg-current opacity-50"></div>
                </div>
              );
            })}
          </div>
          <p className="text-slate-500 text-xs mt-3">
            Steps: {" "}
            {stepProgress
              .map(
                (s, i) =>
                  `${s.label}${i < stepProgress.length - 1 ? " → " : ""}`
              )
              .join("")}
          </p>
        </div>

        {/* ---------- LIVE SYSTEM TERMINAL CONSOLE ---------- */}
        <div
          className="bg-navy-900 rounded-xl p-6 mb-8 border border-slate-700/50 fade-in-up"
          style="animation-delay: 0.3s"
        >
          <h2 className="text-lg font-semibold text-emerald-300 mb-4 flex items-center gap-2">
            <FontAwesome icon={faPhone} className="text-[size:0.8rem]" /> Live Terminal Console
          </h2>
          <div className="h-64 overflow-y-auto space-y-3">
            {/* Auto-scroll terminal logs */}
            {terminalLogs.map((log) => {
              const colorClass =
                terminalLogColors[log.type as keyof typeof terminalLogColors] ||
                "text-slate-400";
              return (
                <div
                  key={log.id}
                  className={`flex gap-2 text-xs ${colorClass}`}>
                  <span className="w-8">
                    <FontAwesome
                      icon={
                        log.type === "success"
                          ? faCheck
                          : log.type === "error"
                          ? faTrash
                          : log.type === "info"
                          ? faUserFriends
                          : faPhone
                      }
                      className="text-[size:0.65rem]"
                    />
                  </span>
                  <span className="break-all">{log.message}</span>
                </div>
              );
            })}
            {/* Placeholder when no logs */}
            {terminalLogs.length === 0 && (
              <div className="text-slate-600 text-xs py-4 text-center">
                Waiting for system events...
              </div>
            )}
          </div>
        </div>

        {/* ---------- SEARCH FILTERING ---------- */}
        <div
          className="bg-navy-900 rounded-xl p-6 mb-8 border border-slate-700/50 fade-in-up"
          style="animation-delay: 0.4s"
        >
          <h2 className="text-lg font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <FontAwesome icon={faSearch} className="text-[size:0.8rem]" /> Search Transactions
          </h2>
          <div className="relative">
            <FontAwesome
              icon={faSearch}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm"
            />
            <input
              type="text"
              placeholder="Search by reference... or buyer/seller phone"
              className="bg-slate-950 border border-slate-600 rounded-lg px-12 py-3 w-full outline-none text-slate-100 font-medium transition-colors focus:border-emerald-500 focus:text-emerald-300"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search escrow transactions"
            />
          </div>
        </div>

        {/* ---------- TRANSACTIONS TABLE ---------- */}
        <div
          className="bg-navy-900 rounded-3xl overflow-hidden border border-slate-700/50 fade-in-up"
          style="animation-delay: 0.5s"
        >
          <div className="p-6 border-b border-slate-700/50">
            <h2 className="text-xl font-semibold text-slate-300">
              <FontAwesome icon={faTable} className="text-[size:0.8rem] mr-2" />
              Transactions Management
            </h2>
            {showNewEscrowModal || showDisputeModal && (
              <button
                onClick={() => setShowNewEscrowModal(false)}
                className="text-sm text-emerald-400 hover:text-emerald-300 transition"
              >
                Close
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-700/50">
              <thead>
                <tr className="text-slate-400 text-xs uppercase tracking-wider">
                  <th className="px-6 py-3">Reference & Date</th>
                  <th className="px-6 py-3">Parties</th>
                  <th className="px-6 py-3">Financial Breakdown</th>
                  <th className="px-6 py-3">Lifecycle Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50 text-sm">
                {loading && escrows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500/60">
                      Loading escrow records...
                    </td>
                  </tr>
                ) : filteredEscrows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500/60">
                      No escrow transactions match your search.
                    </td>
                  </tr>
                ) : filteredEscrows.map((tx) => (
                  <tr key={tx.id} className="hover:bg-navy-950/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-100 font-mono text-xs">
                      <span className="text-slate-500/60 small">
                        ({tx.createdAt.toLocaleDateString()})
                      </span>{" "}
                      {tx.transactionRef}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      <div className="font-medium">Buyer:</div>
                      <span className="font-mono text-emerald-300">
                        {tx.buyerPhone}
                      </span>
                      <div className="mt-1">
                        <div className="font-medium">Seller:</div>
                        <span className="font-mono text-blue-400">
                          {tx.sellerPhone}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-200">Item:</div>
                      <div className="mt-1 text-emerald-400 font-mono">
                        ₦{tx.itemAmount.toLocaleString()}
                      </div>
                      <div className="mt-1 text-slate-500 text-xs">Waybill:</div>
                      <div className="mt-1 font-mono text-blue-400">
                        ₦{tx.waybillAmount.toLocaleString()}
                      </div>
                      <div className="mt-1 text-slate-500 text-xs">Total:</div>
                      <div className="mt-1 font-bold text-emerald-300">
                        ₦{tx.totalEscrow.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(tx.status)}`}>
                        {tx.status}
                      </span>
                      {tx.releasePin && (
                        <span className="ml-2 text-xs font-medium">
                          <FontAwesome icon={faLock} className="text-[size:0.5rem] mr-1" /> PIN{" "}
                          {tx.releasePin}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {/* Fund button: only show if not ESCROW_LOCKED and not RELEASED */}
                      {tx.status !== "ESCROW_LOCKED" && tx.status !== "RELEASED" && (
                        <button
                          onClick={() => handleAction(tx.transactionRef, "fund")}
                          disabled={
                            actionLoading === tx.transactionRef + "fund"
                          }
                          className="px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-md text-xs font-medium hover:bg-blue-500/30 transition">
                          Fund
                        </button>
                      )}
                      {/* Release button: only show if not RELEASED */}
                      {tx.status !== "RELEASED" && (
                        <button
                          onClick={() => handleAction(tx.transactionRef, "release")}
                          disabled={
                            actionLoading === tx.transactionRef + "release"
                          }
                          className="px-3 py-1.5 bg-emerald-600/20 text-emerald-400 rounded-md text-xs font-medium hover:bg-emerald-500/30 transition">
                          Release
                        </button>
                      )}
                      {/* Dispute button: show for non-final states */}
                      {["PENDING_DEPOSIT", "ESCROW_LOCKED", "DELIVERED"].includes(
                        tx.status
                      ) && (
                        <button
                          onClick={() => {
                            setEditingTx(tx);
                            setShowDisputeModal(true);
                          }}
                          className="px-3 py-1.5 bg-rose-600/20 text-rose-400 rounded-md text-xs font-medium hover:bg-rose-500/30 transition">
                          Dispute
                        </button>
                      )}
                      {/* View details button */}
                      <button
                        className="px-3 py-1.5 bg-slate-600/20 text-slate-400 rounded-md text-xs font-medium hover:bg-slate-700/30 transition"
                        aria-label={`View details for ${tx.transactionRef}`}
                      >
                        <FontAwesome icon={faEye} className="text-[size:0.6rem] mr-1" />
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ---------- MODAL: New Escrow Initialization ---------- */}
        {showNewEscrowModal && (
          <div className="fixed inset-0 bg-navy-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-navy-900 rounded-3xl p-8 w-full max-w-md border border-slate-700/50">
              <h2 className="text-xl font-bold text-emerald-300 mb-6 flex items-center gap-2">
                <FontAwesome icon={faExchangeAlt} className="text-[size:1rem]" />
                Initialize New Escrow
              </h2>
              <form
                className="space-y-6"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.target as HTMLFormElement);
                  const ref = formData.get("transactionRef") as string;
                  const buyerPhone = formData.get("buyerPhone") as string;
                  const sellerPhone = formData.get("sellerPhone") as string;
                  const itemAmount = parseFloat(
                    formData.get("itemAmount") as string
                  );
                  const waybillAmount = parseFloat(
                    formData.get("waybillAmount") as string
                  );

                  if (!ref || !buyerPhone || !sellerPhone) {
                    alert("All required fields must be filled");
                    return;
                  }

                  setLoading(true);
                  try {
                    const res = await fetch("/api/admin/escrows", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        transactionRef: ref,
                        buyerPhone,
                        sellerPhone,
                        itemAmount,
                        waybillAmount,
                        totalEscrow: itemAmount + waybillAmount,
                        status: "PENDING_DEPOSIT",
                      }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      addTerminalLog(`✅ New escrow created: ${ref}`, "success");
                      setShowNewEscrowModal(false);
                      fetchEscrows();
                    } else {
                      alert(data.error || "Failed to create escrow");
                    }
                  } catch (err) {
                    console.error("Create escrow error", err);
                    addTerminalLog(`❌ Failed to create escrow: ${ref}`, "error");
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-400 text-sm mb-2 block">
                      Transaction Reference
                    </label>
                    <input
                      type="text"
                      name="transactionRef"
                      placeholder="e.g. ESCROW-2024-001"
                      className="w-full bg-slate-950 border border-slate-600 rounded-lg px-4 py-3 focus:border-emerald-500 focus:text-emerald-300"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-sm mb-2 block">
                      Buyer Phone
                    </label>
                    <input
                      type="tel"
                      name="buyerPhone"
                      placeholder="+234 XXXX XXX"
                      className="w-full bg-slate-950 border border-slate-600 rounded-lg px-4 py-3 focus:border-emerald-500 focus:text-emerald-300"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-sm mb-2 block">
                      Seller Phone
                    </label>
                    <input
                      type="tel"
                      name="sellerPhone"
                      placeholder="+234 XXXX XXX"
                      className="w-full bg-slate-950 border border-slate-600 rounded-lg px-4 py-3 focus:border-emerald-500 focus:text-emerald-300"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-sm mb-2 block">
                      Item Amount (₦)
                    </label>
                    <input
                      type="number"
                      name="itemAmount"
                      placeholder="0"
                      className="col-span-2 w-full bg-slate-950 border border-slate-600 rounded-lg px-4 py-3 focus:border-emerald-500 focus:text-emerald-300"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-slate-400 text-sm mb-2 block">
                    Waybill Amount (₦)
                  </label>
                  <input
                    type="number"
                    name="waybillAmount"
                    placeholder="0"
                    className="w-full bg-slate-950 border border-slate-600 rounded-lg px-4 py-3 focus:border-emerald-500 focus:text-emerald-300"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 bg-emerald-600 text-white rounded-lg py-3 px-6 font-medium hover:bg-emerald-700 transition flex items-center gap-2">
                    <FontAwesome icon={faDownload} className="text-[size:0.8rem]" />
                    Create Escrow
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewEscrowModal(false)}
                    className="flex-1 bg-slate-600 text-white rounded-lg py-3 px-6 font-medium hover:bg-slate-700 transition flex items-center gap-2">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ---------- MODAL: Admin Dispute Arbitration ---------- */}
        {showDisputeModal && editingTx && (
          <div className="fixed inset-0 bg-navy-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-navy-900 rounded-3xl p-8 w-full max-w-md border border-slate-700/50">
              <h2 className="text-xl font-bold text-rose-400 mb-6 flex items-center gap-2">
                <FontAwesome icon={faTrash} className="text-[size:1rem]" />
                Dispute Arbitration
              </h2>
              <p className="text-slate-500 text-sm mb-6">
                Transaction: <span className="font-mono text-emerald-300">
                  {editingTx.transactionRef}
                </span>
              </p>
              <form
                className="space-y-5"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.target as HTMLFormElement);
                  const resolution =
                    formData.get("resolution") as "RELEASE_TO_SELLER" | "REFUND_BUYER";
                  const adminNote = formData.get("adminNote") as string | undefined;

                  if (!resolution) {
                    alert("Please select a resolution");
                    return;
                  }

                  setActionLoading(editingTx.transactionRef + "dispute");
                  try {
                    const res = await fetch("/api/admin/resolve-dispute", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        transactionRef: editingTx.transactionRef,
                        resolution,
                        adminNote,
                      }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      addTerminalLog(
                        `✅ Dispute resolved as ${resolution}: ${editingTx.transactionRef}`,
                        "success"
                      );
                      setShowDisputeModal(false);
                      setEditingTx(null);
                      fetchEscrows();
                    } else {
                      alert(data.error || "Dispute resolution failed");
                      addTerminalLog(`❌ Dispute failed: ${editingTx.transactionRef}`, "error");
                    }
                  } catch (err) {
                    console.error("Dispute resolution error", err);
                    addTerminalLog(`❌ Dispute error: ${editingTx.transactionRef}`, "error");
                  } finally {
                    setActionLoading(null);
                  }
                }}
              >
                <div>
                  <label className="text-slate-400 text-sm mb-2 block">
                    Resolution
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label>
                        <input
                          type="radio"
                          name="resolution"
                          value="RELEASE_TO_SELLER"
                          className="rounded border-slate-600 focus:ring-emerald-500"
                          required
                        />
                        {""}
                        <span className="ml-2 text-slate-300">Release to Seller</span>
                      </label>
                    </div>
                    <div>
                      <label>
                        <input
                          type="radio"
                          name="resolution"
                          value="REFUND_BUYER"
                          className="rounded border-slate-600 focus:ring-emerald-500"
                          required
                        />
                        {""}
                        <span className="ml-2 text-slate-300">Refund Buyer</span>
                      </label>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-slate-400 text-sm mb-2 block">
                    Admin Note (optional)
                  </label>
                  <textarea
                    name="adminNote"
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-600 rounded-lg px-4 py-3 focus:border-emerald-500 focus:text-emerald-300 resize-py"
                    placeholder="Enter admin note..."
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 bg-rose-600 text-white rounded-lg py-3 px-6 font-medium hover:bg-rose-700 transition flex items-center gap-2">
                    <FontAwesome icon={faTrash} className="text-[size:0.8rem]" />
                    Resolve Dispute
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDisputeModal(false);
                      setEditingTx(null);
                    }}
                    className="flex-1 bg-slate-600 text-white rounded-lg py-3 px-6 font-medium hover:bg-slate-700 transition flex items-center gap-2">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* ---------- FOOTER ---------- */}
      <footer className="mt-12 text-slate-500 text-center text-xs">
        <p>
          TrustShip Admin Portal •{new Date().getFullYear()}• All rights reserved
        </p>
      </footer>
    </div>
  );
}