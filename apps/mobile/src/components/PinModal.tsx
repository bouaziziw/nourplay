import React, { useState, useRef } from 'react'
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, TouchableWithoutFeedback,
} from 'react-native'
import type { TextInputInstance } from 'react-native'

interface Props {
  visible: boolean
  profileName: string
  onSubmit: (pin: string) => Promise<void>
  onClose: () => void
}

export function PinModal({ visible, profileName, onSubmit, onClose }: Props) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<TextInputInstance>(null)

  const reset = () => { setPin(''); setError(''); setLoading(false) }

  const handleClose = () => { reset(); onClose() }

  const handleSubmit = async () => {
    if (pin.length < 4) return
    setError('')
    setLoading(true)
    try {
      await onSubmit(pin)
      reset()
    } catch {
      setError('PIN incorrect, réessayez.')
      setPin('')
      inputRef.current?.focus()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      <View style={styles.centerer} pointerEvents="box-none">
        <View style={styles.card}>
          <Text style={styles.title}>Code PIN</Text>
          <Text style={styles.subtitle}>Entrez le PIN de <Text style={styles.name}>{profileName}</Text></Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TextInput
            ref={inputRef}
            style={styles.pinInput}
            value={pin}
            onChangeText={setPin}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            textAlign="center"
            placeholder="• • • •"
            placeholderTextColor="#64748b"
            autoFocus
          />

          <TouchableOpacity
            style={[styles.btn, (loading || pin.length < 4) && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading || pin.length < 4}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Confirmer</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={handleClose} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.75)' },
  centerer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  card: {
    width: '100%', maxWidth: 360, backgroundColor: '#0f172a', borderRadius: 24,
    padding: 28, alignItems: 'center',
    borderWidth: 1, borderColor: '#1e293b',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  title: { fontSize: 20, fontWeight: '800', color: '#f8fafc', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#94a3b8', marginBottom: 20, textAlign: 'center' },
  name: { fontWeight: '700', color: '#38bdf8' },
  errorBox: { backgroundColor: 'rgba(239, 68, 68, 0.2)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.4)', borderRadius: 10, padding: 10, marginBottom: 14, width: '100%' },
  errorText: { color: '#f87171', fontSize: 13, textAlign: 'center', fontWeight: '600' },
  pinInput: {
    width: '100%', height: 56, borderWidth: 1.5, borderColor: '#334155', borderRadius: 14,
    backgroundColor: '#1e293b',
    fontSize: 24, fontWeight: '700', letterSpacing: 8, color: '#f8fafc', marginBottom: 20,
  },
  btn: {
    width: '100%', height: 48, backgroundColor: '#0284c7', borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cancelBtn: { marginTop: 14 },
  cancelText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
})
