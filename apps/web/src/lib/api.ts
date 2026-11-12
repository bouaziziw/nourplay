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
  validationStatus?: string
  submitterApprovedAt?: string | null
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
  scheduledPublishAt: string | null
  createdAt: string
  playlistVideos: PlaylistVideo[]
}

export interface PlaylistSummary {
  id: string
  name: string
  description: string | null
  visibility: string
  scheduledPublishAt: string | null
  _count: { playlistVideos: number }
  importedVideoCount?: number
  pendingValidationCount?: number
  skippedVideoCount?: number
  validationQueueFailedCount?: number
}

export interface ScheduledPlaylist {
  id: string
  name: string
  visibility: string
  scheduledPublishAt: string
  targetAgeGroup: string[]
  _count: { playlistVideos: number }
  owner: { id: string; email: string }
}

export interface Tag {
  id: string
  name: string
  locale: string
}

export interface VideoSearchResult {
  id: string
  title: string
  description?: string | null
  thumbnailUrl: string | null
  embedUrl: string
  durationSec: number | null
  language: string | null
  ageRating: string
  validationStatus: string
  submitterApprovedAt?: string | null
  source?: { name: string; slug: string }
}

export interface VideoSubmission {
  id: string
  title: string
  thumbnailUrl: string | null
  validationStatus: string
  submitterApprovedAt: string | null
  createdAt: string
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
  watchTimeByMonth: Array<{ date: string; watchedSec: number }>
  topVideos: Array<{
    video: { id: string; title: string; thumbnailUrl: string | null; durationSec: number | null }
    watchCount: number
    totalWatchedSec: number
  }>
}

export interface VideoRating {
  profileId: string
  videoId: string
  rating: 'THUMBS_UP' | 'THUMBS_DOWN'
  ratedAt: string
  video: { id: string; title: string; thumbnailUrl: string | null }
}

export interface UserBlock {
  id: string
  userId: string
  profileId: string | null
  type: 'CHANNEL_WHITELIST' | 'CHANNEL_BLACKLIST' | 'KEYWORD_BLACKLIST' | 'KEYWORD_WHITELIST'
  value: string
  createdAt: string
}

export interface ProfileCategoryLimit {
  id: string
  profileId: string
  tagId: string
  dailyLimitMin: number
  tag: { id: string; name: string; locale: string }
}

export interface VideoSource {
  id: string
  name: string
  slug: string
  baseUrl: string
  embedAllowed: boolean
  isActive: boolean
  cguVersion: string | null
  cguCheckedAt: string | null
  embedPolicy: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
  _count: { videos: number }
}

export interface GdprRequest {
  id: string
  type: 'EXPORT' | 'DELETE' | 'RECTIFICATION'
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED'
  requestedAt: string
  processedAt: string | null
  exportUrl: string | null
  notes: string | null
}

export interface GdprAdminRequest extends GdprRequest {
  user: { id: string; email: string }
}

export interface GdprAdminStats {
  totalUsers: number
  pendingTotal: number
  requests: Record<string, Record<string, number>>
  consentCoverage: Record<string, { active: number; total: number; pct: number }>
}

export interface ApprovalVideoInfo {
  id: string
  title: string
  thumbnailUrl: string | null
  ageRating: string
}

export interface ParentalApprovalRequest {
  id: string
  profileId: string
  videoId: string
  status: 'PENDING' | 'APPROVED' | 'DENIED'
  requestedAt: string
  resolvedAt: string | null
  video: ApprovalVideoInfo
  profile: { id: string; displayName: string; ageGroup?: string }
}

