import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SubscriptionTasksService } from './subscription.tasks'

const makePrisma = () => ({
  subscription: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
})

const makeCache = () => ({
  del: vi.fn().mockResolvedValue(undefined),
})

const makeEmail = () => ({
  sendSubscriptionExpiryEmail: vi.fn().mockResolvedValue(undefined),
})

const makeNotifications = () => ({
  create: vi.fn().mockResolvedValue(undefined),
})

describe('SubscriptionTasksService', () => {
  let service: SubscriptionTasksService
  let prisma: ReturnType<typeof makePrisma>
  let cache: ReturnType<typeof makeCache>
  let email: ReturnType<typeof makeEmail>
  let notifications: ReturnType<typeof makeNotifications>

  beforeEach(() => {
    vi.clearAllMocks()
    prisma = makePrisma()
    cache = makeCache()
    email = makeEmail()
    notifications = makeNotifications()
    service = new SubscriptionTasksService(
      prisma as never,
      cache as never,
      email as never,
      notifications as never,
    )
  })

  // ── sendExpiryReminders ───────────────────────────────────────────────────

  describe('sendExpiryReminders', () => {
    it('ne fait rien s\'il n\'y a aucun abonnement expirant', async () => {
      prisma.subscription.findMany.mockResolvedValue([])

      await service.sendExpiryReminders()

      expect(notifications.create).not.toHaveBeenCalled()
      expect(email.sendSubscriptionExpiryEmail).not.toHaveBeenCalled()
    })

    it('envoie une notification et un email par abonnement expirant', async () => {
      const expiresAt = new Date(Date.now() + 6.5 * 24 * 60 * 60 * 1000)
      const subs = [
        {
          user: { id: 'u-1', email: 'user1@test.com', locale: 'fr' },
          expiresAt,
        },
        {
          user: { id: 'u-2', email: 'user2@test.com', locale: 'en' },
          expiresAt,
        },
      ]
      prisma.subscription.findMany.mockResolvedValue(subs)

      await service.sendExpiryReminders()

      expect(notifications.create).toHaveBeenCalledTimes(2)
      expect(email.sendSubscriptionExpiryEmail).toHaveBeenCalledTimes(2)
    })

    it('appelle findMany avec les abonnements ACTIVE ou TRIALING expirant dans [+6j, +7j]', async () => {
      prisma.subscription.findMany.mockResolvedValue([])

      const before = Date.now()
      await service.sendExpiryReminders()
      const after = Date.now()

      const call = prisma.subscription.findMany.mock.calls[0][0]
      expect(call.where.status).toEqual({ in: ['ACTIVE', 'TRIALING'] })

      const { gte, lte } = call.where.expiresAt
      expect(gte.getTime()).toBeGreaterThanOrEqual(before + 6 * 24 * 60 * 60 * 1000)
      expect(gte.getTime()).toBeLessThanOrEqual(after + 6 * 24 * 60 * 60 * 1000)
      expect(lte.getTime()).toBeGreaterThanOrEqual(before + 7 * 24 * 60 * 60 * 1000)
    })

    it('envoie la notification avec le bon type et les daysLeft approximatifs', async () => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      prisma.subscription.findMany.mockResolvedValue([{
        user: { id: 'u-1', email: 'u@test.com', locale: 'fr' },
        expiresAt,
      }])

      await service.sendExpiryReminders()

      const notifCall = notifications.create.mock.calls[0][0]
      expect(notifCall.type).toBe('subscription.expiring')
      expect(notifCall.userId).toBe('u-1')
      expect(notifCall.payload.daysLeft).toBeGreaterThanOrEqual(6)
      expect(notifCall.payload.daysLeft).toBeLessThanOrEqual(8)
    })

    it('continue les autres envois si un appel Promise.allSettled échoue', async () => {
      const expiresAt = new Date(Date.now() + 6.5 * 24 * 60 * 60 * 1000)
      prisma.subscription.findMany.mockResolvedValue([
        { user: { id: 'u-1', email: 'fail@test.com', locale: 'fr' }, expiresAt },
        { user: { id: 'u-2', email: 'ok@test.com', locale: 'fr' }, expiresAt },
      ])
      email.sendSubscriptionExpiryEmail.mockRejectedValueOnce(new Error('SMTP error'))

      await expect(service.sendExpiryReminders()).resolves.not.toThrow()
      expect(email.sendSubscriptionExpiryEmail).toHaveBeenCalledTimes(2)
    })
  })

  // ── markExpiredSubscriptions ──────────────────────────────────────────────

  describe('markExpiredSubscriptions', () => {
    it('ne fait rien s\'il n\'y a aucun abonnement expiré', async () => {
      prisma.subscription.findMany.mockResolvedValue([])

      await service.markExpiredSubscriptions()

      expect(prisma.subscription.updateMany).not.toHaveBeenCalled()
      expect(cache.del).not.toHaveBeenCalled()
    })

    it('marque les abonnements expirés en EXPIRED', async () => {
      prisma.subscription.findMany.mockResolvedValue([
        { id: 's-1', userId: 'u-1' },
        { id: 's-2', userId: 'u-2' },
      ])
      prisma.subscription.updateMany.mockResolvedValue({ count: 2 })

      await service.markExpiredSubscriptions()

      expect(prisma.subscription.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['s-1', 's-2'] } },
        data: { status: 'EXPIRED' },
      })
    })

    it('invalide le cache des limits pour chaque utilisateur affecté', async () => {
      prisma.subscription.findMany.mockResolvedValue([
        { id: 's-1', userId: 'u-1' },
        { id: 's-2', userId: 'u-2' },
        { id: 's-3', userId: 'u-3' },
      ])
      prisma.subscription.updateMany.mockResolvedValue({ count: 3 })

      await service.markExpiredSubscriptions()

      expect(cache.del).toHaveBeenCalledWith(
        'sub:limits:u-1',
        'sub:limits:u-2',
        'sub:limits:u-3',
      )
    })

    it('recherche uniquement les abonnements ACTIVE/TRIALING avec expiresAt < now', async () => {
      prisma.subscription.findMany.mockResolvedValue([])

      const before = Date.now()
      await service.markExpiredSubscriptions()
      const after = Date.now()

      const call = prisma.subscription.findMany.mock.calls[0][0]
      expect(call.where.status).toEqual({ in: ['ACTIVE', 'TRIALING'] })
      expect(call.where.expiresAt.lt.getTime()).toBeGreaterThanOrEqual(before)
      expect(call.where.expiresAt.lt.getTime()).toBeLessThanOrEqual(after)
    })
  })
})
