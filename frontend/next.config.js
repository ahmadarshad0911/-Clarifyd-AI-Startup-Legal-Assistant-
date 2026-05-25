/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Kimi K2 analyze calls can take up to 120s — prevent Next.js from killing
  // them at the default 30s proxy timeout.
  experimental: {
    proxyTimeout: 300_000,
  },
  async rewrites() {
    const backendOrigin = process.env.BACKEND_ORIGIN || "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;

