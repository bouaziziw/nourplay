import React, { useContext, useEffect, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Image, Modal, TextInput, KeyboardAvoidingView, Platform, ImageBackground,
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

const AVATAR_COLORS = ['#0284c7', '#be185d', '#059669', '#d97706', '#4f46e5', '#0891b2']
const AVATAR_TEXT_COLORS = ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff']

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

        // En mode TV, activer le mode enfant par défaut dès le chargement initial si aucune session
        if (Platform.isTV && profs.length > 0 && childCtx && !childCtx.session) {
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
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Logo size="sm" dark={false} />
          {/* Mode parent : toujours accessible comme avant */}
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
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.title}>Qui regarde ? 🌈</Text>
          <Text style={styles.subtitle}>Touche ton prénom pour commencer !</Text>
        </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 64 }} size="large" color="#38bdf8" />
      ) : profiles.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Aucun profil enfant disponible.</Text>
          <Text style={styles.linkText}>Le parent peut créer un profil après avoir déverrouillé le Mode Parent.</Text>
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

      {/* Modal de déverrouillage Mode Parent */}
      <Modal visible={unlockVisible} transparent animationType="fade" onRequestClose={() => setUnlockVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Accès Parent</Text>
            <Text style={styles.modalSubtitle}>Entrez votre mot de passe pour accéder aux réglages parentaux.</Text>

            {unlockError ? <Text style={styles.errorText}>{unlockError}</Text> : null}

            <TextInput
              style={styles.input}
              value={parentPassword}
              onChangeText={setParentPassword}
              placeholder="Mot de passe du compte"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              autoCapitalize="none"
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setUnlockVisible(false)}>
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmBtn, (!parentPassword || unlocking) && styles.disabledBtn]}
                onPress={handleParentUnlock}
                disabled={!parentPassword || unlocking}
              >
                {unlocking ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Accéder</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  safe: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  parentModeButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#1c90d8',
    shadowColor: '#1c90d8',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  dashboardLink: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },
  titleBlock: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#1c90d8',
    fontWeight: '700',
    marginTop: 6,
  },
  grid: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  row: {
    gap: 16,
  },
  profileCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarImg: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '900',
  },
  profileName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 4,
  },
  profileAge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1c90d8',
    backgroundColor: 'rgba(28, 144, 216, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  logoutBtn: {
    alignSelf: 'center',
    marginBottom: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  logoutText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  linkText: {
    fontSize: 13,
    color: '#1c90d8',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 16,
    lineHeight: 18,
  },
  errorText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 14,
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cancelBtnText: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 13,
  },
  confirmBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#0284c7',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  confirmBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },
})
