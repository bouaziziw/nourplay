'use client'

import { useState, useEffect, useCallback } from 'react'
import type { PlaylistDetail } from '../lib/api'

export interface OfflineVideo {
  id: string
  title: string
  thumbnailUrl: string | null
  durationSec: number | null
  embedUrl: string
  language: string | null
  ageRating: string
}

export interface OfflinePlaylist {
  id: string
  name: string
  description: string | null
  savedAt: string
  videos: OfflineVideo[]
}

const STORE_KEY = 'nourplay:offline-playlists'
const CACHE_NAME = 'nourplay-offline'

export function readOfflinePlaylist(id: string): OfflinePlaylist | null {
  if (typeof window === 'undefined') return null
  try {
    const all: OfflinePlaylist[] = JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]')
    return all.find(p => p.id === id) ?? null
  } catch {
    return null
  }
}

function readAllStored(): OfflinePlaylist[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function useOfflinePlaylists() {
  const [saved, setSaved] = useState<OfflinePlaylist[]>([])

  useEffect(() => {
    setSaved(readAllStored())
  }, [])

  const save = useCallback(async (playlist: PlaylistDetail) => {
    const videos: OfflineVideo[] = [...playlist.playlistVideos]
      .sort((a, b) => a.position - b.position)
      .map(({ video }) => ({
        id: video.id,
        title: video.title,
        thumbnailUrl: video.thumbnailUrl,
        durationSec: video.durationSec,
        embedUrl: video.embedUrl,
        language: video.language,
        ageRating: video.ageRating,
      }))

    if ('caches' in window) {
      const cache = await caches.open(CACHE_NAME).catch(() => null)
      if (cache) {
        await Promise.all(
          videos
            .map(v => v.thumbnailUrl)
            .filter(Boolean)
            .map(url => cache.add(url!).catch(() => {}))
        )
      }
    }

    const entry: OfflinePlaylist = {
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      savedAt: new Date().toISOString(),
      videos,
    }
    const next = [entry, ...readAllStored().filter(p => p.id !== playlist.id)]
    localStorage.setItem(STORE_KEY, JSON.stringify(next))
    setSaved(next)
  }, [])

  const remove = useCallback(async (playlistId: string) => {
    const current = readAllStored()
    const toRemove = current.find(p => p.id === playlistId)
    const next = current.filter(p => p.id !== playlistId)
    localStorage.setItem(STORE_KEY, JSON.stringify(next))
    setSaved(next)

    if (toRemove && 'caches' in window) {
      const cache = await caches.open(CACHE_NAME).catch(() => null)
      if (cache) {
        await Promise.all(
          toRemove.videos
            .map(v => v.thumbnailUrl)
            .filter(Boolean)
            .map(url => cache.delete(url!).catch(() => {}))
        )
      }
    }
  }, [])

  return { saved, save, remove }
}
