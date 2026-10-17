"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function CheckoutPage() {
  const params = useParams();
  const id = params?.id as string; // This is the transactionRef (e.g. TS-ESCROW-...)
  
  const [loading, setLoading] = useState(true);
  const [transaction, setTransaction] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    
    // Fetch transaction details from a backend endpoint if needed, 
    // or parse from URL / verify status
    async function fetchDetails() {
      try {
        const res = await fetch(`/api/escrow/status?ref=${id}`);
        const data = await res.json();
        if (res.ok) {
          setTransaction(data.transaction);
        } else {
          setError(data.error || "Transaction not found");
        }
      } catch (err) {
        setError("Failed to load transaction details.");
      } finally {
        setLoading(false);
      }
    }

    fetchDetails();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600 animate-pulse font-medium">Loading TrustShip Escrow details...</p>
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-md p-6 text-center">
          <h2 className="text-xl font-bold text-red-600 mb-2">Error</h2>
          <p className="text-gray-600">{error || "Escrow transaction could not be found."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        <div className="bg-blue-600 px-6 py-4 text-white">
          <h1 className="text-lg font-bold">TrustShip Secure Escrow</h1>
          <p className="text-xs text-blue-100 font-mono mt-1">Ref: {transaction.transactionRef}</p>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="flex justify-between border-b pb-3">
            <span className="text-gray-500">Item Description</span>
            <span className="font-semibold text-gray-800">{transaction.itemTitle}</span>
          </div>

          <div className="flex justify-between border-b pb-3">
            <span className="text-gray-500">Total Escrow Amount</span>
            <span className="font-bold text-green-600 text-lg">₦{transaction.totalEscrow?.toLocaleString()}</span>
          </div>

          <div className="flex justify-between border-b pb-3">
            <span className="text-gray-500">Current Status</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
              {transaction.status}
            </span>
          </div>

          <div className="pt-4">
            {transaction.status === "PENDING_DEPOSIT" ? (
              <div className="text-center text-sm text-gray-500 bg-blue-50 p-4 rounded-lg">
                Please complete your payment via the link sent to your WhatsApp or restart the payment session.
              </div>
            ) : (
              <div className="text-center text-sm text-green-600 bg-green-50 p-4 rounded-lg font-medium">
                Payment verified & escrow locked securely! Track status via WhatsApp.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}