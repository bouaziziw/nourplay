export interface ChannelTheme {
  emoji: string
  illustration: string
  channelLabel: string
  gradient: [string, string]
  accentColor: string
  bgLight: string
  category: 'all' | 'stories' | 'animals' | 'fun' | 'learn' | 'general'
}

export function getPlaylistTheme(name: string, description?: string | null): ChannelTheme {
  const text = `${name || ''} ${description || ''}`.toLowerCase()

  // Animals / Nature
  if (
    text.includes('anim') ||
    text.includes('lion') ||
    text.includes('safari') ||
    text.includes('zoo') ||
    text.includes('jungle') ||
    text.includes('dino') ||
    text.includes('chat') ||
    text.includes('chien') ||
    text.includes('oiseau')
  ) {
    return {
      emoji: '🦁',
      illustration: '🐾',
      channelLabel: 'Animaux & Nature',
      gradient: ['#f97316', '#ea580c'],
      accentColor: '#ea580c',
      bgLight: '#fff7ed',
      category: 'animals',
    }
  }

  // Stories / Bedtime / Contes
  if (
    text.includes('histoir') ||
    text.includes('conte') ||
    text.includes('nuit') ||
    text.includes('dormir') ||
    text.includes('sommeil') ||
    text.includes('prophet') ||
    text.includes('coran') ||
    text.includes('islam') ||
    text.includes('sourat') ||
    text.includes('doua') ||
    text.includes('ramadan')
  ) {
    return {
      emoji: '🌙',
      illustration: '⭐',
      channelLabel: 'Histoires & Contes',
      gradient: ['#6366f1', '#4338ca'],
      accentColor: '#4f46e5',
      bgLight: '#eef2ff',
      category: 'stories',
    }
  }

  // Songs / Rhymes / Music
  if (
    text.includes('chans') ||
    text.includes('comptin') ||
    text.includes('musique') ||
    text.includes('chante') ||
    text.includes('danse') ||
    text.includes('karaoke')
  ) {
    return {
      emoji: '🎵',
      illustration: '🎉',
      channelLabel: 'Comptines & Chansons',
      gradient: ['#ec4899', '#be185d'],
      accentColor: '#db2777',
      bgLight: '#fdf2f8',
      category: 'fun',
    }
  }

  // Drawing / Art
  if (
    text.includes('dessin') ||
    text.includes('colori') ||
    text.includes('peint') ||
    text.includes('bricol') ||
    text.includes('art')
  ) {
    return {
      emoji: '🎨',
      illustration: '✨',
      channelLabel: 'Dessin & Créativité',
      gradient: ['#8b5cf6', '#6d28d9'],
      accentColor: '#7c3aed',
      bgLight: '#f5f3ff',
      category: 'fun',
    }
  }

  // Learning / Alphabet / Science / Numbers
  if (
    text.includes('apprend') ||
    text.includes('alphabet') ||
    text.includes('chiffre') ||
    text.includes('nombre') ||
    text.includes('ecole') ||
    text.includes('science') ||
    text.includes('espace') ||
    text.includes('decouvert') ||
    text.includes('anglais') ||
    text.includes('arabe') ||
    text.includes('lire') ||
    text.includes('math')
  ) {
    return {
      emoji: '🔤',
      illustration: '🚀',
      channelLabel: 'Éveil & Découverte',
      gradient: ['#06b6d4', '#0284c7'],
      accentColor: '#0284c7',
      bgLight: '#f0f9ff',
      category: 'learn',
    }
  }

  // Space / Adventure
  if (text.includes('espace') || text.includes('planete') || text.includes('fusee') || text.includes('univers')) {
    return {
      emoji: '🚀',
      illustration: '🪐',
      channelLabel: 'Aventure & Espace',
      gradient: ['#0284c7', '#0369a1'],
      accentColor: '#0284c7',
      bgLight: '#e0f2fe',
      category: 'learn',
    }
  }

  // Default Channel
  return {
    emoji: '🎬',
    illustration: '🎈',
    channelLabel: 'Dessins Animés & Découvertes',
    gradient: ['#3b82f6', '#1d4ed8'],
    accentColor: '#2563eb',
    bgLight: '#eff6ff',
    category: 'general',
  }
}
