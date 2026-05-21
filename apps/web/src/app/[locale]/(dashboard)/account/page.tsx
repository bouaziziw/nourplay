'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../../../hooks/useAuth'
import { api, GdprRequest } from '../../../../lib/api'

function RequestStatus({ req }: { req: GdprRequest }) {
  const STATUS_LABEL: Record<string, string> = {
    PENDING: 'En attente',
    PROCESSING: 'En cours de traitement',
    COMPLETED: 'Complété',
    FAILED: 'Échoué',
  }
  const STATUS_COLOR: Record<string, string> = {
    PENDING: 'text-amber-600',
    PROCESSING: 'text-blue-600',
    COMPLETED: 'text-green-600',
    FAILED: 'text-red-600',
  }
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm">
      <p className="font-medium text-gray-800">{req.type === 'EXPORT' ? 'Export de données' : 'Suppression de compte'}</p>
      <p className={`text-xs mt-0.5 ${STATUS_COLOR[req.status] ?? 'text-gray-500'}`}>{STATUS_LABEL[req.status] ?? req.status}</p>
      <p className="text-xs text-gray-400 mt-0.5">
        Demandé le {new Date(req.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
    </div>
  )
}

export default function AccountPage() {
  const router = useRouter()
  const { user, token, logout } = useAuth()
  const [exportReq, setExportReq] = useState<GdprRequest | null>(null)
  const [deleteReq, setDeleteReq] = useState<GdprRequest | null>(null)
  const [requesting, setRequesting] = useState<'export' | 'delete' | null>(null)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleExport = async () => {
    if (!token) return
    setRequesting('export')
    setError('')
    try {
      const req = await api.gdpr.requestExport(token)
      setExportReq(req)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la demande.')
    } finally {
      setRequesting(null)
    }
  }

  const handleDelete = async () => {
    if (!token) return
    setRequesting('delete')
    setError('')
    try {
      const req = await api.gdpr.requestDeletion(token)
      setDeleteReq(req)
      setConfirmDelete(false)
      await logout()
      router.replace('/login')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la demande.')
    } finally {
      setRequesting(null)
    }
  }

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mon compte</h1>
        <p className="text-sm text-gray-500 mt-1">Informations et droits RGPD</p>
      </div>

      {/* Profile info */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
        <h2 className="font-semibold text-gray-900">Informations</h2>
        <div className="text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-500">Email</span>
            <span className="text-gray-900 font-medium">{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Rôle</span>
            <span className="text-gray-900 font-medium capitalize">{user?.role?.toLowerCase()}</span>
          </div>
        </div>
      </div>

      {/* GDPR rights */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-5">
        <div>
          <h2 className="font-semibold text-gray-900">Vos droits RGPD</h2>
          <p className="text-xs text-gray-500 mt-1">
            Conformément au RGPD et à la loi Informatique et Libertés, vous disposez des droits suivants sur vos données personnelles.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* Export */}
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium text-gray-800">Droit d'accès — Export de données</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Téléchargez une copie de toutes vos données personnelles stockées sur NourPlay.
            </p>
          </div>
          {exportReq ? (
            <RequestStatus req={exportReq} />
          ) : (
            <button
              onClick={handleExport}
              disabled={requesting !== null}
              className="h-9 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {requesting === 'export' ? 'Demande en cours…' : 'Demander un export'}
            </button>
          )}
        </div>

        <div className="border-t border-gray-100" />

        {/* Deletion */}
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium text-gray-800">Droit à l'effacement — Suppression du compte</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Demandez la suppression définitive de votre compte et de toutes vos données. Cette action est irréversible.
            </p>
          </div>
          {deleteReq ? (
            <RequestStatus req={deleteReq} />
          ) : confirmDelete ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
              <p className="text-sm text-red-700 font-medium">
                Confirmer la suppression de votre compte ?
              </p>
              <p className="text-xs text-red-600">
                Toutes vos données (profils, playlists, historique) seront supprimées de façon permanente. Vous serez déconnecté immédiatement.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  disabled={requesting !== null}
                  className="h-9 px-4 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {requesting === 'delete' ? 'Suppression…' : 'Oui, supprimer mon compte'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="h-9 px-4 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="h-9 px-4 border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors"
            >
              Supprimer mon compte
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
