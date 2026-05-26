'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../../../hooks/useAuth'
import { api, ApiError, GdprRequest } from '../../../../lib/api'

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

  // 2FA state — override tracks optimistic updates after enable/disable
  const [twoFaOverride, setTwoFaOverride] = useState<boolean | null>(null)
  const twoFaEnabled = twoFaOverride ?? (user?.twoFactorEnabled ?? false)
  const [totpSetup, setTotpSetup] = useState<{ qrCode: string; secret: string } | null>(null)
  const [totpCode, setTotpCode] = useState('')
  const [totpError, setTotpError] = useState('')
  const [totpLoading, setTotpLoading] = useState(false)
  const [showDisable, setShowDisable] = useState(false)

  useEffect(() => {
    if (user?.twoFactorEnabled !== undefined) setTwoFaOverride(null)
  }, [user?.twoFactorEnabled])

  const handleInit2fa = async () => {
    if (!token) return
    setTotpLoading(true)
    setTotpError('')
    try {
      const res = await api.auth.initTotp(token)
      setTotpSetup({ qrCode: res.qrCode, secret: res.secret })
      setTotpCode('')
    } catch (e) {
      setTotpError(e instanceof ApiError ? e.message : 'Erreur lors de l\'initialisation.')
    } finally {
      setTotpLoading(false)
    }
  }

  const handleEnable2fa = async () => {
    if (!token || totpCode.length !== 6) return
    setTotpLoading(true)
    setTotpError('')
    try {
      await api.auth.enableTotp(token, totpCode)
      setTwoFaOverride(true)
      setTotpSetup(null)
      setTotpCode('')
    } catch (e) {
      setTotpError(e instanceof ApiError ? e.message : 'Code incorrect.')
    } finally {
      setTotpLoading(false)
    }
  }

  const handleDisable2fa = async () => {
    if (!token || totpCode.length !== 6) return
    setTotpLoading(true)
    setTotpError('')
    try {
      await api.auth.disableTotp(token, totpCode)
      setTwoFaOverride(false)
      setShowDisable(false)
      setTotpCode('')
    } catch (e) {
      setTotpError(e instanceof ApiError ? e.message : 'Code incorrect.')
    } finally {
      setTotpLoading(false)
    }
  }

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

      {/* Security — 2FA */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-5">
        <div>
          <h2 className="font-semibold text-gray-900">Sécurité</h2>
          <p className="text-xs text-gray-500 mt-1">Renforcez la sécurité de votre compte avec la double authentification.</p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800">Double authentification (2FA)</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {twoFaEnabled ? 'Activée — votre compte est protégé.' : 'Désactivée — recommandée pour sécuriser votre accès.'}
            </p>
          </div>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${twoFaEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {twoFaEnabled ? 'Activée' : 'Désactivée'}
          </span>
        </div>

        {totpError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{totpError}</div>
        )}

        {!twoFaEnabled && !totpSetup && (
          <button
            onClick={handleInit2fa}
            disabled={totpLoading}
            className="h-9 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {totpLoading ? 'Chargement…' : 'Activer la 2FA'}
          </button>
        )}

        {!twoFaEnabled && totpSetup && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Scannez ce QR code avec votre application d'authentification (Google Authenticator, Authy…), puis entrez le code généré.
            </p>
            <img src={totpSetup.qrCode} alt="QR Code 2FA" className="w-40 h-40 rounded-xl border border-gray-200" />
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-500 mb-0.5">Ou entrez le code manuellement :</p>
              <code className="text-xs font-mono text-gray-800 break-all select-all">{totpSetup.secret}</code>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code de vérification</label>
                <input
                  type="text" inputMode="numeric" pattern="\d{6}" maxLength={6}
                  value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-36 h-10 rounded-lg border border-gray-300 px-3 text-center text-xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleEnable2fa}
                  disabled={totpLoading || totpCode.length !== 6}
                  className="h-9 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {totpLoading ? 'Vérification…' : 'Confirmer et activer'}
                </button>
                <button
                  onClick={() => { setTotpSetup(null); setTotpCode(''); setTotpError('') }}
                  className="h-9 px-4 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}

        {twoFaEnabled && !showDisable && (
          <button
            onClick={() => { setShowDisable(true); setTotpCode(''); setTotpError('') }}
            className="h-9 px-4 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Désactiver la 2FA
          </button>
        )}

        {twoFaEnabled && showDisable && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-amber-800">
              Entrez votre code TOTP actuel pour désactiver la double authentification.
            </p>
            <input
              type="text" inputMode="numeric" pattern="\d{6}" maxLength={6}
              value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-36 h-10 rounded-lg border border-amber-300 px-3 text-center text-xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <div className="flex gap-2">
              <button
                onClick={handleDisable2fa}
                disabled={totpLoading || totpCode.length !== 6}
                className="h-9 px-4 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {totpLoading ? 'Désactivation…' : 'Désactiver'}
              </button>
              <button
                onClick={() => { setShowDisable(false); setTotpCode(''); setTotpError('') }}
                className="h-9 px-4 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
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
