import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full text-center space-y-8">
        <div>
          <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-3">
            Secure Payments
          </span>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
            TrustShip
          </h1>
          <p className="mt-2 text-lg text-slate-600">
            WhatsApp-Native Escrow Platform
          </p>
        </div>

        <div className="bg-white py-8 px-6 shadow rounded-xl border border-slate-200 space-y-4">
          <p className="text-sm text-slate-500">
            Protect your buyers and sellers with automated milestones, Paystack integration, and instant WhatsApp notifications.
          </p>

          <div className="flex flex-col space-y-3 pt-2">
            <Link
              href="/escrow/create"
              className="w-full bg-blue-600 text-white font-medium py-3 px-4 rounded-lg hover:bg-blue-700 transition text-center shadow-sm"
            >
              Get Started (Create Escrow)
            </Link>
            <Link
              href="/dashboard"
              className="w-full bg-slate-100 text-slate-700 font-medium py-3 px-4 rounded-lg hover:bg-slate-200 transition text-center"
            >
              View Dashboard
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}