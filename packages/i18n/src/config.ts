export const locales = ['fr', 'en', 'ar', 'es'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'fr'

export const rtlLocales: Locale[] = ['ar']

export function isRtl(locale: Locale): boolean {
  return rtlLocales.includes(locale)
}

export function isValidLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value)
}
