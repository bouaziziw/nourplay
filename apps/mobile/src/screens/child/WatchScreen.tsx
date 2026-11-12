import React, { useContext, useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { AuthContext } from '../../hooks/useAuth'
import { ChildSessionContext } from '../../hooks/useChildSession'
import { VideoPlayer } from '../../components/VideoPlayer'
import { api, PlaylistDetail } from '../../api'
import type { RootStackParamList } from '../../navigation/AppNavigator'

type Props = NativeStackScreenProps<RootStackParamList, 'Watch'>
const PLAYLIST_VIDEOS_PER_PAGE = 6

function formatDuration(sec: number | null): string {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  return m > 0 ? `${m}m` : `${sec}s`
}

export default function WatchScreen({ route, navigation }: Props) {
  const { videoId, playlistId } = route.params
  const auth = useContext(AuthContext)
  const childCtx = useContext(ChildSessionContext)

  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (!auth?.token) return
    api.playlists.getById(auth.token, playlistId)
      .then(setPlaylist)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [auth?.token, playlistId])

  const handleWatched = (durationSec: number, completed: boolean) => {
    const token = auth?.token
    const profileId = childCtx?.session?.profileId
    if (!token || !profileId) return
    api.users.recordWatch(token, profileId, { videoId, durationWatchedSec: durationSec, completed }).catch(() => {})
  }

  const sorted = playlist
    ? [...playlist.playlistVideos].sort((a, b) => a.position - b.position)
    : []
  const currentIdx = sorted.findIndex(pv => pv.video.id === videoId)
  const video = sorted[currentIdx]?.video ?? null
  const nextVideo = sorted[currentIdx + 1]?.video ?? null
  const pageCount = Math.ceil(sorted.length / PLAYLIST_VIDEOS_PER_PAGE)
  const visibleVideos = sorted.slice((page - 1) * PLAYLIST_VIDEOS_PER_PAGE, page * PLAYLIST_VIDEOS_PER_PAGE)

  useEffect(() => {
    if (currentIdx >= 0) setPage(Math.floor(currentIdx / PLAYLIST_VIDEOS_PER_PAGE) + 1)
  }, [currentIdx, videoId])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    )
  }

  if (!video) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>Vidéo introuvable.</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Player */}
        <VideoPlayer
          key={videoId}
          embedUrl={video.embedUrl}
          title={video.title}
          onWatched={handleWatched}
        />

        {/* Video info */}
        <View style={styles.infoCard}>
          <Text style={styles.videoTitle}>{video.title}</Text>
          {playlist && (
            <Text style={styles.playlistName}>
              {playlist.name}{currentIdx >= 0 ? ` · #${sorted[currentIdx].position}` : ''}
            </Text>
          )}
        </View>

        {sorted.length > 1 && (
          <View style={styles.playlistCard}>
            <View style={styles.playlistHeader}>
              <Text style={styles.playlistLabel}>Vidéos de la playlist</Text>
              <Text style={styles.playlistCounter}>{currentIdx + 1} / {sorted.length}</Text>
            </View>
            <View style={styles.playlistGrid}>
              {visibleVideos.map((item, index) => {
                const active = item.video.id === videoId
                return (
                  <TouchableOpacity
                    key={item.video.id}
                    style={[styles.playlistItem, active && styles.playlistItemActive]}
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      if (!active) navigation.replace('Watch', { videoId: item.video.id, playlistId })
                    }}
                  >
                    <View style={styles.playlistThumb}>
                      {item.video.thumbnailUrl ? (
                        <Image source={{ uri: item.video.thumbnailUrl }} style={styles.nextThumb} resizeMode="cover" accessibilityLabel={item.video.title} />
                      ) : (
                        <View style={[styles.nextThumb, styles.nextThumbPlaceholder]}>
                          <Text style={{ fontSize: 18 }}>🎥</Text>
                        </View>
                      )}
                      <View style={styles.playlistPosition}>
                        <Text style={styles.playlistPositionText}>{(page - 1) * PLAYLIST_VIDEOS_PER_PAGE + index + 1}</Text>
                      </View>
                    </View>
                    <Text style={styles.playlistItemTitle} numberOfLines={2}>{item.video.title}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            {pageCount > 1 && (
              <View style={styles.pagination}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={{ disabled: page === 1 }}
                  disabled={page === 1}
                  onPress={() => setPage(current => Math.max(1, current - 1))}
                  style={[styles.pageButton, page === 1 && styles.pageButtonDisabled]}
                >
                  <Text style={styles.pageButtonText}>Précédent</Text>
                </TouchableOpacity>
                <Text style={styles.pageLabel}>Page {page} / {pageCount}</Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={{ disabled: page === pageCount }}
                  disabled={page === pageCount}
                  onPress={() => setPage(current => Math.min(pageCount, current + 1))}
                  style={[styles.pageButton, page === pageCount && styles.pageButtonDisabled]}
                >
                  <Text style={styles.pageButtonText}>Suivant</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Next video */}
        {nextVideo && (
          <View style={styles.nextCard}>
            <Text style={styles.nextLabel}>Suivant</Text>
            <TouchableOpacity
              style={styles.nextItem}
              activeOpacity={0.7}
              onPress={() => navigation.replace('Watch', { videoId: nextVideo.id, playlistId })}
            >
              <View style={styles.nextThumbWrapper}>
                {nextVideo.thumbnailUrl ? (
                  <Image source={{ uri: nextVideo.thumbnailUrl }} style={styles.nextThumb} resizeMode="cover" accessibilityLabel={nextVideo.title} />
                ) : (
                  <View style={[styles.nextThumb, styles.nextThumbPlaceholder]}>
                    <Text style={{ fontSize: 18 }}>🎥</Text>
                  </View>
                )}
              </View>
              <View style={styles.nextInfo}>
                <Text style={styles.nextTitle} numberOfLines={2}>{nextVideo.title}</Text>
                {nextVideo.durationSec ? (
                  <Text style={styles.nextDuration}>{formatDuration(nextVideo.durationSec)}</Text>
                ) : null}
              </View>
              <Text style={styles.nextChevron}>›</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#eef2ff' },
  scroll: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eef2ff' },
  notFound: { fontSize: 15, color: '#6b7280' },
  infoCard: { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 16, padding: 16 },
  videoTitle: { fontSize: 16, fontWeight: '700', color: '#111827', lineHeight: 22 },
  playlistName: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  playlistCard: { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 16, paddingVertical: 14 },
  playlistHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, marginBottom: 10 },
  playlistLabel: { fontSize: 11, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8 },
  playlistCounter: { fontSize: 11, color: '#9ca3af' },
  playlistGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 14, gap: 10 },
  playlistItem: { width: '48%', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#f3f4f6', backgroundColor: '#fff' },
  playlistItemActive: { borderColor: '#6366f1', backgroundColor: '#eef2ff' },
  playlistThumb: { width: '100%', aspectRatio: 16 / 9, position: 'relative', overflow: 'hidden' },
  playlistPosition: { position: 'absolute', top: 6, left: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center' },
  playlistPositionText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  playlistItemTitle: { padding: 8, fontSize: 12, lineHeight: 16, fontWeight: '600', color: '#111827' },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 12 },
  pageButton: { borderWidth: 1, borderColor: '#c7d2fe', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#fff' },
  pageButtonDisabled: { opacity: 0.4 },
  pageButtonText: { color: '#4f46e5', fontSize: 11, fontWeight: '700' },
  pageLabel: { color: '#6b7280', fontSize: 11 },
  nextCard: { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 16, padding: 14 },
  nextLabel: { fontSize: 11, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  nextItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextThumbWrapper: { width: 80, aspectRatio: 16 / 9, borderRadius: 8, overflow: 'hidden', flexShrink: 0 },
  nextThumb: { width: '100%', height: '100%' },
  nextThumbPlaceholder: { backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center' },
  nextInfo: { flex: 1 },
  nextTitle: { fontSize: 13, fontWeight: '600', color: '#111827', lineHeight: 18 },
  nextDuration: { fontSize: 11, color: '#9ca3af', marginTop: 3 },
  nextChevron: { fontSize: 24, color: '#d1d5db' },
})
