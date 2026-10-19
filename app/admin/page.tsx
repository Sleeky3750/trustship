'use client';

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">TrustShip Admin Dashboard</h1>
        <p className="text-sm text-slate-400 mt-1">Live engine overview and compliance metrics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white text-slate-900 p-6 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 font-medium">Active Transactions</p>
          <h3 className="text-3xl font-bold text-gray-900 mt-2">0</h3>
        </div>
        <div className="bg-white text-slate-900 p-6 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 font-medium">Successful Releases</p>
          <h3 className="text-3xl font-bold text-gray-900 mt-2">0</h3>
        </div>
        <div className="bg-white text-slate-900 p-6 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 font-medium">Active Disputes</p>
          <h3 className="text-3xl font-bold text-gray-900 mt-2">0</h3>
        </div>
      </div>
    </div>
  );
}
