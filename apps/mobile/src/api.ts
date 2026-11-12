import Constants from 'expo-constants'

const metroHost = Constants.expoConfig?.hostUri?.replace(/:\d+$/, '')
const API_URL = process.env.EXPO_PUBLIC_API_URL
  || (metroHost ? `http://${metroHost}:4000/api/v1` : 'http://localhost:4000/api/v1')

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string }
    throw new ApiError(res.status, body.message ?? res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

function bearer(token: string): { headers: Record<string, string> } {
  return { headers: { Authorization: `Bearer ${token}` } }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProfileSummary {
  id: string
  displayName: string
  ageGroup: string
  avatarKey: string | null
  birthYear: number | null
  dailyLimitMin: number | null
  sessionLimitMin: number | null
  viewingSchedule: Record<string, string[]> | null
  createdAt: string
}

export interface VideoSummary {
  id: string
  title: string
  thumbnailUrl: string | null
  embedUrl: string
  durationSec: number | null
  language: string | null
  ageRating: string
}

export interface PlaylistVideo {
  id: string
  position: number
  video: VideoSummary
}

export interface PlaylistDetail {
  id: string
  name: string
  description: string | null
  visibility: string
  targetAgeGroup: string[]
  languages: string[]
  createdAt: string
  playlistVideos: PlaylistVideo[]
}

export interface PlaylistSummary {
  id: string
  name: string
  description: string | null
  visibility: string
  _count: { playlistVideos: number }
}

export interface VideoSearchResult {
  id: string
  title: string
  thumbnailUrl: string | null
  embedUrl: string
  durationSec: number | null
  language: string | null
  ageRating: string
  validationStatus: string
}

export interface VideoFavorite {
  id: string
  profileId: string
  videoId: string
  createdAt: string
  video: VideoSummary
}

// ── API client ────────────────────────────────────────────────────────────────

export const api = {
  auth: {
    verifyParentPassword: (token: string, password: string) =>
      request<{ verified: true }>('/auth/verify-parent-password', {
        method: 'POST',
        body: JSON.stringify({ password }),
        ...bearer(token),
      }),

    login: (data: { email: string; password: string }) =>
      request<{ accessToken?: string; requiresTwoFactor?: boolean; userId?: string }>(
        '/auth/login', { method: 'POST', body: JSON.stringify(data) }),

    loginWith2fa: (data: { userId: string; code: string }) =>
      request<{ accessToken: string }>('/auth/login/2fa', { method: 'POST', body: JSON.stringify(data) }),

    refresh: (refreshToken: string) =>
      request<{ accessToken: string }>('/auth/refresh', {
        method: 'POST',
        headers: { Cookie: `refresh_token=${refreshToken}` },
      }),
  },

  users: {
    me: (token: string) =>
      request<{ id: string; email: string; role: string; locale: string; twoFactorEnabled: boolean }>('/users/me', bearer(token)),

    profiles: (token: string) =>
      request<ProfileSummary[]>('/users/me/profiles', bearer(token)),

    getProfile: (token: string, profileId: string) =>
      request<ProfileSummary>(`/users/me/profiles/${profileId}`, bearer(token)),

    verifyPin: (token: string, profileId: string, pin: string) =>
      request<boolean>(`/users/me/profiles/${profileId}/pin/verify`, {
        method: 'POST',
        body: JSON.stringify({ pin }),
        ...bearer(token),
      }),

    recordWatch: (
      token: string,
      profileId: string,
      data: { videoId: string; durationWatchedSec: number; completed: boolean },
    ) =>
      request<{ id: string }>(`/users/me/profiles/${profileId}/history`, {
        method: 'POST',
        body: JSON.stringify(data),
        ...bearer(token),
      }),
  },

  playlists: {
    list: (token: string) =>
      request<PlaylistSummary[]>('/playlists', bearer(token)),

    getById: (token: string, id: string) =>
      request<PlaylistDetail>(`/playlists/${id}`, bearer(token)),

    addVideo: (token: string, id: string, videoId: string) =>
      request<{ id: string; position: number }>(`/playlists/${id}/videos`, {
        method: 'POST',
        body: JSON.stringify({ videoId }),
        ...bearer(token),
      }),
  },

  videos: {
    search: (token: string, params: { q?: string; language?: string; ageRating?: string; page?: number; limit?: number }) => {
      const qs = new URLSearchParams()
      if (params.q) qs.set('q', params.q)
      if (params.language) qs.set('language', params.language)
      if (params.ageRating) qs.set('ageRating', params.ageRating)
      if (params.page) qs.set('page', String(params.page))
      if (params.limit) qs.set('limit', String(params.limit))
      return request<{ items: VideoSearchResult[]; total: number; page: number; pages: number }>(
        `/videos/search?${qs}`,
        bearer(token),
      )
    },
  },

  deviceTokens: {
    register: (token: string, data: { token: string; platform: string }) =>
      request<{ registered: boolean }>('/notifications/device-tokens', {
        method: 'POST',
        body: JSON.stringify(data),
        ...bearer(token),
      }),

    unregister: (token: string, deviceToken: string) =>
      request<{ unregistered: boolean }>('/notifications/device-tokens/unregister', {
        method: 'DELETE',
        body: JSON.stringify({ token: deviceToken }),
        ...bearer(token),
      }),
  },

  favorites: {
    list: (token: string, profileId: string) =>
      request<VideoFavorite[]>(`/users/me/profiles/${profileId}/favorites`, bearer(token)),

    add: (token: string, profileId: string, videoId: string) =>
      request<VideoFavorite>(`/users/me/profiles/${profileId}/favorites/${videoId}`, {
        method: 'POST',
        ...bearer(token),
      }),

    remove: (token: string, profileId: string, videoId: string) =>
      request<void>(`/users/me/profiles/${profileId}/favorites/${videoId}`, {
        method: 'DELETE',
        ...bearer(token),
      }),
  },
}
