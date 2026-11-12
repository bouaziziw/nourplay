import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common'
import { GdprRequestStatus, GdprRequestType, ConsentType } from '@nourplay/db'
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

  async getUserRequests(userId: string) {
    return this.prisma.gdprRequest.findMany({
      where: { userId },
      select: { id: true, type: true, status: true, requestedAt: true, processedAt: true, exportUrl: true, notes: true },
      orderBy: { requestedAt: 'desc' },
    })
  }

  async getAdminStats() {
    const allTypes = Object.values(GdprRequestType)
    const allStatuses = Object.values(GdprRequestStatus)
    const allConsentTypes = Object.values(ConsentType)

    const [totalUsers, requestCounts, activeCounts] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.gdprRequest.groupBy({
        by: ['type', 'status'],
        _count: { _all: true },
      }),
      this.prisma.consentRecord.groupBy({
        by: ['type'],
        where: { revokedAt: null },
        _count: { _all: true },
      }),
    ])

    // Build requests matrix: { [type]: { [status]: count } }
    const requests: Record<string, Record<string, number>> = {}
    for (const t of allTypes) {
      requests[t] = {}
      for (const s of allStatuses) requests[t][s] = 0
    }
    for (const row of requestCounts) {
      requests[row.type][row.status] = row._count._all
    }

    // Consent coverage per type
    const activeByType: Record<string, number> = {}
    for (const row of activeCounts) activeByType[row.type] = row._count._all
    const consentCoverage: Record<string, { active: number; total: number; pct: number }> = {}
    for (const t of allConsentTypes) {
      const active = activeByType[t] ?? 0
      consentCoverage[t] = { active, total: totalUsers, pct: totalUsers > 0 ? Math.round((active / totalUsers) * 100) : 0 }
    }

    const pendingTotal = allTypes.reduce((s, t) => s + (requests[t]['PENDING'] ?? 0), 0)

    return { totalUsers, pendingTotal, requests, consentCoverage }
  }

  async listAdminRequests(params: { status?: string; type?: string; page?: number; limit?: number }) {
    const { status, type, page = 1, limit = 50 } = params
    const take = Math.min(limit, 100)
    const skip = (page - 1) * take

    const where: Record<string, unknown> = {}
    if (status && status !== 'ALL') where.status = status
    if (type && type !== 'ALL') where.type = type

    const [items, total] = await Promise.all([
      this.prisma.gdprRequest.findMany({
        where,
        select: {
          id: true, type: true, status: true,
          requestedAt: true, processedAt: true, notes: true, exportUrl: true,
          user: { select: { id: true, email: true } },
        },
        orderBy: { requestedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.gdprRequest.count({ where }),
    ])

    return { items, total, page, pages: Math.ceil(total / take) }
  }

  async updateRequestStatus(adminId: string, requestId: string, status: GdprRequestStatus, notes?: string) {
    const req = await this.prisma.gdprRequest.findUnique({ where: { id: requestId }, select: { id: true, status: true } })
    if (!req) throw new NotFoundException('Demande introuvable')
    if (req.status === 'COMPLETED' || req.status === 'REJECTED') {
      throw new ForbiddenException('Cette demande est déjà finalisée.')
    }
    return this.prisma.gdprRequest.update({
      where: { id: requestId },
      data: {
        status,
        notes,
        processedAt: status === 'COMPLETED' || status === 'REJECTED' ? new Date() : undefined,
      },
      select: { id: true, type: true, status: true, requestedAt: true, processedAt: true, notes: true },
    })
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
