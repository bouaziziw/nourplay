import React, { useContext, useEffect, useState, useMemo } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, ImageBackground,
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
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text style={styles.loadingText}>Ouverture de la playlist... 🎬</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
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
        <View style={styles.heroBanner}>
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
              <ActivityIndicator size="small" color="#38bdf8" />
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
  </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  safe: { flex: 1, backgroundColor: '#ffffff' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  backArrow: { fontSize: 24, fontWeight: '900', color: '#1c90d8', lineHeight: 26 },
  backText: { fontSize: 13, fontWeight: '700', color: '#000000' },
  channelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(28, 144, 216, 0.1)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(28, 144, 216, 0.25)',
  },
  channelEmoji: { fontSize: 15 },
  channelLabel: { fontSize: 12, fontWeight: '800', color: '#1c90d8' },

  heroBanner: {
    padding: 20,
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 12,
    backgroundColor: '#162d4a',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  heroContent: { gap: 6 },
  heroTitle: { fontSize: 22, fontWeight: '900', color: '#ffffff', lineHeight: 28 },
  heroCount: { fontSize: 13, fontWeight: '700', color: '#cbd5e1' },
  playAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fbbf24',
    alignSelf: 'flex-start',
    marginTop: 8,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  playAllIcon: { fontSize: 16, color: '#000000' },
  playAllText: { fontSize: 14, fontWeight: '900', color: '#000000' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: 'transparent' },
  loadingText: { marginTop: 12, fontSize: 14, fontWeight: '700', color: '#000000' },
  emptyEmoji: { fontSize: 52, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#000000', textAlign: 'center' },

  list: { paddingHorizontal: 12, paddingBottom: 32 },
  row: { gap: 12 },
  card: {
    flex: 1,
    marginBottom: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  thumbWrapper: { width: '100%', aspectRatio: 16 / 9, position: 'relative' },
  thumb: { width: '100%', height: '100%' },
  thumbPlaceholder: { backgroundColor: '#0284c7', alignItems: 'center', justifyContent: 'center' },
  playOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnIcon: { fontSize: 15, color: '#1c90d8', marginLeft: 2 },
  positionBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  positionText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  durationText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  info: { padding: 10 },
  videoTitle: { fontSize: 13, fontWeight: '700', color: '#000000', lineHeight: 18 },
  footerLoader: { paddingVertical: 16, alignItems: 'center' },
})
