import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '../hooks/useAuth'

export const metadata: Metadata = { title: 'NourPlay Admin' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="bg-white text-slate-900 antialiased min-h-screen" suppressHydrationWarning>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
