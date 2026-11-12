export interface PresetAvatar {
  id: string
  emoji: string
  bg: string
  label: string
}

export const PRESET_AVATARS: PresetAvatar[] = [
  { id: 'preset:lion',      emoji: '🦁', bg: '#FEF3C7', label: 'Lion' },
  { id: 'preset:dolphin',   emoji: '🐬', bg: '#E0F2FE', label: 'Dauphin' },
  { id: 'preset:fox',       emoji: '🦊', bg: '#FFEDD5', label: 'Renard' },
  { id: 'preset:turtle',    emoji: '🐢', bg: '#D1FAE5', label: 'Tortue' },
  { id: 'preset:butterfly', emoji: '🦋', bg: '#EDE9FE', label: 'Papillon' },
  { id: 'preset:penguin',   emoji: '🐧', bg: '#F1F5F9', label: 'Manchot' },
  { id: 'preset:octopus',   emoji: '🐙', bg: '#FCE7F3', label: 'Pieuvre' },
  { id: 'preset:unicorn',   emoji: '🦄', bg: '#E0E7FF', label: 'Licorne' },
  { id: 'preset:frog',      emoji: '🐸', bg: '#ECFCCB', label: 'Grenouille' },
  { id: 'preset:bee',       emoji: '🐝', bg: '#FEF9C3', label: 'Abeille' },
  { id: 'preset:parrot',    emoji: '🦜', bg: '#CCFBF1', label: 'Perroquet' },
  { id: 'preset:panda',     emoji: '🐼', bg: '#F3F4F6', label: 'Panda' },
]

const PRESET_MAP = new Map(PRESET_AVATARS.map(a => [a.id, a]))

export function getPreset(key: string | null | undefined): PresetAvatar | null {
  if (!key?.startsWith('preset:')) return null
  return PRESET_MAP.get(key) ?? null
}
