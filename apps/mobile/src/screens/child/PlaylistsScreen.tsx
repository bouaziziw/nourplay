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

  // ── TV MODE DISPLAY (MATCHING screenshot-tv-1.png & 1000017388.png) ──
  if (isTV) {
    return (
      <SafeAreaView style={styles.tvSafe}>
        {/* ── TV Header (Directly matching screenshot-tv-1.png) ── */}
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

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={styles.tvProfileBadge}>
              <View style={styles.avatar}>
                <Text style={styles.avatarEmoji}>👶</Text>
              </View>
              <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 14 }}>
                {session?.displayName}
              </Text>
            </View>

            {/* Mode Parent: available on TV */}
            <TouchableOpacity
              onPress={() => navigation.navigate('ProfileSelector', { unlockParent: true })}
              style={styles.tvParentBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.tvParentBtnText}>🔒 Mode Parent</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* ── TV Hero Banner : Sélection du Jour (Directly matching screenshot-tv-1.png & 1000017388.png) ── */}
          <View style={styles.tvHero}>
            <Text style={styles.tvHeroTitle} numberOfLines={2}>
              {featuredPlaylist?.name
                ? `Sélection du Jour : ${featuredPlaylist.name}`
                : 'Sélection du Jour : Les Histoires Éducatives'}
            </Text>
            <Text style={styles.tvHeroDesc} numberOfLines={3}>
              {featuredPlaylist?.description ||
                'Contenu vérifié et validé sans risque pour les enfants. Durée adaptée et sans publicité.'}
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
                  <Text style={styles.tvInfoBtnText}>ⓘ Plus d'infos</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* ── Row 1 : Playlists pour Enfants (Directly matching screenshot-tv-1.png) ── */}
          <View style={styles.tvSection}>
            <Text style={styles.tvSectionTitle}>Playlists pour Enfants</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tvHorizontalList}>
              {playlists.map(pl => {
                const theme = getPlaylistTheme(pl.name, pl.description)
                const firstThumb = pl.playlistVideos?.[0]?.video?.thumbnailUrl
                return (
                  <TouchableOpacity
                    key={pl.id}
                    style={styles.tvCardWrapper}
                    activeOpacity={0.85}
                    onPress={() =>
                      navigation.push('ChildPlaylistDetail', {
                        playlistId: pl.id,
                        playlistName: pl.name,
                      })
                    }
                  >
                    {/* 16:9 Blue / Thumbnail Card (exact match to screenshot-tv-1.png) */}
                    <View style={[styles.tvCardCover, { backgroundColor: theme.gradient[0] || '#0284c7' }]}>
                      {firstThumb ? (
                        <Image source={{ uri: firstThumb }} style={{ width: '100%', height: '100%', opacity: 0.85 }} resizeMode="cover" />
                      ) : null}

                      {/* Centered White Play Triangle */}
                      <View style={styles.tvCardPlayCenter}>
                        <View style={styles.tvPlayTriangleCircle}>
                          <Text style={styles.tvPlayTriangleIcon}>▶</Text>
                        </View>
                      </View>
                    </View>

                    {/* Title BELOW the card (exact match to screenshot-tv-1.png) */}
                    <View style={styles.tvCardTitleBox}>
                      <Text style={styles.tvCardTitle} numberOfLines={1}>{pl.name}</Text>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>

          {/* ── Row 2 : Tout votre divertissement (1000017388.png) ── */}
          <View style={styles.tvSection}>
            <Text style={styles.tvSectionTitle}>Tout votre divertissement</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tvHorizontalList}>
              {FILTER_PILLS.map((pill, idx) => {
                const isActive = activeFilter === pill.id
                return (
                  <TouchableOpacity
                    key={pill.id}
                    onPress={() => setActiveFilter(pill.id)}
                    style={[
                      styles.tvFilterPill,
                      isActive && (idx === 0 ? styles.tvFilterPillActiveRed : styles.tvFilterPillActiveBlue),
                    ]}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.tvFilterPillEmoji}>{pill.emoji}</Text>
                    <Text style={[styles.tvFilterPillText, isActive && styles.tvFilterPillTextActive]}>
                      {pill.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>

          {/* ── Row 3 : À découvrir ce soir (1000017389.png) ── */}
          {discoverVideos.length > 0 && (
            <View style={styles.tvSection}>
              <Text style={styles.tvSectionTitle}>À découvrir ce soir 🌙</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tvHorizontalList}>
                {discoverVideos.map(({ video, playlistId, playlistName }) => (
                  <TouchableOpacity
                    key={video.id}
                    style={styles.tvDiscoverCard}
                    activeOpacity={0.85}
                    onPress={() => navigation.push('Watch', { videoId: video.id, playlistId })}
                  >
                    <View style={styles.tvDiscoverCover}>
                      {video.thumbnailUrl ? (
                        <Image source={{ uri: video.thumbnailUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      ) : (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e293b' }}>
                          <Text style={{ fontSize: 36 }}>🎬</Text>
                        </View>
                      )}
                      <View style={styles.tvCardTitleOverlay}>
                        <Text style={{ color: '#38bdf8', fontSize: 10, fontWeight: '800' }}>{playlistName}</Text>
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

  // ── MOBILE PHONE & TABLET DISPLAY (MATCHING MOCKUPS, NO MODE PARENT) ──
  return (
    <SafeAreaView style={styles.safe}>
      {/* Friendly Kid Top Bar (NO Mode Parent button) */}
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
          {/* NOTE: Mode Parent is completely REMOVED on Mobile as requested in Requirement 3 */}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Mobile Hero Banner : Sélection du Jour (screenshot-tv-1.png & 1000017388.png) */}
        <View style={styles.mobileHero}>
          <Text style={styles.mobileHeroTitle} numberOfLines={2}>
            {featuredPlaylist?.name
              ? `Sélection du Jour : ${featuredPlaylist.name}`
              : 'Sélection du Jour : Les Histoires Éducatives'}
          </Text>
          <Text style={styles.mobileHeroDesc} numberOfLines={3}>
            {featuredPlaylist?.description ||
              'Contenu vérifié et validé sans risque pour les enfants. Durée adaptée et sans publicité.'}
          </Text>
          <TouchableOpacity
            style={styles.mobilePlayBtn}
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
            <Text style={styles.mobilePlayBtnText}>▶ Lire la vidéo</Text>
          </TouchableOpacity>
        </View>

        {/* Category Pills (1000017388.png) */}
        <View style={styles.pillsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsScroll}>
            {FILTER_PILLS.map((pill, idx) => {
              const isActive = activeFilter === pill.id
              return (
                <TouchableOpacity
                  key={pill.id}
                  onPress={() => setActiveFilter(pill.id)}
                  style={[
                    styles.pill,
                    isActive && (idx === 0 ? styles.pillActiveRed : styles.pillActiveBlue),
                  ]}
                  activeOpacity={0.8}
                >
                  <Text style={styles.pillEmoji}>{pill.emoji}</Text>
                  <Text style={[styles.pillLabel, isActive && styles.pillLabelActive]}>{pill.label}</Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>

        {/* Playlists pour Enfants Section (screenshot-tv-1.png) */}
        <View style={styles.mobileSection}>
          <Text style={styles.mobileSectionTitle}>Playlists pour Enfants</Text>
          {loading ? (
            <View style={styles.loaderCenter}>
              <ActivityIndicator size="large" color="#1c90d8" />
              <Text style={styles.loadingText}>Chargement de tes vidéos... 🎈</Text>
            </View>
          ) : filteredPlaylists.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🎬</Text>
              <Text style={styles.emptyTitle}>Pas encore de vidéos ici !</Text>
              <TouchableOpacity onPress={() => setActiveFilter('all')} style={styles.resetFilterBtn}>
                <Text style={styles.resetFilterText}>Voir toutes les playlists ⭐</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.mobileGrid}>
              {filteredPlaylists.map(pl => {
                const theme = getPlaylistTheme(pl.name, pl.description)
                const firstThumb = pl.playlistVideos?.[0]?.video?.thumbnailUrl

                return (
                  <TouchableOpacity
                    key={pl.id}
                    style={styles.mobileCard}
                    activeOpacity={0.85}
                    onPress={() => navigation.push('ChildPlaylistDetail', { playlistId: pl.id, playlistName: pl.name })}
                  >
                    {/* 16:9 Cover Thumbnail matching screenshot-tv-1.png */}
                    <View style={[styles.coverContainer, { backgroundColor: theme.gradient[0] || '#0284c7' }]}>
                      {firstThumb ? (
                        <Image source={{ uri: firstThumb }} style={styles.coverImage} resizeMode="cover" />
                      ) : null}

                      {/* Centered White Play Triangle */}
                      <View style={styles.centerPlayBtn}>
                        <View style={styles.playCircle}>
                          <Text style={styles.playArrow}>▶</Text>
                        </View>
                      </View>

                      {/* Video count badge */}
                      <View style={styles.videoCountPill}>
                        <Text style={styles.videoCountText}>
                          🎬 {pl._count.playlistVideos}
                        </Text>
                      </View>
                    </View>

                    {/* Card Title BELOW the card (matching screenshot-tv-1.png) */}
                    <View style={styles.mobileCardTitleBox}>
                      <Text style={styles.mobileCardTitle} numberOfLines={1}>{pl.name}</Text>
                      <Text style={styles.mobileCardEpCount}>🎬 {pl._count.playlistVideos} épisodes</Text>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}
        </View>

        {/* À découvrir ce soir Section (1000017389.png) */}
        {discoverVideos.length > 0 && activeFilter === 'all' && (
          <View style={styles.mobileSection}>
            <Text style={styles.mobileSectionTitle}>À découvrir ce soir 🌙</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mobileDiscoverScroll}>
              {discoverVideos.map(({ video, playlistId, playlistName }) => (
                <TouchableOpacity
                  key={video.id}
                  style={styles.mobileDiscoverCard}
                  activeOpacity={0.85}
                  onPress={() => navigation.push('Watch', { videoId: video.id, playlistId })}
                >
                  <View style={styles.mobileDiscoverThumb}>
                    {video.thumbnailUrl ? (
                      <Image source={{ uri: video.thumbnailUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : (
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e293b' }}>
                        <Text style={{ fontSize: 24 }}>🎬</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.mobileDiscoverInfo}>
                    <Text style={styles.mobileDiscoverTag}>{playlistName}</Text>
                    <Text style={styles.mobileDiscoverTitle} numberOfLines={1}>{video.title}</Text>
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0b1120' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#070d18',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  profileBox: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 20 },
  helloText: { fontSize: 10, fontWeight: '800', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: 0.5 },
  profileName: { fontSize: 15, fontWeight: '900', color: '#ffffff' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  // Mobile Hero Banner (matching screenshot-tv-1.png & 1000017388.png)
  mobileHero: {
    margin: 16,
    padding: 20,
    borderRadius: 24,
    backgroundColor: '#16325c',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  mobileHeroTitle: { fontSize: 22, fontWeight: '900', color: '#ffffff', marginBottom: 8, lineHeight: 28 },
  mobileHeroDesc: { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 18, marginBottom: 16 },
  mobilePlayBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignSelf: 'flex-start',
  },
  mobilePlayBtnText: { color: '#0f172a', fontWeight: '900', fontSize: 15 },

  // Category Pills (1000017388.png)
  pillsContainer: { paddingVertical: 8, backgroundColor: 'transparent' },
  pillsScroll: { paddingHorizontal: 16, gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  pillActiveRed: {
    backgroundColor: '#e50914',
    borderColor: '#e50914',
  },
  pillActiveBlue: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  pillEmoji: { fontSize: 14 },
  pillLabel: { fontSize: 13, fontWeight: '800', color: '#94a3b8' },
  pillLabelActive: { color: '#ffffff' },

  // Mobile Sections
  mobileSection: { marginTop: 18, paddingHorizontal: 16 },
  mobileSectionTitle: { fontSize: 20, fontWeight: '900', color: '#ffffff', marginBottom: 12 },
  mobileGrid: { gap: 16 },
  mobileCard: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  mobileCardTitleBox: { paddingTop: 8, paddingHorizontal: 2 },
  mobileCardTitle: { fontSize: 16, fontWeight: '800', color: '#ffffff' },
  mobileCardEpCount: { fontSize: 12, fontWeight: '700', color: '#38bdf8', marginTop: 2 },

  coverContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverImage: { width: '100%', height: '100%', opacity: 0.85 },
  videoCountPill: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  videoCountText: { fontSize: 10, fontWeight: '800', color: '#ffffff' },
  centerPlayBtn: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playArrow: { fontSize: 18, color: '#ffffff', marginLeft: 2 },

  // Mobile Discover
  mobileDiscoverScroll: { gap: 14 },
  mobileDiscoverCard: {
    width: 220,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  mobileDiscoverThumb: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#1e293b' },
  mobileDiscoverInfo: { padding: 10 },
  mobileDiscoverTag: { fontSize: 10, fontWeight: '800', color: '#38bdf8', marginBottom: 2 },
  mobileDiscoverTitle: { fontSize: 13, fontWeight: '800', color: '#ffffff' },

  // Loader / Empty
  loaderCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  loadingText: { fontSize: 14, fontWeight: '700', color: '#94a3b8', marginTop: 12 },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#0f172a', borderRadius: 20 },
  emptyEmoji: { fontSize: 44, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#ffffff' },
  resetFilterBtn: { marginTop: 14, backgroundColor: '#0284c7', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10 },
  resetFilterText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },

  // TV Mode Specific Styles (Directly matching screenshot-tv-1.png & 1000017388.png)
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
  tvNavTabActive: { backgroundColor: '#0284c7' },
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
  tvParentBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tvParentBtnText: { color: '#38bdf8', fontSize: 13, fontWeight: '800' },
  tvHero: {
    margin: 24,
    padding: 28,
    borderRadius: 24,
    backgroundColor: '#16325c',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  tvHeroTitle: { fontSize: 32, fontWeight: '900', color: '#ffffff', marginBottom: 8 },
  tvHeroDesc: { color: '#cbd5e1', fontSize: 14, lineHeight: 20, marginBottom: 18, maxWidth: 650 },
  tvHeroActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  tvPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  tvPlayBtnText: { color: '#0f172a', fontSize: 16, fontWeight: '900' },
  tvInfoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(35, 53, 77, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
  },
  tvInfoBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  tvSection: { marginBottom: 28, paddingHorizontal: 24 },
  tvSectionTitle: { fontSize: 22, fontWeight: '900', color: '#ffffff', marginBottom: 12 },
  tvHorizontalList: { gap: 18 },
  tvCardWrapper: { width: 280 },
  tvCardCover: {
    width: '100%',
    aspectRatio: 16 / 9,
    position: 'relative',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tvCardPlayCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tvPlayTriangleCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tvPlayTriangleIcon: { fontSize: 18, color: '#ffffff', marginLeft: 2 },
  tvCardTitleBox: { paddingTop: 10, paddingHorizontal: 2 },
  tvCardTitle: { fontSize: 15, fontWeight: '800', color: '#ffffff' },
  tvFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tvFilterPillActiveRed: { backgroundColor: '#e50914', borderColor: '#e50914' },
  tvFilterPillActiveBlue: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
  tvFilterPillEmoji: { fontSize: 16 },
  tvFilterPillText: { fontSize: 14, fontWeight: '800', color: '#cbd5e1' },
  tvFilterPillTextActive: { color: '#ffffff' },
  tvDiscoverCard: { width: 260, borderRadius: 18, overflow: 'hidden', backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b' },
  tvDiscoverCover: { width: '100%', aspectRatio: 16 / 9, position: 'relative' },
  tvCardTitleOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12, backgroundColor: 'rgba(5,10,20,0.85)' },
})
