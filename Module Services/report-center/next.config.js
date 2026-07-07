/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  assetPrefix: process.env.REPORT_CENTER_ASSET_PREFIX ?? '/report-center-assets',
  allowedDevOrigins: ['http://localhost:3001', 'http://127.0.0.1:3001'],
  turbopack: {
    root: __dirname,
  },
}

module.exports = nextConfig
