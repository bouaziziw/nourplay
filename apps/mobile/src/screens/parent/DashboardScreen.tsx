import React, { useContext, useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, FlatList,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AuthContext } from '../../hooks/useAuth'
import { ChildSessionContext } from '../../hooks/useChildSession'
import { PinModal } from '../../components/PinModal'
import { api, ProfileSummary } from '../../api'

const AGE_LABELS: Record<string, string> = {
  AGE_0_3: '0–3 ans', AGE_4_6: '4–6 ans', AGE_7_9: '7–9 ans',
  AGE_10_12: '10–12 ans', AGE_13_15: '13–15 ans',
}

const AVATAR_COLORS = ['#ede9fe', '#fce7f3', '#d1fae5', '#fef3c7', '#e0f2fe', '#f3e8ff']
const AVATAR_TEXT = ['#7c3aed', '#be185d', '#065f46', '#92400e', '#0369a1', '#7e22ce']

export default function DashboardScreen() {
  const auth = useContext(AuthContext)
  const childCtx = useContext(ChildSessionContext)

  const [profiles, setProfiles] = useState<ProfileSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ProfileSummary | null>(null)

  useEffect(() => {
    if (!auth?.token) return
    api.users.profiles(auth.token)
      .then(setProfiles)
      .catch(() => {})
      .finally(() => setLoading(false))
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Profils enfants</Text>
        <Text style={styles.hint}>Appuyez pour lancer le mode enfant</Text>
      </View>

      {profiles.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Aucun profil créé.</Text>
          <Text style={styles.emptyHint}>Créez des profils depuis l'interface web.</Text>
        </View>
      ) : (
        <FlatList
          data={profiles}
          keyExtractor={p => p.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          renderItem={({ item: p, index }) => {
            const bg = AVATAR_COLORS[index % AVATAR_COLORS.length]
            const fg = AVATAR_TEXT[index % AVATAR_TEXT.length]
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => setSelected(p)}
                activeOpacity={0.7}
              >
                <View style={[styles.avatar, { backgroundColor: bg }]}>
                  <Text style={[styles.avatarText, { color: fg }]}>
                    {p.displayName.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.name} numberOfLines={1}>{p.displayName}</Text>
                <Text style={styles.age}>{AGE_LABELS[p.ageGroup] ?? p.ageGroup}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>▶ Mode enfant</Text>
                </View>
              </TouchableOpacity>
            )
          }}
        />
      )}

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
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  hint: { fontSize: 13, color: '#9ca3af', marginTop: 2 },
  grid: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8 },
  row: { justifyContent: 'space-between', marginBottom: 14 },
  card: { width: '47%', backgroundColor: '#fff', borderRadius: 18, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  avatarText: { fontSize: 20, fontWeight: '800' },
  name: { fontSize: 13, fontWeight: '600', color: '#111827', textAlign: 'center' },
  age: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  badge: { marginTop: 8, backgroundColor: '#eef2ff', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, color: '#4f46e5', fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 15, color: '#9ca3af' },
  emptyHint: { fontSize: 13, color: '#d1d5db', marginTop: 6, textAlign: 'center' },
})
