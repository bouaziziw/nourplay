const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'

class ApiError extends Error {
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

export const api = {
  auth: {
    register: (data: { email: string; password: string; role?: string; locale?: string }) =>
      request<{ id: string; email: string }>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

    login: (data: { email: string; password: string }) =>
      request<{ accessToken?: string; requiresTwoFactor?: boolean; userId?: string }>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

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
  },

  users: {
    me: (token: string) => request<{ id: string; email: string; role: string; locale: string }>('/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    }),
    profiles: (token: string) => request<Array<{ id: string; displayName: string; ageGroup: string }>>('/users/me/profiles', {
      headers: { Authorization: `Bearer ${token}` },
    }),
  },

  playlists: {
    list: (token: string) => request<Array<{ id: string; name: string; _count: { playlistVideos: number } }>>('/playlists', {
      headers: { Authorization: `Bearer ${token}` },
    }),
  },
}

export { ApiError }
