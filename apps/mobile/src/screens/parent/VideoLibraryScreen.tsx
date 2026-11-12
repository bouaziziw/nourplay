import React, { useContext, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AuthContext } from '../../hooks/useAuth'
import { api, VideoSearchResult } from '../../api'
import { PlaylistPickerModal } from '../../components/PlaylistPickerModal'
import { ProfilePickerModal } from '../../components/ProfilePickerModal'

type ActionTarget = { id: string; title: string } | null

const AGE_COLORS: Record<string, string> = {
  ALL: '#d1fae5', G: '#d1fae5', PG: '#fef3c7', PG13: '#fed7aa', R: '#fecaca',
}

function fmtDuration(sec: number | null): string {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function VideoLibraryScreen() {
  const auth = useContext(AuthContext)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<VideoSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [actionTarget, setActionTarget] = useState<ActionTarget>(null)
  const [showActionModal, setShowActionModal] = useState(false)
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false)
  const [showProfilePicker, setShowProfilePicker] = useState(false)

  const handleSearch = async () => {
    if (!auth?.token) return
    setLoading(true)
    setSearched(true)
    try {
      const res = await api.videos.search(auth.token, { q: query || undefined, limit: 30 })
      setResults(res.items)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const openActions = (video: VideoSearchResult) => {
    setActionTarget({ id: video.id, title: video.title })
    setShowActionModal(true)
  }

  const pickPlaylist = () => {
    setShowActionModal(false)
    setShowPlaylistPicker(true)
  }

  const pickProfile = () => {
    setShowActionModal(false)
    setShowProfilePicker(true)
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Vidéothèque</Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="Rechercher une vidéo..."
          placeholderTextColor="#9ca3af"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} activeOpacity={0.8}>
          <Text style={styles.searchBtnText}>Chercher</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} size="large" color="#4f46e5" />
      ) : !searched ? (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Saisissez un terme et lancez la recherche.</Text>
        </View>
      ) : results.length === 0 ? (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Aucun résultat.</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={v => v.id}
          contentContainerStyle={styles.list}
          renderItem={({ item: v }) => (
            <View style={styles.card}>
              <View style={styles.thumb}>
                <Text style={styles.thumbIcon}>🎬</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.videoTitle} numberOfLines={2}>{v.title}</Text>
                <View style={styles.tags}>
                  <View style={[styles.tag, { backgroundColor: AGE_COLORS[v.ageRating] ?? '#f3f4f6' }]}>
                    <Text style={styles.tagText}>{v.ageRating}</Text>
                  </View>
                  {v.durationSec ? (
                    <Text style={styles.duration}>{fmtDuration(v.durationSec)}</Text>
                  ) : null}
                  {v.language ? (
                    <Text style={styles.lang}>{v.language.toUpperCase()}</Text>
                  ) : null}
                </View>
              </View>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => openActions(v)}
                activeOpacity={0.7}
              >
                <Text style={styles.addBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* Action modal */}
      <Modal visible={showActionModal} transparent animationType="fade" onRequestClose={() => setShowActionModal(false)}>
        <TouchableOpacity style={styles.actionBackdrop} activeOpacity={1} onPress={() => setShowActionModal(false)} />
        <View style={styles.actionSheet}>
          <View style={styles.handle} />
          <Text style={styles.actionTitle} numberOfLines={1}>{actionTarget?.title}</Text>
          <TouchableOpacity style={styles.actionItem} onPress={pickPlaylist} activeOpacity={0.7}>
            <Text style={styles.actionIcon}>📋</Text>
            <Text style={styles.actionLabel}>Ajouter à une playlist</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem} onPress={pickProfile} activeOpacity={0.7}>
            <Text style={styles.actionIcon}>♥</Text>
            <Text style={styles.actionLabel}>Ajouter aux favoris d&apos;un profil</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCancel} onPress={() => setShowActionModal(false)} activeOpacity={0.7}>
            <Text style={styles.actionCancelText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Playlist picker */}
      {actionTarget && (
        <PlaylistPickerModal
          visible={showPlaylistPicker}
          videoId={actionTarget.id}
          videoTitle={actionTarget.title}
          onClose={() => setShowPlaylistPicker(false)}
          onAdded={() => setShowPlaylistPicker(false)}
        />
      )}

      {/* Profile picker (favorites) */}
      {actionTarget && (
        <ProfilePickerModal
          visible={showProfilePicker}
          videoId={actionTarget.id}
          videoTitle={actionTarget.title}
          onClose={() => setShowProfilePicker(false)}
          onAdded={() => setShowProfilePicker(false)}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  searchRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  input: { flex: 1, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#111827', borderWidth: 1, borderColor: '#e5e7eb' },
  searchBtn: { backgroundColor: '#4f46e5', borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center' },
  searchBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  placeholderText: { fontSize: 14, color: '#9ca3af', textAlign: 'center' },
  list: { padding: 16, gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  thumb: { width: 52, height: 40, backgroundColor: '#eef2ff', borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  thumbIcon: { fontSize: 20 },
  info: { flex: 1 },
  videoTitle: { fontSize: 13, fontWeight: '600', color: '#111827', lineHeight: 18 },
  tags: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  tag: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  tagText: { fontSize: 10, fontWeight: '700', color: '#374151' },
  duration: { fontSize: 11, color: '#9ca3af' },
  lang: { fontSize: 11, color: '#9ca3af' },
  addBtn: { width: 32, height: 32, backgroundColor: '#4f46e5', borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  addBtnText: { color: '#fff', fontSize: 20, fontWeight: '300', lineHeight: 28 },
  actionBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  actionSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32 },
  handle: { width: 40, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 12 },
  actionTitle: { fontSize: 13, color: '#6b7280', paddingHorizontal: 20, marginBottom: 8 },
  actionItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  actionIcon: { fontSize: 20, marginRight: 14 },
  actionLabel: { fontSize: 15, color: '#111827', fontWeight: '500' },
  actionCancel: { marginHorizontal: 16, marginTop: 8, backgroundColor: '#f3f4f6', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  actionCancelText: { fontSize: 14, color: '#374151', fontWeight: '600' },
})
