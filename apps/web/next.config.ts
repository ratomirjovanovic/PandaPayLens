import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

// A dedicated worker follows the CSP of its own script response, not the
// page's. proxy.ts skips /_next/static, so the analysis worker, which handles
// all pasted data, gets its policy here. Browsers ignore it on ordinary
// scripts, styles and fonts.
const workerCsp = "default-src 'none'; script-src 'self'; connect-src 'self'";

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // The page Content-Security-Policy is set per request (with a nonce) in proxy.ts.
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/_next/static/:path*",
        headers: [{ key: "Content-Security-Policy", value: workerCsp }],
      },
    ];
  },
};

export default config;
