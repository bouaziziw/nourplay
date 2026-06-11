'use client'

import { useState } from 'react'

const DAYS = [
  { key: 'mon', label: 'Lun' }, { key: 'tue', label: 'Mar' },
  { key: 'wed', label: 'Mer' }, { key: 'thu', label: 'Jeu' },
  { key: 'fri', label: 'Ven' }, { key: 'sat', label: 'Sam' },
  { key: 'sun', label: 'Dim' },
]

const SLOT_RE = /^\d{2}:\d{2}-\d{2}:\d{2}$/

function parseSlots(raw: string): string[] {
  return raw.split(',').map(s => s.trim()).filter(s => SLOT_RE.test(s))
}

function slotsToRaw(slots: string[]): string {
  return slots.join(', ')
}

interface Props {
  value: Record<string, string>
  onChange: (v: Record<string, string>) => void
}

export function ScheduleEditor({ value, onChange }: Props) {
  const [adding, setAdding] = useState<string | null>(null)
  const [start, setStart] = useState('08:00')
  const [end, setEnd] = useState('12:00')
  const [addError, setAddError] = useState('')

  const openAdd = (key: string) => {
    setAdding(key)
    setStart('08:00')
    setEnd('12:00')
    setAddError('')
  }

  const cancelAdd = () => {
    setAdding(null)
    setAddError('')
  }

  const confirmAdd = (key: string) => {
    if (start >= end) {
      setAddError("L'heure de fin doit être après le début.")
      return
    }
    const slot = `${start}-${end}`
    const existing = parseSlots(value[key] ?? '')
    if (existing.includes(slot)) {
      setAddError('Ce créneau existe déjà.')
      return
    }
    const updated = [...existing, slot].sort()
    onChange({ ...value, [key]: slotsToRaw(updated) })
    setAdding(null)
    setAddError('')
  }

  const removeSlot = (key: string, slot: string) => {
    const updated = parseSlots(value[key] ?? '').filter(s => s !== slot)
    onChange({ ...value, [key]: slotsToRaw(updated) })
  }

  return (
    <div className="space-y-3">
      {DAYS.map(d => {
        const slots = parseSlots(value[d.key] ?? '')
        const isAdding = adding === d.key

        return (
          <div key={d.key} className="flex items-start gap-3">
            <span className="w-9 pt-1.5 text-xs font-semibold text-gray-500 shrink-0">{d.label}</span>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                {slots.length === 0 && !isAdding && (
                  <span className="text-xs text-gray-400 pt-1">Aucune restriction</span>
                )}

                {slots.map(slot => {
                  const [s, e] = slot.split('-')
                  return (
                    <span
                      key={slot}
                      className="inline-flex items-center gap-1 h-7 px-2.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium"
                    >
                      {s} → {e}
                      <button
                        type="button"
                        onClick={() => removeSlot(d.key, slot)}
                        title="Supprimer ce créneau"
                        className="text-indigo-400 hover:text-indigo-700 leading-none ml-0.5 text-sm"
                      >
                        ×
                      </button>
                    </span>
                  )
                })}

                {!isAdding && (
                  <button
                    type="button"
                    onClick={() => openAdd(d.key)}
                    className="h-7 px-2.5 text-xs text-indigo-600 border border-dashed border-indigo-300 rounded-full hover:bg-indigo-50 transition-colors"
                  >
                    + Ajouter
                  </button>
                )}
              </div>

              {isAdding && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    type="time"
                    value={start}
                    onChange={e => { setStart(e.target.value); setAddError('') }}
                    className="h-8 px-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-xs text-gray-400">→</span>
                  <input
                    type="time"
                    value={end}
                    onChange={e => { setEnd(e.target.value); setAddError('') }}
                    className="h-8 px-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => confirmAdd(d.key)}
                    className="h-8 px-3 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Ajouter
                  </button>
                  <button
                    type="button"
                    onClick={cancelAdd}
                    className="h-8 px-3 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Annuler
                  </button>
                  {addError && (
                    <p className="w-full text-xs text-red-600">{addError}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
