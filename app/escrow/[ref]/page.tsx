"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

interface TransactionDetail {
  id: string;
  transactionRef: string;
  itemAmount: number;
  waybillAmount: number;
  totalEscrow: number;
  waybillPayer: string;
  status: "PENDING_SELLER_ACCEPTANCE" | "PENDING_PAYMENT" | "PENDING_AGREEMENT" | "PENDING_DEPOSIT" | "ESCROW_LOCKED" | "DISPATCHED" | "DELIVERED" | "RELEASED" | "DISPUTED" | "REFUNDED" | "CANCELLED";
  dispatchStatus: string;
  buyerPhone: string;
  sellerPhone: string;
  createdAt: string;
  seller?: {
    name: string;
    bankName: string;
    accountNumber: string;
  };
}

export default function EscrowTrackingPage() {
  const params = useParams();
  const ref = params?.ref as string;

  const [transaction, setTransaction] = useState<TransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Dispute Form Modal State
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeFault, setDisputeFault] = useState<"SELLER_FAULT" | "BUYER_FAULT">("SELLER_FAULT");
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeLoading, setDisputeLoading] = useState(false);
  const [disputeError, setDisputeError] = useState("");

  useEffect(() => {
    if (ref) fetchTransaction();
  }, [ref]);

  const fetchTransaction = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/escrow/status?ref=${encodeURIComponent(ref)}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Transaction not found");
      }
      const data = await res.json();
      setTransaction(data.transaction);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const handleInitiateDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transaction) return;
    setDisputeLoading(true);
    setDisputeError("");

    try {
      const res = await fetch("/api/escrow/dispute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionRef: transaction.transactionRef,
          disputeFault,
          reason: disputeReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to raise dispute");

      setShowDisputeModal(false);
      fetchTransaction(); // Refresh state
    } catch (err: any) {
      setDisputeError(err.message);
    } finally {
      setDisputeLoading(false);
    }
  };

  const getStepIndex = (status: string) => {
    switch (status) {
      case "PENDING_DEPOSIT": return 1;
      case "ESCROW_LOCKED": return 2;
      case "DISPATCHED": return 3;
      case "DELIVERED": return 4;
      case "RELEASED": return 5;
      default: return 0;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-slate-500 font-medium">Loading transaction tracking details...</div>
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200 text-center max-w-md">
          <div className="text-3xl mb-2">🔍</div>
          <h2 className="text-lg font-bold text-slate-800">Transaction Not Found</h2>
          <p className="text-sm text-slate-500 mt-1">{error || "Could not locate this escrow reference."}</p>
        </div>
      </div>
    );
  }

  const currentStep = getStepIndex(transaction.status);

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* Header Badge */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="text-xs font-mono uppercase text-slate-400">Escrow Reference</span>
            <h1 className="text-2xl font-bold text-slate-900">{transaction.transactionRef}</h1>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
            transaction.status === "RELEASED" ? "bg-emerald-100 text-emerald-800" :
            transaction.status === "DISPUTED" ? "bg-red-100 text-red-800" :
            transaction.status === "ESCROW_LOCKED" ? "bg-blue-100 text-blue-800" :
            "bg-amber-100 text-amber-800"
          }`}>
            {transaction.status.replace("_", " ")}
          </span>
        </div>

        {/* Visual Lifecycle Stepper */}
        {transaction.status !== "DISPUTED" && transaction.status !== "REFUNDED" && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-xs font-bold text-slate-400 uppercase mb-4">Transaction Progress</h3>
            <div className="grid grid-cols-5 gap-2 text-center text-xs">
              {[
                { label: "Created", step: 1 },
                { label: "Locked", step: 2 },
                { label: "Dispatched", step: 3 },
                { label: "Delivered", step: 4 },
                { label: "Released", step: 5 },
              ].map((item) => (
                <div key={item.step} className="space-y-1">
                  <div className={`h-2 rounded-full transition ${
                    currentStep >= item.step ? "bg-blue-600" : "bg-slate-200"
                  }`} />
                  <span className={`block font-medium ${
                    currentStep >= item.step ? "text-slate-900" : "text-slate-400"
                  }`}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Escrow Details */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">Financial Summary</h3>
          <div className="space-y-2 text-sm text-slate-600">
            <div className="flex justify-between">
              <span>Item Value:</span>
              <span className="font-semibold text-slate-900">₦{transaction.itemAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Waybill Fee:</span>
              <span className="font-semibold text-slate-900">₦{transaction.waybillAmount.toLocaleString()} ({transaction.waybillPayer})</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-100 font-bold text-slate-900 text-base">
              <span>Total Escrow Balance:</span>
              <span className="text-blue-600">₦{transaction.totalEscrow.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Action Panel / Instructions */}
        <div className="bg-blue-50 border border-blue-200 p-5 rounded-xl space-y-2">
          <h4 className="text-sm font-bold text-blue-900 flex items-center gap-1.5">
            📱 WhatsApp Verification
          </h4>
          <p className="text-xs text-blue-800 leading-relaxed">
            {transaction.status === "DELIVERED"
              ? "Your item has been marked delivered! Reply directly on WhatsApp with your 4-digit PIN to instantly release funds to the seller."
              : transaction.status === "ESCROW_LOCKED"
              ? "Funds are safely locked in escrow. The seller will dispatch the item shorty."
              : transaction.status === "RELEASED"
              ? "Transaction complete! Funds have been disbursed to the seller."
              : "Awaiting initial payment deposit from the buyer."}
          </p>
        </div>

        {/* Dispute Trigger Button */}
        {["ESCROW_LOCKED", "DISPATCHED", "DELIVERED"].includes(transaction.status) && (
          <div className="text-center pt-2">
            <button
              onClick={() => setShowDisputeModal(true)}
              className="text-xs text-red-600 hover:text-red-700 font-medium underline"
            >
              Having an issue with this order? Report a Dispute
            </button>
          </div>
        )}

        {/* Dispute Modal */}
        {showDisputeModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <h3 className="text-lg font-bold text-slate-900">Initiate Escrow Dispute</h3>
              <p className="text-xs text-slate-500">
                Submitting a dispute halts automated release and alerts admins for arbitration.
              </p>

              {disputeError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg">{disputeError}</div>
              )}

              <form onSubmit={handleInitiateDispute} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Fault Attribution</label>
                  <select
                    value={disputeFault}
                    onChange={(e) => setDisputeFault(e.target.value as any)}
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs text-slate-900"
                  >
                    <option value="SELLER_FAULT">Seller Fault (Wrong / Damaged Item)</option>
                    <option value="BUYER_FAULT">Buyer Fault (Change of Mind / Unreachable)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Reason / Notes</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Describe the issue in detail..."
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs text-slate-900"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowDisputeModal(false)}
                    className="w-1/2 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={disputeLoading}
                    className="w-1/2 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                  >
                    {disputeLoading ? "Submitting..." : "Submit Dispute"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}