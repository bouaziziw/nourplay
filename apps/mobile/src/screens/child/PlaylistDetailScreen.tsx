import React, { useContext, useEffect, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { AuthContext } from '../../hooks/useAuth'
import { api, PlaylistVideo } from '../../api'
import type { RootStackParamList } from '../../navigation/AppNavigator'

type Props = NativeStackScreenProps<RootStackParamList, 'ChildPlaylistDetail'>

function formatDuration(sec: number | null): string {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  return m > 0 ? `${m}m` : `${sec}s`
}

export default function ChildPlaylistDetailScreen({ route, navigation }: Props) {
  const { playlistId, playlistName } = route.params
  const auth = useContext(AuthContext)

  const [videos, setVideos] = useState<PlaylistVideo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    navigation.setOptions({ title: playlistName })
  }, [playlistName, navigation])

  useEffect(() => {
    if (!auth?.token) return
    api.playlists.getById(auth.token, playlistId)
      .then(pl => setVideos([...pl.playlistVideos].sort((a, b) => a.position - b.position)))
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

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {videos.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🎬</Text>
          <Text style={styles.emptyText}>Aucune vidéo disponible pour le moment.</Text>
        </View>
      ) : (
        <FlatList
          data={videos}
          keyExtractor={pv => pv.video.id}
          contentContainerStyle={styles.list}
          numColumns={2}
          columnWrapperStyle={styles.row}
          renderItem={({ item: pv }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.75}
              onPress={() => navigation.push('Watch', { videoId: pv.video.id, playlistId })}
            >
              {/* Thumbnail */}
              <View style={styles.thumbWrapper}>
                {pv.video.thumbnailUrl ? (
                  <Image source={{ uri: pv.video.thumbnailUrl }} style={styles.thumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]}>
                    <Text style={{ fontSize: 28 }}>🎥</Text>
                  </View>
                )}
                <View style={styles.playOverlay}>
                  <View style={styles.playBtn}>
                    <Text style={styles.playBtnIcon}>▶</Text>
                  </View>
                </View>
                <View style={styles.positionBadge}>
                  <Text style={styles.positionText}>{pv.position}</Text>
                </View>
                {pv.video.durationSec ? (
                  <View style={styles.durationBadge}>
                    <Text style={styles.durationText}>{formatDuration(pv.video.durationSec)}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.info}>
                <Text style={styles.videoTitle} numberOfLines={2}>{pv.video.title}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#eef2ff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#6b7280' },
  list: { padding: 12, paddingBottom: 32 },
  row: { justifyContent: 'space-between', marginBottom: 12 },
  card: { width: '48%', backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  thumbWrapper: { width: '100%', aspectRatio: 16 / 9, position: 'relative' },
  thumb: { width: '100%', height: '100%' },
  thumbPlaceholder: { backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center' },
  playOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.15)' },
  playBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  playBtnIcon: { fontSize: 14, color: '#4f46e5', marginLeft: 2 },
  positionBadge: { position: 'absolute', top: 6, left: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center' },
  positionText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  durationBadge: { position: 'absolute', bottom: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  durationText: { fontSize: 10, color: '#fff', fontWeight: '600' },
  info: { padding: 10 },
  videoTitle: { fontSize: 12, fontWeight: '600', color: '#111827', lineHeight: 16 },
})
