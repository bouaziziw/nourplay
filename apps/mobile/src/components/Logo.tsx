import React from 'react'
import { View, Text, StyleSheet, ViewStyle } from 'react-native'

export interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  subtitle?: string
  style?: ViewStyle
  dark?: boolean
}

export function Logo({
  size = 'md',
  showText = true,
  subtitle,
  style,
  dark = false,
}: LogoProps) {
  const iconDim = size === 'sm' ? 32 : size === 'lg' ? 64 : 44
  const fontSize = size === 'sm' ? 16 : size === 'lg' ? 26 : 20
  const playSize = size === 'sm' ? 12 : size === 'lg' ? 24 : 16

  return (
    <View style={[styles.container, style]}>
      {/* Icon Squircle */}
      <View
        style={[
          styles.iconSquircle,
          {
            width: iconDim,
            height: iconDim,
            borderRadius: Math.round(iconDim * 0.3),
          },
        ]}
      >
        {/* Play symbol */}
        <View
          style={[
            styles.playTriangle,
            {
              borderLeftWidth: playSize * 1.1,
              borderTopWidth: playSize * 0.65,
              borderBottomWidth: playSize * 0.65,
            },
          ]}
        />
        {/* Star badge dot */}
        <View style={[styles.starAccent, { top: iconDim * 0.15, right: iconDim * 0.15 }]} />
      </View>

      {/* Wordmark */}
      {showText && (
        <View style={styles.textContainer}>
          <Text style={[styles.title, { fontSize, color: dark ? '#ffffff' : '#111827' }]}>
            Nour<Text style={{ color: '#1c90d8' }}>Play</Text>
          </Text>
          {subtitle ? (
            <View style={styles.subtitleBadge}>
              <Text style={styles.subtitleText}>{subtitle}</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconSquircle: {
    backgroundColor: '#1c90d8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1c90d8',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
    position: 'relative',
  },
  playTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#ffffff',
    marginLeft: 3,
  },
  starAccent: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fbbf24',
  },
  textContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitleBadge: {
    backgroundColor: '#e0f2fe',
    borderColor: '#bae6fd',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  subtitleText: {
    color: '#0369a1',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
})
