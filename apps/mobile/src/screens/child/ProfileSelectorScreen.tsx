import React, { useContext, useEffect, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Image, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { AuthContext } from '../../hooks/useAuth'
import { ChildSessionContext } from '../../hooks/useChildSession'
import { PinModal } from '../../components/PinModal'
import { api, ProfileSummary } from '../../api'
import type { RootStackParamList } from '../../navigation/AppNavigator'
import { Logo } from '../../components/Logo'

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileSelector'>

const AGE_LABELS: Record<string, string> = {
  AGE_0_3: '0–3', AGE_4_6: '4–6', AGE_7_9: '7–9', AGE_10_12: '10–12', AGE_13_15: '13–15',
}

const AVATAR_COLORS = ['#def0fa', '#fce7f3', '#d1fae5', '#fef3c7', '#e0f2fe', '#c5e4f6']
const AVATAR_TEXT_COLORS = ['#1c90d8', '#be185d', '#065f46', '#92400e', '#0369a1', '#0e507f']

export default function ProfileSelectorScreen({ navigation, route }: Props) {
  const auth = useContext(AuthContext)
  const childCtx = useContext(ChildSessionContext)

  const [profiles, setProfiles] = useState<ProfileSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ProfileSummary | null>(null)
  const [unlockVisible, setUnlockVisible] = useState(false)
  const [parentPassword, setParentPassword] = useState('')
  const [unlockError, setUnlockError] = useState('')
  const [unlocking, setUnlocking] = useState(false)

  useEffect(() => {
    if (!auth?.token) return
    api.users.profiles(auth.token)
      .then(profs => {
        setProfiles(profs)

        // Requirement: En mode TV, activer le mode enfant par défaut dès le chargement
        if (Platform.isTV && profs.length > 0 && childCtx) {
          const auto = profs[0]
          void childCtx.set({
            profileId: auto.id,
            displayName: auto.displayName,
            ageGroup: auto.ageGroup,
            dailyLimitMin: auto.dailyLimitMin,
            sessionLimitMin: auto.sessionLimitMin,
            viewingSchedule: auto.viewingSchedule,
          })
          navigation.navigate('ChildPlaylists')
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [auth?.token, childCtx, navigation])

  useEffect(() => {
    if (route.params?.unlockParent) {
      setUnlockVisible(true)
      navigation.setParams({ unlockParent: undefined })
    }
  }, [route.params?.unlockParent, navigation])

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

  const handleParentUnlock = async () => {
    if (!auth || !parentPassword || unlocking) return
    setUnlockError('')
    setUnlocking(true)
    try {
      await auth.unlockParentMode(parentPassword)
      await childCtx?.clear()
      setUnlockVisible(false)
      setParentPassword('')
    } catch (error) {
      setUnlockError(error instanceof Error ? error.message : 'Mot de passe incorrect.')
      setParentPassword('')
    } finally {
      setUnlocking(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Logo size="sm" subtitle="Enfant" />
        {Platform.isTV && (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => {
              setUnlockError('')
              setUnlockVisible(true)
            }}
            style={styles.parentModeButton}
          >
            <Text style={styles.dashboardLink}>🔒 Mode Parent</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.title}>Qui regarde ? 🌈</Text>
        <Text style={styles.subtitle}>Touche ton prénom pour commencer !</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 64 }} size="large" color="#1c90d8" />
      ) : profiles.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Aucun profil enfant disponible.</Text>
          {Platform.isTV && (
            <Text style={styles.linkText}>Le parent peut créer un profil après avoir déverrouillé le Mode Parent.</Text>
          )}
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
                      accessibilityLabel={p.displayName}
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

      <Modal
        visible={unlockVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!unlocking) {
            setUnlockVisible(false)
            setParentPassword('')
          }
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.unlockCard}>
            <Text style={styles.unlockTitle}>Mode Parent</Text>
            <Text style={styles.unlockSubtitle}>
              Entrez le mot de passe de votre compte pour accéder aux paramètres.
            </Text>
            <TextInput
              style={styles.passwordInput}
              value={parentPassword}
              onChangeText={setParentPassword}
              placeholder="Mot de passe du compte"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              accessibilityLabel="Mot de passe du compte"
              editable={!unlocking}
            />
            {unlockError ? <Text accessibilityRole="alert" style={styles.unlockError}>{unlockError}</Text> : null}
            <TouchableOpacity
              style={[styles.unlockButton, (!parentPassword || unlocking) && styles.unlockButtonDisabled]}
              onPress={handleParentUnlock}
              disabled={!parentPassword || unlocking}
            >
              <Text style={styles.unlockButtonText}>{unlocking ? 'Vérification…' : 'Déverrouiller'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (!unlocking) {
                  setUnlockVisible(false)
                  setParentPassword('')
                }
              }}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0b1120' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 },
  appName: { fontSize: 18, fontWeight: '800', color: '#1c90d8' },
  dashboardLink: { fontSize: 13, color: '#38bdf8', fontWeight: '800' },
  parentModeButton: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.08)' },
  titleBlock: { alignItems: 'center', marginTop: 32, marginBottom: 24 },
  title: { fontSize: 26, fontWeight: '900', color: '#ffffff' },
  subtitle: { fontSize: 14, color: '#94a3b8', marginTop: 4 },
  grid: { paddingHorizontal: 16, paddingBottom: 24 },
  row: { justifyContent: 'space-between', marginBottom: 16 },
  profileCard: { width: '47%', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 3, borderWidth: 1, borderColor: '#1e293b' },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 10, overflow: 'hidden' },
  avatarImg: { width: 72, height: 72, borderRadius: 36 },
  avatarText: { fontSize: 22, fontWeight: '800' },
  profileName: { fontSize: 15, fontWeight: '800', color: '#ffffff', textAlign: 'center' },
  profileAge: { fontSize: 12, color: '#38bdf8', marginTop: 2, fontWeight: '700' },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 15, color: '#94a3b8', marginBottom: 16 },
  linkText: { fontSize: 14, color: '#38bdf8', fontWeight: '600', textAlign: 'center', maxWidth: 280 },
  logoutBtn: { alignItems: 'center', paddingVertical: 20 },
  logoutText: { fontSize: 13, color: '#64748b' },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.75)' },
  unlockCard: { width: '100%', maxWidth: 380, backgroundColor: '#0f172a', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#1e293b' },
  unlockTitle: { fontSize: 22, fontWeight: '800', color: '#ffffff', textAlign: 'center' },
  unlockSubtitle: { fontSize: 14, color: '#94a3b8', textAlign: 'center', marginTop: 8, marginBottom: 20, lineHeight: 20 },
  passwordInput: { height: 48, borderWidth: 1, borderColor: '#334155', borderRadius: 12, paddingHorizontal: 12, color: '#ffffff', backgroundColor: '#1e293b' },
  unlockError: { color: '#f87171', fontSize: 13, textAlign: 'center', marginTop: 10 },
  unlockButton: { height: 48, borderRadius: 12, backgroundColor: '#0284c7', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  unlockButtonDisabled: { opacity: 0.55 },
  unlockButtonText: { color: '#fff', fontWeight: '800' },
  cancelButton: { alignItems: 'center', padding: 12, marginTop: 4 },
  cancelText: { fontSize: 14, color: '#94a3b8' },
})
