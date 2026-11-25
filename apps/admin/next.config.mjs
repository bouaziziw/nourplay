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

let apiOrigin = process.env.API_PROXY_ORIGIN
if (process.env.VERCEL_GIT_COMMIT_REF === 'dev') {
  if (apiOrigin && (apiOrigin.includes('nourplay-api.vercel.app') || apiOrigin.includes('nourplay-api-'))) {
    apiOrigin = 'https://nourplay-api-git-dev-bouaziziws-projects.vercel.app'
  }
}
if (apiOrigin) {
  const url = new URL(apiOrigin)
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== apiOrigin) {
    throw new Error('API_PROXY_ORIGIN must be an HTTP(S) origin without credentials, paths, or trailing slashes')
  }
}

const nextConfig = {
  transpilePackages: ['@nourplay/ui'],
  basePath,
  reactStrictMode: true,
  async rewrites() {
    if (!apiOrigin) return []
    return [
      { source: '/api/:path*', destination: `${apiOrigin}/api/:path*`, basePath: false },
    ]
  },
  async redirects() {
    return [
      ...(basePath ? [{ source: '/', destination: basePath, basePath: false, permanent: false }] : []),
      { source: '/', destination: '/dashboard', permanent: false },
    ]
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
