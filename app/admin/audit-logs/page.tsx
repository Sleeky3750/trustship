'use client';

import { useState, useEffect } from 'react';

interface AuditLog {
  id: string;
  action: string;
  details: string;
  ipAddress: string;
  createdAt: string;
  adminId: string;
  targetId: string;
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
    let isMounted = true;

    async function fetchLogs() {
      try {
        const res = await fetch('/api/admin/audit-logs');
        let data: any = null;
        try {
          data = await res.json();
        } catch {
          // Non-JSON response (e.g. proxy HTML error page) — treat as failure.
          data = null;
        }
        if (!res.ok) {
          throw new Error(data?.error || 'Failed to fetch audit logs');
        }
        // Never trust the response shape: only accept a real array.
        const payload = Array.isArray(data?.logs)
          ? data.logs
          : Array.isArray(data?.auditLogs)
            ? data.auditLogs
            : [];
        if (isMounted) setLogs(payload);
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Failed to fetch audit logs');
          setLogs([]);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    fetchLogs();

    return () => {
      isMounted = false;
    };
  }, []);

  // Defense-in-depth: `logs` is always treated as an array even if state is
  // somehow set to a non-array value.
  const safeLogs: AuditLog[] = Array.isArray(logs) ? logs : [];

  // Filter logs by action, admin email, or IP address
  const filteredLogs = safeLogs.filter((log) => {
    const term = searchTerm.toLowerCase();
    return (
      (log?.action || '').toLowerCase().includes(term) ||
      (log?.admin?.email || '').toLowerCase().includes(term) ||
      (log?.ipAddress || '').toLowerCase().includes(term) ||
      (log?.details || '').toLowerCase().includes(term)
    );
  });

  // Null-safe timestamp rendering: `toISOString()` throws on invalid dates.
  const formatTimestamp = (value?: string | null): string => {
    if (!value) return '-';
    const date = new Date(value);
    return isNaN(date.getTime()) ? String(value) : date.toISOString();
  };

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
          Showing {filteredLogs.length} of {safeLogs.length} records
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
                <th className="py-3.5 px-6">Timestamp (UTC)</th>
                <th className="py-3.5 px-6">Admin Email / ID</th>
                <th className="py-3.5 px-6">Action Type</th>
                <th className="py-3.5 px-6">Target / Reference ID</th>
                <th className="py-3.5 px-6">IP Address / Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="animate-pulse">
                    <td className="py-4 px-6">
                      <div className="h-3 w-28 bg-gray-200 rounded" />
                    </td>
                    <td className="py-4 px-6">
                      <div className="h-3 w-40 bg-gray-200 rounded" />
                      <div className="h-2.5 w-24 bg-gray-100 rounded mt-2" />
                    </td>
                    <td className="py-4 px-6">
                      <div className="h-5 w-24 bg-gray-200 rounded-lg" />
                    </td>
                    <td className="py-4 px-6">
                      <div className="h-3 w-32 bg-gray-200 rounded" />
                    </td>
                    <td className="py-4 px-6">
                      <div className="h-3 w-24 bg-gray-200 rounded" />
                    </td>
                  </tr>
                ))
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400">
                    {safeLogs.length === 0
                      ? 'No audit logs recorded yet.'
                      : 'No audit logs found matching your criteria.'}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id || log.createdAt} className="hover:bg-gray-50 transition">
                    <td className="py-4 px-6 text-gray-500 text-xs whitespace-nowrap font-mono">
                      {formatTimestamp(log.createdAt)}
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-medium text-gray-900">{log.admin?.email || log.adminId}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5 font-mono">{log.adminId}</div>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700">
                        {log.admin?.role || 'ADMIN'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-gray-100 text-gray-800">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-mono text-xs text-gray-600 truncate max-w-xs" title={log.targetId || log.details || ''}>
                      {log.targetId || '-'}
                    </td>
                    <td className="py-4 px-6 font-mono text-xs text-gray-600 truncate max-w-xs" title={log.ipAddress || log.details || ''}>
                      {log.ipAddress || '-'}
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
