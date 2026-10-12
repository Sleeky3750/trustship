"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateEscrowPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    itemAmount: "",
    waybillAmount: "",
    waybillPayer: "BUYER",
    buyerPhone: "",
    sellerPhone: "",
  });

  // Simple fee calculation (e.g., 1.5% platform fee capped or flat)
  const itemVal = parseFloat(formData.itemAmount) || 0;
  const waybillVal = parseFloat(formData.waybillAmount) || 0;
  const platformFee = Math.round(itemVal * 0.015);
  const totalEscrow = itemVal + (formData.waybillPayer === "BUYER" ? waybillVal : 0) + platformFee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/escrow/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemAmount: itemVal,
          waybillAmount: waybillVal,
          waybillPayer: formData.waybillPayer,
          buyerPhone: formData.buyerPhone,
          sellerPhone: formData.sellerPhone,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create escrow");

      router.push(`/dashboard?ref=${data.transactionRef}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden p-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Create TrustShip Escrow</h2>
        <p className="text-sm text-slate-500 mb-6">Secure buyer-seller transaction with WhatsApp release PINs.</p>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 uppercase">Item Amount (₦)</label>
            <input
              type="number"
              required
              placeholder="e.g. 15000"
              value={formData.itemAmount}
              onChange={(e) => setFormData({ ...formData, itemAmount: e.target.value })}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 uppercase">Waybill / Delivery Amount (₦)</label>
            <input
              type="number"
              required
              placeholder="e.g. 2000"
              value={formData.waybillAmount}
              onChange={(e) => setFormData({ ...formData, waybillAmount: e.target.value })}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 uppercase">Waybill Payer</label>
            <select
              value={formData.waybillPayer}
              onChange={(e) => setFormData({ ...formData, waybillPayer: e.target.value })}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none"
            >
              <option value="BUYER">Buyer Pays Waybill</option>
              <option value="SELLER">Seller Pays Waybill</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 uppercase">Buyer WhatsApp Phone</label>
            <input
              type="text"
              required
              placeholder="e.g. 2349162483537"
              value={formData.buyerPhone}
              onChange={(e) => setFormData({ ...formData, buyerPhone: e.target.value })}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 uppercase">Seller WhatsApp Phone</label>
            <input
              type="text"
              required
              placeholder="e.g. 2348001112223"
              value={formData.sellerPhone}
              onChange={(e) => setFormData({ ...formData, sellerPhone: e.target.value })}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="bg-slate-50 p-4 rounded-lg space-y-1 text-sm border border-slate-200">
            <div className="flex justify-between text-slate-600">
              <span>Platform Fee (1.5%):</span>
              <span>₦{platformFee.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-slate-200">
              <span>Total Escrow Deposit:</span>
              <span>₦{totalEscrow.toLocaleString()}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? "Initializing Escrow..." : "Create & Fund Escrow"}
          </button>
        </form>
      </div>
    </div>
  );
}