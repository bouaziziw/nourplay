'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../../hooks/useAuth'
import { api, AdminStats } from '../../lib/api'

function StatCard({ label, value, sub, href, color = 'sky' }: {
  label: string; value: number | string; sub?: string; href?: string; color?: string
}) {
  const colorMap: Record<string, string> = {
    indigo: 'text-[#1c90d8]',
    green: 'text-emerald-600',
    amber: 'text-amber-600',
    red: 'text-rose-600',
    sky: 'text-[#1c90d8]',
  }
  const card = (
    <div className="bg-white/80 border border-slate-200/90 rounded-xl p-5 hover:border-[#1c90d8] transition-colors shadow-xs backdrop-blur-sm">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{label}</p>
      <p className={`text-3xl font-extrabold ${colorMap[color] ?? 'text-slate-900'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  )
  return href ? <Link href={href}>{card}</Link> : card
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-700 border border-rose-200',
  NEEDS_REVIEW: 'bg-amber-50 text-amber-700 border border-amber-200',
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-rose-50 text-rose-700 border border-rose-200',
  MODERATOR: 'bg-amber-50 text-amber-700 border border-amber-200',
  TEACHER: 'bg-sky-50 text-[#1c90d8] border border-sky-200',
  PARENT: 'bg-sky-50 text-[#1c90d8] border border-sky-200',
}

export default function DashboardPage() {
  const { token } = useAuth()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    api.admin.getStats(token)
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-[#1c90d8] border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!stats) return (
    <div className="p-8 text-slate-500 text-sm">Impossible de charger les statistiques.</div>
  )

  const videoTotal = stats.videos.total
  const approved = stats.videos.byStatus['APPROVED'] ?? 0
  const needsReview = stats.videos.byStatus['NEEDS_REVIEW'] ?? 0
  const rejected = stats.videos.byStatus['REJECTED'] ?? 0
  const pending = stats.videos.byStatus['PENDING'] ?? 0

  return (
    <div className="p-8 space-y-8 bg-transparent text-slate-900">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Vue d&apos;ensemble</h1>
        <p className="text-slate-500 text-sm mt-1">Statistiques de la plateforme en temps réel</p>
      </div>

      {/* Primary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Utilisateurs" value={stats.users.total} color="indigo" href="/dashboard/users" />
        <StatCard label="Vidéos" value={videoTotal} color="sky" />
        <StatCard
          label="Signalements en attente"
          value={stats.moderation.pendingReports}
          color={stats.moderation.pendingReports > 0 ? 'red' : 'green'}
          href="/dashboard/moderation/reports"
        />
        <StatCard
          label="Demandes GDPR"
          value={stats.gdpr.pendingRequests}
          color={stats.gdpr.pendingRequests > 0 ? 'amber' : 'green'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users by role */}
        <div className="bg-white/80 border border-slate-200/90 rounded-xl p-5 shadow-xs backdrop-blur-sm">
          <h2 className="text-sm font-bold text-slate-900 mb-4">Utilisateurs par rôle</h2>
          <div className="space-y-3">
            {Object.entries(stats.users.byRole).map(([role, count]) => (
              <div key={role} className="flex items-center justify-between">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ROLE_COLORS[role] ?? 'bg-slate-100 text-slate-600'}`}>
                  {role}
                </span>
                <div className="flex items-center gap-3 flex-1 mx-4">
                  <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-[#1c90d8] rounded-full"
                      style={{ width: `${stats.users.total > 0 ? (count / stats.users.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-bold text-slate-900 w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Videos by status */}
        <div className="bg-white/80 border border-slate-200/90 rounded-xl p-5 shadow-xs backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900">Vidéos par statut</h2>
            {needsReview > 0 && (
              <Link href="/dashboard/moderation" className="text-xs text-[#1c90d8] hover:underline font-bold">
                {needsReview} à réviser →
              </Link>
            )}
          </div>
          <div className="space-y-3">
            {[
              { key: 'APPROVED', count: approved },
              { key: 'NEEDS_REVIEW', count: needsReview },
              { key: 'PENDING', count: pending },
              { key: 'REJECTED', count: rejected },
            ].map(({ key, count }) => (
              <div key={key} className="flex items-center justify-between">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[key] ?? 'bg-slate-100 text-slate-600'}`}>
                  {key}
                </span>
                <div className="flex items-center gap-3 flex-1 mx-4">
                  <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-[#1c90d8] rounded-full"
                      style={{ width: `${videoTotal > 0 ? (count / videoTotal) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-bold text-slate-900 w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/dashboard/moderation" className="group bg-white/80 border border-slate-200/90 rounded-xl p-5 hover:border-[#1c90d8] hover:shadow-sm transition-all">
          <p className="text-2xl mb-3">▶</p>
          <p className="font-bold text-slate-900 text-sm group-hover:text-[#1c90d8] transition-colors">File de modération</p>
          <p className="text-xs text-slate-500 mt-1">{needsReview} vidéo{needsReview !== 1 ? 's' : ''} en attente</p>
        </Link>
        <Link href="/dashboard/moderation/reports" className="group bg-white/80 border border-slate-200/90 rounded-xl p-5 hover:border-[#1c90d8] hover:shadow-sm transition-all">
          <p className="text-2xl mb-3">⚑</p>
          <p className="font-bold text-slate-900 text-sm group-hover:text-[#1c90d8] transition-colors">Signalements</p>
          <p className="text-xs text-slate-500 mt-1">{stats.moderation.pendingReports} non résolu{stats.moderation.pendingReports !== 1 ? 's' : ''}</p>
        </Link>
        <Link href="/dashboard/audit" className="group bg-white/80 border border-slate-200/90 rounded-xl p-5 hover:border-[#1c90d8] hover:shadow-sm transition-all">
          <p className="text-2xl mb-3">≡</p>
          <p className="font-bold text-slate-900 text-sm group-hover:text-[#1c90d8] transition-colors">Journal d&apos;audit</p>
          <p className="text-xs text-slate-500 mt-1">Toutes les actions</p>
        </Link>
      </div>
    </div>
  )
}
