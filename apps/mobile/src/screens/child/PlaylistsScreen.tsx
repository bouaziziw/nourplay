import React, { useContext, useEffect, useState, useCallback, useMemo } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Image, ScrollView,
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

          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => navigation.navigate('ProfileSelector', { unlockParent: true })}
            style={styles.parentBtn}
          >
            <Text style={styles.parentText}>🔒 Parent</Text>
          </TouchableOpacity>
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
          <Text style={styles.emptySub}>Demande à ton parent d'ajouter de chouettes playlists depuis son espace.</Text>
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
})
