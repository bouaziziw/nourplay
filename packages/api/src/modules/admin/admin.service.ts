import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import { AuditService } from '../../common/audit/audit.service'
import { QueryUsersDto } from './dto/query-users.dto'
import { UpdateUserAdminDto } from './dto/update-user-admin.dto'
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto'
import { UserRole } from '@nourplay/db'

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Utilisateurs ──────────────────────────────────────────────

  async getUsers(query: QueryUsersDto) {
    const { page, limit, role, search, deleted } = query
    const skip = (page - 1) * limit

    const where = {
      ...(role && { role }),
      ...(search && { email: { contains: search, mode: 'insensitive' as const } }),
      deletedAt: deleted ? { not: null } : null,
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, email: true, role: true, locale: true,
          emailVerified: true, twoFactorEnabled: true,
          createdAt: true, deletedAt: true,
          _count: { select: { childProfiles: true, playlists: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ])

    return { items, total, page, limit }
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, role: true, locale: true, googleId: true,
        emailVerified: true, emailVerifiedAt: true, twoFactorEnabled: true,
        createdAt: true, updatedAt: true, deletedAt: true,
        _count: {
          select: { childProfiles: true, playlists: true, consentRecords: true, gdprRequests: true },
        },
      },
    })
    if (!user) throw new NotFoundException('Utilisateur introuvable')
    return user
  }

  async updateUser(
    actorId: string,
    actorRole: string,
    userId: string,
    dto: UpdateUserAdminDto,
  ) {
    const existing = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!existing) throw new NotFoundException('Utilisateur introuvable')

    if (dto.role && existing.role === UserRole.ADMIN && dto.role !== UserRole.ADMIN) {
      const adminCount = await this.prisma.user.count({ where: { role: UserRole.ADMIN, deletedAt: null } })
      if (adminCount <= 1) throw new BadRequestException('Impossible de rétrograder le dernier administrateur')
    }

    const data: Record<string, unknown> = {}
    if (dto.role !== undefined) data.role = dto.role
    if (dto.banned === true) data.deletedAt = new Date()
    if (dto.banned === false) data.deletedAt = null

    const updated = await this.prisma.user.update({ where: { id: userId }, data })

    const changes: Record<string, unknown> = {}
    if (dto.role !== undefined) changes.role = { from: existing.role, to: dto.role }
    if (dto.banned !== undefined) changes.banned = dto.banned

    await this.audit.log({
      actorId, actorRole, action: 'user.update',
      resourceType: 'User', resourceId: userId, metadata: changes,
    })

    return updated
  }

  // ── Logs d'audit ──────────────────────────────────────────────

  async getAuditLogs(query: QueryAuditLogsDto) {
    const { page, limit, actorId, action, resourceType, dateFrom, dateTo } = query
    const skip = (page - 1) * limit

    const where = {
      ...(actorId && { actorId }),
      ...(action && { action: { contains: action } }),
      ...(resourceType && { resourceType }),
      ...((dateFrom || dateTo) && {
        occurredAt: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      }),
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { occurredAt: 'desc' },
        include: { actor: { select: { id: true, email: true, role: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ])

    return { items, total, page, limit }
  }

  // ── Statistiques ──────────────────────────────────────────────

  async getStats() {
    const [
      totalUsers,
      usersByRole,
      totalVideos,
      videosByStatus,
      pendingReports,
      pendingGdpr,
    ] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.groupBy({ by: ['role'], where: { deletedAt: null }, _count: true }),
      this.prisma.video.count(),
      this.prisma.video.groupBy({ by: ['validationStatus'], _count: true }),
      this.prisma.videoReport.count({ where: { resolved: false } }),
      this.prisma.gdprRequest.count({ where: { status: 'PENDING' } }),
    ])

    return {
      users: {
        total: totalUsers,
        byRole: Object.fromEntries(usersByRole.map(r => [r.role, r._count])),
      },
      videos: {
        total: totalVideos,
        byStatus: Object.fromEntries(videosByStatus.map(s => [s.validationStatus, s._count])),
      },
      moderation: { pendingReports },
      gdpr: { pendingRequests: pendingGdpr },
    }
  }
}
