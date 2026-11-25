import createNextIntlPlugin from 'next-intl/plugin'
import withPWAInit from '@ducanh2912/next-pwa'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const withPWA = withPWAInit({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
  fallbacks: { document: '/~offline' },
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      // API: network-first, fall back to cache (30 s timeout)
      {
        urlPattern: /^https?:\/\/.*\/api\//,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          networkTimeoutSeconds: 10,
          expiration: { maxEntries: 128, maxAgeSeconds: 24 * 60 * 60 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      // Images (thumbnails, avatars): stale-while-revalidate
      {
        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'image-cache',
          expiration: { maxEntries: 256, maxAgeSeconds: 7 * 24 * 60 * 60 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      // Fonts: cache-first (immutable)
      {
        urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts',
          expiration: { maxEntries: 16, maxAgeSeconds: 365 * 24 * 60 * 60 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },
})

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

let apiOrigin = process.env.API_PROXY_ORIGIN
let adminOrigin = process.env.ADMIN_PROXY_ORIGIN

if (process.env.VERCEL_GIT_COMMIT_REF === 'dev') {
  if (apiOrigin && (apiOrigin.includes('nourplay-api.vercel.app') || apiOrigin.includes('nourplay-api-'))) {
    apiOrigin = 'https://nourplay-api-git-dev-bouaziziws-projects.vercel.app'
  }
  if (adminOrigin && (adminOrigin.includes('nourplay-admin.vercel.app') || adminOrigin.includes('nourplay-admin-'))) {
    adminOrigin = 'https://nourplay-admin-git-dev-bouaziziws-projects.vercel.app'
  }
}

if (Boolean(apiOrigin) !== Boolean(adminOrigin)) {
  throw new Error('API_PROXY_ORIGIN and ADMIN_PROXY_ORIGIN must be configured together')
}

for (const origin of [apiOrigin, adminOrigin].filter(Boolean)) {
  const url = new URL(origin)
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
    throw new Error('Proxy destinations must be HTTP(S) origins without credentials, paths, or trailing slashes')
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@nourplay/ui', '@nourplay/i18n'],
  output: process.platform === 'win32' ? undefined : 'standalone',
  reactStrictMode: true,
  skipTrailingSlashRedirect: true,
  async rewrites() {
    if (!apiOrigin || !adminOrigin) return []
    return {
      beforeFiles: [
        { source: '/api/:path*', destination: `${apiOrigin}/api/:path*` },
        { source: '/admin', destination: `${adminOrigin}/admin` },
        { source: '/admin/', destination: `${adminOrigin}/admin` },
        { source: '/admin/:path+', destination: `${adminOrigin}/admin/:path+` },
      ],
    }
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'i.vimeocdn.com' },
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

export default withNextIntl(withPWA(nextConfig))
