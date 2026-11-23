import React, { useEffect, useRef, useCallback, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native'
import { WebView } from 'react-native-webview'

const APP_ORIGIN = process.env.EXPO_PUBLIC_APP_URL ?? 'https://nour-play.app'

interface Props {
  embedUrl: string
  title: string
  onWatched?: (durationSec: number, completed: boolean) => void
  autoMarkCompleteAfterSec?: number
  onNext?: () => void
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
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
      const params = new URLSearchParams({
        rel: '0',
        modestbranding: '1',
        enablejsapi: '1',
        playsinline: '1',
        autoplay: '1',
        origin: APP_ORIGIN,
      })
      return `https://www.youtube.com/embed/${videoId}?${params}`
    }

    if (u.hostname.includes('vimeo.com')) {
      const videoId = u.pathname.split('/').filter(Boolean).pop()
      if (!videoId) return raw
      return `https://player.vimeo.com/video/${videoId}?dnt=1&byline=0&title=0&portrait=0&autoplay=1`
    }

    if (u.hostname.includes('dailymotion.com')) {
      const videoId = u.pathname.split('/').pop()
      if (!videoId) return raw
      return `https://www.dailymotion.com/embed/video/${videoId}?sharing-enable=false&ui-logo=false&autoplay=1`
    }

    return raw
  } catch {
    return raw
  }
}

// In TV mode, keep all URLs and navigations inside the integrated in-app browser
function shouldAllowNavigation(): boolean {
  return true
}

const INJECTED_START_AND_PAUSE_JS = `
  (function() {
    var executed = false;
    function startAndQuickPause() {
      if (executed) return;
      var v = document.querySelector('video');
      if (v) {
        executed = true;
        v.play().then(function() {
          setTimeout(function() {
            v.pause();
          }, 850);
        }).catch(function() {});
      }
    }
    document.addEventListener('DOMContentLoaded', startAndQuickPause);
    setTimeout(startAndQuickPause, 800);
    setTimeout(startAndQuickPause, 1800);

    // Active quick commands via remote / keyboard in WebView
    document.addEventListener('keydown', function(e) {
      var v = document.querySelector('video');
      if (!v) return;
      if (e.key === ' ' || e.code === 'Space' || e.key === 'MediaPlayPause' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        if (v.paused) v.play(); else v.pause();
      } else if (e.key === 'ArrowLeft' || e.key === 'MediaRewind' || e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        v.currentTime = Math.max(0, v.currentTime - 10);
      } else if (e.key === 'ArrowRight' || e.key === 'MediaFastForward' || e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        v.currentTime = v.currentTime + 10;
      } else if (e.key === 'm' || e.key === 'M') {
        v.muted = !v.muted;
      } else if (e.key === 'f' || e.key === 'F') {
        if (v.requestFullscreen) v.requestFullscreen();
        else if (v.webkitRequestFullscreen) v.webkitRequestFullscreen();
      }
    });
  })();
  true;
`

