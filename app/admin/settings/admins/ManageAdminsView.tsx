'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import {
  createAdminAction,
  updateAdminRoleAction,
  deactivateAdminAction,
  reactivateAdminAction,
  type CreateAdminActionState,
} from '@/app/actions/admin';

interface AdminAccount {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isTwoFactorEnabled: boolean;
  isActive: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  SUPPORT_MODERATOR: 'Support Moderator',
  SUPPORT: 'Support Moderator',
  FINANCE_ADMIN: 'Finance Admin',
  FINANCE: 'Finance Admin',
};

// The canonical values we may assign. The DB stores these enum literals.
const ASSIGNABLE_ROLES = [
  { value: 'SUPPORT_MODERATOR', label: 'Support Moderator' },
  { value: 'FINANCE_ADMIN', label: 'Finance Admin' },
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
] as const;

/** Normalize a stored role (SUPPORT / FINANCE @map values) to an assignable one. */
function canonicalRole(role: string): string {
  const r = (role || '').trim().toUpperCase();
  if (r === 'SUPPORT') return 'SUPPORT_MODERATOR';
  if (r === 'FINANCE') return 'FINANCE_ADMIN';
  return r;
}

const initialState: CreateAdminActionState = { success: false };

export default function ManageAdminsView({
  initialAdmins,
  currentAdminId,
  loadError,
}: {
  initialAdmins: AdminAccount[];
  currentAdminId: string;
  loadError?: string;
}) {
  const [state, formAction, isPending] = useActionState(
    createAdminAction,
    initialState
  );

  // Local, server-refreshed copy so role changes reflect immediately without a
  // full reload (revalidatePath on the action repopulates initialAdmins).
  const [admins, setAdmins] = useState<AdminAccount[]>(initialAdmins);
  useEffect(() => setAdmins(initialAdmins), [initialAdmins]);

  // Per-row transient feedback (independent of the create form's state).
  const [rowMessage, setRowMessage] = useState<{ id: string; kind: 'ok' | 'err'; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isTransitioning, startTransition] = useTransition();

  // Confirmation dialog state for the destructive action.
  const [pendingRemoval, setPendingRemoval] = useState<AdminAccount | null>(null);

  const handleRoleChange = (admin: AdminAccount, nextRole: string) => {
    if (canonicalRole(admin.role) === nextRole) return;
    setBusyId(admin.id);
    setRowMessage(null);

    // Optimistic update — rolled back if the server refuses.
    const previous = admins;
    setAdmins((rows) =>
      rows.map((r) => (r.id === admin.id ? { ...r, role: nextRole } : r))
    );

    startTransition(async () => {
      const res = await updateAdminRoleAction(admin.id, nextRole);
      setBusyId(null);
      if (!res.success) {
        setAdmins(previous); // revert
        setRowMessage({ id: admin.id, kind: 'err', text: res.error || 'Could not update role.' });
      } else {
        setRowMessage({ id: admin.id, kind: 'ok', text: res.message || 'Role updated.' });
      }
    });
  };

  const handleConfirmRemoval = () => {
    const admin = pendingRemoval;
    if (!admin) return;
    setPendingRemoval(null);
    setBusyId(admin.id);
    setRowMessage(null);

    startTransition(async () => {
      const res = await deactivateAdminAction(admin.id);
      setBusyId(null);
      if (!res.success) {
        setRowMessage({ id: admin.id, kind: 'err', text: res.error || 'Could not remove account.' });
      } else {
        setAdmins((rows) =>
          rows.map((r) => (r.id === admin.id ? { ...r, isActive: false } : r))
        );
        setRowMessage({ id: admin.id, kind: 'ok', text: res.message || 'Account removed.' });
      }
    });
  };

  const handleRestore = (admin: AdminAccount) => {
    setBusyId(admin.id);
    setRowMessage(null);
    startTransition(async () => {
      const res = await reactivateAdminAction(admin.id);
      setBusyId(null);
      if (!res.success) {
        setRowMessage({ id: admin.id, kind: 'err', text: res.error || 'Could not restore account.' });
      } else {
        setAdmins((rows) =>
          rows.map((r) => (r.id === admin.id ? { ...r, isActive: true } : r))
        );
        setRowMessage({ id: admin.id, kind: 'ok', text: res.message || 'Account restored.' });
      }
    });
  };

  const anyBusy = busyId !== null || isTransitioning;

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
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
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
            {admins.filter((a) => a.isActive).length} active
            {admins.length !== admins.filter((a) => a.isActive).length
              ? ` · ${admins.length - admins.filter((a) => a.isActive).length} deactivated`
              : ''}
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
                <th className="py-3 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {admins.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No administrator accounts found.
                  </td>
                </tr>
              ) : (
                admins.map((admin) => {
                  const isSelf = admin.id === currentAdminId;
                  const rowBusy = busyId === admin.id;
                  const msg = rowMessage?.id === admin.id ? rowMessage : null;

                  return (
                    <tr
                      key={admin.id}
                      className={`hover:bg-[#030611]/40 transition ${admin.isActive ? '' : 'opacity-60'}`}
                    >
                      <td className="py-3 px-6 font-medium text-slate-200">
                        <div className="flex items-center gap-2">
                          <span>{admin.email}</span>
                          {isSelf && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/20">
                              You
                            </span>
                          )}
                          {!admin.isActive && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-500/10 text-slate-400 border border-slate-600/40">
                              Deactivated
                            </span>
                          )}
                        </div>
                        {msg && (
                          <div
                            className={`mt-1 text-[10px] font-medium ${
                              msg.kind === 'ok' ? 'text-emerald-300' : 'text-red-300'
                            }`}
                          >
                            {msg.text}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-6 text-slate-400">{admin.name || '—'}</td>
                      <td className="py-3 px-6">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/20">
                          {ROLE_LABELS[canonicalRole(admin.role)] || admin.role}
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
                      <td className="py-3 px-6">
                        <div className="flex items-center justify-end gap-2">
                          {/* Inline role dropdown — disabled for the current admin
                              (the server also refuses self-role-changes). */}
                          <select
                            aria-label={`Change role for ${admin.email}`}
                            value={canonicalRole(admin.role)}
                            disabled={isSelf || rowBusy || !admin.isActive || anyBusy}
                            onChange={(e) => handleRoleChange(admin, e.target.value)}
                            title={isSelf ? 'You cannot change your own role' : 'Change role'}
                            className="px-2.5 py-1.5 rounded-lg bg-[#030611] border border-slate-800 text-[11px] text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {ASSIGNABLE_ROLES.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>

                          {/* Remove (deactivate) / Restore */}
                          {admin.isActive ? (
                            <button
                              type="button"
                              disabled={isSelf || rowBusy || anyBusy}
                              onClick={() => setPendingRemoval(admin)}
                              title={isSelf ? 'You cannot remove your own account' : 'Remove this admin'}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-red-500/10 text-red-300 border border-red-500/30 hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
                            >
                              {rowBusy ? 'Removing…' : 'Remove'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={rowBusy || anyBusy}
                              onClick={() => handleRestore(admin)}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
                            >
                              {rowBusy ? 'Restoring…' : 'Restore'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Confirmation dialog for destructive removal */}
      {pendingRemoval && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-admin-title"
          onClick={() => setPendingRemoval(null)}
        >
          <div
            className="w-full max-w-md bg-[#070C1E] border border-slate-800 rounded-2xl shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="remove-admin-title" className="text-base font-bold text-white">
              Remove administrator?
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              This will deactivate{' '}
              <span className="font-semibold text-slate-200">{pendingRemoval.email}</span>.
              They will no longer be able to sign in, but their audit history is
              preserved and the account can be restored later.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingRemoval(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-300 bg-slate-800/60 hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoval}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-500 transition"
              >
                Yes, remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
