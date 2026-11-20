import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f8fd',
          100: '#def0fa',
          200: '#c5e4f6',
          300: '#9ed3f0',
          400: '#5ab8e7',
          500: '#1c90d8',
          600: '#1479be',
          700: '#10619b',
          800: '#0e507f',
          900: '#0f4469',
          950: '#0a2c46',
          DEFAULT: '#1c90d8',
          foreground: '#ffffff',
        },
        brand: {
          50: '#f0f8fd',
          100: '#def0fa',
          200: '#c5e4f6',
          300: '#9ed3f0',
          400: '#5ab8e7',
          500: '#1c90d8',
          600: '#1479be',
          700: '#10619b',
          800: '#0e507f',
          900: '#0f4469',
          950: '#0a2c46',
          DEFAULT: '#1c90d8',
        },
        secondary: { DEFAULT: '#f59e0b', foreground: '#ffffff' },
        indigo: {
          50: '#f0f8fd',
          100: '#def0fa',
          200: '#c5e4f6',
          300: '#9ed3f0',
          400: '#5ab8e7',
          500: '#1c90d8',
          600: '#1479be',
          700: '#10619b',
          800: '#0e507f',
          900: '#0f4469',
          950: '#0a2c46',
          DEFAULT: '#1c90d8',
        },
      },
    },
  },
  plugins: [],
}

export default config
