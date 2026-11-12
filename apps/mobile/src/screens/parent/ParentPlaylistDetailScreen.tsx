import React, { useContext, useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { AuthContext } from '../../hooks/useAuth'
import { api, PlaylistDetail } from '../../api'
import type { RootStackParamList } from '../../navigation/AppNavigator'

type Props = NativeStackScreenProps<RootStackParamList, 'ParentPlaylistDetail'>

function fmtDuration(sec: number | null): string {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function ParentPlaylistDetailScreen({ route }: Props) {
  const { playlistId, playlistName } = route.params
  const auth = useContext(AuthContext)
  const [detail, setDetail] = useState<PlaylistDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const pageSize = 6

  useEffect(() => {
    if (!auth?.token) return
    api.playlists.getById(auth.token, playlistId)
      .then(setDetail)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [auth?.token, playlistId])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    )
  }

  const videos = detail?.playlistVideos ?? []
  const pageCount = Math.ceil(videos.length / pageSize)
  const visibleVideos = videos.slice((page - 1) * pageSize, page * pageSize)

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.meta}>
        <Text style={styles.subtitle} numberOfLines={2}>{detail?.description ?? ''}</Text>
        <Text style={styles.count}>{videos.length} vidéo{videos.length !== 1 ? 's' : ''}</Text>
      </View>

      {videos.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Cette playlist est vide.</Text>
        </View>
      ) : (
        <FlatList
          data={visibleVideos}
          keyExtractor={pv => pv.id}
          contentContainerStyle={styles.list}
          numColumns={2}
          columnWrapperStyle={styles.row}
          ListFooterComponent={pageCount > 1 ? (
            <View style={styles.pagination}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ disabled: page === 1 }}
                disabled={page === 1}
                onPress={() => setPage(current => Math.max(1, current - 1))}
                style={[styles.pageButton, page === 1 && styles.pageButtonDisabled]}
              >
                <Text style={styles.pageButtonText}>Précédent</Text>
              </TouchableOpacity>
              <Text style={styles.pageLabel}>Page {page} / {pageCount}</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ disabled: page === pageCount }}
                disabled={page === pageCount}
                onPress={() => setPage(current => Math.min(pageCount, current + 1))}
                style={[styles.pageButton, page === pageCount && styles.pageButtonDisabled]}
              >
                <Text style={styles.pageButtonText}>Suivant</Text>
              </TouchableOpacity>
            </View>
          ) : undefined}
          renderItem={({ item: pv, index }) => (
            <View style={styles.card}>
              <View style={styles.thumb}>
                <Text style={styles.thumbNum}>{(page - 1) * pageSize + index + 1}</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.videoTitle} numberOfLines={2}>{pv.video.title}</Text>
                <Text style={styles.videoMeta}>
                  {pv.video.ageRating}
                  {pv.video.durationSec ? ` · ${fmtDuration(pv.video.durationSec)}` : ''}
                  {pv.video.language ? ` · ${pv.video.language.toUpperCase()}` : ''}
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  meta: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  subtitle: { fontSize: 13, color: '#6b7280' },
  count: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  list: { padding: 16 },
  row: { gap: 10, marginBottom: 10 },
  card: { flex: 1, minHeight: 104, justifyContent: 'center', alignItems: 'flex-start', backgroundColor: '#fff', borderRadius: 14, padding: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  thumb: { width: 48, height: 36, backgroundColor: '#eef2ff', borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  thumbNum: { fontSize: 15, fontWeight: '700', color: '#4f46e5' },
  info: { flex: 1 },
  videoTitle: { fontSize: 13, fontWeight: '600', color: '#111827' },
  videoMeta: { fontSize: 11, color: '#9ca3af', marginTop: 3 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 15, color: '#9ca3af' },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 12 },
  pageButton: { borderWidth: 1, borderColor: '#c7d2fe', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff' },
  pageButtonDisabled: { opacity: 0.4 },
  pageButtonText: { color: '#4f46e5', fontSize: 12, fontWeight: '700' },
  pageLabel: { color: '#6b7280', fontSize: 12 },
})
