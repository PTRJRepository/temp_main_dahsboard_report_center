/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // Allow HMR websocket from parent server
    allowedDevOrigins: ['http://localhost:3001'],
    // Configure Turbopack root to avoid lockfile detection issues
    turbopack: {
        root: __dirname,
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
    // Disable automatic HMR to avoid conflicts
    experimental: {
        forceSwcTransforms: true,
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'encrypted-tbn0.gstatic.com',
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
