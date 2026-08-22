/** @type {import('next').NextConfig} */
const path = require('path')

const nextConfig = {
    reactStrictMode: true,
    // Asset prefix so the gateway proxy can serve pages under /report-center
    assetPrefix: '/report-center',
    // Keep mssql/tedious out of Next worker bundling
    serverExternalPackages: ['mssql'],
    // Turbopack root = repo root so @modules/* resolves
    turbopack: {
        root: path.resolve(__dirname, '..', '..'),
    },
}

module.exports = nextConfig
