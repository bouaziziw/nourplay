const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string }
    throw new ApiError(res.status, body.message ?? res.statusText)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ── Domain types ──────────────────────────────────────────────────────────────

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
  source?: { name: string; slug: string }
}

export interface PlaylistAccess {
  id: string
  grantedTo: string
  role: 'VIEWER' | 'EDITOR'
  createdAt: string
}

export interface Notification {
  id: string
  type: string
  payload: Record<string, unknown>
  readAt: string | null
  createdAt: string
}

export interface ProfileAnalytics {
  today: { watchedSec: number; count: number }
  week: { watchedSec: number; count: number }
  month: { watchedSec: number; count: number; completionRate: number }
  watchTimeByDay: Array<{ date: string; watchedSec: number }>
  topVideos: Array<{
    video: { id: string; title: string; thumbnailUrl: string | null; durationSec: number | null }
    watchCount: number
    totalWatchedSec: number
  }>
}

export interface UserBlock {
  id: string
  userId: string
  profileId: string | null
  type: 'CHANNEL_WHITELIST' | 'CHANNEL_BLACKLIST' | 'KEYWORD_BLACKLIST' | 'KEYWORD_WHITELIST'
  value: string
  createdAt: string
}

export interface GdprRequest {
  id: string
  type: 'EXPORT' | 'DELETION'
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  createdAt: string
  completedAt: string | null
}

export interface VideoFavorite {
  id: string
  profileId: string
  videoId: string
  createdAt: string
  video: VideoSummary
}

export interface SubscriptionPlan {
  id: string
  name: string
  slug: string
  priceEur: number
  interval: 'MONTHLY' | 'YEARLY'
  features: string[]
}