export function VideoPlayer({
  embedUrl,
  title,
  onWatched,
  autoMarkCompleteAfterSec = 300,
  onNext,
  isFullscreen: externalFullscreen,
  onToggleFullscreen,
}: Props) {
  const webViewRef = useRef<any>(null)
  const startTimeRef = useRef(Date.now())
  const firedRef = useRef(false)
  const completedRef = useRef(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [internalFullscreen, setInternalFullscreen] = useState(false)
  const isFullscreen = externalFullscreen !== undefined ? externalFullscreen : internalFullscreen
  const isTV = Platform.isTV

  const toggleFullscreen = () => {
    const next = !isFullscreen
    if (onToggleFullscreen) {
      onToggleFullscreen()
    } else {
      setInternalFullscreen(next)
    }

    webViewRef.current?.injectJavaScript(`
      (function(){
        var v = document.querySelector('video');
        if (v) {
          if (${next}) {
            if (v.requestFullscreen) v.requestFullscreen();
            else if (v.webkitRequestFullscreen) v.webkitRequestFullscreen();
            else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
          } else {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
          }
        }
      })();
      true;
    `)
  }

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
    setIsPlaying(false)

    const timer = setTimeout(() => {
      completedRef.current = true
    }, autoMarkCompleteAfterSec * 1000)

    return () => {
      clearTimeout(timer)
      fireWatched(completedRef.current)
    }
  }, [embedUrl, autoMarkCompleteAfterSec, fireWatched])

  const safeUrl = buildSafeEmbedUrl(embedUrl)
  const isYouTube = safeUrl.includes('youtube.com/embed/')

  const togglePlay = () => {
    const next = !isPlaying
    setIsPlaying(next)
    const code = next
      ? `(function(){ var v = document.querySelector('video'); if (v) v.play(); else window.postMessage('{"event":"command","func":"playVideo"}', '*'); })(); true;`
      : `(function(){ var v = document.querySelector('video'); if (v) v.pause(); else window.postMessage('{"event":"command","func":"pauseVideo"}', '*'); })(); true;`
    webViewRef.current?.injectJavaScript(code)
  }

  const rewind10 = () => {
    webViewRef.current?.injectJavaScript(`
      (function(){
        var v = document.querySelector('video');
        if (v) v.currentTime = Math.max(0, v.currentTime - 10);
      })();
      true;
    `)
  }

  const forward10 = () => {
    webViewRef.current?.injectJavaScript(`
      (function(){
        var v = document.querySelector('video');
        if (v) v.currentTime += 10;
      })();
      true;
    `)
  }

  const toggleMute = () => {
    const next = !isMuted
    setIsMuted(next)
    webViewRef.current?.injectJavaScript(`
      (function(){
        var v = document.querySelector('video');
        if (v) v.muted = ${next};
      })();
      true;
    `)
  }

  return (
    <View style={[styles.container, isFullscreen && styles.containerFullscreen]}>
      {/* 16:9 Video Canvas */}
      <View style={[styles.wrapper, isFullscreen && styles.wrapperFullscreen]}>
        <WebView
          ref={webViewRef as any}
          source={{
            uri: safeUrl,
            headers: isYouTube ? { Referer: `${APP_ORIGIN}/` } : undefined,
          }}
          style={styles.webview}
          allowsFullscreenVideo
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled={false}
          injectedJavaScript={INJECTED_START_AND_PAUSE_JS}
          originWhitelist={['https://*', 'http://*']}
          onShouldStartLoadWithRequest={shouldAllowNavigation}
          onOpenWindow={() => {}}
          contentMode="mobile"
        />
      </View>

      {/* Integrated Remote-Friendly TV Playback Controls */}
      <View style={[styles.controlsBar, isTV && styles.tvControlsBar]}>
        {/* Quick Commands Header (Active by default) */}
        <View style={styles.quickHeaderRow}>
          <View style={styles.quickBadge}>
            <View style={styles.pulseDot} />
            <Text style={styles.quickBadgeText}>⚡ Commandes rapides</Text>
          </View>
          <Text style={styles.quickStatusText}>
            {isPlaying ? '▶ Lecture en cours' : 'Prêt à regarder 🍿'}
          </Text>
        </View>

        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={[styles.btn, isPlaying ? styles.btnPause : styles.btnPlay, isTV && styles.tvBtn]}
            onPress={togglePlay}
            activeOpacity={0.8}
            hasTVPreferredFocus
          >
            <Text style={styles.btnIcon}>{isPlaying ? '⏸' : '▶'}</Text>
            <Text style={[styles.btnText, isPlaying && styles.btnTextPause]}>
              {isPlaying ? 'Pause' : 'Lecture'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnSecondary, isTV && styles.tvBtn]}
            onPress={rewind10}
            activeOpacity={0.8}
          >
            <Text style={styles.btnSecondaryText}>◀◀ -10s</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnSecondary, isTV && styles.tvBtn]}
            onPress={forward10}
            activeOpacity={0.8}
          >
            <Text style={styles.btnSecondaryText}>+10s ▶▶</Text>
          </TouchableOpacity>

          {onNext && (
            <TouchableOpacity
              style={[styles.btnNext, isTV && styles.tvBtn]}
              onPress={onNext}
              activeOpacity={0.8}
            >
              <Text style={styles.btnNextText}>Suivant ⏭️</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.btnSecondary, isTV && styles.tvBtn]}
            onPress={toggleFullscreen}
            activeOpacity={0.8}
          >
            <Text style={styles.btnSecondaryText}>
              {isFullscreen ? '🗗 Réduire' : '⛶ Plein écran'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnIconOnly, isTV && styles.tvBtn]}
            onPress={toggleMute}
            activeOpacity={0.8}
          >
            <Text style={styles.btnIconText}>{isMuted ? '🔇' : '🔊'}</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Remote Navigation Hints for TV */}
        <View style={styles.remoteHintRow}>
          <Text style={styles.remoteHintText}>
            [OK] Lecture/Pause  •  [◀◀ / ▶▶] ±10s  •  [⛶ Plein écran]
          </Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#090d16',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  containerFullscreen: {
    borderRadius: 0,
    flex: 1,
    height: '100%',
  },
  wrapper: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  wrapperFullscreen: {
    flex: 1,
    aspectRatio: undefined,
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  controlsBar: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  tvControlsBar: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  tvBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 48,
  },
  btnPlay: {
    backgroundColor: '#1c90d8',
  },
  btnPause: {
    backgroundColor: '#f59e0b',
  },
  btnIcon: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '900',
  },
  btnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  btnTextPause: {
    color: '#0f172a',
  },
  btnSecondary: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  btnSecondaryText: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '700',
  },
  btnNext: {
    backgroundColor: '#059669',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  btnNextText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  btnIconOnly: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  btnIconText: {
    fontSize: 15,
  },
  quickHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  quickBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0c2d48',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#0284c7',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  quickBadgeText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  quickStatusText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  remoteHintRow: {
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remoteHintText: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
  },
})
