/** @type {import('next').NextConfig} */
const path = require('path')

// Modul RJFM — UI milik modul sendiri (isolasi penuh, subrepo-ready).
const nextConfig = {
    reactStrictMode: true,
    // Standalone output: dilayani Express 8011 via reverse proxy internal.
    output: 'standalone',
    // Aset di-serve di bawah /file lewat Express.
    assetPrefix: '/file',
    // Root monorepo untuk resolusi workspace (node_modules hoisted).
    turbopack: {
        root: path.resolve(__dirname, '..', '..', '..'),
    },
}

module.exports = nextConfig
