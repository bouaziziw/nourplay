'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../../../../hooks/useAuth'
import { api, ApiError, SubscriptionPlan, UserSubscription } from '../../../../lib/api'

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Actif',
  TRIALING: 'Essai',
  PAST_DUE: 'Paiement en retard',
  CANCELLED: 'Annulé',
  EXPIRED: 'Expiré',
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  TRIALING: 'bg-blue-100 text-blue-700',
  PAST_DUE: 'bg-yellow-100 text-yellow-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
  EXPIRED: 'bg-red-100 text-red-600',
}

export default function SubscriptionPage() {
  const { token } = useAuth()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [loadingSub, setLoadingSub] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.subscriptions.getPlans()
      .then(setPlans)
      .catch(() => setError('Impossible de charger les plans.'))
      .finally(() => setLoadingPlans(false))
  }, [])

  useEffect(() => {
    if (!token) return
    setLoadingSub(true)
    api.subscriptions.getMine(token)
      .then(setSubscription)
      .catch(() => {})
      .finally(() => setLoadingSub(false))
  }, [token])

  const handleCheckout = async (planId: string) => {
    if (!token) return
    setCheckoutLoading(planId)
    setError(null)
    try {
      const { url } = await api.subscriptions.checkout(token, planId)
      window.location.href = url
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur lors de la création de la session.')
      setCheckoutLoading(null)
    }
  }

  const handlePortal = async () => {
    if (!token) return
    setPortalLoading(true)
    setError(null)
    try {
      const { url } = await api.subscriptions.portal(token)
      window.location.href = url
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur lors de l\'accès au portail.')
      setPortalLoading(false)
    }
  }

  const isActive = subscription?.status === 'ACTIVE' || subscription?.status === 'TRIALING'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Abonnement</h1>
        <p className="mt-1 text-sm text-gray-500">Gérez votre abonnement NourPlay.</p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Current subscription banner */}
      {token && !loadingSub && subscription && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Abonnement actuel</p>
              <p className="text-lg font-semibold text-gray-900">{subscription.plan.name}</p>
              <p className="text-sm text-gray-500 mt-0.5">
                {subscription.plan.priceEur === 0 ? 'Gratuit' : `${subscription.plan.priceEur} €/${subscription.plan.interval === 'MONTHLY' ? 'mois' : 'an'}`}
              </p>
              {subscription.expiresAt && (
                <p className="text-xs text-gray-400 mt-1">
                  {isActive ? 'Renouvellement le' : 'Expire le'} {new Date(subscription.expiresAt).toLocaleDateString('fr-FR')}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-3">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[subscription.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {STATUS_LABELS[subscription.status] ?? subscription.status}
              </span>
              {isActive && (
                <button
                  onClick={handlePortal}
                  disabled={portalLoading}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50 transition-colors"
                >
                  {portalLoading ? 'Chargement…' : 'Gérer mon abonnement →'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Plans */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {subscription ? 'Changer de plan' : 'Choisissez un plan'}
        </h2>

        {loadingPlans ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-xl border border-gray-200 bg-white p-6 animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-1/2" />
                <div className="h-8 bg-gray-200 rounded w-1/3" />
                <div className="space-y-2">
                  {[1, 2, 3].map(j => <div key={j} className="h-3 bg-gray-200 rounded" />)}
                </div>
              </div>
            ))}
          </div>
        ) : plans.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun plan disponible pour le moment.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map(plan => {
              const isCurrent = subscription?.plan.id === plan.id && isActive
              const isFree = plan.priceEur === 0
              return (
                <div
                  key={plan.id}
                  className={`relative rounded-xl border-2 bg-white p-6 flex flex-col gap-4 transition-shadow hover:shadow-md ${
                    isCurrent ? 'border-indigo-500' : 'border-gray-200'
                  }`}
                >
                  {isCurrent && (
                    <span className="absolute -top-3 left-4 bg-indigo-500 text-white text-xs font-medium px-2.5 py-0.5 rounded-full">
                      Plan actuel
                    </span>
                  )}
                  <div>
                    <p className="font-semibold text-gray-900">{plan.name}</p>
                    <p className="mt-1">
                      {isFree ? (
                        <span className="text-2xl font-bold text-gray-900">Gratuit</span>
                      ) : (
                        <>
                          <span className="text-2xl font-bold text-gray-900">{plan.priceEur} €</span>
                          <span className="text-sm text-gray-500">/{plan.interval === 'MONTHLY' ? 'mois' : 'an'}</span>
                        </>
                      )}
                    </p>
                  </div>

                  {plan.features.length > 0 && (
                    <ul className="flex-1 space-y-2">
                      {plan.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                          <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}

                  {!isFree && token && !isCurrent && (
                    <button
                      onClick={() => handleCheckout(plan.id)}
                      disabled={checkoutLoading === plan.id}
                      className="mt-auto w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {checkoutLoading === plan.id ? 'Redirection…' : "S'abonner"}
                    </button>
                  )}

                  {!token && !isFree && (
                    <p className="mt-auto text-center text-xs text-gray-400">Connectez-vous pour vous abonner</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
