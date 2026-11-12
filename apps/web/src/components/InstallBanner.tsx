'use client'

import Image from 'next/image'
import { useInstallPrompt } from '../hooks/useInstallPrompt'

export function InstallBanner() {
  const { canInstall, install, dismiss } = useInstallPrompt()

  if (!canInstall) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm mx-4">
      <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl shadow-xl px-4 py-3">
        <Image
          src="/icons/icon-72.png"
          alt="NourPlay"
          width={40}
          height={40}
          className="rounded-xl flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">Installer NourPlay</p>
          <p className="text-xs text-gray-500 truncate">Accès rapide depuis votre écran d&apos;accueil</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={install}
            className="h-8 px-3 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Installer
          </button>
          <button
            onClick={dismiss}
            aria-label="Fermer"
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
