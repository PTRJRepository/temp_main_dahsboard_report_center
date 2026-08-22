/** @type {import('next').NextConfig} */
const path = require('path')

const nextConfig = {
    reactStrictMode: true,
    // Asset prefix so the gateway proxy can serve pages under /file
    assetPrefix: '/file',
    // Turbopack root = repo root (npm workspaces + node_modules symlink setup)
    turbopack: {
        root: path.resolve(__dirname, '..', '..'),
    },
}

module.exports = nextConfig
