// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   reactStrictMode: true,
//   output: 'standalone',
// };

// export default nextConfig;



import { EventEmitter } from 'events';
EventEmitter.defaultMaxListeners = 50;
if (typeof process !== 'undefined' && process.setMaxListeners) {
  process.setMaxListeners(50);
}

/** @type {import('next').NextConfig} */

const isVercel = process.env.VERCEL === '1' || Boolean(process.env.VERCEL);

const nextConfig = {
  allowedDevOrigins: ['localhost', '127.0.0.1'],
  reactStrictMode: true,
  ...(process.env.STANDALONE === 'true' ? { output: 'standalone' } : {}),
  async redirects() {
    return [
      {
        source: '/shop',
        destination: '/products',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
