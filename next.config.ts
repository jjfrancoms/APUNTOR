import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Paquetes de servidor que no deben empaquetarse en el bundle de Next.
  serverExternalPackages: ['bullmq', 'ioredis', 'postgres', 'unpdf'],
};

export default nextConfig;
