const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

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

// ── API client ────────────────────────────────────────────────────────────────

export const api = {
  auth: {
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
      request<{ id: string; email: string; role: string; locale: string }>('/users/me', bearer(token)),

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
  },
}
