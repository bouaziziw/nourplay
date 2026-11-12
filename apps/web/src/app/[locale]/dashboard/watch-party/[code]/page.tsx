'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useLocale } from 'next-intl'
import Link from 'next/link'
import { io, Socket } from 'socket.io-client'
import { useAuth } from '../../../../../hooks/useAuth'
import { RemoteImage } from '../../../../../components/RemoteImage'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000'

interface VideoInfo {
  id: string
  title: string
  thumbnailUrl: string | null
  durationSec: number | null
  embedUrl: string
}

interface WatchPlaylist {
  id: string
  name: string
  videos: VideoInfo[]
}

interface Participant {
  userId: string
  displayName: string
}

interface ChatMessage {
  userId: string
  displayName: string
  message: string
  ts: number
}

export default function WatchRoomPage({ params }: { params: { code: string } }) {
  const locale = useLocale()
  const { token, user, loading } = useAuth()
  const socketRef = useRef<Socket | null>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  const [connected, setConnected] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [playlist, setPlaylist] = useState<WatchPlaylist | null>(null)
  const [videoIndex, setVideoIndex] = useState(0)
  const [isHost, setIsHost] = useState(false)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages(prev => [...prev.slice(-199), msg])
  }, [])

  useEffect(() => {
    if (!token || loading) return

    const socket = io(`${WS_URL}/watch`, {
      auth: { token },
      transports: ['websocket'],
    })

    socket.on('connect', () => {
      setConnected(true)
      socket.emit('join', {
        code: params.code.toUpperCase(),
        displayName: user?.email ?? 'Anonyme',
      })
    })

    socket.on('connect_error', () => {
      setJoinError('Impossible de se connecter au serveur.')
    })

    socket.on('joined', (data: {
      isHost: boolean
      videoIndex: number
      participants: Participant[]
      playlist: WatchPlaylist
    }) => {
      setIsHost(data.isHost)
      setVideoIndex(data.videoIndex)
      setParticipants(data.participants)
      setPlaylist(data.playlist)
    })

    socket.on('error', ({ message }: { message: string }) => {
      setJoinError(message)
    })

    socket.on('video-changed', ({ videoIndex: idx }: { videoIndex: number }) => {
      setVideoIndex(idx)
    })

    socket.on('participant-joined', (p: Participant) => {
      setParticipants(prev => [...prev.filter(x => x.userId !== p.userId), p])
      addMessage({ userId: 'system', displayName: '', message: `${p.displayName} a rejoint la salle.`, ts: Date.now() })
    })

    socket.on('participant-left', ({ userId }: { userId: string }) => {
      setParticipants(prev => {
        const leaving = prev.find(x => x.userId === userId)
        if (leaving) addMessage({ userId: 'system', displayName: '', message: `${leaving.displayName} a quitté la salle.`, ts: Date.now() })
        return prev.filter(x => x.userId !== userId)
      })
    })

    socket.on('host-left', () => {
      addMessage({ userId: 'system', displayName: '', message: "L'hôte a quitté la salle.", ts: Date.now() })
    })

    socket.on('chat', (msg: ChatMessage) => {
      addMessage(msg)
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
    }
  }, [token, loading, params.code, user?.email, addMessage])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const changeVideo = (idx: number) => {
    if (!playlist) return
    const clamped = Math.max(0, Math.min(idx, playlist.videos.length - 1))
    setVideoIndex(clamped)
    socketRef.current?.emit('change-video', { videoIndex: clamped })
  }

  const sendChat = () => {
    const msg = chatInput.trim()
    if (!msg || !socketRef.current) return
    socketRef.current.emit('chat', { message: msg })
    setChatInput('')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (joinError) {
    return (
      <div className="w-full text-center py-16">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Salle introuvable</h2>
        <p className="text-sm text-gray-500 mb-4">{joinError}</p>
        <Link href={`/${locale}/dashboard`} className="text-indigo-600 text-sm hover:underline">
          Retour au tableau de bord
        </Link>
      </div>
    )
  }

  if (!connected || !playlist) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
        <p className="text-sm text-gray-500">Connexion à la salle <span className="font-mono font-bold">{params.code.toUpperCase()}</span>…</p>
      </div>
    )
  }

  const currentVideo = playlist.videos[videoIndex]

  return (
    <div className="flex gap-0 h-[calc(100vh-4rem)] -mx-6 -mt-6">
      {/* ── Player column ── */}
      <div className="flex flex-col flex-1 min-w-0 bg-black">
        {/* Video */}
        <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
          {currentVideo ? (
            <iframe
              key={currentVideo.id}
              src={currentVideo.embedUrl}
              className="absolute inset-0 w-full h-full"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              title={currentVideo.title}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
              Aucune vidéo dans cette playlist
            </div>
          )}
        </div>

        {/* Controls bar */}
        <div className="bg-gray-900 text-white px-4 py-3 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{currentVideo?.title ?? '—'}</p>
            <p className="text-xs text-gray-400 mt-0.5">{playlist.name}</p>
          </div>

          {isHost ? (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => changeVideo(videoIndex - 1)}
                disabled={videoIndex === 0}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 disabled:opacity-30 transition-colors"
                title="Vidéo précédente"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-xs text-gray-300 w-14 text-center">
                {videoIndex + 1} / {playlist.videos.length}
              </span>
              <button
                onClick={() => changeVideo(videoIndex + 1)}
                disabled={videoIndex >= playlist.videos.length - 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 disabled:opacity-30 transition-colors"
                title="Vidéo suivante"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-gray-400">{videoIndex + 1} / {playlist.videos.length}</span>
              <span className="text-xs text-indigo-400 bg-indigo-900/50 px-2 py-0.5 rounded-full">
                Mode spectateur
              </span>
            </div>
          )}
        </div>

        {/* Playlist thumbnails */}
        {playlist.videos.length > 1 && (
          <div className="flex gap-2 p-3 bg-gray-900 overflow-x-auto">
            {playlist.videos.map((v, i) => (
              <button
                key={v.id}
                onClick={() => isHost && changeVideo(i)}
                disabled={!isHost}
                className={`shrink-0 w-28 rounded-lg overflow-hidden transition-all ${
                  i === videoIndex ? 'ring-2 ring-indigo-500' : isHost ? 'opacity-60 hover:opacity-100' : 'opacity-60'
                }`}
                title={v.title}
              >
                {v.thumbnailUrl ? (
                  <RemoteImage src={v.thumbnailUrl} alt={v.title} width={112} height={63} className="w-full aspect-video object-cover" />
                ) : (
                  <div className="w-full aspect-video bg-gray-700 flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    </svg>
                  </div>
                )}
                <p className="text-xs text-gray-300 p-1 truncate">{v.title}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Sidebar: participants + chat ── */}
      <div className="w-72 shrink-0 flex flex-col bg-white border-l border-gray-200">
        {/* Room header */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <span className="font-mono font-bold text-indigo-600 tracking-widest text-sm">{params.code.toUpperCase()}</span>
            {isHost && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Hôte</span>}
          </div>
        </div>

        {/* Participants */}
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Participants · {participants.length}
          </p>
          <div className="space-y-1.5">
            {participants.map(p => (
              <div key={p.userId} className="flex items-center gap-2">
                <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-xs font-medium text-indigo-600">
                    {p.displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-xs text-gray-700 truncate">{p.displayName}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {messages.length === 0 ? (
            <p className="text-xs text-gray-400 text-center mt-4">Aucun message pour l&apos;instant.</p>
          ) : (
            messages.map((m, i) => (
              <div key={i}>
                {m.userId === 'system' ? (
                  <p className="text-xs text-gray-400 text-center italic">{m.message}</p>
                ) : (
                  <div>
                    <span className="text-xs font-semibold text-indigo-600">{m.displayName} </span>
                    <span className="text-xs text-gray-700">{m.message}</span>
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Chat input */}
        <div className="px-3 py-3 border-t border-gray-100">
          <div className="flex gap-2">
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }}
              placeholder="Message…"
              maxLength={300}
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
            />
            <button
              onClick={sendChat}
              disabled={!chatInput.trim()}
              className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors disabled:opacity-40"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
