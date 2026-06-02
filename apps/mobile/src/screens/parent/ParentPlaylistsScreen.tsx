import React, { useContext, useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { AuthContext } from '../../hooks/useAuth'
import { api, PlaylistSummary } from '../../api'
import type { RootStackParamList } from '../../navigation/AppNavigator'

type Nav = NativeStackNavigationProp<RootStackParamList>

export default function ParentPlaylistsScreen() {
  const auth = useContext(AuthContext)
  const navigation = useNavigation<Nav>()
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!auth?.token) return
    api.playlists.list(auth.token)
      .then(setPlaylists)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [auth?.token])

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
        <Text style={styles.title}>Playlists</Text>
        <Text style={styles.count}>{playlists.length} playlist{playlists.length !== 1 ? 's' : ''}</Text>
      </View>

      {playlists.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Aucune playlist.</Text>
          <Text style={styles.emptyHint}>Créez des playlists depuis l'interface web.</Text>
        </View>
      ) : (
        <FlatList
          data={playlists}
          keyExtractor={pl => pl.id}
          contentContainerStyle={styles.list}
          renderItem={({ item: pl }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('ParentPlaylistDetail', { playlistId: pl.id, playlistName: pl.name })}
            >
              <View style={styles.icon}>
                <Text style={{ fontSize: 22 }}>📋</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>{pl.name}</Text>
                {pl.description ? (
                  <Text style={styles.desc} numberOfLines={1}>{pl.description}</Text>
                ) : null}
                <Text style={styles.meta}>
                  {pl._count.playlistVideos} vidéo{pl._count.playlistVideos !== 1 ? 's' : ''}
                  {' · '}{pl.visibility === 'PUBLIC' ? 'Publique' : pl.visibility === 'SHARED' ? 'Partagée' : 'Privée'}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  count: { fontSize: 13, color: '#9ca3af', marginTop: 2 },
  list: { padding: 16, gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  icon: { width: 46, height: 46, backgroundColor: '#eef2ff', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700', color: '#111827' },
  desc: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  meta: { fontSize: 12, color: '#9ca3af', marginTop: 3 },
  chevron: { fontSize: 22, color: '#d1d5db', marginLeft: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 15, color: '#9ca3af' },
  emptyHint: { fontSize: 13, color: '#d1d5db', marginTop: 6, textAlign: 'center' },
})
