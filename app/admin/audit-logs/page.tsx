'use client';

import { useState, useEffect } from 'react';

interface AuditLog {
  id: string;
  action: string;
  details: string;
  ipAddress: string;
  createdAt: string;
  admin: {
    email: string;
    role: string;
  };
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchLogs() {
      try {
        const res = await fetch('/api/admin/audit-logs');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch audit logs');
        setLogs(data.logs);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchLogs();
  }, []);

  // Filter logs by action, admin email, or IP address
  const filteredLogs = logs.filter((log) => {
    const term = searchTerm.toLowerCase();
    return (
      log.action.toLowerCase().includes(term) ||
      log.admin.email.toLowerCase().includes(term) ||
      log.ipAddress.toLowerCase().includes(term) ||
      log.details.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Immutable Audit Logs</h1>
        <p className="text-sm text-slate-400 mt-1">
          Forensic records of all administrative actions, logins, and IP forensics across TrustShip.
        </p>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center justify-between gap-4">
        <input
          type="text"
          placeholder="Search by action, admin email, IP address, or details..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-md px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder-gray-400 text-sm shadow-sm"
        />
        <span className="text-xs font-medium text-slate-300 bg-slate-800 px-3 py-2 rounded-lg">
          Showing {filteredLogs.length} of {logs.length} records
        </span>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
          Error: {error}
        </div>
      )}

      {/* Logs Table */}
      <div className="bg-white text-slate-900 rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="py-3.5 px-6">Timestamp</th>
                <th className="py-3.5 px-6">Admin User</th>
                <th className="py-3.5 px-6">Action</th>
                <th className="py-3.5 px-6">IP Address</th>
                <th className="py-3.5 px-6">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400">
                    Loading audit records...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400">
                    No audit logs found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition">
                    <td className="py-4 px-6 text-gray-500 text-xs whitespace-nowrap font-mono">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-medium text-gray-900">{log.admin.email}</div>
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700">
                        {log.admin.role}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-gray-100 text-gray-800">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-mono text-xs text-gray-600">
                      {log.ipAddress}
                    </td>
                    <td className="py-4 px-6 text-gray-600 text-xs max-w-xs truncate" title={log.details}>
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
