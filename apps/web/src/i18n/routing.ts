import { defineRouting } from 'next-intl/routing'
import { locales, defaultLocale } from '@nourplay/i18n'

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
})
