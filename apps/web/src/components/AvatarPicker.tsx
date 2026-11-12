'use client'

import { useEffect, useRef } from 'react'
import { PRESET_AVATARS } from '../lib/avatars'

interface Props {
  current?: string | null
  onSelect: (id: string) => void
  onClose: () => void
}

export function AvatarPicker({ current, onSelect, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-gray-900 text-base">Choisir un avatar</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {PRESET_AVATARS.map(avatar => (
            <button
              key={avatar.id}
              onClick={() => { onSelect(avatar.id); onClose() }}
              title={avatar.label}
              className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all ${
                current === avatar.id
                  ? 'ring-2 ring-indigo-500 ring-offset-1'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                style={{ background: avatar.bg }}
              >
                {avatar.emoji}
              </div>
              <span className="text-[10px] text-gray-500 truncate w-full text-center">{avatar.label}</span>
            </button>
          ))}
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          Ou utilisez le bouton &quot;Changer la photo&quot; pour téléverser votre propre image.
        </p>
      </div>
    </div>
  )
}
