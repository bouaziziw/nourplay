import Link from 'next/link'

export default async function LegalLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  return (
    <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href={`/${locale}`}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500 flex items-center gap-1"
          >
            ← Retour à l&apos;accueil
          </Link>
          <span className="text-sm font-bold text-gray-900">NourPlay</span>
        </div>
        <div className="bg-white shadow-sm rounded-2xl p-8 sm:p-12 border border-gray-100 prose prose-indigo max-w-none">
          {children}
        </div>
      </div>
    </div>
  )
}
