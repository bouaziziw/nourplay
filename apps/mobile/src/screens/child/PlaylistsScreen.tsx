import React, { useContext, useEffect, useState, useCallback, useMemo } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Image, ScrollView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { AuthContext } from '../../hooks/useAuth'
import { ChildSessionContext, isWithinSchedule } from '../../hooks/useChildSession'
import { sendLocalScreenTimeNotification } from '../../hooks/usePushNotifications'
import { api, PlaylistSummary } from '../../api'
import { ChildCountdownTimer } from '../../components/ChildCountdownTimer'
import { getPlaylistTheme } from '../../utils/channelTheme'
import type { RootStackParamList } from '../../navigation/AppNavigator'
import { Logo } from '../../components/Logo'

type Props = NativeStackScreenProps<RootStackParamList, 'ChildPlaylists'>

const FILTER_PILLS = [
  { id: 'all', label: 'Tout', emoji: '⭐' },
  { id: 'stories', label: 'Histoires', emoji: '🌙' },
  { id: 'animals', label: 'Animaux', emoji: '🦁' },
  { id: 'fun', label: 'Chansons', emoji: '🎵' },
  { id: 'learn', label: 'Éveil', emoji: '🔤' },
]

export default function ChildPlaylistsScreen({ navigation }: Props) {
  const auth = useContext(AuthContext)
  const childCtx = useContext(ChildSessionContext)
  const { session } = childCtx ?? {}

  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('all')

  const load = useCallback(() => {
    if (!auth?.token) return
    api.playlists.list(auth.token)
      .then(setPlaylists)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [auth?.token])

  useEffect(() => { load() }, [load])

  // Re-check schedule / session every minute
  useEffect(() => {
    const interval = setInterval(() => {
      if (!session || !childCtx) return
      if (!isWithinSchedule(session.viewingSchedule) || childCtx.isSessionExpired()) {
        void sendLocalScreenTimeNotification(session.displayName)
        if (auth?.token && session.profileId) {
          void api.users.notifySessionExpired(auth.token, session.profileId).catch(() => {})
        }
        childCtx.clear()
      }
    }, 60_000)
    return () => clearInterval(interval)
  }, [session, childCtx, auth?.token])

  // Enforce schedule on mount
  useEffect(() => {
    if (!session || !childCtx) return
    if (!isWithinSchedule(session.viewingSchedule)) {
      Alert.alert('Pas maintenant 🌙', 'La lecture vidéo n\'est pas disponible à cette heure.', [
        { text: 'OK', onPress: () => childCtx.clear() },
      ])
      return
    }
    if (childCtx.isSessionExpired()) {
      void sendLocalScreenTimeNotification(session.displayName)
      if (auth?.token && session.profileId) {
        void api.users.notifySessionExpired(auth.token, session.profileId).catch(() => {})
      }
      Alert.alert('Temps écoulé ⏰', `La session de ${session.displayName} est terminée pour aujourd'hui.`, [
        { text: 'OK', onPress: () => childCtx.clear() },
      ])
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleExit = () => {
    Alert.alert('Quitter', 'Voulez-vous quitter le mode enfant ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Quitter', style: 'destructive', onPress: () => childCtx?.clear() },
    ])
  }

  const filteredPlaylists = useMemo(() => {
    if (activeFilter === 'all') return playlists
    return playlists.filter(pl => {
      const theme = getPlaylistTheme(pl.name, pl.description)
      if (activeFilter === 'stories' && (theme.emoji === '🌙' || theme.emoji === '📚')) return true
      if (activeFilter === 'animals' && theme.emoji === '🦁') return true
      if (activeFilter === 'fun' && (theme.emoji === '🎵' || theme.emoji === '🎨')) return true
      if (activeFilter === 'learn' && (theme.emoji === '🔤' || theme.emoji === '🚀')) return true
      return false
    })
  }, [playlists, activeFilter])

  const isTV = Platform.isTV

  const featuredPlaylist = useMemo(() => {
    if (playlists.length === 0) return null
    return playlists.find(p => p.playlistVideos && p.playlistVideos.length > 0) || playlists[0]
  }, [playlists])

  const featuredFirstVideo = featuredPlaylist?.playlistVideos?.[0]?.video

  const discoverVideos = useMemo(() => {
    const list: { video: any; playlistId: string; playlistName: string }[] = []
    for (const pl of playlists) {
      for (const pv of pl.playlistVideos || []) {
        if (pv.video && !list.some(item => item.video.id === pv.video.id)) {
          list.push({ video: pv.video, playlistId: pl.id, playlistName: pl.name })
        }
      }
    }
    return list.slice(0, 10)
  }, [playlists])

  if (isTV) {
    return (
      <SafeAreaView style={styles.tvSafe}>
        {/* ── TV Header (screenshot-tv-1.png) ── */}
        <View style={styles.tvHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Logo size="sm" subtitle="TV" />
            <View style={styles.tvNavTabs}>
              <View style={[styles.tvNavTab, styles.tvNavTabActive]}>
                <Text style={styles.tvNavTabTextActive}>Accueil</Text>
              </View>
              <View style={styles.tvNavTab}>
                <Text style={styles.tvNavTabText}>Playlists</Text>
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate('ProfileSelector')}
                style={styles.tvNavTab}
              >
                <Text style={styles.tvNavTabText}>Profils Enfants</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.tvProfileBadge}>
            <View style={styles.avatar}>
              <Text style={styles.avatarEmoji}>👶</Text>
            </View>
            <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 14 }}>
              {session?.displayName}
            </Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* ── TV Hero Banner : Sélection du Jour (screenshot-tv-1.png & 1000017388.png) ── */}
          <View style={styles.tvHero}>
            <View style={styles.tvHeroBadge}>
              <Text style={styles.tvHeroBadgeText}>⭐ SÉLECTION DU JOUR</Text>
            </View>
            <Text style={styles.tvHeroTitle} numberOfLines={2}>
              {featuredPlaylist?.name || 'Les Histoires Éducatives'}
            </Text>
            <View style={styles.tvHeroMeta}>
              <Text style={styles.tvHeroTag}>✨ Tous publics</Text>
              <Text style={styles.tvHeroTag}>
                🎬 {featuredPlaylist?._count?.playlistVideos ?? 0} vidéos
              </Text>
            </View>
            <Text style={styles.tvHeroDesc} numberOfLines={3}>
              {featuredPlaylist?.description ||
                'Découvre de merveilleuses aventures pleines de sagesse et d\'apprentissage !'}
            </Text>

            <View style={styles.tvHeroActions}>
              <TouchableOpacity
                style={styles.tvPlayBtn}
                activeOpacity={0.85}
                onPress={() => {
                  if (featuredFirstVideo && featuredPlaylist) {
                    navigation.push('Watch', {
                      videoId: featuredFirstVideo.id,
                      playlistId: featuredPlaylist.id,
                    })
                  } else if (featuredPlaylist) {
                    navigation.push('ChildPlaylistDetail', {
                      playlistId: featuredPlaylist.id,
                      playlistName: featuredPlaylist.name,
                    })
                  }
                }}
              >
                <Text style={styles.tvPlayBtnText}>▶ Lire la vidéo</Text>
              </TouchableOpacity>

              {featuredPlaylist && (
                <TouchableOpacity
                  style={styles.tvInfoBtn}
                  activeOpacity={0.85}
                  onPress={() =>
                    navigation.push('ChildPlaylistDetail', {
                      playlistId: featuredPlaylist.id,
                      playlistName: featuredPlaylist.name,
                    })
                  }
                >
                  <Text style={styles.tvInfoBtnText}>ⓘ Voir les épisodes</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* ── Row 1 : Playlists pour Enfants (screenshot-tv-1.png) ── */}
          <View style={styles.tvSection}>
            <Text style={styles.tvSectionTitle}>Playlists pour Enfants</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tvHorizontalList}>
              {playlists.map(pl => {
                const theme = getPlaylistTheme(pl.name, pl.description)
                const firstThumb = pl.playlistVideos?.[0]?.video?.thumbnailUrl
                return (
                  <TouchableOpacity
                    key={pl.id}
                    style={styles.tvCard}
                    activeOpacity={0.85}
                    onPress={() =>
                      navigation.push('ChildPlaylistDetail', {
                        playlistId: pl.id,
                        playlistName: pl.name,
                      })
                    }
                  >
                    <View style={[styles.tvCardCover, { backgroundColor: theme.gradient[0] }]}>
                      {firstThumb ? (
                        <Image source={{ uri: firstThumb }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      ) : (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 44 }}>{theme.emoji}</Text>
                        </View>
                      )}
                      <View style={styles.tvCardTitleOverlay}>
                        <Text style={styles.tvCardTitle} numberOfLines={1}>{pl.name}</Text>
                        <Text style={{ color: '#38bdf8', fontSize: 11, fontWeight: '700', marginTop: 2 }}>
                          🎬 {pl._count.playlistVideos} épisodes
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>

          {/* ── Row 2 : À découvrir ce soir (1000017389.png) ── */}
          {discoverVideos.length > 0 && (
            <View style={styles.tvSection}>
              <Text style={styles.tvSectionTitle}>À découvrir ce soir 🌙</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tvHorizontalList}>
                {discoverVideos.map(({ video, playlistId, playlistName }) => (
                  <TouchableOpacity
                    key={video.id}
                    style={styles.tvCard}
                    activeOpacity={0.85}
                    onPress={() => navigation.push('Watch', { videoId: video.id, playlistId })}
                  >
                    <View style={styles.tvCardCover}>
                      {video.thumbnailUrl ? (
                        <Image source={{ uri: video.thumbnailUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      ) : (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e293b' }}>
                          <Text style={{ fontSize: 36 }}>🎬</Text>
                        </View>
                      )}
                      <View style={styles.tvCardTitleOverlay}>
                        <Text style={{ color: '#38bdf8', fontSize: 10, fontWeight: '700' }}>{playlistName}</Text>
                        <Text style={styles.tvCardTitle} numberOfLines={1}>{video.title}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Friendly Kid Top Bar */}
      <View style={styles.header}>
        <View style={styles.profileBox}>
          <View style={styles.avatar}>
            <Text style={styles.avatarEmoji}>👶</Text>
          </View>
          <View>
            <Text style={styles.helloText}>Coucou !</Text>
            <Text style={styles.profileName} numberOfLines={1}>{session?.displayName}</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {session && (
            <ChildCountdownTimer
              sessionLimitMin={session.sessionLimitMin}
              dailyLimitMin={session.dailyLimitMin}
              activatedAt={session.activatedAt}
              onExpire={() => {
                void sendLocalScreenTimeNotification(session.displayName)
                if (auth?.token && session.profileId) {
                  void api.users.notifySessionExpired(auth.token, session.profileId).catch(() => {})
                }
                Alert.alert('Temps écoulé ⏰', `La session de ${session.displayName} est terminée pour aujourd'hui.`, [
                  { text: 'OK', onPress: () => childCtx?.clear() },
                ])
              }}
            />
          )}

          {!Platform.isTV && (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => navigation.navigate('ProfileSelector', { unlockParent: true })}
              style={styles.parentBtn}
            >
              <Text style={styles.parentText}>🔒 Parent</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Pills for Kids */}
      <View style={styles.pillsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsScroll}>
          {FILTER_PILLS.map(pill => {
            const isActive = activeFilter === pill.id
            return (
              <TouchableOpacity
                key={pill.id}
                onPress={() => setActiveFilter(pill.id)}
                style={[styles.pill, isActive && styles.pillActive]}
                activeOpacity={0.8}
              >
                <Text style={styles.pillEmoji}>{pill.emoji}</Text>
                <Text style={[styles.pillLabel, isActive && styles.pillLabelActive]}>{pill.label}</Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      </View>

      {/* Main Channels List */}
      {loading ? (
        <View style={styles.loaderCenter}>
          <ActivityIndicator size="large" color="#1c90d8" />
          <Text style={styles.loadingText}>Chargement de tes vidéos... 🎈</Text>
        </View>
      ) : filteredPlaylists.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🎬</Text>
          <Text style={styles.emptyTitle}>Pas encore de vidéos ici !</Text>
          <Text style={styles.emptySub}>{"Demande à ton parent d'ajouter de chouettes playlists depuis son espace."}</Text>
          <TouchableOpacity onPress={() => setActiveFilter('all')} style={styles.resetFilterBtn}>
            <Text style={styles.resetFilterText}>Voir toutes les playlists ⭐</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredPlaylists}
          keyExtractor={pl => pl.id}
          contentContainerStyle={styles.list}
          onRefresh={load}
          refreshing={loading}
          renderItem={({ item: pl }) => {
            const theme = getPlaylistTheme(pl.name, pl.description)
            const firstThumb = pl.playlistVideos?.[0]?.video?.thumbnailUrl

            return (
              <TouchableOpacity
                style={styles.channelCard}
                activeOpacity={0.85}
                onPress={() => navigation.push('ChildPlaylistDetail', { playlistId: pl.id, playlistName: pl.name })}
              >
                {/* 16:9 Cover Thumbnail / Channel Header */}
                <View style={[styles.coverContainer, { backgroundColor: theme.gradient[0] }]}>
                  {firstThumb ? (
                    <Image source={{ uri: firstThumb }} style={styles.coverImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.coverFallback}>
                      <Text style={styles.fallbackEmoji}>{theme.emoji}</Text>
                      <Text style={styles.fallbackIllustration}>{theme.illustration}</Text>
                    </View>
                  )}

                  {/* Gradient shadow overlay for contrast */}
                  <View style={styles.coverOverlay} />

                  {/* Floating Channel Badge */}
                  <View style={styles.channelBadgePill}>
                    <Text style={styles.channelBadgeEmoji}>{theme.emoji}</Text>
                    <Text style={styles.channelBadgeText}>{theme.channelLabel}</Text>
                  </View>

                  {/* Video count pill */}
                  <View style={styles.videoCountPill}>
                    <Text style={styles.videoCountText}>
                      🎬 {pl._count.playlistVideos} vidéo{pl._count.playlistVideos !== 1 ? 's' : ''}
                    </Text>
                  </View>

                  {/* Big Play Button on Image */}
                  <View style={styles.centerPlayBtn}>
                    <View style={styles.playCircle}>
                      <Text style={styles.playArrow}>▶</Text>
                    </View>
                  </View>
                </View>

                {/* Card Bottom / Channel Title & Action */}
                <View style={styles.cardFooter}>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle} numberOfLines={2}>{pl.name}</Text>
                    {pl.description ? (
                      <Text style={styles.cardDesc} numberOfLines={1}>{pl.description}</Text>
                    ) : null}
                  </View>

                  <View style={styles.watchActionBtn}>
                    <Text style={styles.watchActionText}>Regarder</Text>
                    <Text style={styles.watchActionArrow}>›</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )
          }}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f0f9ff' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0f2fe',
    shadowColor: '#0284c7',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  profileBox: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#38bdf8',
  },
  avatarEmoji: { fontSize: 22 },
  helloText: { fontSize: 11, fontWeight: '700', color: '#0284c7', textTransform: 'uppercase', letterSpacing: 0.5 },
  profileName: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  parentBtn: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  parentText: { fontSize: 12, fontWeight: '800', color: '#475569' },

  // Category Pills
  pillsContainer: { paddingVertical: 10, backgroundColor: '#ffffff' },
  pillsScroll: { paddingHorizontal: 14, gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pillActive: {
    backgroundColor: '#1c90d8',
    borderColor: '#1c90d8',
    shadowColor: '#1c90d8',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pillEmoji: { fontSize: 15 },
  pillLabel: { fontSize: 13, fontWeight: '700', color: '#475569' },
  pillLabelActive: { color: '#ffffff' },

  // Content
  list: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 32, gap: 18 },
  channelCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e0f2fe',
  },
  coverContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverImage: { width: '100%', height: '100%' },
  coverOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.25)',
  },
  coverFallback: { alignItems: 'center', justifyContent: 'center' },
  fallbackEmoji: { fontSize: 56 },
  fallbackIllustration: { fontSize: 24, marginTop: 4 },

  // Badges floating
  channelBadgePill: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  channelBadgeEmoji: { fontSize: 14 },
  channelBadgeText: { fontSize: 11, fontWeight: '800', color: '#0f172a' },

  videoCountPill: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  videoCountText: { fontSize: 11, fontWeight: '700', color: '#ffffff' },

  // Center Play button
  centerPlayBtn: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  playArrow: { fontSize: 24, color: '#1c90d8', marginLeft: 4 },

  // Card Footer
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#ffffff',
  },
  cardInfo: { flex: 1, paddingRight: 12 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a', lineHeight: 22 },
  cardDesc: { fontSize: 12, color: '#64748b', marginTop: 4 },

  watchActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0f9ff',
    borderWidth: 1.5,
    borderColor: '#bae6fd',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  watchActionText: { fontSize: 13, fontWeight: '800', color: '#1c90d8' },
  watchActionArrow: { fontSize: 18, fontWeight: '800', color: '#1c90d8' },

  // Loader / Empty
  loaderCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  loadingText: { fontSize: 15, fontWeight: '700', color: '#64748b', marginTop: 12 },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 32, marginTop: 40 },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 19, fontWeight: '800', color: '#0f172a', textAlign: 'center' },
  emptySub: { fontSize: 13, color: '#64748b', textAlign: 'center', marginTop: 6, lineHeight: 18 },
  resetFilterBtn: {
    marginTop: 20,
    backgroundColor: '#1c90d8',
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  resetFilterText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },

  // TV Mode Specific Styles (Matching mockups)
  tvSafe: { flex: 1, backgroundColor: '#0b1120' },
  tvHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingVertical: 18,
    backgroundColor: '#070d18',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  tvNavTabs: { flexDirection: 'row', alignItems: 'center', gap: 12, marginLeft: 24 },
  tvNavTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: 'transparent' },
  tvNavTabActive: { backgroundColor: '#1c90d8' },
  tvNavTabText: { color: '#94a3b8', fontSize: 14, fontWeight: '800' },
  tvNavTabTextActive: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  tvProfileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tvHero: {
    margin: 24,
    padding: 28,
    borderRadius: 24,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  tvHeroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 12,
  },
  tvHeroBadgeText: { color: '#0f172a', fontWeight: '900', fontSize: 11, letterSpacing: 0.5 },
  tvHeroTitle: { fontSize: 32, fontWeight: '900', color: '#ffffff', marginBottom: 8 },
  tvHeroMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  tvHeroTag: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: 'rgba(56,189,248,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tvHeroDesc: { color: '#94a3b8', fontSize: 14, lineHeight: 20, marginBottom: 18, maxWidth: 600 },
  tvHeroActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  tvPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
  },
  tvPlayBtnText: { color: '#0f172a', fontSize: 16, fontWeight: '900' },
  tvInfoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: '#475569',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
  },
  tvInfoBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  tvSection: { marginBottom: 28, paddingHorizontal: 24 },
  tvSectionTitle: { fontSize: 22, fontWeight: '900', color: '#ffffff', marginBottom: 12 },
  tvHorizontalList: { gap: 18 },
  tvCard: { width: 280, borderRadius: 20, overflow: 'hidden', backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b' },
  tvCardCover: { width: '100%', aspectRatio: 16 / 9, position: 'relative' },
  tvCardTitleOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12, backgroundColor: 'rgba(5,10,20,0.85)' },
  tvCardTitle: { fontSize: 14, fontWeight: '800', color: '#ffffff' },
})
