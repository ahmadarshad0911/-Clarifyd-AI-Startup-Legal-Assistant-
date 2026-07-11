/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Kimi K2 analyze calls can take up to 120s — prevent Next.js from killing
  // them at the default 30s proxy timeout.
  experimental: {
    proxyTimeout: 300_000,
  },
  async rewrites() {
    // Next requires rewrite destinations to start with a scheme. A BACKEND_ORIGIN
    // set without http(s):// (a common dashboard mistake) fails the whole build with
    // "Invalid rewrite found", so normalize it here.
    const raw = (process.env.BACKEND_ORIGIN || "http://localhost:8000").trim().replace(/\/+$/, "");
    const backendOrigin = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return [
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;

