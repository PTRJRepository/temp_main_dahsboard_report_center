const LAN_DEV_ORIGINS = [
    'localhost',
    '*.localhost',
    '127.0.0.1',
    '10.*.*.*',
    '172.*.*.*',
    '192.168.*.*',
    ...(process.env.LAN_DEV_ORIGINS || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
]

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // Standalone output for Docker
    output: 'standalone',
    // Allow HMR / _next requests through LAN gateway hosts during development.
    allowedDevOrigins: LAN_DEV_ORIGINS,
    // Keep mssql/tedious out of Next worker bundling.
    serverExternalPackages: ['mssql'],
    // Turbopack root = repo root so `@modules/*` (Module Services/) resolves
    // outside Dashboard_Utama. Bare packages resolve via the Module Services/
    // node_modules symlink (see module README setup).
    turbopack: {
        root: require('path').resolve(__dirname, '..'),
    },
    // Fix WebSocket HMR issues
    webpack: (config, { dev, isServer }) => {
        if (dev && !isServer) {
            config.watchOptions = {
                poll: 1000,
                aggregateTimeout: 300,
            };
        }
        return config;
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'encrypted-tbn0.gstatic.com',
            },
            {
                protocol: 'https',
                hostname: 'myfirstblog123.hashnode.dev',
            },
            {
                protocol: 'https',
                hostname: 'cdn.hashnode.com',
            },
            {
                protocol: 'https',
                hostname: 'bookdown.org',
            },
            {
                protocol: 'https',
                hostname: 'asset.tribunnews.com',
            },
            {
                protocol: 'https',
                hostname: 'images.unsplash.com',
            },
            {
                protocol: 'https',
                hostname: 'i.ytimg.com',
            },
            {
                protocol: 'https',
                hostname: 'memory.co.ke',
            },
            {
                protocol: 'https',
                hostname: 'elearning2.be.bisa.ai',
            },
        ],
    },
};

module.exports = nextConfig;
