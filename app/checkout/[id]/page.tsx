'use client';

import { useEffect, useState, use } from 'react';

interface Transaction {
  id: string;
  transactionRef: string;
  itemPrice: number;
  totalAmount: number;
  status: string;
  buyerPhone: string;
}

export default function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [tx, setTx] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTx() {
      try {
        const res = await fetch(`/api/checkout/${resolvedParams.id}`);
        const data = await res.json();
        if (data.success) {
          setTx(data.transaction);
        }
      } catch (err) {
        console.error('Failed to load transaction');
      } finally {
        setLoading(false);
      }
    }
    loadTx();
  }, [resolvedParams.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center font-sans">
        <p className="text-sm animate-pulse">Loading TrustShip Escrow Checkout...</p>
      </div>
    );
  }

  if (!tx) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center font-sans p-4">
        <div className="bg-slate-800 p-6 rounded-2xl max-w-sm w-full text-center space-y-3 border border-slate-700">
          <h2 className="text-lg font-bold text-red-400">Transaction Not Found</h2>
          <p className="text-xs text-slate-400">This escrow link may have expired or is invalid.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans p-4">
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl max-w-md w-full shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500 mx-auto flex items-center justify-center text-white font-black text-xl">
            TS
          </div>
          <h1 className="text-xl font-bold">TrustShip Escrow Deposit</h1>
          <p className="text-xs text-slate-400">Ref: <span className="font-mono text-emerald-400">{tx.transactionRef}</span></p>
        </div>

        <div className="bg-slate-800/50 p-4 rounded-2xl space-y-2 border border-slate-700/50 text-sm">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Escrow Amount</span>
            <span className="font-semibold text-white">₦{(tx.totalAmount || tx.itemPrice || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>Buyer Phone</span>
            <span className="font-mono text-white">+{tx.buyerPhone}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>Status</span>
            <span className="text-yellow-400 font-medium">{tx.status}</span>
          </div>
        </div>

        <button
          onClick={() => alert('Paystack integration active! Proceeding to Paystack checkout gateway...')}
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-4 rounded-2xl text-sm transition shadow-lg shadow-emerald-500/20"
        >
          Pay ₦{(tx.totalAmount || tx.itemPrice || 0).toLocaleString()} into Escrow
        </button>

        <p className="text-[11px] text-slate-500 text-center">
          🔒 Funds are held safely in TrustShip Escrow and only released when you confirm delivery.
        </p>
      </div>
    </div>
  );
}
