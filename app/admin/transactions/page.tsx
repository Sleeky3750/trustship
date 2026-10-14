'use client';

import { useState, useEffect } from 'react';

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Fetch transactions from your backend API
    async function fetchTransactions() {
      try {
        const res = await fetch('/api/admin/transactions'); // Or your transactions API route
        const data = await res.json();
        if (data.success) {
          setTransactions(data.transactions || []);
        }
      } catch (err: any) {
        setError('Failed to load live escrow transactions.');
      } finally {
        setIsLoading(false);
      }
    }
    fetchTransactions();
  }, []);

  return (
    <div className="space-y-6 text-black">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Escrow Transactions Management</h1>
        <p className="text-sm text-gray-500 mt-1">Monitor multi-state transaction lifecycles, release pins, and waybills.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        {isLoading ? (
          <p className="text-gray-500 text-center py-8">Loading escrow records...</p>
        ) : error ? (
          <p className="text-red-600 text-center py-8">{error}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase">
                  <th className="py-3 px-4">Ref</th>
                  <th className="py-3 px-4">Parties</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400">
                      No active escrow transactions found in database.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx: any) => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-mono text-xs">{tx.reference}</td>
                      <td className="py-3 px-4 text-xs">{tx.buyerPhone} / {tx.sellerPhone}</td>
                      <td className="py-3 px-4 font-semibold">₦{tx.amount}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-800 font-medium">
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <button className="text-blue-600 hover:underline font-medium">View</button>
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
