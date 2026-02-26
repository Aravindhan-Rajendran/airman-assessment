/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Only use standalone for Docker/self-host. Vercel needs default output to detect Next.js and serve correctly.
  ...(process.env.VERCEL ? {} : { output: 'standalone' }),
};

module.exports = nextConfig;
