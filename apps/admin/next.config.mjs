/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
]

const basePath = process.env.ADMIN_BASE_PATH || ''
if (basePath !== '' && basePath !== '/admin') {
  throw new Error('ADMIN_BASE_PATH must be empty or /admin')
}

const nextConfig = {
  basePath,
  reactStrictMode: true,
  async redirects() {
    return [{ source: '/', destination: '/dashboard', permanent: false }]
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'assets.nourplay.app' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
