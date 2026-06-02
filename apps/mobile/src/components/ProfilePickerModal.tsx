import React, { useContext, useEffect, useState } from 'react'
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator,
} from 'react-native'
import { AuthContext } from '../hooks/useAuth'
import { api, ProfileSummary } from '../api'

interface Props {
  visible: boolean
  videoId: string
  videoTitle: string
  onClose: () => void
  onAdded: () => void
}

const AGE_LABELS: Record<string, string> = {
  AGE_0_3: '0–3 ans', AGE_4_6: '4–6 ans', AGE_7_9: '7–9 ans',
  AGE_10_12: '10–12 ans', AGE_13_15: '13–15 ans',
}

const COLORS = ['#ede9fe', '#fce7f3', '#d1fae5', '#fef3c7', '#e0f2fe']
const TEXT_COLORS = ['#7c3aed', '#be185d', '#065f46', '#92400e', '#0369a1']

export function ProfilePickerModal({ visible, videoId, videoTitle, onClose, onAdded }: Props) {
  const auth = useContext(AuthContext)
  const [profiles, setProfiles] = useState<ProfileSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [added, setAdded] = useState<string | null>(null)

  useEffect(() => {
    if (!visible || !auth?.token) return
    setAdded(null)
    setLoading(true)
    api.users.profiles(auth.token)
      .then(setProfiles)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [visible, auth?.token])

  const handleAdd = async (profileId: string) => {
    if (!auth?.token) return
    setAdding(profileId)
    try {
      await api.favorites.add(auth.token, profileId, videoId)
      setAdded(profileId)
      setTimeout(() => { onAdded(); onClose() }, 1000)
    } catch {
      // ignore
    } finally {
      setAdding(null)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Ajouter aux favoris d'un profil</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{videoTitle}</Text>

        {loading ? (
          <ActivityIndicator style={{ marginVertical: 32 }} color="#ec4899" />
        ) : profiles.length === 0 ? (
          <Text style={styles.empty}>Aucun profil enfant.</Text>
        ) : (
          <FlatList
            data={profiles}
            keyExtractor={p => p.id}
            style={styles.list}
            renderItem={({ item: p, index }) => {
              const isAdded = added === p.id
              const isAdding = adding === p.id
              const bg = COLORS[index % COLORS.length]
              const fg = TEXT_COLORS[index % TEXT_COLORS.length]
              return (
                <TouchableOpacity
                  style={[styles.item, isAdded && styles.itemAdded]}
                  onPress={() => handleAdd(p.id)}
                  disabled={!!adding || !!added}
                  activeOpacity={0.7}
                >
                  <View style={[styles.avatar, { backgroundColor: bg }]}>
                    <Text style={[styles.avatarText, { color: fg }]}>
                      {p.displayName.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={1}>{p.displayName}</Text>
                    <Text style={styles.itemAge}>{AGE_LABELS[p.ageGroup] ?? p.ageGroup}</Text>
                  </View>
                  <Text style={[styles.itemStatus, isAdded && styles.itemStatusAdded]}>
                    {isAdded ? '♥ Ajouté' : isAdding ? '…' : ''}
                  </Text>
                </TouchableOpacity>
              )
            }}
          />
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32, maxHeight: '60%' },
  handle: { width: 40, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 16 },
  title: { fontSize: 16, fontWeight: '700', color: '#111827', paddingHorizontal: 20 },
  subtitle: { fontSize: 13, color: '#9ca3af', paddingHorizontal: 20, marginTop: 4, marginBottom: 12 },
  empty: { fontSize: 14, color: '#9ca3af', textAlign: 'center', paddingVertical: 24 },
  list: { paddingHorizontal: 16 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, borderRadius: 12 },
  itemAdded: { backgroundColor: '#fdf2f8' },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { fontSize: 14, fontWeight: '800' },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  itemAge: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  itemStatus: { fontSize: 12, color: '#9ca3af' },
  itemStatusAdded: { color: '#db2777', fontWeight: '600' },
})
