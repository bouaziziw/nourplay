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

function bearer(token: string): { headers: Record<string, string> } {
  return { headers: { Authorization: `Bearer ${token}` } }
}

// ── Domain types ──────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string
  email: string
  role: string
  locale: string
  emailVerified: boolean
  twoFactorEnabled: boolean
  createdAt: string
  deletedAt: string | null
  _count: { childProfiles: number; playlists: number; consentRecords?: number; gdprRequests?: number }
}

export interface AdminStats {
  users: { total: number; byRole: Record<string, number> }
  videos: { total: number; byStatus: Record<string, number> }
  moderation: { pendingReports: number }
  gdpr: { pendingRequests: number }
}

export interface QueueVideo {
  id: string
  title: string
  description: string | null
  embedUrl: string
  thumbnailUrl: string | null
  durationSec: number | null
  language: string | null
  ageRating: string
  validationStatus: string
  validationScore: number | null
  validationLog: Record<string, unknown> | null
  createdAt: string
  source: { name: string; slug: string } | null
}

export interface VideoReport {
  id: string
  reason: string
  description: string | null
  resolved: boolean
  resolvedAt: string | null
  createdAt: string
  video: { id: string; title: string; thumbnailUrl: string | null; validationStatus: string }
  reporter: { id: string; email: string }
}

export interface AuditLog {
  id: string
  action: string
  resourceType: string
  resourceId: string | null
  metadata: Record<string, unknown> | null
  ip: string | null
  occurredAt: string
  actor: { id: string; email: string; role: string } | null
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

// ── API client ────────────────────────────────────────────────────────────────

export const api = {
  auth: {
    login: (data: { email: string; password: string }) =>
      request<{ accessToken?: string; requiresTwoFactor?: boolean; userId?: string }>(
        '/auth/login', { method: 'POST', body: JSON.stringify(data) }),

    loginWith2fa: (data: { userId: string; code: string }) =>
      request<{ accessToken: string }>('/auth/login/2fa', { method: 'POST', body: JSON.stringify(data) }),

    logout: () => request<void>('/auth/logout', { method: 'POST' }),
    refresh: () => request<{ accessToken: string }>('/auth/refresh', { method: 'POST' }),
    me: (token: string) =>
      request<{ id: string; email: string; role: string; locale: string }>('/users/me', bearer(token)),
  },

  admin: {
    getStats: (token: string) =>
      request<AdminStats>('/admin/stats', bearer(token)),

    getUsers: (token: string, params: { page?: number; limit?: number; role?: string; search?: string; deleted?: boolean }) => {
      const qs = new URLSearchParams()
      if (params.page) qs.set('page', String(params.page))
      if (params.limit) qs.set('limit', String(params.limit))
      if (params.role) qs.set('role', params.role)
      if (params.search) qs.set('search', params.search)
      if (params.deleted !== undefined) qs.set('deleted', String(params.deleted))
      return request<Paginated<AdminUser>>(`/admin/users?${qs}`, bearer(token))
    },

    getUserById: (token: string, id: string) =>
      request<AdminUser>(`/admin/users/${id}`, bearer(token)),

    updateUser: (token: string, id: string, data: { role?: string; banned?: boolean }) =>
      request<AdminUser>(`/admin/users/${id}`, {
        method: 'PATCH', body: JSON.stringify(data), ...bearer(token),
      }),

    getAuditLogs: (token: string, params: { page?: number; limit?: number; actorId?: string; action?: string; resourceType?: string; dateFrom?: string; dateTo?: string }) => {
      const qs = new URLSearchParams()
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined) qs.set(k, String(v)) })
      return request<Paginated<AuditLog>>(`/admin/audit-logs?${qs}`, bearer(token))
    },
  },

  moderation: {
    getQueue: (token: string, params: { page?: number; limit?: number; ageRating?: string }) => {
      const qs = new URLSearchParams()
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined) qs.set(k, String(v)) })
      return request<Paginated<QueueVideo>>(`/moderation/queue?${qs}`, bearer(token))
    },

    reviewVideo: (token: string, videoId: string, data: { action: 'approve' | 'reject'; reason?: string }) =>
      request<QueueVideo>(`/moderation/videos/${videoId}/review`, {
        method: 'PATCH', body: JSON.stringify(data), ...bearer(token),
      }),

    getReports: (token: string, params: { page?: number; limit?: number; resolved?: boolean }) => {
      const qs = new URLSearchParams()
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined) qs.set(k, String(v)) })
      return request<Paginated<VideoReport>>(`/moderation/reports?${qs}`, bearer(token))
    },

    getReport: (token: string, id: string) =>
      request<VideoReport>(`/moderation/reports/${id}`, bearer(token)),

    resolveReport: (token: string, id: string, notes?: string) =>
      request<VideoReport>(`/moderation/reports/${id}/resolve`, {
        method: 'PATCH', body: JSON.stringify({ notes }), ...bearer(token),
      }),
  },
}
