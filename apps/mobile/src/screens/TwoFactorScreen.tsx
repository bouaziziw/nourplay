import React, { useContext, useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { AuthContext } from '../hooks/useAuth'
import type { RootStackParamList } from '../navigation/AppNavigator'
import { ApiError } from '../api'

type Props = NativeStackScreenProps<RootStackParamList, 'TwoFactor'>

export default function TwoFactorScreen({ route }: Props) {
  const auth = useContext(AuthContext)
  const { userId } = route.params
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleVerify = async () => {
    if (!auth || code.length < 6) return
    setError('')
    setLoading(true)
    try {
      await auth.loginWith2fa(userId, code)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Code incorrect.')
      setCode('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Vérification en 2 étapes</Text>
        <Text style={styles.desc}>
          Entrez le code à 6 chiffres généré par votre application d&apos;authentification.
        </Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TextInput
          style={styles.codeInput}
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
          textAlign="center"
          placeholder="000000"
          placeholderTextColor="#9ca3af"
          autoFocus
        />

        <TouchableOpacity
          style={[styles.btn, (loading || code.length < 6) && styles.btnDisabled]}
          onPress={handleVerify}
          disabled={loading || code.length < 6}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Vérifier</Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#eef2ff' },
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: '#1e1b4b', textAlign: 'center', marginBottom: 10 },
  desc: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 28, lineHeight: 20 },
  errorBox: { backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { color: '#b91c1c', fontSize: 13, textAlign: 'center' },
  codeInput: {
    height: 64, borderWidth: 2, borderColor: '#4f46e5', borderRadius: 14,
    fontSize: 28, fontWeight: '700', color: '#1e1b4b', marginBottom: 24, letterSpacing: 8,
  },
  btn: {
    height: 48, backgroundColor: '#4f46e5', borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
})
