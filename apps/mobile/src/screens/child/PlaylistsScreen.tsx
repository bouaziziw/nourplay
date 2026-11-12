import React, { useContext, useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { AuthContext } from '../../hooks/useAuth'
import { ChildSessionContext, isWithinSchedule, sessionElapsedMin } from '../../hooks/useChildSession'
import { api, PlaylistSummary } from '../../api'
import type { RootStackParamList } from '../../navigation/AppNavigator'

type Props = NativeStackScreenProps<RootStackParamList, 'ChildPlaylists'>

export default function ChildPlaylistsScreen({ navigation }: Props) {
  const auth = useContext(AuthContext)
  const childCtx = useContext(ChildSessionContext)
  const { session } = childCtx ?? {}

  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([])
  const [loading, setLoading] = useState(true)

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
        childCtx.clear()
      }
    }, 60_000)
    return () => clearInterval(interval)
  }, [session, childCtx])

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

  const remaining = session?.sessionLimitMin
    ? Math.max(0, session.sessionLimitMin - sessionElapsedMin(session.activatedAt))
    : null

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{session?.displayName.slice(0, 2).toUpperCase()}</Text>
          </View>
          <Text style={styles.profileName}>{session?.displayName}</Text>
        </View>
        <View style={styles.headerRight}>
          {remaining !== null && (
            <Text style={styles.remaining}>{remaining} min</Text>
          )}
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={() => navigation.navigate('ProfileSelector', { unlockParent: true })}
              style={styles.parentBtn}
            >
              <Text style={styles.parentText}>Parent</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleExit} style={styles.exitBtn}>
              <Text style={styles.exitText}>Quitter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Text style={styles.pageTitle}>Mes playlists</Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 64 }} size="large" color="#4f46e5" />
      ) : playlists.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📚</Text>
          <Text style={styles.emptyText}>Aucune playlist disponible.</Text>
        </View>
      ) : (
        <FlatList
          data={playlists}
          keyExtractor={pl => pl.id}
          contentContainerStyle={styles.list}
          onRefresh={load}
          refreshing={loading}
          renderItem={({ item: pl }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => navigation.push('ChildPlaylistDetail', { playlistId: pl.id, playlistName: pl.name })}
            >
              <View style={styles.cardIcon}>
                <Text style={styles.cardIconText}>📋</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={1}>{pl.name}</Text>
                {pl.description ? (
                  <Text style={styles.cardDesc} numberOfLines={1}>{pl.description}</Text>
                ) : null}
                <Text style={styles.cardCount}>
                  {pl._count.playlistVideos} vidéo{pl._count.playlistVideos !== 1 ? 's' : ''}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#eef2ff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.8)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.5)' },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 12, fontWeight: '700', color: '#4f46e5' },
  profileName: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  parentBtn: { borderWidth: 1, borderColor: '#c7d2fe', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#eef2ff' },
  parentText: { fontSize: 12, color: '#4f46e5', fontWeight: '700' },
  remaining: { fontSize: 12, color: '#9ca3af' },
  exitBtn: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  exitText: { fontSize: 12, color: '#6b7280' },
  pageTitle: { fontSize: 22, fontWeight: '800', color: '#1e1b4b', marginHorizontal: 16, marginTop: 20, marginBottom: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardIcon: { width: 52, height: 52, backgroundColor: '#e0e7ff', borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  cardIconText: { fontSize: 24 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  cardDesc: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  cardCount: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  chevron: { fontSize: 24, color: '#d1d5db', marginLeft: 8 },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 15, color: '#6b7280' },
})
