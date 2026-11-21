import {
  Injectable, NotFoundException, BadRequestException, OnModuleInit, ServiceUnavailableException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Stripe from 'stripe'
import { PrismaService } from '../../common/prisma/prisma.service'
import { CacheService } from '../../common/cache/cache.service'
import { CreateCheckoutDto } from './dto/create-checkout.dto'

const TTL = { PLAN_LIMITS: 60, PLANS_LIST: 300 }

type StripeClient = InstanceType<typeof Stripe>

// Minimal shapes we actually use from webhook payloads
interface CheckoutSessionPayload {
  customer?: string | null
  subscription?: string | null
  metadata?: Record<string, string> | null
}

interface SubscriptionPayload {
  id: string
  status: string
  metadata?: Record<string, string> | null
  items?: { data: Array<{ current_period_end?: number }> }
}

@Injectable()
export class SubscriptionService implements OnModuleInit {
  private stripe: StripeClient | null = null
  private webhookSecret!: string
  private appUrl!: string

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly cache: CacheService,
  ) {}

  onModuleInit() {
    const secretKey = this.config.get<string>('stripe.secretKey', '')
    this.webhookSecret = this.config.get<string>('stripe.webhookSecret', '')
    this.appUrl = this.config.get<string>('appUrl', 'http://localhost:3000')
    if (secretKey) {
      this.stripe = new Stripe(secretKey, { apiVersion: '2026-05-27.dahlia' })
    }
  }

  private requireStripe(): StripeClient {
    if (!this.stripe) {
      throw new ServiceUnavailableException('Stripe is not configured')
    }
    return this.stripe
  }

  // ── Plans (public) ────────────────────────────────────────────

  async getPlans() {
    type PlanRow = { id: string; name: string; slug: string; priceEur: number | null; interval: string | null; features: unknown }
    const cached = await this.cache.get<PlanRow[]>('sub:plans')
    if (cached) return cached

    let plans = await this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { priceEur: 'asc' },
      select: { id: true, name: true, slug: true, priceEur: true, interval: true, features: true },
    })

    if (plans.length === 0) {
      await this.ensureDefaultPlans()
      plans = await this.prisma.subscriptionPlan.findMany({
        where: { isActive: true },
        orderBy: { priceEur: 'asc' },
        select: { id: true, name: true, slug: true, priceEur: true, interval: true, features: true },
      })
    }

    await this.cache.set('sub:plans', plans, TTL.PLANS_LIST)
    return plans
  }

  private async ensureDefaultPlans() {
    try {
      const defaultPlans = [
        {
          slug: 'free',
          name: 'Gratuit',
          priceEur: 0,
          interval: 'MONTHLY' as const,
          features: ['1 profil enfant', '5 playlists', 'Vidéothèque complète', 'Support par email'],
        },
        {
          slug: 'premium-monthly',
          name: 'Premium Mensuel',
          priceEur: 999,
          interval: 'MONTHLY' as const,
          features: ['Profils enfants illimités', 'Playlists illimitées', 'Planification horaire', 'Rapports d\'activité détaillés', 'Support prioritaire'],
        },
        {
          slug: 'premium-yearly',
          name: 'Premium Annuel',
          priceEur: 7999,
          interval: 'YEARLY' as const,
          features: ['Profils enfants illimités', 'Playlists illimitées', 'Planification horaire', 'Rapports d\'activité détaillés', 'Support prioritaire', '2 mois offerts'],
        },
      ]

      for (const plan of defaultPlans) {
        await this.prisma.subscriptionPlan.upsert({
          where: { slug: plan.slug },
          update: { features: plan.features },
          create: plan,
        })
      }
    } catch {
      // Ignoré en cas d'erreur concurrente
    }
  }

  // ── Plan limits ───────────────────────────────────────────────

  private static readonly PLAN_LIMITS: Record<string, { maxProfiles: number; maxPlaylists: number }> = {
    free: { maxProfiles: 1, maxPlaylists: 5 },
  }
  private static readonly PREMIUM_LIMITS = { maxProfiles: 999, maxPlaylists: 999 }

  async getUserPlanLimits(userId: string): Promise<{
    maxProfiles: number
    maxPlaylists: number
    planSlug: string
  }> {
    type PlanLimits = { maxProfiles: number; maxPlaylists: number; planSlug: string }
    const cacheKey = `sub:limits:${userId}`
    const cached = await this.cache.get<PlanLimits>(cacheKey)
    if (cached) return cached

    const [user, sub] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      }),
      this.prisma.subscription.findUnique({
        where: { userId },
        select: { status: true, plan: { select: { slug: true } } },
      }),
    ])

    const isActive = sub?.status === 'ACTIVE' || sub?.status === 'TRIALING'
    const planSlug = isActive && sub?.plan.slug ? sub.plan.slug : 'free'
    const limits = SubscriptionService.PLAN_LIMITS[planSlug] ?? SubscriptionService.PREMIUM_LIMITS

    const isModeratorOrAdmin = user?.role === 'MODERATOR' || user?.role === 'ADMIN'
    const maxPlaylists = isModeratorOrAdmin ? SubscriptionService.PREMIUM_LIMITS.maxPlaylists : limits.maxPlaylists
    const maxProfiles = isModeratorOrAdmin ? SubscriptionService.PREMIUM_LIMITS.maxProfiles : limits.maxProfiles

    const result: PlanLimits = {
      maxProfiles,
      maxPlaylists,
      planSlug: isModeratorOrAdmin && planSlug === 'free' ? 'moderator' : planSlug,
    }

    await this.cache.set(cacheKey, result, TTL.PLAN_LIMITS)
    return result
  }

  // ── Current subscription ──────────────────────────────────────

  async getMySubscription(userId: string) {
    return this.prisma.subscription.findUnique({
      where: { userId },
      include: { plan: { select: { id: true, name: true, slug: true, priceEur: true, interval: true } } },
    })
  }

  // ── Checkout ──────────────────────────────────────────────────

  async createCheckoutSession(userId: string, userEmail: string, dto: CreateCheckoutDto) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: dto.planId } })
    if (!plan) throw new NotFoundException('Plan introuvable')
    if (!plan.stripePriceId) throw new BadRequestException('Ce plan n\'a pas de prix Stripe configuré')
    if (plan.priceEur === 0) throw new BadRequestException('Le plan gratuit ne nécessite pas de paiement')

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } })
    if (!user) throw new NotFoundException('Utilisateur introuvable')

    const session = await this.requireStripe().checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      ...(user.stripeCustomerId
        ? { customer: user.stripeCustomerId }
        : { customer_email: userEmail }),
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: `${this.appUrl}/fr/dashboard/subscription?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.appUrl}/fr/dashboard/subscription?cancelled=1`,
      metadata: { userId, planId: plan.id },
      subscription_data: { metadata: { userId, planId: plan.id } },
    })

    return { url: session.url! }
  }

  // ── Customer Portal ───────────────────────────────────────────

  async createPortalSession(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } })
    if (!user?.stripeCustomerId) throw new BadRequestException('Aucun compte Stripe associé à cet utilisateur')

    const session = await this.requireStripe().billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${this.appUrl}/fr/dashboard/subscription`,
    })

    return { url: session.url }
  }

  // ── Webhook ───────────────────────────────────────────────────

  async handleWebhook(rawBody: Buffer, signature: string) {
    let event: ReturnType<StripeClient['webhooks']['constructEvent']>
    try {
      event = this.requireStripe().webhooks.constructEvent(rawBody, signature, this.webhookSecret)
    } catch {
      throw new BadRequestException('Signature webhook invalide')
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutCompleted(event.data.object as unknown as CheckoutSessionPayload)
        break
      case 'customer.subscription.updated':
        await this.onSubscriptionUpdated(event.data.object as unknown as SubscriptionPayload)
        break
      case 'customer.subscription.deleted':
        await this.onSubscriptionDeleted(event.data.object as unknown as SubscriptionPayload)
        break
    }
  }

  private async invalidatePlanLimitsCache(userId: string) {
    await this.cache.del(`sub:limits:${userId}`)
  }

  private async getUserIdByExternalId(externalId: string): Promise<string | null> {
    const row = await this.prisma.subscription.findFirst({
      where: { externalId },
      select: { userId: true },
    })
    return row?.userId ?? null
  }

  private async onCheckoutCompleted(session: CheckoutSessionPayload) {
    const userId = session.metadata?.userId
    const planId = session.metadata?.planId
    if (!userId || !planId) return

    const customerId = session.customer ?? null
    const stripeSubId = session.subscription ?? null
    if (!stripeSubId) return

    if (customerId) {
      await this.prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customerId } })
    }

    const stripeSubscription = await this.requireStripe().subscriptions.retrieve(stripeSubId, {
      expand: ['items'],
    }) as unknown as SubscriptionPayload

    const periodEnd = stripeSubscription.items?.data[0]?.current_period_end
      ? new Date(stripeSubscription.items.data[0].current_period_end * 1000)
      : null

    await this.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        planId,
        status: 'ACTIVE',
        externalId: stripeSubId,
        ...(periodEnd && { expiresAt: periodEnd }),
      },
      update: {
        planId,
        status: 'ACTIVE',
        externalId: stripeSubId,
        cancelledAt: null,
        ...(periodEnd && { expiresAt: periodEnd }),
      },
    })

    await this.invalidatePlanLimitsCache(userId)
  }

  private async onSubscriptionUpdated(sub: SubscriptionPayload) {
    const userId = sub.metadata?.userId
    if (!userId) return

    const statusMap: Record<string, string> = {
      active: 'ACTIVE',
      past_due: 'PAST_DUE',
      canceled: 'CANCELLED',
      trialing: 'TRIALING',
      unpaid: 'PAST_DUE',
    }

    const periodEnd = sub.items?.data[0]?.current_period_end
      ? new Date(sub.items.data[0].current_period_end * 1000)
      : undefined

    await this.prisma.subscription.updateMany({
      where: { externalId: sub.id },
      data: {
        status: (statusMap[sub.status] ?? 'ACTIVE') as 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'TRIALING' | 'EXPIRED',
        ...(periodEnd && { expiresAt: periodEnd }),
      },
    })

    await this.invalidatePlanLimitsCache(userId)
  }

  private async onSubscriptionDeleted(sub: SubscriptionPayload) {
    const userId = await this.getUserIdByExternalId(sub.id)

    await this.prisma.subscription.updateMany({
      where: { externalId: sub.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    })

    if (userId) await this.invalidatePlanLimitsCache(userId)
  }
}
