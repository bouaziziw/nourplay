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
import { getPlaylistTheme } from '../../utils/channelTheme'
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
  const [isLoved, setIsLoved] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    navigation.setOptions({ headerShown: false })
  }, [navigation])

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

  const theme = playlist ? getPlaylistTheme(playlist.name) : null

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text style={styles.loadingText}>Lancement de la vidéo... 🍿</Text>
      </View>
    )
  }

  if (!video) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.emptyEmoji}>🎬</Text>
        <Text style={styles.notFound}>Vidéo introuvable.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backHomeBtn}>
          <Text style={styles.backHomeText}>‹ Retour aux vidéos</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView
      style={[styles.safe, isFullscreen && styles.safeFullscreen]}
      edges={isFullscreen ? [] : ['top', 'bottom']}
    >
      {/* Friendly Kid Watch Top Bar - hidden in fullscreen */}
      {!isFullscreen && (
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.backBtnIcon}>‹</Text>
            <Text style={styles.backBtnText}>Retour</Text>
          </TouchableOpacity>

          {playlist && (
            <View style={styles.playlistBadgePill}>
              <Text style={styles.playlistBadgeEmoji}>{theme?.emoji ?? '🎬'}</Text>
              <Text style={styles.playlistBadgeName} numberOfLines={1}>{playlist.name}</Text>
            </View>
          )}
        </View>
      )}

      <ScrollView
        contentContainerStyle={isFullscreen ? styles.scrollFullscreen : styles.scroll}
        scrollEnabled={!isFullscreen}
        showsVerticalScrollIndicator={false}
      >
        {/* Main 16:9 Video Player */}
        <View style={[styles.playerCard, isFullscreen && styles.playerCardFullscreen]}>
          <VideoPlayer
            key={videoId}
            embedUrl={video.embedUrl}
            title={video.title}
            onWatched={handleWatched}
            onNext={nextVideo ? () => navigation.replace('Watch', { videoId: nextVideo.id, playlistId }) : undefined}
            isFullscreen={isFullscreen}
            onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
          />
        </View>

        {!isFullscreen && (
          <>
            {/* Video Info & Kid Actions */}
            <View style={styles.infoCard}>
              <View style={styles.titleRow}>
                <Text style={styles.videoTitle}>{video.title}</Text>
                <TouchableOpacity
                  onPress={() => setIsLoved(!isLoved)}
                  style={[styles.loveBtn, isLoved && styles.loveBtnActive]}
                  activeOpacity={0.7}
                >
                  <Text style={styles.loveEmoji}>{isLoved ? '❤️' : '🤍'}</Text>
                  <Text style={[styles.loveText, isLoved && styles.loveTextActive]}>
                    {isLoved ? 'J\'adore !' : 'J\'aime'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Big "Vidéo Suivante" Button (Children love this!) */}
            {nextVideo && (
              <TouchableOpacity
                style={styles.nextBigButton}
                activeOpacity={0.85}
                onPress={() => navigation.replace('Watch', { videoId: nextVideo.id, playlistId })}
              >
                <View style={styles.nextBigIconBox}>
                  <Text style={styles.nextBigIcon}>⏭️</Text>
                </View>
                <View style={styles.nextBigTextBox}>
                  <Text style={styles.nextBigLabel}>Vidéo suivante</Text>
                  <Text style={styles.nextBigTitle} numberOfLines={1}>{nextVideo.title}</Text>
                </View>
                <Text style={styles.nextBigArrow}>›</Text>
              </TouchableOpacity>
            )}

            {/* Horizontal Carousel of other videos in this playlist */}
            {sorted.length > 1 && (
              <View style={styles.carouselSection}>
                <View style={styles.carouselHeader}>
                  <Text style={styles.carouselTitle}>Toutes les vidéos ({sorted.length})</Text>
                  <Text style={styles.carouselCounter}>{currentIdx + 1} / {sorted.length}</Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.carouselScroll}
                >
                  {sorted.map((item, index) => {
                    const isActive = item.video.id === videoId
                    return (
                      <TouchableOpacity
                        key={item.video.id}
                        style={[styles.thumbCard, isActive && styles.thumbCardActive]}
                        activeOpacity={0.8}
                        onPress={() => {
                          if (!isActive) navigation.replace('Watch', { videoId: item.video.id, playlistId })
                        }}
                      >
                        <View style={styles.thumbBox}>
                          {item.video.thumbnailUrl ? (
                            <Image source={{ uri: item.video.thumbnailUrl }} style={styles.thumbImg} resizeMode="cover" />
                          ) : (
                            <View style={styles.thumbPlaceholder}>
                              <Text style={{ fontSize: 24 }}>🎥</Text>
                            </View>
                          )}

                          {isActive && (
                            <View style={styles.playingBadge}>
                              <Text style={styles.playingText}>En cours ▶</Text>
                            </View>
                          )}

                          <View style={styles.posBadge}>
                            <Text style={styles.posBadgeText}>{index + 1}</Text>
                          </View>

                          {item.video.durationSec ? (
                            <View style={styles.durBadge}>
                              <Text style={styles.durBadgeText}>{formatDuration(item.video.durationSec)}</Text>
                            </View>
                          ) : null}
                        </View>

                        <Text style={styles.thumbTitle} numberOfLines={2}>{item.video.title}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </ScrollView>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0b1120' },
  safeFullscreen: { backgroundColor: '#000000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#0b1120' },
  loadingText: { marginTop: 12, fontSize: 14, fontWeight: '700', color: '#94a3b8' },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  notFound: { fontSize: 16, fontWeight: '700', color: '#f1f5f9', marginBottom: 16 },
  backHomeBtn: { backgroundColor: '#0284c7', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 10 },
  backHomeText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#070d18',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  backBtnIcon: { fontSize: 24, fontWeight: '900', color: '#38bdf8', lineHeight: 26 },
  backBtnText: { fontSize: 13, fontWeight: '700', color: '#f1f5f9' },
  playlistBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: '60%',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  playlistBadgeEmoji: { fontSize: 14 },
  playlistBadgeName: { fontSize: 12, fontWeight: '800', color: '#38bdf8' },

  scroll: { padding: 14, gap: 14, paddingBottom: 32 },
  scrollFullscreen: { padding: 0, flex: 1 },
  playerCard: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#000000',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  playerCardFullscreen: {
    borderRadius: 0,
    flex: 1,
    elevation: 0,
    shadowOpacity: 0,
  },
  infoCard: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  videoTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc',
    lineHeight: 22,
  },
  loveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
  },
  loveBtnActive: { backgroundColor: '#f43f5e', borderColor: '#f43f5e' },
  loveEmoji: { fontSize: 14 },
  loveText: { fontSize: 12, fontWeight: '800', color: '#fb7185' },
  loveTextActive: { color: '#ffffff' },

  // Big Next Button
  nextBigButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    borderRadius: 20,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  nextBigIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  nextBigIcon: { fontSize: 20 },
  nextBigTextBox: { flex: 1 },
  nextBigLabel: { fontSize: 11, fontWeight: '800', color: '#451a03', textTransform: 'uppercase', letterSpacing: 0.6 },
  nextBigTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', marginTop: 2 },
  nextBigArrow: { fontSize: 28, fontWeight: '900', color: '#451a03', marginLeft: 8 },

  // Carousel
  carouselSection: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  carouselHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  carouselTitle: { fontSize: 15, fontWeight: '800', color: '#f8fafc' },
  carouselCounter: { fontSize: 12, fontWeight: '700', color: '#38bdf8' },
  carouselScroll: { paddingHorizontal: 14, gap: 12 },
  thumbCard: {
    width: 170,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#1e293b',
    backgroundColor: '#1e293b',
  },
  thumbCardActive: {
    borderColor: '#38bdf8',
    backgroundColor: '#0c4a6e',
  },
  thumbBox: { width: '100%', aspectRatio: 16 / 9, position: 'relative' },
  thumbImg: { width: '100%', height: '100%' },
  thumbPlaceholder: { backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' },
  playingBadge: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(2, 132, 199, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playingText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  posBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  posBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '800' },
  durBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  durBadgeText: { color: '#ffffff', fontSize: 9, fontWeight: '700' },
  thumbTitle: { fontSize: 12, fontWeight: '700', color: '#f1f5f9', padding: 8, lineHeight: 16 },
})
