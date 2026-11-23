function getApiUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL?.startsWith('/')) {
    return process.env.NEXT_PUBLIC_API_URL
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host.endsWith('vercel.app') || host.endsWith('nour-play.app')) {
      return '/api/v1'
    }
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'
}

const API_URL = getApiUrl()

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

let activeRefreshPromise: Promise<string | null> | null = null
let onTokenUpdateCallback: ((token: string) => void) | null = null

export function setOnTokenUpdate(callback: ((token: string) => void) | null) {
  onTokenUpdateCallback = callback
}

export async function refreshAccessToken(): Promise<string | null> {
  if (activeRefreshPromise) return activeRefreshPromise
  activeRefreshPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) return null
      const data = await res.json().catch(() => null) as { accessToken?: string } | null
      if (data?.accessToken) {
        onTokenUpdateCallback?.(data.accessToken)
        return data.accessToken
      }
      return null
    } catch {
      return null
    } finally {
      activeRefreshPromise = null
    }
  })()
  return activeRefreshPromise
}

async function request<T>(path: string, init: RequestInit = {}, isRetry = false): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })

  // En cas de 401 Unauthorized sur une requête authentifiée, tenter un rafraîchissement transparent du token
  if (
    res.status === 401
    && !isRetry
    && !path.startsWith('/auth/login')
    && !path.startsWith('/auth/refresh')
  ) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      const newHeaders: Record<string, string> = {
        ...(init.headers as Record<string, string>),
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newToken}`,
      }
      return request<T>(path, { ...init, headers: newHeaders }, true)
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string }
    throw new ApiError(res.status, body.message ?? res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

function bearer(token?: string | null): { headers: Record<string, string> } {
  return token ? { headers: { Authorization: `Bearer ${token}` } } : { headers: {} }
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

export interface ComplianceStats {
  consents: {
    activeTotal: number
    revokedTotal: number
    byType: Record<string, number>
    activeAll: number
  }
  gdpr: {
    byStatus: Record<string, number>
    byType: Record<string, number>
    pendingRequests: Array<{
      id: string
      type: string
      status: string
      requestedAt: string
      user: { id: string; email: string }
    }>
  }
}

export interface LegalDocument {
  id: string
  type: string
  version: string
  content?: string
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  createdById: string | null
}

export interface AdminSubscription {
  id: string
  status: 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED'
  startedAt: string
  expiresAt: string | null
  cancelledAt: string | null
  externalId: string | null
  user: { id: string; email: string; role: string }
  plan: { id: string; name: string; slug: string; priceEur: number; interval: string }
}

export interface SubscriptionStats {
  total: number
  byStatus: Record<string, number>
  byPlan: Record<string, number>
}

export interface SubscriptionPlan {
  id: string
  name: string
  slug: string
  priceEur: number
  interval: 'MONTHLY' | 'YEARLY'
  isActive: boolean
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

    updateUser: (token: string, id: string, data: { role?: string; banned?: boolean; email?: string; password?: string }) =>
      request<AdminUser>(`/admin/users/${id}`, {
        method: 'PATCH', body: JSON.stringify(data), ...bearer(token),
      }),

    getAuditLogs: (token: string, params: { page?: number; limit?: number; actorId?: string; action?: string; resourceType?: string; dateFrom?: string; dateTo?: string }) => {
      const qs = new URLSearchParams()
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined) qs.set(k, String(v)) })
      return request<Paginated<AuditLog>>(`/admin/audit-logs?${qs}`, bearer(token))
    },

    getComplianceStats: (token: string) =>
      request<ComplianceStats>('/admin/compliance', bearer(token)),

    listLegalDocuments: (token: string) =>
      request<LegalDocument[]>('/admin/legal', bearer(token)),

    getLegalDocument: (token: string, id: string) =>
      request<LegalDocument>(`/admin/legal/${id}`, bearer(token)),

    createLegalDocument: (token: string, data: { type: string; version: string; content: string }) =>
      request<LegalDocument>('/admin/legal', { method: 'POST', body: JSON.stringify(data), ...bearer(token) }),

    publishLegalDocument: (token: string, id: string) =>
      request<LegalDocument>(`/admin/legal/${id}/publish`, { method: 'PATCH', ...bearer(token) }),

    getSubscriptions: (token: string, params: { page?: number; limit?: number; status?: string; userId?: string }) => {
      const qs = new URLSearchParams()
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined) qs.set(k, String(v)) })
      return request<Paginated<AdminSubscription>>(`/admin/subscriptions?${qs}`, bearer(token))
    },

    getSubscriptionStats: (token: string) =>
      request<SubscriptionStats>('/admin/subscriptions/stats', bearer(token)),

    grantSubscription: (token: string, data: { userId: string; planId: string; expiresAt?: string }) =>
      request<AdminSubscription>('/admin/subscriptions', {
        method: 'POST', body: JSON.stringify(data), ...bearer(token),
      }),

    revokeSubscription: (token: string, id: string) =>
      request<AdminSubscription>(`/admin/subscriptions/${id}`, { method: 'DELETE', ...bearer(token) }),

    getPlans: (token: string) =>
      request<SubscriptionPlan[]>('/subscriptions/plans', bearer(token)),
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

    deleteVideo: (token: string, videoId: string) =>
      request<{ id: string }>(`/videos/admin/${videoId}`, { method: 'DELETE', ...bearer(token) }),

    approveAll: (token: string) =>
      request<{ updated: number }>('/moderation/approve-all', {
        method: 'PATCH',
        ...bearer(token),
      }),

    revalidateAllPending: (token?: string | null) =>
      request<{
        queued: number
        processed?: number
        approved?: number
        rejected?: number
        needsReview?: number
      }>('/videos/admin/revalidate-pending', {
        method: 'POST',
        ...bearer(token),
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
