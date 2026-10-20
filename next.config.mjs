/** @type {import('next').NextConfig} */

// Baseline hardening for administrative routes. The nonce-based
// Content-Security-Policy header is attached per request by proxy.ts
// (a static CSP cannot carry a request-specific nonce).
const adminSecurityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  // Admin HTML/JSON must never sit in a shared cache.
  { key: "Cache-Control", value: "no-store" },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // Security: hide Next.js header
  output: "standalone", // Optimizes Docker & Vercel deployment builds

  async headers() {
    return [
      // Administrative pages (dashboard, transactions, audit logs, login...).
      {
        source: "/admin/:path*",
        headers: adminSecurityHeaders,
      },
      // Administrative APIs. NOTE: intentionally NO Access-Control-*
      // headers — /api/admin/* is same-origin only, and proxy.ts rejects
      // OPTIONS preflights and untrusted cross-origin requests outright.
      {
        source: "/api/admin/:path*",
        headers: adminSecurityHeaders,
      },
      // The blanket `/api/(.*)` CORS rule was removed on purpose: nothing in
      // this app calls its own APIs cross-origin, and webhook consumers
      // (Flutterwave, WhatsApp) are server-to-server clients that ignore
      // CORS. A permissive `Access-Control-Allow-Origin` on state-changing
      // endpoints is a CSRF/ data-exfiltration hazard, so routes now opt in
      // explicitly if a trusted cross-origin consumer ever appears.
    ];
  },
};

export default nextConfig;
