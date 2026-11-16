import createMiddleware from 'next-intl/middleware'

export default createMiddleware({
  locales: ['fr', 'en', 'ar', 'es'],
  defaultLocale: 'fr',
  localePrefix: 'as-needed',
})

export const config = {
  matcher: ['/((?!api|admin|_next|_vercel|.*\\..*).*)'],
}
