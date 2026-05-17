/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverActions: { bodySizeLimit: '15mb' } },
  serverExternalPackages: ['pdf-parse'],
};
export default nextConfig;
