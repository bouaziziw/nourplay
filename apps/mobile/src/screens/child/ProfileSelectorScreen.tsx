import React, { useContext, useEffect, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { AuthContext } from '../../hooks/useAuth'
import { ChildSessionContext } from '../../hooks/useChildSession'
import { PinModal } from '../../components/PinModal'
import { api, ProfileSummary } from '../../api'
import type { RootStackParamList } from '../../navigation/AppNavigator'

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileSelector'>

const AGE_LABELS: Record<string, string> = {
  AGE_0_3: '0–3', AGE_4_6: '4–6', AGE_7_9: '7–9', AGE_10_12: '10–12', AGE_13_15: '13–15',
}

const AVATAR_COLORS = ['#ede9fe', '#fce7f3', '#d1fae5', '#fef3c7', '#e0f2fe', '#f3e8ff']
const AVATAR_TEXT_COLORS = ['#7c3aed', '#be185d', '#065f46', '#92400e', '#0369a1', '#7e22ce']

export default function ProfileSelectorScreen({ navigation }: Props) {
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

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: () => auth?.logout() },
    ])
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.appName}>NourPlay</Text>
        <TouchableOpacity onPress={() => navigation.navigate('ParentTabs')}>
          <Text style={styles.dashboardLink}>Tableau de bord</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.title}>Qui regarde ?</Text>
        <Text style={styles.subtitle}>Choisissez votre profil pour commencer</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 64 }} size="large" color="#4f46e5" />
      ) : profiles.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Aucun profil enfant disponible.</Text>
          <TouchableOpacity onPress={() => navigation.navigate('ParentTabs')}>
            <Text style={styles.linkText}>Créer un profil →</Text>
          </TouchableOpacity>
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
            const fg = AVATAR_TEXT_COLORS[index % AVATAR_TEXT_COLORS.length]
            return (
              <TouchableOpacity style={styles.profileCard} onPress={() => setSelected(p)} activeOpacity={0.7}>
                <View style={[styles.avatar, { backgroundColor: bg }]}>
                  {p.avatarKey && process.env.EXPO_PUBLIC_S3_PUBLIC_URL ? (
                    <Image
                      source={{ uri: `${process.env.EXPO_PUBLIC_S3_PUBLIC_URL}/${p.avatarKey}` }}
                      style={styles.avatarImg}
                    />
                  ) : (
                    <Text style={[styles.avatarText, { color: fg }]}>
                      {p.displayName.slice(0, 2).toUpperCase()}
                    </Text>
                  )}
                </View>
                <Text style={styles.profileName} numberOfLines={1}>{p.displayName}</Text>
                <Text style={styles.profileAge}>{AGE_LABELS[p.ageGroup] ?? p.ageGroup} ans</Text>
              </TouchableOpacity>
            )
          }}
        />
      )}

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Se déconnecter</Text>
      </TouchableOpacity>

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
  safe: { flex: 1, backgroundColor: '#eef2ff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 },
  appName: { fontSize: 18, fontWeight: '800', color: '#4f46e5' },
  dashboardLink: { fontSize: 13, color: '#4f46e5', fontWeight: '500' },
  titleBlock: { alignItems: 'center', marginTop: 32, marginBottom: 24 },
  title: { fontSize: 26, fontWeight: '800', color: '#1e1b4b' },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  grid: { paddingHorizontal: 16, paddingBottom: 24 },
  row: { justifyContent: 'space-between', marginBottom: 16 },
  profileCard: { width: '47%', alignItems: 'center', backgroundColor: '#fff', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 10, overflow: 'hidden' },
  avatarImg: { width: 72, height: 72, borderRadius: 36 },
  avatarText: { fontSize: 22, fontWeight: '800' },
  profileName: { fontSize: 14, fontWeight: '600', color: '#111827', textAlign: 'center' },
  profileAge: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 15, color: '#6b7280', marginBottom: 16 },
  linkText: { fontSize: 14, color: '#4f46e5', fontWeight: '600' },
  logoutBtn: { alignItems: 'center', paddingVertical: 20 },
  logoutText: { fontSize: 13, color: '#9ca3af' },
})
