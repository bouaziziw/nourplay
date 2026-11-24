import { Logo } from '@nourplay/ui'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 flex flex-col items-center">
          <Logo size="lg" className="justify-center mb-2" />
          <p className="text-gray-500 text-sm">Plateforme vidéo sécurisée pour enfants</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl shadow-sky-950/5 border border-sky-100/60 p-8">
          {children}
        </div>
      </div>
    </div>
  )
}
