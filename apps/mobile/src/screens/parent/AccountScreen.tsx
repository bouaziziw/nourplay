import React, { useContext, useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AuthContext } from '../../hooks/useAuth'
import { api } from '../../api'

interface UserInfo {
  id: string
  email: string
  role: string
  locale: string
  twoFactorEnabled: boolean
}

export default function AccountScreen() {
  const auth = useContext(AuthContext)
  const [user, setUser] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!auth?.token) return
    api.users.me(auth.token)
      .then(setUser)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [auth?.token])

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
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Mon compte</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.avatarWrap}>
          <Text style={styles.avatarText}>
            {user?.email?.slice(0, 2).toUpperCase() ?? '??'}
          </Text>
        </View>
        <Text style={styles.email}>{user?.email}</Text>
        <Text style={styles.role}>{user?.role?.toLowerCase()}</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Authentification à deux facteurs</Text>
          <View style={[styles.badge, user?.twoFactorEnabled ? styles.badgeOn : styles.badgeOff]}>
            <Text style={[styles.badgeText, user?.twoFactorEnabled ? styles.badgeTextOn : styles.badgeTextOff]}>
              {user?.twoFactorEnabled ? 'Activée' : 'Désactivée'}
            </Text>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Langue</Text>
          <Text style={styles.rowValue}>{user?.locale?.toUpperCase() ?? '—'}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={styles.logoutText}>Se déconnecter</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  card: { marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  avatarWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: 24, fontWeight: '800', color: '#4f46e5' },
  email: { fontSize: 15, fontWeight: '600', color: '#111827' },
  role: { fontSize: 12, color: '#9ca3af', marginTop: 2, textTransform: 'capitalize' },
  section: { marginHorizontal: 16, marginTop: 16, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  rowLabel: { fontSize: 14, color: '#374151' },
  rowValue: { fontSize: 14, color: '#6b7280' },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 16 },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeOn: { backgroundColor: '#d1fae5' },
  badgeOff: { backgroundColor: '#f3f4f6' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  badgeTextOn: { color: '#065f46' },
  badgeTextOff: { color: '#6b7280' },
  logoutBtn: { marginHorizontal: 16, marginTop: 24, backgroundColor: '#fef2f2', borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#fecaca' },
  logoutText: { fontSize: 14, color: '#ef4444', fontWeight: '700' },
})
