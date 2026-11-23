import { getPlaylistTheme } from './channelTheme'

export interface PlaylistCategoryDef {
  id: string
  label: string
  emoji: string
  desc: string
  themeCategory: 'stories' | 'animals' | 'fun' | 'learn' | 'creativity' | 'cartoons' | 'general'
}

export const PLAYLIST_CATEGORIES: PlaylistCategoryDef[] = [
  {
    id: 'stories',
    label: 'Histoires & Contes',
    emoji: '🌙',
    desc: 'Contes du soir, histoires des prophètes, récits de sagesse',
    themeCategory: 'stories',
  },
  {
    id: 'animals',
    label: 'Animaux & Nature',
    emoji: '🦁',
    desc: 'Le monde animal, safaris, faune et flore, découvertes nature',
    themeCategory: 'animals',
  },
  {
    id: 'fun',
    label: 'Comptines & Chansons',
    emoji: '🎵',
    desc: 'Musique pour enfants, danses, karaoké et comptines joyeuses',
    themeCategory: 'fun',
  },
  {
    id: 'learn',
    label: 'Éveil & Découverte',
    emoji: '🔤',
    desc: 'Alphabet, chiffres, sciences, langues et apprentissages ludiques',
    themeCategory: 'learn',
  },
  {
    id: 'creativity',
    label: 'Dessin & Créativité',
    emoji: '🎨',
    desc: 'Coloriage, travaux manuels, origami et peinture créative',
    themeCategory: 'creativity',
  },
  {
    id: 'cartoons',
    label: 'Dessins Animés & Aventure',
    emoji: '🚀',
    desc: 'Aventures héroïques, exploration spatiale et dessins animés',
    themeCategory: 'cartoons',
  },
  {
    id: 'general',
    label: 'Général & Famille',
    emoji: '🎬',
    desc: 'Vidéos familiales et sélection éducative variée',
    themeCategory: 'general',
  },
]

export interface LanguageOption {
  value: string
  label: string
  flag: string
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: 'fr', label: 'Français', flag: '🇫🇷' },
  { value: 'ar', label: 'Arabe (العربية)', flag: '🇸🇦' },
  { value: 'en', label: 'Anglais (English)', flag: '🇬🇧' },
  { value: 'es', label: 'Espagnol (Español)', flag: '🇪🇸' },
  { value: 'de', label: 'Allemand (Deutsch)', flag: '🇩🇪' },
  { value: 'it', label: 'Italien (Italiano)', flag: '🇮🇹' },
  { value: 'tr', label: 'Turc (Türkçe)', flag: '🇹🇷' },
  { value: 'multi', label: 'Multilingue', flag: '🌐' },
]

const CAT_REGEX = /^\[cat:([a-zA-Z0-9_-]+)\]\s*/i

/**
 * Packs category identifier into the description string so it is persisted
 * transparently in the database without schema changes.
 */
export function packPlaylistDescription(category: string, userDescription?: string): string {
  const clean = (userDescription ?? '').replace(CAT_REGEX, '').trim()
  if (!category || category === 'general') {
    return clean ? `[cat:${category}] ${clean}` : `[cat:${category}]`
  }
  return clean ? `[cat:${category}] ${clean}` : `[cat:${category}]`
}

/**
 * Extracts category and clean user description from raw description.
 * Falls back to semantic detection if no explicit [cat:...] tag is present.
 */
export function unpackPlaylistDescription(
  rawDescription?: string | null,
  name?: string
): { category: string; cleanDescription: string } {
  const raw = rawDescription ?? ''
  const match = raw.match(CAT_REGEX)
  if (match) {
    const category = match[1].toLowerCase()
    const cleanDescription = raw.replace(CAT_REGEX, '').trim()
    return { category, cleanDescription }
  }

  // Fallback to thematic category from channelTheme
  const theme = getPlaylistTheme(name ?? '', raw)
  return {
    category: theme.category === 'all' ? 'general' : theme.category,
    cleanDescription: raw.trim(),
  }
}

/**
 * Get category badge label and emoji
 */
export function getCategoryBadge(categoryId: string): { label: string; emoji: string } {
  const cat = PLAYLIST_CATEGORIES.find(c => c.id === categoryId)
  if (cat) {
    return { label: cat.label, emoji: cat.emoji }
  }
  return { label: 'Général', emoji: '🎬' }
}

/**
 * Get language flag / label
 */
export function getLanguageBadge(langCode: string): { label: string; flag: string } {
  const opt = LANGUAGE_OPTIONS.find(l => l.value.toLowerCase() === langCode.toLowerCase())
  if (opt) return { label: opt.label, flag: opt.flag }
  return { label: langCode.toUpperCase(), flag: '🌐' }
}
