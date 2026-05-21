import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { Prisma } from '@nourplay/db'
import { PrismaService } from '../../common/prisma/prisma.service'

export interface CreateNotificationParams {
  userId: string
  type: string
  payload: Record<string, unknown>
}

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

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

  // Called internally by other services (moderation, GDPR, etc.)
  create(params: CreateNotificationParams) {
    return this.prisma.notification.create({
      data: { userId: params.userId, type: params.type, payload: params.payload as Prisma.InputJsonValue },
    })
  }
}
