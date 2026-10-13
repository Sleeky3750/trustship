"use client";

import { useEffect, useState } from "react";

export default function AdminDashboardPage() {
  const [escrows, setEscrows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchEscrows = async () => {
    try {
      const res = await fetch("/api/admin/escrows");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch escrows");
      setEscrows(data.escrows || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEscrows();
  }, []);

  const handleAction = async (reference: string, action: string) => {
    try {
      const res = await fetch(`/api/admin/escrow/${reference}/${action}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action} escrow`);
      fetchEscrows(); // Refresh list
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">TrustShip Admin Portal</h1>
            <p className="text-slate-500 text-sm mt-1">Manage escrow transactions, track payments, and oversee state releases.</p>
          </div>
          <button
            onClick={fetchEscrows}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-medium transition"
          >
            Refresh Data
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-slate-500 font-medium">Loading escrows from database...</div>
        ) : escrows.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 text-slate-500">
            No escrow transactions found in the database yet.
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="p-4">Reference</th>
                    <th className="p-4">Amount (₦)</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Buyer / Seller</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {escrows.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-4 font-mono font-medium text-slate-900">{item.transactionRef}</td>
                      <td className="p-4 font-semibold text-slate-800">₦{Number(item.itemAmount).toLocaleString()}</td>
                      <td className="p-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                          item.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          item.status === 'FUNDED' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600 text-xs space-y-0.5">
                        <div>Buyer: {item.buyerPhone}</div>
                        <div>Seller: {item.sellerPhone}</div>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        {item.status === 'PENDING' && (
                          <button
                            onClick={() => handleAction(item.transactionRef, 'fund')}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition"
                          >
                            Mark Funded
                          </button>
                        )}
                        {item.status === 'FUNDED' && (
                          <button
                            onClick={() => handleAction(item.transactionRef, 'release')}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition"
                          >
                            Release Funds
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}