"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface Transaction {
  id: string;
  transactionRef: string;
  totalEscrow: number;
  status: string;
  dispatchStatus: string;
  releasePin: string;
  buyerPhone: string;
  sellerPhone: string;
  createdAt: string;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const highlightRef = searchParams.get("ref");

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real implementation, fetch user transactions from a backend API route
    setLoading(false);
  }, []);

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      PENDING_DEPOSIT: "bg-yellow-100 text-yellow-800",
      ESCROW_LOCKED: "bg-blue-100 text-blue-800",
      DELIVERED: "bg-purple-100 text-purple-800",
      COMPLETED: "bg-green-100 text-green-800",
      DISPUTE_OPEN: "bg-red-100 text-red-800",
      REFUNDED: "bg-gray-100 text-gray-800",
    };
    return colors[status] || "bg-slate-100 text-slate-800";
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-slate-900">TrustShip Dashboard</h1>
          <a
            href="/escrow/create"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            + New Escrow
          </a>
        </div>

        {highlightRef && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm">
            ✨ Successfully created transaction reference: <strong>{highlightRef}</strong>
          </div>
        )}

        <div className="bg-white shadow rounded-lg overflow-hidden border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200 font-semibold text-slate-800">
            Active Escrow Transactions
          </div>
          
          <div className="p-6 text-center text-slate-500">
            <p className="mb-2">Your active escrow state tracker and history will display here.</p>
            <p className="text-xs">Connected to Prisma multi-state engine & Flutterwave financial rails.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 font-medium">Loading TrustShip dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  );
}