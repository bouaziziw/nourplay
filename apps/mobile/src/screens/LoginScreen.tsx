import React, { useContext, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { AuthContext } from '../hooks/useAuth'
import type { RootStackParamList } from '../navigation/AppNavigator'
import { ApiError } from '../api'

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>

export default function LoginScreen({ navigation }: Props) {
  const auth = useContext(AuthContext)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!auth) return
    setError('')
    setLoading(true)
    try {
      const result = await auth.login(email.trim(), password)
      if (result.requiresTwoFactor && result.userId) {
        navigation.replace('TwoFactor', { userId: result.userId })
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Identifiants incorrects.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kav}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>N</Text>
            </View>
            <Text style={styles.title}>NourPlay</Text>
            <Text style={styles.subtitle}>La plateforme vidéo sécurisée pour vos enfants</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Connexion</Text>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>Adresse email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder="vous@exemple.com"
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.label}>Mot de passe</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
              placeholder="••••••••"
              placeholderTextColor="#9ca3af"
              onSubmitEditing={handleLogin}
            />

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Se connecter</Text>
              }
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#eef2ff' },
  kav: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  logoText: { color: '#fff', fontSize: 32, fontWeight: '800' },
  title: { fontSize: 28, fontWeight: '800', color: '#1e1b4b', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 4, textAlign: 'center' },
  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  cardTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 20 },
  errorBox: { backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { color: '#b91c1c', fontSize: 13 },
  label: { fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input: {
    height: 44, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10,
    paddingHorizontal: 12, fontSize: 15, color: '#111827', marginBottom: 16,
    backgroundColor: '#f9fafb',
  },
  btn: {
    height: 48, backgroundColor: '#4f46e5', borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
})
