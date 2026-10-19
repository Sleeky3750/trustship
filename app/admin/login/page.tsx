'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          token: requires2FA ? token : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Login failed');
      }

      // If 2FA token required, switch UI mode
      if (data.requires2FA) {
        setRequires2FA(true);
        setIsLoading(false);
        return;
      }

      // Success (HTTP 200): the admin_token cookie is now set — enter the dashboard
      setIsLoading(false);
      router.push('/admin/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'An error occurred during login');
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#03070A] text-slate-100 min-h-screen flex items-center justify-center font-sans px-4">
      <div className="bg-white text-slate-900 rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500 mx-auto flex items-center justify-center text-white font-black text-xl">
            TS
          </div>
          <h1 className="text-2xl font-black text-slate-900">Admin Portal Login</h1>
          <p className="text-xs text-slate-500">
            {requires2FA
              ? 'Enter the 6-digit code from your authenticator app.'
              : 'Sign in to access TrustShip management controls.'}
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 text-red-600 text-xs font-semibold text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          {!requires2FA ? (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-500 text-slate-900"
                  placeholder="admin@trustship.app"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-500 text-slate-900"
                  placeholder="••••••••"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 text-center">
                Two-Factor Security Code
              </label>
              <input
                type="text"
                maxLength={6}
                required
                autoFocus
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-lg font-mono tracking-widest text-center focus:outline-none focus:border-emerald-500 text-slate-900 bg-slate-50"
                placeholder="123456"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl text-sm transition shadow-lg shadow-emerald-600/20 disabled:opacity-50"
          >
            {isLoading
              ? 'Verifying...'
              : requires2FA
              ? 'Verify 2FA Code'
              : 'Sign In to Dashboard'}
          </button>

          {requires2FA && (
            <button
              type="button"
              onClick={() => {
                setRequires2FA(false);
                setError('');
              }}
              className="w-full text-xs text-slate-500 hover:underline pt-2 text-center block"
            >
              ← Back to credentials login
            </button>
          )}
        </form>

        <div className="text-center pt-2">
          <a href="/" className="text-xs text-slate-500 hover:text-slate-900 transition">
            ← Back to TrustShip Home
          </a>
        </div>
      </div>
    </div>
  );
}
