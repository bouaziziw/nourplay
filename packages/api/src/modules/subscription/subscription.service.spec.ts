import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { SubscriptionService } from './subscription.service'
import Stripe from 'stripe'

vi.mock('stripe', () => ({ default: vi.fn() }))

// ── Mock factories ────────────────────────────────────────────────────────────

const makePrisma = () => ({
  subscriptionPlan: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  subscription: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    upsert: vi.fn(),
    updateMany: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
})

const makeCache = () => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
})

const makeConfig = () => ({
  get: vi.fn((key: string, def?: unknown) => {
    const map: Record<string, unknown> = {
      'stripe.secretKey': 'sk_test_xxx',
      'stripe.webhookSecret': 'whsec_test',
      'appUrl': 'http://localhost:3000',
    }
    return map[key] ?? def
  }),
})

type MockStripe = {
  checkout: { sessions: { create: ReturnType<typeof vi.fn> } }
  billingPortal: { sessions: { create: ReturnType<typeof vi.fn> } }
  webhooks: { constructEvent: ReturnType<typeof vi.fn> }
  subscriptions: { retrieve: ReturnType<typeof vi.fn> }
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('SubscriptionService', () => {
  let service: SubscriptionService
  let prisma: ReturnType<typeof makePrisma>
  let cache: ReturnType<typeof makeCache>
  let stripe: MockStripe

  beforeEach(() => {
    vi.clearAllMocks()
    prisma = makePrisma()
    cache = makeCache()

    stripe = {
      checkout: { sessions: { create: vi.fn() } },
      billingPortal: { sessions: { create: vi.fn() } },
      webhooks: { constructEvent: vi.fn() },
      subscriptions: { retrieve: vi.fn() },
    }
    vi.mocked(Stripe).mockImplementation(() => stripe as never)

    service = new SubscriptionService(prisma as never, makeConfig() as never, cache as never)
    service.onModuleInit()
  })

  // ── getPlans ──────────────────────────────────────────────────────────────

  describe('getPlans', () => {
    const plans = [
      { id: 'p-1', name: 'Gratuit', slug: 'free', priceEur: 0, interval: null, features: [] },
      { id: 'p-2', name: 'Premium', slug: 'premium-monthly', priceEur: 999, interval: 'MONTHLY', features: [] },
    ]

    it('retourne les plans depuis la DB et les met en cache', async () => {
      prisma.subscriptionPlan.findMany.mockResolvedValue(plans)

      const result = await service.getPlans()

      expect(result).toBe(plans)
      expect(prisma.subscriptionPlan.findMany).toHaveBeenCalledOnce()
      expect(cache.set).toHaveBeenCalledWith('sub:plans', plans, 300)
    })

    it('retourne la valeur en cache sans appeler la DB', async () => {
      cache.get.mockResolvedValueOnce(plans)

      const result = await service.getPlans()

      expect(result).toBe(plans)
      expect(prisma.subscriptionPlan.findMany).not.toHaveBeenCalled()
      expect(cache.set).not.toHaveBeenCalled()
    })
  })

  // ── getUserPlanLimits ─────────────────────────────────────────────────────

  describe('getUserPlanLimits', () => {
    it('retourne la valeur en cache sans appeler la DB', async () => {
      const cached = { maxProfiles: 999, maxPlaylists: 999, planSlug: 'premium-monthly' }
      cache.get.mockResolvedValueOnce(cached)

      const result = await service.getUserPlanLimits('u-1')

      expect(result).toBe(cached)
      expect(prisma.subscription.findUnique).not.toHaveBeenCalled()
    })

    it('retourne les limites free quand l\'abonnement est null', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null)

      const result = await service.getUserPlanLimits('u-1')

      expect(result).toEqual({ maxProfiles: 1, maxPlaylists: 5, planSlug: 'free' })
      expect(cache.set).toHaveBeenCalledWith('sub:limits:u-1', expect.objectContaining({ planSlug: 'free' }), 60)
    })

    it('retourne les limites free quand le statut est EXPIRED', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        status: 'EXPIRED',
        plan: { slug: 'premium-monthly' },
      })

      const result = await service.getUserPlanLimits('u-1')

      expect(result.planSlug).toBe('free')
      expect(result.maxProfiles).toBe(1)
    })

    it('retourne les limites premium quand l\'abonnement est ACTIVE', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        status: 'ACTIVE',
        plan: { slug: 'premium-monthly' },
      })

      const result = await service.getUserPlanLimits('u-1')

      expect(result.maxProfiles).toBe(999)
      expect(result.maxPlaylists).toBe(999)
      expect(result.planSlug).toBe('premium-monthly')
    })

    it('retourne les limites premium quand le statut est TRIALING', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        status: 'TRIALING',
        plan: { slug: 'premium-monthly' },
      })

      const result = await service.getUserPlanLimits('u-1')

      expect(result.maxProfiles).toBe(999)
    })

    it('retourne les limites free pour le plan free même si ACTIVE', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        status: 'ACTIVE',
        plan: { slug: 'free' },
      })

      const result = await service.getUserPlanLimits('u-1')

      expect(result.maxProfiles).toBe(1)
      expect(result.maxPlaylists).toBe(5)
    })
  })

  // ── getMySubscription ─────────────────────────────────────────────────────

  describe('getMySubscription', () => {
    it('retourne l\'abonnement avec le plan inclus', async () => {
      const sub = { id: 's-1', status: 'ACTIVE', plan: { name: 'Premium' } }
      prisma.subscription.findUnique.mockResolvedValue(sub)

      expect(await service.getMySubscription('u-1')).toBe(sub)
      expect(prisma.subscription.findUnique.mock.calls[0][0].where).toEqual({ userId: 'u-1' })
    })

    it('retourne null si pas d\'abonnement', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null)
      expect(await service.getMySubscription('u-1')).toBeNull()
    })
  })

  // ── createCheckoutSession ─────────────────────────────────────────────────

  describe('createCheckoutSession', () => {
    const dto = { planId: 'plan-1' }

    it('lève NotFoundException si le plan est introuvable', async () => {
      prisma.subscriptionPlan.findUnique.mockResolvedValue(null)

      await expect(service.createCheckoutSession('u-1', 'user@test.com', dto))
        .rejects.toThrow(NotFoundException)
    })

    it('lève BadRequestException si le plan n\'a pas de stripePriceId', async () => {
      prisma.subscriptionPlan.findUnique.mockResolvedValue({ id: 'plan-1', stripePriceId: null, priceEur: 999 })

      await expect(service.createCheckoutSession('u-1', 'user@test.com', dto))
        .rejects.toThrow(BadRequestException)
    })

    it('lève BadRequestException si le plan est gratuit (priceEur === 0)', async () => {
      prisma.subscriptionPlan.findUnique.mockResolvedValue({ id: 'plan-1', stripePriceId: 'price_xxx', priceEur: 0 })

      await expect(service.createCheckoutSession('u-1', 'user@test.com', dto))
        .rejects.toThrow(BadRequestException)
    })

    it('lève NotFoundException si l\'utilisateur est introuvable', async () => {
      prisma.subscriptionPlan.findUnique.mockResolvedValue({ id: 'plan-1', stripePriceId: 'price_xxx', priceEur: 999 })
      prisma.user.findUnique.mockResolvedValue(null)

      await expect(service.createCheckoutSession('u-1', 'user@test.com', dto))
        .rejects.toThrow(NotFoundException)
    })

    it('utilise le customer existant si stripeCustomerId est renseigné', async () => {
      prisma.subscriptionPlan.findUnique.mockResolvedValue({ id: 'plan-1', stripePriceId: 'price_xxx', priceEur: 999 })
      prisma.user.findUnique.mockResolvedValue({ stripeCustomerId: 'cus_existing' })
      stripe.checkout.sessions.create.mockResolvedValue({ url: 'https://checkout.stripe.com/pay/xxx' })

      const result = await service.createCheckoutSession('u-1', 'user@test.com', dto)

      expect(result).toEqual({ url: 'https://checkout.stripe.com/pay/xxx' })
      const call = stripe.checkout.sessions.create.mock.calls[0][0]
      expect(call.customer).toBe('cus_existing')
      expect(call).not.toHaveProperty('customer_email')
    })

    it('utilise customer_email si pas de stripeCustomerId', async () => {
      prisma.subscriptionPlan.findUnique.mockResolvedValue({ id: 'plan-1', stripePriceId: 'price_xxx', priceEur: 999 })
      prisma.user.findUnique.mockResolvedValue({ stripeCustomerId: null })
      stripe.checkout.sessions.create.mockResolvedValue({ url: 'https://checkout.stripe.com/pay/yyy' })

      await service.createCheckoutSession('u-1', 'user@test.com', dto)

      const call = stripe.checkout.sessions.create.mock.calls[0][0]
      expect(call.customer_email).toBe('user@test.com')
      expect(call).not.toHaveProperty('customer')
    })

    it('inclut userId et planId dans les métadonnées', async () => {
      prisma.subscriptionPlan.findUnique.mockResolvedValue({ id: 'plan-1', stripePriceId: 'price_xxx', priceEur: 999 })
      prisma.user.findUnique.mockResolvedValue({ stripeCustomerId: null })
      stripe.checkout.sessions.create.mockResolvedValue({ url: 'https://checkout.stripe.com/pay/zzz' })

      await service.createCheckoutSession('u-1', 'user@test.com', dto)

      const call = stripe.checkout.sessions.create.mock.calls[0][0]
      expect(call.metadata).toMatchObject({ userId: 'u-1', planId: 'plan-1' })
      expect(call.subscription_data.metadata).toMatchObject({ userId: 'u-1', planId: 'plan-1' })
    })
  })

  // ── createPortalSession ───────────────────────────────────────────────────

  describe('createPortalSession', () => {
    it('lève BadRequestException si l\'utilisateur n\'a pas de compte Stripe', async () => {
      prisma.user.findUnique.mockResolvedValue({ stripeCustomerId: null })

      await expect(service.createPortalSession('u-1')).rejects.toThrow(BadRequestException)
    })

    it('lève BadRequestException si l\'utilisateur est introuvable', async () => {
      prisma.user.findUnique.mockResolvedValue(null)

      await expect(service.createPortalSession('u-1')).rejects.toThrow(BadRequestException)
    })

    it('retourne l\'URL du Customer Portal Stripe', async () => {
      prisma.user.findUnique.mockResolvedValue({ stripeCustomerId: 'cus_abc' })
      stripe.billingPortal.sessions.create.mockResolvedValue({ url: 'https://billing.stripe.com/session/xxx' })

      const result = await service.createPortalSession('u-1')

      expect(result).toEqual({ url: 'https://billing.stripe.com/session/xxx' })
      expect(stripe.billingPortal.sessions.create.mock.calls[0][0].customer).toBe('cus_abc')
    })
  })

  // ── handleWebhook ─────────────────────────────────────────────────────────

  describe('handleWebhook', () => {
    const rawBody = Buffer.from('{}')
    const sig = 'stripe-sig'

    it('lève BadRequestException si la signature est invalide', async () => {
      stripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature')
      })

      await expect(service.handleWebhook(rawBody, sig)).rejects.toThrow(BadRequestException)
    })

    describe('checkout.session.completed', () => {
      it('ne fait rien si les metadata userId/planId sont absentes', async () => {
        stripe.webhooks.constructEvent.mockReturnValue({
          type: 'checkout.session.completed',
          data: { object: { customer: 'cus_1', subscription: 'sub_1', metadata: {} } },
        })

        await service.handleWebhook(rawBody, sig)

        expect(prisma.subscription.upsert).not.toHaveBeenCalled()
      })

      it('ne fait rien si subscription est null dans le payload', async () => {
        stripe.webhooks.constructEvent.mockReturnValue({
          type: 'checkout.session.completed',
          data: { object: { customer: 'cus_1', subscription: null, metadata: { userId: 'u-1', planId: 'plan-1' } } },
        })

        await service.handleWebhook(rawBody, sig)

        expect(prisma.subscription.upsert).not.toHaveBeenCalled()
      })

      it('upsert l\'abonnement en ACTIVE et met à jour stripeCustomerId', async () => {
        stripe.webhooks.constructEvent.mockReturnValue({
          type: 'checkout.session.completed',
          data: {
            object: {
              customer: 'cus_new',
              subscription: 'sub_abc',
              metadata: { userId: 'u-1', planId: 'plan-1' },
            },
          },
        })
        stripe.subscriptions.retrieve.mockResolvedValue({
          id: 'sub_abc',
          status: 'active',
          metadata: { userId: 'u-1' },
          items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 86400 }] },
        })
        prisma.user.update.mockResolvedValue({})
        prisma.subscription.upsert.mockResolvedValue({})

        await service.handleWebhook(rawBody, sig)

        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: 'u-1' },
          data: { stripeCustomerId: 'cus_new' },
        })
        expect(prisma.subscription.upsert).toHaveBeenCalledOnce()
        const upsertCall = prisma.subscription.upsert.mock.calls[0][0]
        expect(upsertCall.create.status).toBe('ACTIVE')
        expect(upsertCall.create.externalId).toBe('sub_abc')
        expect(cache.del).toHaveBeenCalledWith('sub:limits:u-1')
      })
    })

    describe('customer.subscription.updated', () => {
      it('ne fait rien si metadata userId est absent', async () => {
        stripe.webhooks.constructEvent.mockReturnValue({
          type: 'customer.subscription.updated',
          data: { object: { id: 'sub_abc', status: 'past_due', metadata: {} } },
        })

        await service.handleWebhook(rawBody, sig)

        expect(prisma.subscription.updateMany).not.toHaveBeenCalled()
      })

      it('met à jour le statut et invalide le cache', async () => {
        stripe.webhooks.constructEvent.mockReturnValue({
          type: 'customer.subscription.updated',
          data: {
            object: {
              id: 'sub_abc',
              status: 'past_due',
              metadata: { userId: 'u-1' },
              items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 86400 }] },
            },
          },
        })
        prisma.subscription.updateMany.mockResolvedValue({ count: 1 })

        await service.handleWebhook(rawBody, sig)

        expect(prisma.subscription.updateMany.mock.calls[0][0]).toMatchObject({
          where: { externalId: 'sub_abc' },
          data: expect.objectContaining({ status: 'PAST_DUE' }),
        })
        expect(cache.del).toHaveBeenCalledWith('sub:limits:u-1')
      })

      it('mappe correctement les statuts Stripe → enum NourPlay', async () => {
        const cases: Array<[string, string]> = [
          ['active', 'ACTIVE'],
          ['trialing', 'TRIALING'],
          ['canceled', 'CANCELLED'],
          ['unpaid', 'PAST_DUE'],
        ]

        for (const [stripeStatus, expected] of cases) {
          vi.clearAllMocks()
          stripe.webhooks.constructEvent.mockReturnValue({
            type: 'customer.subscription.updated',
            data: {
              object: {
                id: 'sub_abc',
                status: stripeStatus,
                metadata: { userId: 'u-1' },
                items: { data: [{}] },
              },
            },
          })
          prisma.subscription.updateMany.mockResolvedValue({ count: 1 })

          await service.handleWebhook(rawBody, sig)

          expect(prisma.subscription.updateMany.mock.calls[0][0].data.status).toBe(expected)
        }
      })
    })

    describe('customer.subscription.deleted', () => {
      it('passe le statut à CANCELLED et invalide le cache', async () => {
        stripe.webhooks.constructEvent.mockReturnValue({
          type: 'customer.subscription.deleted',
          data: { object: { id: 'sub_abc', status: 'canceled', metadata: {} } },
        })
        prisma.subscription.findFirst.mockResolvedValue({ userId: 'u-1' })
        prisma.subscription.updateMany.mockResolvedValue({ count: 1 })

        await service.handleWebhook(rawBody, sig)

        expect(prisma.subscription.updateMany.mock.calls[0][0]).toMatchObject({
          where: { externalId: 'sub_abc' },
          data: expect.objectContaining({ status: 'CANCELLED' }),
        })
        expect(cache.del).toHaveBeenCalledWith('sub:limits:u-1')
      })

      it('n\'invalide pas le cache si aucun userId trouvé via externalId', async () => {
        stripe.webhooks.constructEvent.mockReturnValue({
          type: 'customer.subscription.deleted',
          data: { object: { id: 'sub_orphan', status: 'canceled', metadata: {} } },
        })
        prisma.subscription.findFirst.mockResolvedValue(null)
        prisma.subscription.updateMany.mockResolvedValue({ count: 0 })

        await service.handleWebhook(rawBody, sig)

        expect(cache.del).not.toHaveBeenCalled()
      })
    })

    it('ignore les types d\'événements non gérés sans erreur', async () => {
      stripe.webhooks.constructEvent.mockReturnValue({
        type: 'payment_intent.created',
        data: { object: {} },
      })

      await expect(service.handleWebhook(rawBody, sig)).resolves.not.toThrow()
      expect(prisma.subscription.upsert).not.toHaveBeenCalled()
    })
  })
})
