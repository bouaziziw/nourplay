import type { Metadata } from 'next'
import '../globals.css'

export const metadata: Metadata = {
  title: 'Hors ligne | NourPlay',
}

export default function OfflineLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
