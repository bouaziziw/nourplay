import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common'
import { Prisma } from '@nourplay/db'
import { PrismaService } from '../../common/prisma/prisma.service'
import Expo, { ExpoPushMessage } from 'expo-server-sdk'

export interface CreateNotificationParams {
  userId: string
  type: string
  payload: Record<string, unknown>
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name)
  private readonly expo = new Expo()

  constructor(private readonly prisma: PrismaService) {}

  // ── In-app notifications ──────────────────────────────────────

  async findForUser(userId: string, page = 1, limit = 20, unreadOnly = false) {
    const skip = (page - 1) * limit

    const where = {
      userId,
      ...(unreadOnly && { readAt: null }),
    }

    const [items, total, unread] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ])

    return { items, total, unread, page, limit }
  }

  async markRead(userId: string, notificationId: string) {
    const notif = await this.prisma.notification.findUnique({ where: { id: notificationId } })
    if (!notif) throw new NotFoundException('Notification introuvable')
    if (notif.userId !== userId) throw new ForbiddenException()

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    })
  }

  async markAllRead(userId: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    })
    return { updated: count }
  }

  async deleteNotification(userId: string, notificationId: string) {
    const notif = await this.prisma.notification.findUnique({ where: { id: notificationId } })
    if (!notif) throw new NotFoundException('Notification introuvable')
    if (notif.userId !== userId) throw new ForbiddenException()

    await this.prisma.notification.delete({ where: { id: notificationId } })
  }

  // Creates an in-app notification AND sends a push if the user has device tokens
  async create(params: CreateNotificationParams) {
    const notification = await this.prisma.notification.create({
      data: { userId: params.userId, type: params.type, payload: params.payload as Prisma.InputJsonValue },
    })

    // Fire-and-forget push
    this.sendPushToUser(params.userId, params.type, params.payload).catch(err =>
      this.logger.warn(`Push failed for user ${params.userId}: ${err}`)
    )

    return notification
  }

  // ── Device tokens ─────────────────────────────────────────────

  async registerToken(userId: string, token: string, platform: string) {
    if (!Expo.isExpoPushToken(token)) {
      return { registered: false, reason: 'invalid_token' }
    }

    await this.prisma.deviceToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
    })

    return { registered: true }
  }

  async unregisterToken(userId: string, token: string) {
    await this.prisma.deviceToken.deleteMany({ where: { userId, token } })
    return { unregistered: true }
  }

  // ── Push delivery ─────────────────────────────────────────────

  private async sendPushToUser(userId: string, type: string, payload: Record<string, unknown>) {
    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId },
      select: { token: true },
    })

    if (tokens.length === 0) return

    const { title, body } = this.buildPushContent(type, payload)

    const messages: ExpoPushMessage[] = tokens
      .filter(t => Expo.isExpoPushToken(t.token))
      .map(t => ({
        to: t.token,
        sound: 'default' as const,
        title,
        body,
        data: { type, ...payload },
      }))

    if (messages.length === 0) return

    const chunks = this.expo.chunkPushNotifications(messages)
    for (const chunk of chunks) {
      try {
        const receipts = await this.expo.sendPushNotificationsAsync(chunk)
        // Remove stale tokens (DeviceNotRegistered error)
        for (let i = 0; i < receipts.length; i++) {
          const receipt = receipts[i]
          if (receipt.status === 'error' && receipt.details?.error === 'DeviceNotRegistered') {
            const staleToken = messages[i]?.to
            if (typeof staleToken === 'string') {
              await this.prisma.deviceToken.deleteMany({ where: { token: staleToken } })
            }
          }
        }
      } catch (err) {
        this.logger.error('Expo push chunk failed', err)
      }
    }
  }

  private buildPushContent(type: string, payload: Record<string, unknown>): { title: string; body: string } {
    const map: Record<string, (p: Record<string, unknown>) => { title: string; body: string }> = {
      'playlist.shared': p => ({
        title: 'Nouvelle playlist partagée',
        body: `La playlist "${p.playlistName}" a été partagée avec vous.`,
      }),
      'moderation.approved': p => ({
        title: 'Vidéo approuvée',
        body: `"${p.videoTitle}" est maintenant disponible.`,
      }),
      'moderation.rejected': p => ({
        title: 'Vidéo refusée',
        body: `"${p.videoTitle}" n'a pas pu être publiée.`,
      }),
      'gdpr.export_ready': () => ({
        title: 'Export RGPD prêt',
        body: 'Votre export de données est disponible au téléchargement.',
      }),
      'subscription.expiring': () => ({
        title: 'Abonnement bientôt expiré',
        body: 'Votre abonnement Premium expire dans 7 jours.',
      }),
    }

    const builder = map[type]
    if (builder) return builder(payload)

    return { title: 'NourPlay', body: 'Vous avez une nouvelle notification.' }
  }
}