export interface UserSubscription {
  id: string
  status: 'ACTIVE' | 'CANCELLED' | 'PAST_DUE' | 'TRIALING' | 'EXPIRED'
  startedAt: string
  expiresAt: string | null
  cancelledAt: string | null
  plan: { id: string; name: string; slug: string; priceEur: number; interval: string }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function bearer(token: string): { headers: Record<string, string> } {
  return { headers: { Authorization: `Bearer ${token}` } }
}

// ── API client ────────────────────────────────────────────────────────────────

export const api = {
  auth: {
    register: (data: { email: string; password: string; role?: string; locale?: string }) =>
      request<{ id: string; email: string }>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

    login: (data: { email: string; password: string }) =>
      request<{ accessToken?: string; requiresTwoFactor?: boolean; userId?: string }>(
        '/auth/login', { method: 'POST', body: JSON.stringify(data) }),

    loginWith2fa: (data: { userId: string; code: string }) =>
      request<{ accessToken: string }>('/auth/login/2fa', { method: 'POST', body: JSON.stringify(data) }),

    logout: () => request<void>('/auth/logout', { method: 'POST' }),

    refresh: () => request<{ accessToken: string }>('/auth/refresh', { method: 'POST' }),

    verifyEmail: (token: string) =>
      request<{ verified: boolean }>('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }),

    forgotPassword: (email: string) =>
      request<void>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),

    resetPassword: (token: string, password: string) =>
      request<{ reset: boolean }>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),

    initTotp: (token: string) =>
      request<{ qrCode: string; secret: string; otpauth: string }>('/auth/2fa/init', { method: 'POST', ...bearer(token) }),

    enableTotp: (token: string, code: string) =>
      request<{ enabled: boolean }>('/auth/2fa/enable', { method: 'POST', body: JSON.stringify({ code }), ...bearer(token) }),

    disableTotp: (token: string, code: string) =>
      request<{ disabled: boolean }>('/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ code }), ...bearer(token) }),

    requestMagicLink: (email: string) =>
      request<void>('/auth/magic-link', { method: 'POST', body: JSON.stringify({ email }) }),

    verifyMagicLink: (token: string) =>
      request<{ accessToken: string }>(`/auth/magic-link/verify?token=${encodeURIComponent(token)}`),
  },

  users: {
    me: (token: string) =>
      request<{ id: string; email: string; role: string; locale: string; twoFactorEnabled: boolean }>('/users/me', bearer(token)),

    profiles: (token: string) =>
      request<ProfileSummary[]>('/users/me/profiles', bearer(token)),

    getProfile: (token: string, profileId: string) =>
      request<ProfileSummary>(`/users/me/profiles/${profileId}`, bearer(token)),

    createProfile: (
      token: string,
      data: { displayName: string; ageGroup: string; pin: string; birthYear?: number; dailyLimitMin?: number; sessionLimitMin?: number },
    ) => request<ProfileSummary>('/users/me/profiles', { method: 'POST', body: JSON.stringify(data), ...bearer(token) }),

    updateProfile: (
      token: string,
      profileId: string,
      data: { displayName?: string; ageGroup?: string; dailyLimitMin?: number | null; sessionLimitMin?: number | null; viewingSchedule?: Record<string, string[]> | null; avatarKey?: string | null },
    ) => request<ProfileSummary>(`/users/me/profiles/${profileId}`, { method: 'PATCH', body: JSON.stringify(data), ...bearer(token) }),

    deleteProfile: (token: string, profileId: string) =>
      request<void>(`/users/me/profiles/${profileId}`, { method: 'DELETE', ...bearer(token) }),

    verifyPin: (token: string, profileId: string, pin: string) =>
      request<boolean>(`/users/me/profiles/${profileId}/pin/verify`, {
        method: 'POST',
        body: JSON.stringify({ pin }),
        ...bearer(token),
      }),

    getProfileAnalytics: (token: string, profileId: string) =>
      request<ProfileAnalytics>(`/users/me/profiles/${profileId}/analytics`, bearer(token)),

    getWatchHistory: (token: string, profileId: string, limit = 20) =>
      request<Array<{ id: string; watchedAt: string; durationWatchedSec: number; completed: boolean; video: VideoSummary }>>(
        `/users/me/profiles/${profileId}/history?limit=${limit}`,
        bearer(token),
      ),

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

    getDailyWatchTime: (token: string, profileId: string) =>
      request<{ watchedSec: number }>(`/users/me/profiles/${profileId}/daily-watch-time`, bearer(token)),
  },

  playlists: {
    list: (token: string) =>
      request<PlaylistSummary[]>('/playlists', bearer(token)),

    getById: (token: string, id: string) =>
      request<PlaylistDetail>(`/playlists/${id}`, bearer(token)),

    create: (
      token: string,
      data: { name: string; description?: string; visibility?: string; targetAgeGroup?: string[]; languages?: string[] },
    ) => request<PlaylistSummary>('/playlists', { method: 'POST', body: JSON.stringify(data), ...bearer(token) }),

    update: (
      token: string,
      id: string,
      data: { name?: string; description?: string; visibility?: string; targetAgeGroup?: string[]; languages?: string[] },
    ) => request<PlaylistSummary>(`/playlists/${id}`, { method: 'PATCH', body: JSON.stringify(data), ...bearer(token) }),

    delete: (token: string, id: string) =>
      request<void>(`/playlists/${id}`, { method: 'DELETE', ...bearer(token) }),

    addVideo: (token: string, id: string, videoId: string, position?: number) =>
      request<{ id: string; position: number }>(`/playlists/${id}/videos`, {
        method: 'POST',
        body: JSON.stringify({ videoId, ...(position !== undefined && { position }) }),
        ...bearer(token),
      }),

    removeVideo: (token: string, id: string, videoId: string) =>
      request<void>(`/playlists/${id}/videos/${videoId}`, { method: 'DELETE', ...bearer(token) }),

    reorderVideos: (token: string, id: string, videoIds: string[]) =>
      request<void>(`/playlists/${id}/videos/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({ videoIds }),
        ...bearer(token),
      }),

    share: (token: string, id: string, data: { email: string; role?: 'VIEWER' | 'EDITOR' }) =>
      request<PlaylistAccess>(`/playlists/${id}/share`, {
        method: 'POST',
        body: JSON.stringify(data),
        ...bearer(token),
      }),

    revokeShare: (token: string, id: string, userId: string) =>
      request<void>(`/playlists/${id}/share/${userId}`, { method: 'DELETE', ...bearer(token) }),

    generateShareLink: (token: string, id: string) =>
      request<{ shareToken: string }>(`/playlists/${id}/share-link`, { method: 'POST', ...bearer(token) }),

    getShared: (shareToken: string) =>
      request<PlaylistDetail>(`/playlists/shared/${shareToken}`),
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

    getById: (token: string, id: string) =>
      request<VideoSearchResult>(`/videos/${id}`, bearer(token)),

    submit: (token: string, data: { url: string; ageRating?: string; language?: string }) =>
      request<VideoSearchResult>('/videos', { method: 'POST', body: JSON.stringify(data), ...bearer(token) }),

    report: (token: string, id: string, data: { reason: string; description?: string }) =>
      request<{ id: string }>(`/videos/${id}/report`, { method: 'POST', body: JSON.stringify(data), ...bearer(token) }),
  },

  blocks: {
    list: (token: string, profileId?: string) =>
      request<UserBlock[]>(`/users/me/blocks${profileId ? `?profileId=${profileId}` : ''}`, bearer(token)),

    create: (token: string, data: { profileId?: string; type: string; value: string }) =>
      request<UserBlock>('/users/me/blocks', { method: 'POST', body: JSON.stringify(data), ...bearer(token) }),

    delete: (token: string, blockId: string) =>
      request<void>(`/users/me/blocks/${blockId}`, { method: 'DELETE', ...bearer(token) }),
  },

  notifications: {
    list: (token: string, params?: { page?: number; limit?: number; unread?: boolean }) => {
      const qs = new URLSearchParams()
      if (params?.page) qs.set('page', String(params.page))
      if (params?.limit) qs.set('limit', String(params.limit))
      if (params?.unread !== undefined) qs.set('unread', String(params.unread))
      return request<{ items: Notification[]; total: number; unread: number; page: number; limit: number }>(
        `/notifications?${qs}`, bearer(token))
    },

    markRead: (token: string, id: string) =>
      request<Notification>(`/notifications/${id}/read`, { method: 'PATCH', ...bearer(token) }),

    markAllRead: (token: string) =>
      request<{ updated: number }>('/notifications/read-all', { method: 'PATCH', ...bearer(token) }),

    delete: (token: string, id: string) =>
      request<void>(`/notifications/${id}`, { method: 'DELETE', ...bearer(token) }),
  },

  gdpr: {
    requestExport: (token: string) =>
      request<GdprRequest>('/gdpr/export', { method: 'POST', ...bearer(token) }),

    requestDeletion: (token: string) =>
      request<GdprRequest>('/gdpr/delete', { method: 'POST', ...bearer(token) }),

    getRequest: (token: string, id: string) =>
      request<GdprRequest>(`/gdpr/requests/${id}`, bearer(token)),

    getMyData: (token: string) =>
      request<Record<string, unknown>>('/gdpr/my-data', bearer(token)),
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

  storage: {
    getPresignedUploadUrl: (token: string, data: { folder: 'avatars' | 'thumbnails'; contentType: string; sizeBytes: number }) =>
      request<{ uploadUrl: string; key: string; publicUrl: string }>('/storage/presigned-url', {
        method: 'POST',
        body: JSON.stringify(data),
        ...bearer(token),
      }),
  },

  subscriptions: {
    getPlans: () =>
      request<SubscriptionPlan[]>('/subscriptions/plans'),

    getMine: (token: string) =>
      request<UserSubscription | null>('/subscriptions/me', bearer(token)),

    checkout: (token: string, planId: string) =>
      request<{ url: string }>('/subscriptions/checkout', {
        method: 'POST',
        body: JSON.stringify({ planId }),
        ...bearer(token),
      }),

    portal: (token: string) =>
      request<{ url: string }>('/subscriptions/portal', {
        method: 'POST',
        ...bearer(token),
      }),
  },
}
