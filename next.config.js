/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.fbcdn.net' },
      { protocol: 'https', hostname: '**.cdninstagram.com' },
      { protocol: 'https', hostname: '**.whatsapp.net' },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['tsx'],
  },
}

module.exports = nextConfig
