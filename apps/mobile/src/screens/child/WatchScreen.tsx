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
                  <Image source={{ uri: nextVideo.thumbnailUrl }} style={styles.nextThumb} resizeMode="cover" />
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
