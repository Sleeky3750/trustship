'use client';

import { useActionState } from 'react';
import { createAdminAction, type CreateAdminActionState } from '@/app/actions/admin';

interface AdminAccount {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isTwoFactorEnabled: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  SUPPORT_MODERATOR: 'Support Moderator',
  SUPPORT: 'Support Moderator',
  FINANCE_ADMIN: 'Finance Admin',
  FINANCE: 'Finance Admin',
};

const initialState: CreateAdminActionState = { success: false };

export default function ManageAdminsView({
  initialAdmins,
  loadError,
}: {
  initialAdmins: AdminAccount[];
  loadError?: string;
}) {
  const [state, formAction, isPending] = useActionState(
    createAdminAction,
    initialState
  );

  return (
    <div className="space-y-8 text-slate-100">
      <div>
        <h1 className="text-2xl font-bold">Manage Administrators</h1>
        <p className="text-sm text-slate-400 mt-1">
          Create privileged accounts and assign their role. Passwords are hashed
          with bcrypt before they are stored — plaintext is never persisted.
        </p>
      </div>

      {/* Create form */}
      <section className="bg-[#070C1E] border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h2 className="text-sm font-bold text-white mb-4">Create a new admin</h2>

        {state.error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold">
            {state.error}
          </div>
        )}
        {state.success && state.message && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
            {state.message}
          </div>
        )}

        <form action={formAction} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="admin-email" className="block text-xs font-semibold text-slate-400 mb-1">
              Email address
            </label>
            <input
              id="admin-email"
              name="email"
              type="email"
              required
              autoComplete="off"
              className="w-full px-3 py-2 rounded-xl bg-[#030611] border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              placeholder="new.admin@trustship.app"
            />
          </div>

          <div>
            <label htmlFor="admin-name" className="block text-xs font-semibold text-slate-400 mb-1">
              Full name <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <input
              id="admin-name"
              name="name"
              type="text"
              className="w-full px-3 py-2 rounded-xl bg-[#030611] border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              placeholder="Ada Lovelace"
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-xs font-semibold text-slate-400 mb-1">
              Temporary password <span className="font-normal text-slate-500">(min 12 chars)</span>
            </label>
            <input
              id="admin-password"
              name="password"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              className="w-full px-3 py-2 rounded-xl bg-[#030611] border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              placeholder="••••••••••••"
            />
          </div>

          <div>
            <label htmlFor="admin-role" className="block text-xs font-semibold text-slate-400 mb-1">
              Role
            </label>
            <select
              id="admin-role"
              name="role"
              defaultValue="SUPPORT_MODERATOR"
              className="w-full px-3 py-2 rounded-xl bg-[#030611] border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="SUPPORT_MODERATOR">Support Moderator</option>
              <option value="FINANCE_ADMIN">Finance Admin</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={isPending}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-blue-600/25 transition"
            >
              {isPending ? 'Creating…' : 'Create admin account'}
            </button>
          </div>
        </form>
      </section>

      {/* Existing admins */}
      <section className="bg-[#070C1E] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800">
          <h2 className="text-sm font-bold text-white">Existing administrators</h2>
          <p className="text-xs text-slate-400">
            {initialAdmins.length} account{initialAdmins.length === 1 ? '' : 's'}
          </p>
        </div>

        {loadError && (
          <div className="p-4 text-xs text-red-300">Could not load admins: {loadError}</div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-[#030611]/50 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                <th className="py-3 px-6">Email</th>
                <th className="py-3 px-6">Name</th>
                <th className="py-3 px-6">Role</th>
                <th className="py-3 px-6">2FA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {initialAdmins.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    No administrator accounts found.
                  </td>
                </tr>
              ) : (
                initialAdmins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-[#030611]/40 transition">
                    <td className="py-3 px-6 font-medium text-slate-200">{admin.email}</td>
                    <td className="py-3 px-6 text-slate-400">{admin.name || '—'}</td>
                    <td className="py-3 px-6">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/20">
                        {ROLE_LABELS[(admin.role || '').toUpperCase()] || admin.role}
                      </span>
                    </td>
                    <td className="py-3 px-6">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          admin.isTwoFactorEnabled
                            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                        }`}
                      >
                        {admin.isTwoFactorEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
