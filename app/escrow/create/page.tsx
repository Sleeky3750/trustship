"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CURRENCIES = [
  { code: "NGN", symbol: "₦", label: "NGN (₦)" },
  { code: "USD", symbol: "$", label: "USD ($)" },
  { code: "GBP", symbol: "£", label: "GBP (£)" },
  { code: "EUR", symbol: "€", label: "EUR (€)" },
];

export default function CreateEscrowPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    currency: "NGN",
    itemTitle: "",
    itemAmount: "",
    waybillAmount: "",
    waybillPayer: "BUYER",
    buyerPhone: "",
    sellerPhone: "",
    buyerName: "",
    sellerName: "",
  });

  const selectedCurrency = CURRENCIES.find((c) => c.code === formData.currency) || CURRENCIES[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/escrow/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create escrow");

      const ref = data.transactionRef || data.data?.transactionRef || data.ref;
      router.push(`/dashboard?ref=${ref}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const itemNum = Number(formData.itemAmount) || 0;
  const waybillNum = Number(formData.waybillAmount) || 0;

  // 5% Platform Fee calculation
  const platformFee = Math.round(itemNum * 0.05 * 100) / 100;

  // Total includes Item + Waybill (if buyer pays) + 5% Platform Fee
  const total = itemNum + (formData.waybillPayer === "BUYER" ? waybillNum : 0) + platformFee;

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto bg-white shadow-lg rounded-2xl border border-slate-200 overflow-hidden">
        <div className="bg-blue-600 px-6 py-5 text-white">
          <h1 className="text-2xl font-bold">Create TrustShip Escrow</h1>
          <p className="text-blue-100 text-sm mt-1">Secure buyer-seller transaction with WhatsApp release PINs.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Currency Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Transaction Currency</label>
            <select
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800 bg-white font-medium"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Item Title (optional) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Item Title <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. iPhone 13 Pro - 256GB"
              value={formData.itemTitle}
              onChange={(e) => setFormData({ ...formData, itemTitle: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800"
            />
          </div>

          {/* Item Amount Input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Item Amount ({selectedCurrency.symbol})
            </label>
            <input
              type="number"
              required
              placeholder="e.g. 15000"
              value={formData.itemAmount}
              onChange={(e) => setFormData({ ...formData, itemAmount: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800"
            />
          </div>

          {/* Waybill Amount & Payer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Waybill / Shipping ({selectedCurrency.symbol})
              </label>
              <input
                type="number"
                placeholder="e.g. 2000"
                value={formData.waybillAmount}
                onChange={(e) => setFormData({ ...formData, waybillAmount: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Waybill Payer</label>
              <select
                value={formData.waybillPayer}
                onChange={(e) => setFormData({ ...formData, waybillPayer: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800 bg-white"
              >
                <option value="BUYER">Buyer Pays Waybill</option>
                <option value="SELLER">Seller Pays Waybill</option>
              </select>
            </div>
          </div>

          {/* International WhatsApp Phone Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Buyer WhatsApp (with country code)
              </label>
              <input
                type="tel"
                required
                placeholder="e.g. 2348012345678 or 14155552671"
                value={formData.buyerPhone}
                onChange={(e) => setFormData({ ...formData, buyerPhone: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Seller WhatsApp (with country code)
              </label>
              <input
                type="tel"
                required
                placeholder="e.g. 2348001112223 or 447700900077"
                value={formData.sellerPhone}
                onChange={(e) => setFormData({ ...formData, sellerPhone: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800"
              />
            </div>
          </div>

          {/* Calculation Breakdown */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-sm text-slate-600">
            <div className="flex justify-between">
              <span>Platform Fee (5%):</span>
              <span className="font-semibold text-slate-800">
                {selectedCurrency.symbol}
                {platformFee.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-base font-bold text-slate-900 border-t border-slate-200 pt-2">
              <span>Total Escrow Deposit:</span>
              <span className="text-blue-600">
                {selectedCurrency.symbol}
                {total.toLocaleString()}
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition shadow-sm disabled:opacity-50"
          >
            {loading ? "Creating Escrow..." : `Create & Fund Escrow (${formData.currency})`}
          </button>
        </form>
      </div>
    </div>
  );
}