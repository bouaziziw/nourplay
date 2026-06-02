import React, { useContext, useEffect, useState } from 'react'
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator,
} from 'react-native'
import { AuthContext } from '../hooks/useAuth'
import { api, PlaylistSummary } from '../api'

interface Props {
  visible: boolean
  videoId: string
  videoTitle: string
  onClose: () => void
  onAdded: () => void
}

export function PlaylistPickerModal({ visible, videoId, videoTitle, onClose, onAdded }: Props) {
  const auth = useContext(AuthContext)
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [added, setAdded] = useState<string | null>(null)

  useEffect(() => {
    if (!visible || !auth?.token) return
    setAdded(null)
    setLoading(true)
    api.playlists.list(auth.token)
      .then(setPlaylists)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [visible, auth?.token])

  const handleAdd = async (playlistId: string) => {
    if (!auth?.token) return
    setAdding(playlistId)
    try {
      await api.playlists.addVideo(auth.token, playlistId, videoId)
      setAdded(playlistId)
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
        <Text style={styles.title}>Ajouter à une playlist</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{videoTitle}</Text>

        {loading ? (
          <ActivityIndicator style={{ marginVertical: 32 }} color="#4f46e5" />
        ) : playlists.length === 0 ? (
          <Text style={styles.empty}>Aucune playlist disponible.</Text>
        ) : (
          <FlatList
            data={playlists}
            keyExtractor={pl => pl.id}
            style={styles.list}
            renderItem={({ item: pl }) => {
              const isAdded = added === pl.id
              const isAdding = adding === pl.id
              return (
                <TouchableOpacity
                  style={[styles.item, isAdded && styles.itemAdded]}
                  onPress={() => handleAdd(pl.id)}
                  disabled={!!adding || !!added}
                  activeOpacity={0.7}
                >
                  <View style={styles.itemIcon}>
                    <Text>📋</Text>
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={1}>{pl.name}</Text>
                    <Text style={styles.itemCount}>
                      {pl._count.playlistVideos} vidéo{pl._count.playlistVideos !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Text style={[styles.itemStatus, isAdded && styles.itemStatusAdded]}>
                    {isAdded ? '✓ Ajoutée' : isAdding ? '…' : ''}
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
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, borderRadius: 12 },
  itemAdded: { backgroundColor: '#f0fdf4' },
  itemIcon: { width: 36, height: 36, backgroundColor: '#eef2ff', borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  itemCount: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  itemStatus: { fontSize: 12, color: '#9ca3af' },
  itemStatusAdded: { color: '#16a34a', fontWeight: '600' },
})
