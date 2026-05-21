import React, { useContext, useEffect, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { AuthContext } from '../../hooks/useAuth'
import { ChildSessionContext } from '../../hooks/useChildSession'
import { PinModal } from '../../components/PinModal'
import { api, ProfileSummary, PlaylistSummary } from '../../api'
import type { RootStackParamList } from '../../navigation/AppNavigator'

type Props = NativeStackScreenProps<RootStackParamList, 'ParentDashboard'>

const AGE_LABELS: Record<string, string> = {
  AGE_0_3: '0–3 ans', AGE_4_6: '4–6 ans', AGE_7_9: '7–9 ans',
  AGE_10_12: '10–12 ans', AGE_13_15: '13–15 ans',
}

export default function ParentDashboardScreen() {
  const auth = useContext(AuthContext)
  const childCtx = useContext(ChildSessionContext)

  const [profiles, setProfiles] = useState<ProfileSummary[]>([])
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ProfileSummary | null>(null)

  useEffect(() => {
    if (!auth?.token) return
    Promise.all([
      api.users.profiles(auth.token).then(setProfiles),
      api.playlists.list(auth.token).then(setPlaylists),
    ]).finally(() => setLoading(false))
  }, [auth?.token])

  const handlePinSubmit = async (pin: string) => {
    if (!auth?.token || !selected || !childCtx) return
    await api.users.verifyPin(auth.token, selected.id, pin)
    await childCtx.set({
      profileId: selected.id,
      displayName: selected.displayName,
      ageGroup: selected.ageGroup,
      dailyLimitMin: selected.dailyLimitMin,
      sessionLimitMin: selected.sessionLimitMin,
      viewingSchedule: selected.viewingSchedule,
    })
  }

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: () => auth?.logout() },
    ])
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* User info */}
        <View style={styles.userRow}>
          <View>
            <Text style={styles.userEmail}>{auth?.user?.email}</Text>
            <Text style={styles.userRole}>{auth?.user?.role?.toLowerCase()}</Text>
          </View>
          <TouchableOpacity onPress={handleLogout}>
            <Text style={styles.logoutText}>Déconnexion</Text>
          </TouchableOpacity>
        </View>

        {/* Child profiles */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profils enfants</Text>
          {profiles.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Aucun profil créé.</Text>
              <Text style={styles.emptyHint}>Créez des profils depuis l'interface web.</Text>
            </View>
          ) : (
            <View style={styles.profileGrid}>
              {profiles.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.profileCard}
                  onPress={() => setSelected(p)}
                  activeOpacity={0.7}
                >
                  <View style={styles.profileAvatar}>
                    <Text style={styles.profileAvatarText}>{p.displayName.slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.profileName} numberOfLines={1}>{p.displayName}</Text>
                  <Text style={styles.profileAge}>{AGE_LABELS[p.ageGroup] ?? p.ageGroup}</Text>
                  <View style={styles.launchBadge}>
                    <Text style={styles.launchText}>▶ Mode enfant</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Playlists */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Playlists</Text>
          {playlists.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Aucune playlist.</Text>
              <Text style={styles.emptyHint}>Créez des playlists depuis l'interface web.</Text>
            </View>
          ) : (
            playlists.map(pl => (
              <View key={pl.id} style={styles.playlistRow}>
                <View style={styles.playlistIcon}>
                  <Text style={{ fontSize: 18 }}>📋</Text>
                </View>
                <View style={styles.playlistInfo}>
                  <Text style={styles.playlistName} numberOfLines={1}>{pl.name}</Text>
                  <Text style={styles.playlistCount}>
                    {pl._count.playlistVideos} vidéo{pl._count.playlistVideos !== 1 ? 's' : ''}
                    {' · '}{pl.visibility.toLowerCase().replace('_', ' ')}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <PinModal
        visible={!!selected}
        profileName={selected?.displayName ?? ''}
        onSubmit={handlePinSubmit}
        onClose={() => setSelected(null)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, gap: 20, paddingBottom: 40 },
  userRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  userEmail: { fontSize: 14, fontWeight: '600', color: '#111827' },
  userRole: { fontSize: 12, color: '#9ca3af', marginTop: 2, textTransform: 'capitalize' },
  logoutText: { fontSize: 13, color: '#ef4444', fontWeight: '500' },
  section: {},
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginBottom: 12 },
  emptyCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 2, borderColor: '#f3f4f6', borderStyle: 'dashed' },
  emptyText: { fontSize: 14, color: '#9ca3af' },
  emptyHint: { fontSize: 12, color: '#d1d5db', marginTop: 4, textAlign: 'center' },
  profileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  profileCard: { width: '47%', backgroundColor: '#fff', borderRadius: 16, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  profileAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  profileAvatarText: { fontSize: 18, fontWeight: '800', color: '#4f46e5' },
  profileName: { fontSize: 13, fontWeight: '600', color: '#111827', textAlign: 'center' },
  profileAge: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  launchBadge: { marginTop: 8, backgroundColor: '#eef2ff', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  launchText: { fontSize: 11, color: '#4f46e5', fontWeight: '600' },
  playlistRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  playlistIcon: { width: 42, height: 42, backgroundColor: '#e0e7ff', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  playlistInfo: { flex: 1 },
  playlistName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  playlistCount: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
})
