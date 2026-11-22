import React, { useContext, useEffect, useState, useMemo } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { AuthContext } from '../../hooks/useAuth'
import { api, PlaylistVideo } from '../../api'
import { getPlaylistTheme } from '../../utils/channelTheme'
import type { RootStackParamList } from '../../navigation/AppNavigator'

type Props = NativeStackScreenProps<RootStackParamList, 'ChildPlaylistDetail'>

function formatDuration(sec: number | null): string {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  return m > 0 ? `${m}m` : `${sec}s`
}

export default function ChildPlaylistDetailScreen({ route, navigation }: Props) {
  const { playlistId, playlistName } = route.params
  const auth = useContext(AuthContext)

  const [videos, setVideos] = useState<PlaylistVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [displayedCount, setDisplayedCount] = useState(10)

  const theme = useMemo(() => getPlaylistTheme(playlistName), [playlistName])

  const visibleVideos = videos.slice(0, displayedCount)
  const hasMore = displayedCount < videos.length

  const handleLoadMore = () => {
    if (hasMore) {
      setDisplayedCount(prev => Math.min(prev + 8, videos.length))
    }
  }

  const handlePlayAll = () => {
    if (videos.length > 0) {
      navigation.push('Watch', { videoId: videos[0].video.id, playlistId })
    }
  }

  useEffect(() => {
    navigation.setOptions({ headerShown: false })
  }, [navigation])

  useEffect(() => {
    if (!auth?.token) return
    api.playlists.getById(auth.token, playlistId)
      .then(pl => setVideos([...pl.playlistVideos].sort((a, b) => a.position - b.position)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [auth?.token, playlistId])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1c90d8" />
        <Text style={styles.loadingText}>Ouverture de la playlist... 🎬</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Top Custom Kid Header */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.8}
        >
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backText}>Retour</Text>
        </TouchableOpacity>

        <View style={styles.channelPill}>
          <Text style={styles.channelEmoji}>{theme.emoji}</Text>
          <Text style={styles.channelLabel}>{theme.channelLabel}</Text>
        </View>
      </View>

      {/* Playlist Hero Banner */}
      <View style={[styles.heroBanner, { backgroundColor: theme.gradient[0] }]}>
        <View style={styles.heroContent}>
          <Text style={styles.heroTitle} numberOfLines={2}>{playlistName}</Text>
          <Text style={styles.heroCount}>🎬 {videos.length} vidéo{videos.length !== 1 ? 's' : ''}</Text>

          {videos.length > 0 && (
            <TouchableOpacity
              onPress={handlePlayAll}
              style={styles.playAllButton}
              activeOpacity={0.85}
            >
              <Text style={styles.playAllIcon}>▶</Text>
              <Text style={styles.playAllText}>Tout regarder</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {videos.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🎬</Text>
          <Text style={styles.emptyText}>Aucune vidéo dans cette playlist pour le moment.</Text>
        </View>
      ) : (
        <FlatList
          data={visibleVideos}
          keyExtractor={pv => pv.video.id}
          contentContainerStyle={styles.list}
          numColumns={2}
          columnWrapperStyle={styles.row}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={hasMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color="#1c90d8" />
            </View>
          ) : undefined}
          renderItem={({ item: pv, index }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => navigation.push('Watch', { videoId: pv.video.id, playlistId })}
            >
              <View style={styles.thumbWrapper}>
                {pv.video.thumbnailUrl ? (
                  <Image source={{ uri: pv.video.thumbnailUrl }} style={styles.thumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]}>
                    <Text style={{ fontSize: 28 }}>🎥</Text>
                  </View>
                )}

                <View style={styles.playOverlay}>
                  <View style={styles.playBtn}>
                    <Text style={styles.playBtnIcon}>▶</Text>
                  </View>
                </View>

                <View style={styles.positionBadge}>
                  <Text style={styles.positionText}>{index + 1}</Text>
                </View>

                {pv.video.durationSec ? (
                  <View style={styles.durationBadge}>
                    <Text style={styles.durationText}>{formatDuration(pv.video.durationSec)}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.info}>
                <Text style={styles.videoTitle} numberOfLines={2}>{pv.video.title}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f0f9ff' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  backArrow: { fontSize: 24, fontWeight: '900', color: '#1c90d8', lineHeight: 26 },
  backText: { fontSize: 13, fontWeight: '700', color: '#1c90d8' },
  channelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#e0f2fe',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  channelEmoji: { fontSize: 15 },
  channelLabel: { fontSize: 12, fontWeight: '800', color: '#0369a1' },

  heroBanner: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 14,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  heroContent: { gap: 6 },
  heroTitle: { fontSize: 22, fontWeight: '900', color: '#ffffff', lineHeight: 28 },
  heroCount: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },
  playAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fbbf24',
    alignSelf: 'flex-start',
    marginTop: 8,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  playAllIcon: { fontSize: 16, color: '#0f172a' },
  playAllText: { fontSize: 14, fontWeight: '800', color: '#0f172a' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  loadingText: { marginTop: 12, fontSize: 14, fontWeight: '700', color: '#64748b' },
  emptyEmoji: { fontSize: 52, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#64748b', textAlign: 'center' },

  list: { paddingHorizontal: 12, paddingBottom: 32 },
  row: { gap: 12 },
  card: {
    flex: 1,
    marginBottom: 14,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#0284c7',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e0f2fe',
  },
  thumbWrapper: { width: '100%', aspectRatio: 16 / 9, position: 'relative' },
  thumb: { width: '100%', height: '100%' },
  thumbPlaceholder: { backgroundColor: '#def0fa', alignItems: 'center', justifyContent: 'center' },
  playOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.2)',
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnIcon: { fontSize: 16, color: '#1c90d8', marginLeft: 3 },
  positionBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1c90d8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  positionText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  durationText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  info: { padding: 12 },
  videoTitle: { fontSize: 13, fontWeight: '700', color: '#0f172a', lineHeight: 18 },
  footerLoader: { paddingVertical: 16, alignItems: 'center' },
})
