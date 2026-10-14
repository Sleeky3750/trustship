'use client';

import { useState, useEffect } from 'react';

export default function AdminSecuritySettings() {
  const [adminEmail, setAdminEmail] = useState('');
  const [isTwoFactorEnabled, setIsTwoFactorEnabled] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [token, setToken] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function fetchAdminSession() {
      try {
        const res = await fetch('/api/admin/me');
        const data = await res.json();
        if (data.success && data.admin) {
          setAdminEmail(data.admin.email);
          setIsTwoFactorEnabled(data.admin.isTwoFactorEnabled);
        }
      } catch (err) {
        console.error('Failed to load admin session', err);
      }
    }
    fetchAdminSession();
  }, []);

  const handleSetup2FA = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/2fa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to setup 2FA');

      setQrCodeUrl(data.qrCodeUrl);
      setSecret(data.secret);
      setStatusMessage('Scan the QR code with your authenticator app.');
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');

      setIsTwoFactorEnabled(true);
      setStatusMessage('Success! Two-Factor Authentication is now active.');
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-8 bg-white rounded-2xl shadow-lg border border-gray-100 text-black">
      <div className="mb-6 border-b pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Security & 2FA</h1>
        <p className="text-sm text-gray-500 mt-1">
          Logged in as: <span className="font-semibold text-gray-700">{adminEmail || 'Loading...'}</span>
        </p>
      </div>

      <div className="mb-6 p-4 rounded-xl flex items-center justify-between bg-gray-50 border">
        <div>
          <p className="text-sm font-medium text-gray-700">Authenticator App Protection</p>
          <p className="text-xs text-gray-500">Requires a 6-digit code on login.</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${isTwoFactorEnabled ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
          {isTwoFactorEnabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      {!qrCodeUrl && !isTwoFactorEnabled && (
        <button
          onClick={handleSetup2FA}
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-2.5 rounded-xl hover:bg-blue-700 transition font-medium shadow-sm"
        >
          {isLoading ? 'Preparing Setup...' : 'Setup Authenticator App'}
        </button>
      )}

      {qrCodeUrl && !isTwoFactorEnabled && (
        <div className="space-y-6 text-center mt-6 border-t pt-6">
          <div className="border p-4 inline-block bg-white rounded-xl shadow-inner">
            <img src={qrCodeUrl} alt="2FA QR Code" className="mx-auto w-48 h-48" />
          </div>
          <p className="text-xs text-gray-500">
            Scan this QR code, then enter the 6-digit code below. <br />
            <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded mt-1 inline-block">Secret: {secret}</span>
          </p>

          <form onSubmit={handleVerify2FA} className="space-y-4 text-left">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Enter 6-digit Code</label>
              <input
                type="text"
                maxLength={6}
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="123456"
                className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-widest text-center text-xl font-mono text-black bg-gray-50"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-green-600 text-white py-3 rounded-xl hover:bg-green-700 transition font-medium shadow-sm"
            >
              {isLoading ? 'Verifying...' : 'Verify and Enable 2FA'}
            </button>
          </form>
        </div>
      )}

      {isTwoFactorEnabled && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-center space-y-1">
          <p className="text-green-800 font-semibold">🛡️ Account Secured</p>
          <p className="text-green-600 text-sm">Two-factor authentication is active.</p>
        </div>
      )}

      {statusMessage && (
        <p className="mt-4 text-sm text-center font-medium text-red-600">{statusMessage}</p>
      )}
    </div>
  );
}
