import Link from 'next/link'
import { useLocale } from 'next-intl'

export default function LocaleNotFound() {
  const locale = useLocale()
  return (
    <div className="min-h-screen bg-white text-slate-900 flex items-center justify-center font-sans">
      <div className="text-center p-6 max-w-md mx-auto">
        <div className="w-16 h-16 bg-sky-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">🔍</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Page introuvable (404)</h1>
        <p className="text-gray-500 text-sm mb-6">
          La page que vous recherchez n&apos;existe pas ou a été déplacée.
        </p>
        <Link
          href={`/${locale}`}
          className="inline-flex items-center justify-center h-10 px-6 bg-[#1c90d8] text-white rounded-xl text-sm font-medium hover:opacity-95 transition-opacity"
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  )
}
