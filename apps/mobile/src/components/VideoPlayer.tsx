import React, { useEffect, useRef, useCallback } from 'react'
import { View, StyleSheet } from 'react-native'
import { WebView } from 'react-native-webview'

interface Props {
  embedUrl: string
  title: string
  onWatched?: (durationSec: number, completed: boolean) => void
  autoMarkCompleteAfterSec?: number
}

function buildSafeEmbedUrl(raw: string): string {
  try {
    const u = new URL(raw)

    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      let videoId = ''
      if (u.pathname.startsWith('/embed/')) {
        videoId = u.pathname.replace('/embed/', '').split('/')[0]
      } else if (u.searchParams.has('v')) {
        videoId = u.searchParams.get('v')!
      } else if (u.hostname === 'youtu.be') {
        videoId = u.pathname.slice(1)
      }
      if (!videoId) return raw
      return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&enablejsapi=0&playsinline=1`
    }

    if (u.hostname.includes('vimeo.com')) {
      const videoId = u.pathname.split('/').filter(Boolean).pop()
      if (!videoId) return raw
      return `https://player.vimeo.com/video/${videoId}?dnt=1&byline=0&title=0&portrait=0`
    }

    if (u.hostname.includes('dailymotion.com')) {
      const videoId = u.pathname.split('/').pop()
      if (!videoId) return raw
      return `https://www.dailymotion.com/embed/video/${videoId}?sharing-enable=false&ui-logo=false`
    }

    return raw
  } catch {
    return raw
  }
}

export function VideoPlayer({ embedUrl, title, onWatched, autoMarkCompleteAfterSec = 300 }: Props) {
  const startTimeRef = useRef(Date.now())
  const firedRef = useRef(false)
  const completedRef = useRef(false)

  const fireWatched = useCallback((completed: boolean) => {
    if (firedRef.current) return
    firedRef.current = true
    const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000)
    onWatched?.(elapsed, completed)
  }, [onWatched])

  useEffect(() => {
    startTimeRef.current = Date.now()
    firedRef.current = false
    completedRef.current = false

    const timer = setTimeout(() => {
      completedRef.current = true
    }, autoMarkCompleteAfterSec * 1000)

    return () => {
      clearTimeout(timer)
      fireWatched(completedRef.current)
    }
  }, [embedUrl, autoMarkCompleteAfterSec, fireWatched])

  const safeUrl = buildSafeEmbedUrl(embedUrl)

  return (
    <View style={styles.wrapper}>
      <WebView
        source={{ uri: safeUrl }}
        style={styles.webview}
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled={false}
        thirdPartyCookiesEnabled={false}
        originWhitelist={['https://*']}
        contentMode="mobile"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', borderRadius: 12, overflow: 'hidden' },
  webview: { flex: 1 },
})