export interface ConsentRecord {
  id: string
  type: string
  version: string
  consentedAt: string
  revokedAt: string | null
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

export interface AuditLogEntry {
  id: string
  actorId: string | null
  actorRole: string | null
  action: string
  resourceType: string
  resourceId: string | null
  metadata: Record<string, unknown> | null
  ip: string | null
  userAgent: string | null
  occurredAt: string
  actor: { id: string; email: string; role: string } | null
}

export interface UserSubscription {
  id: string
  status: 'ACTIVE' | 'CANCELLED' | 'PAST_DUE' | 'TRIALING' | 'EXPIRED'
  startedAt: string
  expiresAt: string | null
  cancelledAt: string | null
  plan: { id: string; name: string; slug: string; priceEur: number; interval: string }
}

export interface WatchPartyCreated {
  id: string
  code: string
  hostId: string
  playlistId: string
  expiresAt: string
}

export interface WatchPartyInfo {
  id: string
  code: string
  hostId: string
  expiresAt: string
  playlist: { id: string; name: string; _count: { playlistVideos: number } }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function bearer(token: string): { headers: Record<string, string> } {
  return { headers: { Authorization: `Bearer ${token}` } }
}

async function requestBlob(path: string, init: RequestInit = {}): Promise<Blob> {
  const res = await fetch(`${API_URL}${path}`, { ...init, credentials: 'include' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string }
    throw new ApiError(res.status, body.message ?? res.statusText)
  }
  return res.blob()
}

// ── API client ────────────────────────────────────────────────────────────────

export const api = {
  auth: {
    register: (data: { email: string; password: string; role?: string; locale?: string }) =>
      request<{ id: string; email: string }>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

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

    logout: () => request<void>('/auth/logout', { method: 'POST' }),

    refresh: () => request<{ accessToken: string } | undefined>('/auth/refresh', { method: 'POST' }),

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
      request<{ id: string; email: string; role: string; locale: string; weeklyDigestEnabled: boolean; twoFactorEnabled: boolean }>('/users/me', bearer(token)),

    updateLocale: (token: string, locale: string) =>
      request<{ id: string; locale: string }>('/users/me/locale', { method: 'PATCH', body: JSON.stringify({ locale }), ...bearer(token) }),

    setDigestPreference: (token: string, enabled: boolean) =>
      request<{ id: string; weeklyDigestEnabled: boolean }>('/users/me/digest', { method: 'PATCH', body: JSON.stringify({ enabled }), ...bearer(token) }),

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

    changePin: (token: string, profileId: string, currentPin: string, newPin: string) =>
      request<{ changed: boolean }>(`/users/me/profiles/${profileId}/pin`, {
        method: 'PATCH',
        body: JSON.stringify({ currentPin, newPin }),
        ...bearer(token),
      }),

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

    clearHistory: (token: string, profileId: string) =>
      request<void>(`/users/me/profiles/${profileId}/history`, {
        method: 'DELETE',
        ...bearer(token),
      }),

    getInProgress: (token: string, profileId: string) =>
      request<Array<{ positionSec: number; updatedAt: string; video: { id: string; title: string; thumbnailUrl: string | null; durationSec: number | null; embedUrl: string } }>>(
        `/users/me/profiles/${profileId}/in-progress`,
        bearer(token),
      ),

    getProgress: (token: string, profileId: string, videoId: string) =>
      request<{ positionSec: number; completed: boolean }>(
        `/users/me/profiles/${profileId}/progress/${videoId}`,
        bearer(token),
      ),

    saveProgress: (token: string, profileId: string, videoId: string, positionSec: number) =>
      request<void>(`/users/me/profiles/${profileId}/progress/${videoId}`, {
        method: 'PUT',
        body: JSON.stringify({ positionSec }),
        ...bearer(token),
      }),

    getDailyWatchTime: (token: string, profileId: string) =>
      request<{ watchedSec: number }>(`/users/me/profiles/${profileId}/daily-watch-time`, bearer(token)),

    exportHistory: (token: string, profileId: string) =>
      requestBlob(`/users/me/profiles/${profileId}/history/export`, bearer(token)),

    getProfileRatings: (token: string, profileId: string) =>
      request<VideoRating[]>(`/users/me/profiles/${profileId}/ratings`, bearer(token)),

    getVideoRating: (token: string, profileId: string, videoId: string) =>
      request<{ rating: 'THUMBS_UP' | 'THUMBS_DOWN' | null }>(`/users/me/profiles/${profileId}/ratings/${videoId}`, bearer(token)),

    rateVideo: (token: string, profileId: string, videoId: string, rating: 'THUMBS_UP' | 'THUMBS_DOWN' | null) =>
      request<{ rating: string | null }>(`/users/me/profiles/${profileId}/ratings/${videoId}`, {
        method: 'PUT',
        body: JSON.stringify({ rating }),
        ...bearer(token),
      }),
  },

  playlists: {
    list: (token: string) =>
      request<PlaylistSummary[]>('/playlists', bearer(token)),

    getById: (token: string, id: string, profileId?: string) =>
      request<PlaylistDetail>(`/playlists/${id}${profileId ? `?profileId=${profileId}` : ''}`, bearer(token)),

    create: (
      token: string,
      data: {
        name: string
        description?: string
        visibility?: string
        targetAgeGroup?: string[]
        languages?: string[]
        importExternalPlaylist?: boolean
        externalPlaylistUrl?: string
      },
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

    schedule: (token: string, id: string, scheduledPublishAt: string | null) =>
      request<{ id: string; scheduledPublishAt: string | null }>(`/playlists/${id}/schedule`, {
        method: 'PATCH',
        body: JSON.stringify({ scheduledPublishAt }),
        ...bearer(token),
      }),

    listScheduled: (token: string) =>
      request<ScheduledPlaylist[]>('/playlists/scheduled', bearer(token)),

    duplicate: (token: string, id: string) =>
      request<PlaylistSummary>(`/playlists/${id}/duplicate`, { method: 'POST', ...bearer(token) }),

    exportCsv: (token: string, id: string) =>
      requestBlob(`/playlists/${id}/export`, bearer(token)),
  },

  videos: {
    autocomplete: (token: string, q: string) =>
      request<Array<{ id: string; title: string; thumbnailUrl?: string | null }>>(
        `/videos/autocomplete?q=${encodeURIComponent(q)}`,
        bearer(token),
      ),

    listTags: (token: string) =>
      request<Tag[]>('/videos/tags', bearer(token)),

    search: (token: string, params: { q?: string; language?: string; ageRating?: string; tags?: string[]; page?: number; limit?: number }) => {
      const qs = new URLSearchParams()
      if (params.q) qs.set('q', params.q)
      if (params.language) qs.set('language', params.language)
      if (params.ageRating) qs.set('ageRating', params.ageRating)
      if (params.tags?.length) qs.set('tags', params.tags.join(','))
      if (params.page) qs.set('page', String(params.page))
      if (params.limit) qs.set('limit', String(params.limit))
      return request<{ items: VideoSearchResult[]; total: number; page: number; pages: number }>(
        `/videos/search?${qs}`,
        bearer(token),
      )
    },

    getById: (token: string, id: string) =>
      request<VideoSearchResult>(`/videos/${id}`, bearer(token)),

    getSimilar: (token: string, id: string, limit = 4) =>
      request<VideoSummary[]>(`/videos/${id}/similar?limit=${limit}`, bearer(token)),

    getRatings: (token: string, id: string) =>
      request<{ thumbsUp: number; thumbsDown: number; total: number }>(`/videos/${id}/ratings`, bearer(token)),

    submit: (token: string, data: { url: string; ageRating?: string; language?: string }) =>
      request<VideoSearchResult>('/videos', { method: 'POST', body: JSON.stringify(data), ...bearer(token) }),

    mySubmissions: (token: string) =>
      request<VideoSubmission[]>('/videos/submissions', bearer(token)),

    approveSubmission: (token: string, id: string) =>
      request<Pick<VideoSubmission, 'id' | 'title' | 'validationStatus' | 'submitterApprovedAt'>>(
        `/videos/${id}/submitter-approval`,
        { method: 'PATCH', ...bearer(token) },
      ),

    approvePlaylistSubmissions: (token: string, playlistId: string) =>
      request<{ queued: number }>(`/videos/playlists/${playlistId}/submissions/approve`, {
        method: 'PATCH',
        ...bearer(token),
      }),

    updateSubmission: (token: string, id: string, data: { title: string }) =>
      request<{ id: string; title: string }>(`/videos/submissions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
        ...bearer(token),
      }),

    report: (token: string, id: string, data: { reason: string; description?: string }) =>
      request<{ id: string }>(`/videos/${id}/report`, { method: 'POST', body: JSON.stringify(data), ...bearer(token) }),

    adminQueue: (token: string, params?: { status?: string; q?: string; page?: number; limit?: number }) => {
      const qs = new URLSearchParams()
      if (params?.status) qs.set('status', params.status)
      if (params?.q) qs.set('q', params.q)
      if (params?.page) qs.set('page', String(params.page))
      if (params?.limit) qs.set('limit', String(params.limit))
      return request<{
        items: Array<{
          id: string; title: string; thumbnailUrl: string | null
          validationStatus: string; ageRating: string; language: string | null
          createdAt: string; submittedById: string | null
          source: { name: string; slug: string } | null
        }>
        total: number; page: number; pages: number
      }>(`/videos/admin/queue?${qs}`, bearer(token))
    },

    bulkUpdateStatus: (token: string, ids: string[], action: 'APPROVE' | 'REJECT') =>
      request<{ updated: number }>('/videos/admin/bulk', {
        method: 'PATCH',
        body: JSON.stringify({ ids, action }),
        ...bearer(token),
      }),

    listSources: (token: string) =>
      request<VideoSource[]>('/videos/sources', bearer(token)),

    createSource: (
      token: string,
      data: { name: string; slug: string; baseUrl: string; embedAllowed?: boolean; cguVersion?: string; embedPolicy?: Record<string, unknown> },
    ) => request<VideoSource>('/videos/sources', { method: 'POST', body: JSON.stringify(data), ...bearer(token) }),

    updateSource: (
      token: string,
      id: string,
      data: { embedAllowed?: boolean; isActive?: boolean; cguVersion?: string; baseUrl?: string; embedPolicy?: Record<string, unknown> | null },
    ) => request<VideoSource>(`/videos/sources/${id}`, { method: 'PATCH', body: JSON.stringify(data), ...bearer(token) }),

    verifySource: (token: string, id: string) =>
      request<VideoSource>(`/videos/sources/${id}/verify`, { method: 'POST', ...bearer(token) }),
  },

  blocks: {
    list: (token: string, profileId?: string) =>
      request<UserBlock[]>(`/users/me/blocks${profileId ? `?profileId=${profileId}` : ''}`, bearer(token)),

    create: (token: string, data: { profileId?: string; type: string; value: string }) =>
      request<UserBlock>('/users/me/blocks', { method: 'POST', body: JSON.stringify(data), ...bearer(token) }),

    delete: (token: string, blockId: string) =>
      request<void>(`/users/me/blocks/${blockId}`, { method: 'DELETE', ...bearer(token) }),
  },

  categoryLimits: {
    list: (token: string, profileId: string) =>
      request<ProfileCategoryLimit[]>(`/users/me/profiles/${profileId}/category-limits`, bearer(token)),

    upsert: (token: string, profileId: string, tagId: string, dailyLimitMin: number) =>
      request<ProfileCategoryLimit>(`/users/me/profiles/${profileId}/category-limits/${tagId}`, {
        method: 'PUT',
        body: JSON.stringify({ dailyLimitMin }),
        ...bearer(token),
      }),

    delete: (token: string, profileId: string, tagId: string) =>
      request<void>(`/users/me/profiles/${profileId}/category-limits/${tagId}`, {
        method: 'DELETE',
        ...bearer(token),
      }),
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

    getVapidKey: () =>
      request<{ publicKey: string }>('/notifications/web-push/vapid-key'),

    subscribeWebPush: (token: string, sub: { endpoint: string; p256dh: string; auth: string }) =>
      request<{ subscribed: boolean }>('/notifications/web-push/subscribe', {
        method: 'POST',
        body: JSON.stringify(sub),
        ...bearer(token),
      }),

    unsubscribeWebPush: (token: string, endpoint: string) =>
      request<{ unsubscribed: boolean }>('/notifications/web-push/unsubscribe', {
        method: 'DELETE',
        body: JSON.stringify({ endpoint }),
        ...bearer(token),
      }),
  },

  gdpr: {
    requestExport: (token: string) =>
      request<GdprRequest>('/gdpr/export', { method: 'POST', ...bearer(token) }),

    requestDeletion: (token: string) =>
      request<GdprRequest>('/gdpr/delete', { method: 'POST', ...bearer(token) }),

    myRequests: (token: string) =>
      request<GdprRequest[]>('/gdpr/my-requests', bearer(token)),

    getRequest: (token: string, id: string) =>
      request<GdprRequest>(`/gdpr/requests/${id}`, bearer(token)),

    getMyData: (token: string) =>
      request<Record<string, unknown>>('/gdpr/my-data', bearer(token)),

    adminStats: (token: string) =>
      request<GdprAdminStats>('/gdpr/admin/stats', bearer(token)),

    adminListRequests: (token: string, params?: { status?: string; type?: string; page?: number; limit?: number }) => {
      const qs = new URLSearchParams()
      if (params?.status) qs.set('status', params.status)
      if (params?.type) qs.set('type', params.type)
      if (params?.page) qs.set('page', String(params.page))
      if (params?.limit) qs.set('limit', String(params.limit))
      return request<{ items: GdprAdminRequest[]; total: number; page: number; pages: number }>(
        `/gdpr/admin/requests?${qs}`, bearer(token))
    },

    adminUpdateRequest: (token: string, id: string, data: { status: string; notes?: string }) =>
      request<GdprRequest>(`/gdpr/admin/requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
        ...bearer(token),
      }),
  },

  consent: {
    current: (token: string) =>
      request<ConsentRecord[]>('/consent/current', bearer(token)),

    history: (token: string) =>
      request<ConsentRecord[]>('/consent/history', bearer(token)),

    record: (token: string, data: { type: string; version: string }) =>
      request<ConsentRecord>('/consent', { method: 'POST', body: JSON.stringify(data), ...bearer(token) }),

    revoke: (token: string, type: string) =>
      request<void>(`/consent/${type}`, { method: 'DELETE', ...bearer(token) }),
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

  admin: {
    getAuditLogs: (
      token: string,
      params?: { page?: number; limit?: number; actorId?: string; action?: string; resourceType?: string; dateFrom?: string; dateTo?: string },
    ) => {
      const qs = new URLSearchParams()
      if (params?.page) qs.set('page', String(params.page))
      if (params?.limit) qs.set('limit', String(params.limit))
      if (params?.actorId) qs.set('actorId', params.actorId)
      if (params?.action) qs.set('action', params.action)
      if (params?.resourceType) qs.set('resourceType', params.resourceType)
      if (params?.dateFrom) qs.set('dateFrom', params.dateFrom)
      if (params?.dateTo) qs.set('dateTo', params.dateTo)
      return request<{
        items: AuditLogEntry[]
        total: number
        page: number
        limit: number
      }>(`/admin/audit-logs?${qs}`, bearer(token))
    },
  },

  approvals: {
    request: (token: string, profileId: string, videoId: string) =>
      request<ParentalApprovalRequest>(`/users/me/profiles/${profileId}/approval-requests`, {
        method: 'POST',
        body: JSON.stringify({ videoId }),
        ...bearer(token),
      }),

    list: (token: string, status?: string) =>
      request<ParentalApprovalRequest[]>(
        `/users/me/approval-requests${status ? `?status=${status}` : ''}`,
        bearer(token),
      ),

    resolve: (token: string, requestId: string, action: 'APPROVED' | 'DENIED') =>
      request<ParentalApprovalRequest>(`/users/me/approval-requests/${requestId}`, {
        method: 'PATCH',
        body: JSON.stringify({ action }),
        ...bearer(token),
      }),

    getStatus: (token: string, profileId: string, videoId: string) =>
      request<{ status: 'PENDING' | 'APPROVED' | 'DENIED' | null; requestId: string | null; requestedAt: string | null }>(
        `/users/me/profiles/${profileId}/approval-requests/${videoId}`,
        bearer(token),
      ),
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

  watchParties: {
    create: (token: string, playlistId: string) =>
      request<WatchPartyCreated>('/watch-parties', {
        method: 'POST',
        body: JSON.stringify({ playlistId }),
        ...bearer(token),
      }),

    getByCode: (code: string) =>
      request<WatchPartyInfo>(`/watch-parties/code/${encodeURIComponent(code)}`),
  },
}
