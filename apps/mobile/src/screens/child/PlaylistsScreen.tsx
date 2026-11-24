import React, { useContext, useEffect, useMemo, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, Alert, ScrollView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { AuthContext } from '../../hooks/useAuth'
import { ChildSessionContext } from '../../hooks/useChildSession'
import { ChildCountdownTimer } from '../../components/ChildCountdownTimer'
import { api, PlaylistSummary } from '../../api'
import { sendLocalScreenTimeNotification } from '../../hooks/usePushNotifications'
import type { RootStackParamList } from '../../navigation/AppNavigator'
import { Logo } from '../../components/Logo'

type Props = NativeStackScreenProps<RootStackParamList, 'ChildPlaylists'>

// Maquette de référence : D:\DEV\nourplay\apps\mobile\assets\screenshot-tv-1.png
const MOCK_FALLBACK_CARDS = [
  { id: 'alphabet', name: "Apprendre l'Alphabet", color: '#0ea5e9' },
  { id: 'contes', name: "Contes & Sagesse", color: '#0284c7' },
  { id: 'sciences', name: "Découverte des Sciences", color: '#0369a1' },
  { id: 'chansons', name: "Chansons Douces", color: '#075985' },
]

export default function ChildPlaylistsScreen({ navigation }: Props) {
  const auth = useContext(AuthContext)
  const childCtx = useContext(ChildSessionContext)
  const session = childCtx?.session

  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!auth?.token) return
    api.playlists.list(auth.token)
      .then(setPlaylists)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [auth?.token])

  const isTV = Platform.isTV

  const featuredPlaylist = useMemo(() => {
    if (playlists.length === 0) return null
    return playlists.find(p => p.playlistVideos && p.playlistVideos.length > 0) || playlists[0]
  }, [playlists])

  const featuredFirstVideo = featuredPlaylist?.playlistVideos?.[0]?.video

  const featuredTitle = featuredPlaylist
    ? `Sélection du Jour : ${featuredPlaylist.name}`
    : "Sélection du Jour : Les Histoires Éducatives"

  const featuredDesc = featuredPlaylist?.description
    ? featuredPlaylist.description
    : "Contenu vérifié et validé sans risque pour les enfants. Durée adaptée et sans publicité."

  const handlePlayFeatured = () => {
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
  }

  // ── TV MODE DISPLAY (MATCHING screenshot-tv-1.png) ──
  if (isTV) {
    return (
      <View style={styles.tvContainer}>
        <SafeAreaView style={styles.tvSafe}>
          {/* ── TV Header : Logo, Accueil, Playlists, Profils Enfants, Timer, Mode Parent ── */}
          <View style={styles.tvHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
              <Logo size="md" dark={false} />
              <View style={styles.tvNavTabs}>
                <View style={[styles.tvNavTab, styles.tvNavTabActive]}>
                  <Text style={styles.tvNavTabTextActive}>Accueil</Text>
                </View>
                <TouchableOpacity
                  style={styles.tvNavTab}
                  activeOpacity={0.7}
                  onPress={() => {}}
                >
                  <Text style={styles.tvNavTabText}>Playlists</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.tvNavTab}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('ProfileSelector')}
                >
                  <Text style={styles.tvNavTabText}>Profils Enfants</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              {/* Timer conditionnel : affiché UNIQUEMENT si activé par le parent */}
              {session && (
                <ChildCountdownTimer
                  sessionLimitMin={session.sessionLimitMin}
                  dailyLimitMin={session.dailyLimitMin}
                  activatedAt={session.activatedAt}
                  onExpire={() => {
                    void sendLocalScreenTimeNotification(session.displayName)
                    Alert.alert('Temps écoulé ⏰', `La session de ${session.displayName} est terminée pour aujourd'hui.`, [
                      { text: 'OK', onPress: () => childCtx?.clear() },
                    ])
                  }}
                />
              )}

              {/* Mode Parent : accessible sur TV exactement comme avant */}
              <TouchableOpacity
                onPress={() => navigation.navigate('ProfileSelector', { unlockParent: true })}
                style={styles.tvParentBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.tvParentBtnText}>🔒 Mode Parent</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 36 }}>
            {/* ── TV Hero Banner : Matching screenshot-tv-1.png ── */}
            <View style={styles.tvHero}>
              <Text style={styles.tvHeroTitle} numberOfLines={2}>
                {featuredTitle}
              </Text>
              <Text style={styles.tvHeroDesc} numberOfLines={3}>
                {featuredDesc}
              </Text>

              <View style={styles.tvHeroActions}>
                <TouchableOpacity
                  style={styles.tvPlayBtn}
                  activeOpacity={0.85}
                  onPress={handlePlayFeatured}
                  hasTVPreferredFocus
                >
                  <Text style={styles.tvPlayBtnText}>▶ Lire la vidéo</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Section : Playlists pour Enfants (screenshot-tv-1.png) ── */}
            <View style={styles.tvSection}>
              <Text style={styles.tvSectionTitle}>Playlists pour Enfants</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tvHorizontalList}>
                {playlists.length > 0 ? (
                  playlists.map((pl, idx) => {
                    const firstThumb = pl.playlistVideos?.[0]?.video?.thumbnailUrl
                    const cardBg = MOCK_FALLBACK_CARDS[idx % MOCK_FALLBACK_CARDS.length].color

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
                        <View style={[styles.tvCardCover, { backgroundColor: cardBg }]}>
                          {firstThumb ? (
                            <Image source={{ uri: firstThumb }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                          ) : null}
                          <View style={styles.tvCardPlayCenter}>
                            <Text style={styles.tvPlayTriangleIcon}>▶</Text>
                          </View>
                        </View>
                        <View style={styles.tvCardTitleBox}>
                          <Text style={styles.tvCardTitle} numberOfLines={1}>{pl.name}</Text>
                        </View>
                      </TouchableOpacity>
                    )
                  })
                ) : (
                  MOCK_FALLBACK_CARDS.map((card) => (
                    <TouchableOpacity
                      key={card.id}
                      style={styles.tvCardWrapper}
                      activeOpacity={0.85}
                      onPress={() => {}}
                    >
                      <View style={[styles.tvCardCover, { backgroundColor: card.color }]}>
                        <View style={styles.tvCardPlayCenter}>
                          <Text style={styles.tvPlayTriangleIcon}>▶</Text>
                        </View>
                      </View>
                      <View style={styles.tvCardTitleBox}>
                        <Text style={styles.tvCardTitle} numberOfLines={1}>{card.name}</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    )
  }

  // ── MOBILE PHONE & TABLET DISPLAY (MATCHING screenshot-tv-1.png) ──
  return (
    <View style={styles.mobileContainer}>
      <SafeAreaView style={styles.safe}>
        {/* Friendly Kid Top Bar : Logo, Nav items, Timer, Mode Parent */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Logo size="sm" dark={false} />
            <View style={styles.mobileNavTabs}>
              <View style={[styles.mobileNavTab, styles.mobileNavTabActive]}>
                <Text style={styles.mobileNavTabTextActive}>Accueil</Text>
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate('ProfileSelector')}
                style={styles.mobileNavTab}
              >
                <Text style={styles.mobileNavTabText}>Profils</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.headerRight}>
            {/* Timer conditionnel : affiché UNIQUEMENT si activé par le parent */}
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

            {/* Mode Parent : toujours accessible et fonctionnel comme avant */}
            <TouchableOpacity
              onPress={() => navigation.navigate('ProfileSelector', { unlockParent: true })}
              style={styles.parentBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.parentBtnText}>🔒 Parent</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32, paddingHorizontal: 16 }}>
          {/* Mobile Hero Banner matching screenshot-tv-1.png */}
          <View style={styles.heroBanner}>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {featuredTitle}
            </Text>
            <Text style={styles.heroDesc} numberOfLines={3}>
              {featuredDesc}
            </Text>

            <View style={styles.heroActions}>
              <TouchableOpacity
                style={styles.heroPlayBtn}
                activeOpacity={0.85}
                onPress={handlePlayFeatured}
              >
                <Text style={styles.heroPlayBtnText}>▶ Lire la vidéo</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Section Playlists pour Enfants */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Playlists pour Enfants</Text>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#1c90d8" />
              <Text style={styles.loadingText}>Chargement des vidéos... 🎬</Text>
            </View>
          ) : playlists.length > 0 ? (
            <FlatList
              data={playlists}
              keyExtractor={pl => pl.id}
              numColumns={2}
              scrollEnabled={false}
              contentContainerStyle={styles.list}
              columnWrapperStyle={styles.row}
              renderItem={({ item: pl, index }) => {
                const firstThumb = pl.playlistVideos?.[0]?.video?.thumbnailUrl
                const cardBg = MOCK_FALLBACK_CARDS[index % MOCK_FALLBACK_CARDS.length].color

                return (
                  <TouchableOpacity
                    style={styles.card}
                    activeOpacity={0.85}
                    onPress={() =>
                      navigation.push('ChildPlaylistDetail', {
                        playlistId: pl.id,
                        playlistName: pl.name,
                      })
                    }
                  >
                    <View style={[styles.cardThumb, { backgroundColor: cardBg }]}>
                      {firstThumb ? (
                        <Image source={{ uri: firstThumb }} style={styles.cardImg} resizeMode="cover" />
                      ) : null}
                      <View style={styles.cardPlayBadge}>
                        <Text style={styles.cardPlayIcon}>▶</Text>
                      </View>
                    </View>
                    <View style={styles.cardBody}>
                      <Text style={styles.cardTitle} numberOfLines={2}>{pl.name}</Text>
                    </View>
                  </TouchableOpacity>
                )
              }}
            />
          ) : (
            <FlatList
              data={MOCK_FALLBACK_CARDS}
              keyExtractor={card => card.id}
              numColumns={2}
              scrollEnabled={false}
              contentContainerStyle={styles.list}
              columnWrapperStyle={styles.row}
              renderItem={({ item: card }) => (
                <View style={styles.card}>
                  <View style={[styles.cardThumb, { backgroundColor: card.color }]}>
                    <View style={styles.cardPlayBadge}>
                      <Text style={styles.cardPlayIcon}>▶</Text>
                    </View>
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle} numberOfLines={2}>{card.name}</Text>
                  </View>
                </View>
              )}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  // TV Styles
  tvContainer: { flex: 1, backgroundColor: '#ffffff' },
  tvSafe: { flex: 1, backgroundColor: '#ffffff' },
  tvHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 36,
    paddingVertical: 20,
    backgroundColor: '#ffffff',
  },
  tvNavTabs: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  tvNavTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  tvNavTabActive: { backgroundColor: '#0284c7' },
  tvNavTabTextActive: { color: '#ffffff', fontWeight: '800', fontSize: 16 },
  tvNavTabText: { color: '#000000', fontWeight: '700', fontSize: 16 },
  tvParentBtn: {
    backgroundColor: '#1c90d8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  tvParentBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
  tvHero: {
    backgroundColor: '#162d4a',
    borderRadius: 20,
    padding: 36,
    marginTop: 10,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 8,
  },
  tvHeroTitle: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  tvHeroDesc: {
    color: '#cbd5e1',
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 700,
    marginBottom: 24,
  },
  tvHeroActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  tvPlayBtn: {
    backgroundColor: '#fbbf24',
    paddingHorizontal: 26,
    paddingVertical: 14,
    borderRadius: 8,
  },
  tvPlayBtnText: {
    color: '#000000',
    fontWeight: '900',
    fontSize: 16,
  },
  tvSection: { marginBottom: 28 },
  tvSectionTitle: {
    color: '#000000',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 16,
  },
  tvHorizontalList: { gap: 20, paddingVertical: 4 },
  tvCardWrapper: { width: 260 },
  tvCardCover: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  tvCardPlayCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tvPlayTriangleIcon: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '900',
  },
  tvCardTitleBox: { marginTop: 8 },
  tvCardTitle: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
  },

  // Mobile Styles
  mobileContainer: { flex: 1, backgroundColor: '#ffffff' },
  safe: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    backgroundColor: '#ffffff',
  },
  mobileNavTabs: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 6 },
  mobileNavTab: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  mobileNavTabActive: { backgroundColor: '#0284c7' },
  mobileNavTabTextActive: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
  mobileNavTabText: { color: '#000000', fontWeight: '700', fontSize: 13 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  parentBtn: {
    backgroundColor: '#1c90d8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  parentBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 12 },
  heroBanner: {
    backgroundColor: '#162d4a',
    borderRadius: 16,
    padding: 20,
    marginTop: 14,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 8,
  },
  heroDesc: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  heroActions: { flexDirection: 'row' },
  heroPlayBtn: {
    backgroundColor: '#fbbf24',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  heroPlayBtnText: {
    color: '#000000',
    fontWeight: '800',
    fontSize: 14,
  },
  sectionHeader: { marginBottom: 12, marginTop: 8 },
  sectionTitle: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '800',
  },
  list: { paddingBottom: 16 },
  row: { justifyContent: 'space-between', marginBottom: 16 },
  card: { width: '48%' },
  cardThumb: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cardImg: { width: '100%', height: '100%' },
  cardPlayBadge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardPlayIcon: { color: '#ffffff', fontSize: 24, fontWeight: '900' },
  cardBody: { marginTop: 6 },
  cardTitle: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
  },
  center: { padding: 32, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#000000', fontWeight: '700', marginTop: 10 },
})
