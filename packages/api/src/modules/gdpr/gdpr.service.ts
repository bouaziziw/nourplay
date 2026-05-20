import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'

@Injectable()
export class GdprService {
  constructor(private readonly prisma: PrismaService) {}

  async requestExport(userId: string) {
    // Vérifie pas de demande en cours
    const pending = await this.prisma.gdprRequest.findFirst({
      where: { userId, type: 'EXPORT', status: { in: ['PENDING', 'PROCESSING'] } },
    })
    if (pending) throw new BadRequestException('Une demande d\'export est déjà en cours')

    const request = await this.prisma.gdprRequest.create({
      data: { userId, type: 'EXPORT' },
      select: { id: true, type: true, status: true, requestedAt: true },
    })
    // En production : déclencher un job BullMQ qui génère le ZIP et envoie l'URL par email
    return request
  }

  async requestDeletion(userId: string) {
    const pending = await this.prisma.gdprRequest.findFirst({
      where: { userId, type: 'DELETE', status: { in: ['PENDING', 'PROCESSING'] } },
    })
    if (pending) throw new BadRequestException('Une demande de suppression est déjà en cours')

    return this.prisma.gdprRequest.create({
      data: { userId, type: 'DELETE' },
      select: { id: true, type: true, status: true, requestedAt: true },
    })
  }

  async getRequest(userId: string, requestId: string) {
    const req = await this.prisma.gdprRequest.findFirst({
      where: { id: requestId, userId },
      select: { id: true, type: true, status: true, requestedAt: true, processedAt: true },
    })
    if (!req) throw new NotFoundException('Demande introuvable')
    return req
  }

  async getUserData(userId: string) {
    const [user, profiles, playlists, consentHistory, watchHistory] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, role: true, locale: true, createdAt: true },
      }),
      this.prisma.childProfile.findMany({
        where: { userId, deletedAt: null },
        select: { id: true, displayName: true, ageGroup: true, birthYear: true, createdAt: true },
      }),
      this.prisma.playlist.findMany({
        where: { ownerId: userId, deletedAt: null },
        select: { id: true, name: true, visibility: true, createdAt: true },
      }),
      this.prisma.consentRecord.findMany({
        where: { userId },
        select: { type: true, version: true, consentedAt: true, revokedAt: true },
      }),
      this.prisma.watchHistory.findMany({
        where: { profile: { userId } },
        select: { watchedAt: true, durationWatchedSec: true, completed: true },
        take: 1000,
      }),
    ])
    return { user, profiles, playlists, consentHistory, watchHistory, exportedAt: new Date() }
  }
}
