import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../../common/prisma/prisma.service'
import { CacheService } from '../../common/cache/cache.service'
import { EmailService } from '../../common/email/email.service'
import { NotificationService } from '../notification/notification.service'

@Injectable()
export class SubscriptionTasksService {
  private readonly logger = new Logger(SubscriptionTasksService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly email: EmailService,
    private readonly notifications: NotificationService,
  ) {}

  // ── Expiry reminders — daily at 10:00 ─────────────────────────
  // Targets subscriptions expiring in the 24-hour window [now+6d, now+7d]
  // so each subscription is matched exactly once.

  @Cron('0 10 * * *', { name: 'sub-expiry-reminders' })
  async sendExpiryReminders() {
    const now = new Date()
    const in6d = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000)
    const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const subs = await this.prisma.subscription.findMany({
      where: {
        status: { in: ['ACTIVE', 'TRIALING'] },
        expiresAt: { gte: in6d, lte: in7d },
      },
      include: {
        user: { select: { id: true, email: true, locale: true } },
      },
    })

    if (subs.length === 0) return

    this.logger.log(`Sending expiry reminders to ${subs.length} users`)

    for (const sub of subs) {
      const daysLeft = Math.ceil(
        ((sub.expiresAt?.getTime() ?? now.getTime()) - now.getTime()) / (24 * 60 * 60 * 1000),
      )

      await Promise.allSettled([
        this.notifications.create({
          userId: sub.user.id,
          type: 'subscription.expiring',
          payload: { expiresAt: sub.expiresAt?.toISOString(), daysLeft },
        }),
        this.email.sendSubscriptionExpiryEmail(
          sub.user.email,
          daysLeft,
          sub.user.locale ?? 'fr',
        ),
      ])
    }

    this.logger.log(`Expiry reminders sent to ${subs.length} users`)
  }

  // ── Expired subscription cleanup — daily at 02:00 ─────────────
  // Marks subscriptions with expiresAt < now as EXPIRED, invalidates cache.

  @Cron('0 2 * * *', { name: 'sub-expiry-cleanup' })
  async markExpiredSubscriptions() {
    const expired = await this.prisma.subscription.findMany({
      where: {
        status: { in: ['ACTIVE', 'TRIALING'] },
        expiresAt: { lt: new Date() },
      },
      select: { id: true, userId: true },
    })

    if (expired.length === 0) return

    await this.prisma.subscription.updateMany({
      where: { id: { in: expired.map(s => s.id) } },
      data: { status: 'EXPIRED' },
    })

    // Invalidate cached plan limits for affected users so they immediately
    // get free-tier limits on their next request.
    if (expired.length > 0) {
      await this.cache.del(...expired.map(s => `sub:limits:${s.userId}`))
    }

    this.logger.log(`Marked ${expired.length} subscription(s) as EXPIRED`)
  }
}
