'use client';

import { useState, useEffect } from 'react';

interface Transaction {
  id: string;
  transactionRef: string;
  buyerPhone: string;
  sellerPhone: string;
  totalAmount?: number;
  itemPrice?: number;
  status: string;
  createdAt: string;
}

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [adminRole, setAdminRole] = useState('');
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const fetchTransactions = async () => {
    try {
      const res = await fetch('/api/admin/transactions');
      const data = await res.json();
      if (data.success) {
        setTransactions(data.transactions || []);
      }
    } catch (err) {
      setError('Failed to load escrow transactions.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    async function init() {
      try {
        const meRes = await fetch('/api/admin/me');
        const meData = await meRes.json();
        if (meData.success && meData.admin) {
          setAdminRole(meData.admin.role);
        }
      } catch (e) {
        console.error('Failed to fetch admin session role');
      }
      await fetchTransactions();
    }
    init();
  }, []);

  const handleReleaseFunds = async (transactionId: string, reference: string) => {
    if (!confirm(`Are you sure you want to release escrow funds for reference ${reference}? This action is irreversible and recorded in audit logs.`)) {
      return;
    }

    try {
      setActionMessage('Processing release...');
      const res = await fetch('/api/admin/transactions/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to release funds');

      setActionMessage('Successfully released funds!');
      await fetchTransactions();
    } catch (err: any) {
      setActionMessage(`Error: ${err.message}`);
    }
  };

  const formatWhatsAppUrl = (phone: string, role: string, ref: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const message = encodeURIComponent(`Hello, I am contacting you from TrustShip Support regarding escrow transaction reference: ${ref} (${role}).`);
    return `https://wa.me/${cleanPhone}?text=${message}`;
  };

  const isSuperAdmin = adminRole === 'SUPER_ADMIN';

  return (
    <div className="space-y-6 text-black">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Escrow Transactions Management</h1>
        <p className="text-sm text-gray-500 mt-1">Monitor multi-state transaction lifecycles and connect instantly with parties via WhatsApp.</p>
      </div>

      {actionMessage && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-sm font-medium">
          {actionMessage}
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        {isLoading ? (
          <p className="text-gray-500 text-center py-8">Loading escrow records...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase">
                  <th className="py-3 px-4">Ref & Date</th>
                  <th className="py-3 px-4">WhatsApp Parties</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-400">
                      No escrow transactions found in database.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50 transition">
                      <td className="py-4 px-4">
                        <div className="font-mono font-semibold text-xs text-gray-900">{tx.transactionRef}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">{new Date(tx.createdAt).toLocaleDateString()}</div>
                      </td>
                      <td className="py-4 px-4 text-xs space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 font-medium">Buyer:</span>
                          <a
                            href={formatWhatsAppUrl(tx.buyerPhone, 'Buyer', tx.transactionRef)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2 py-0.5 rounded-md font-mono font-semibold transition border border-emerald-200"
                            title="Chat with Buyer on WhatsApp"
                          >
                            💬 {tx.buyerPhone}
                          </a>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 font-medium">Seller:</span>
                          <a
                            href={formatWhatsAppUrl(tx.sellerPhone, 'Seller', tx.transactionRef)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2 py-0.5 rounded-md font-mono font-semibold transition border border-emerald-200"
                            title="Chat with Seller on WhatsApp"
                          >
                            💬 {tx.sellerPhone}
                          </a>
                        </div>
                      </td>
                      <td className="py-4 px-4 font-semibold text-gray-900">₦{(tx.totalAmount || tx.itemPrice || 0).toLocaleString()}</td>
                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          tx.status === 'RELEASED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right space-x-2">
                        {isSuperAdmin && tx.status !== 'RELEASED' && (
                          <button
                            onClick={() => handleReleaseFunds(tx.id, tx.transactionRef)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm transition"
                          >
                            Release Funds
                          </button>
                        )}
                        {!isSuperAdmin && tx.status !== 'RELEASED' && (
                          <span className="text-xs text-gray-400 italic">Requires SUPER_ADMIN</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
