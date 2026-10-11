/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: 'http://localhost:3000/api/:path*'
            },
            {
                source: '/tmp/:path*',
                destination: 'http://localhost:3000/tmp/:path*'
            },
            {
                source: '/ping',
                destination: 'http://localhost:3000/ping'
            }
        ];
    }
};

module.exports = nextConfig;
