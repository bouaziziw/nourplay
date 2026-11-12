import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import { AuditService } from '../../common/audit/audit.service'
import { QueryUsersDto } from './dto/query-users.dto'
import { UpdateUserAdminDto } from './dto/update-user-admin.dto'
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto'
import { CreateLegalDocumentDto } from './dto/create-legal-document.dto'
import { QuerySubscriptionsDto } from './dto/query-subscriptions.dto'
import { GrantSubscriptionDto } from './dto/grant-subscription.dto'
import { UserRole, ConsentType } from '@nourplay/db'

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

  // ── Conformité RGPD ───────────────────────────────────────────

  async getComplianceStats() {
    const [
      consentsByType,
      activeConsents,
      gdprByStatus,
      gdprByType,
      recentGdprRequests,
      activeConsentCount,
      revokedConsentCount,
    ] = await this.prisma.$transaction([
      this.prisma.consentRecord.groupBy({
        by: ['type'],
        where: { revokedAt: null },
        _count: true,
        orderBy: { type: 'asc' },
      }),
      this.prisma.consentRecord.count({ where: { revokedAt: null } }),
      this.prisma.gdprRequest.groupBy({ by: ['status'], _count: true, orderBy: { status: 'asc' } }),
      this.prisma.gdprRequest.groupBy({ by: ['type'], _count: true, orderBy: { type: 'asc' } }),
      this.prisma.gdprRequest.findMany({
        where: { status: { in: ['PENDING', 'PROCESSING'] } },
        orderBy: { requestedAt: 'desc' },
        take: 20,
        select: {
          id: true, type: true, status: true, requestedAt: true,
          user: { select: { id: true, email: true } },
        },
      }),
      this.prisma.consentRecord.count({ where: { revokedAt: null } }),
      this.prisma.consentRecord.count({ where: { revokedAt: { not: null } } }),
    ])

    return {
      consents: {
        activeTotal: activeConsentCount,
        revokedTotal: revokedConsentCount,
        byType: Object.fromEntries(consentsByType.map(c => [c.type, c._count])),
        activeAll: activeConsents,
      },
      gdpr: {
        byStatus: Object.fromEntries(gdprByStatus.map(g => [g.status, g._count])),
        byType: Object.fromEntries(gdprByType.map(g => [g.type, g._count])),
        pendingRequests: recentGdprRequests,
      },
    }
  }

  // ── Textes légaux ─────────────────────────────────────────────

  async listLegalDocuments() {
    return this.prisma.legalDocument.findMany({
      orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
      select: { id: true, type: true, version: true, publishedAt: true, createdAt: true, updatedAt: true, createdById: true },
    })
  }

  async getLegalDocument(id: string) {
    const doc = await this.prisma.legalDocument.findUnique({ where: { id } })
    if (!doc) throw new NotFoundException('Document introuvable')
    return doc
  }

  async createLegalDocument(actorId: string, actorRole: string, dto: CreateLegalDocumentDto) {
    const existing = await this.prisma.legalDocument.findUnique({
      where: { type_version: { type: dto.type as ConsentType, version: dto.version } },
    })
    if (existing) throw new ConflictException(`La version ${dto.version} existe déjà pour ce type`)

    const doc = await this.prisma.legalDocument.create({
      data: { type: dto.type as ConsentType, version: dto.version, content: dto.content, createdById: actorId },
    })

    await this.audit.log({
      actorId, actorRole, action: 'legal.create',
      resourceType: 'LegalDocument', resourceId: doc.id,
      metadata: { type: doc.type, version: doc.version },
    })
    return doc
  }

  async publishLegalDocument(actorId: string, actorRole: string, id: string) {
    const doc = await this.prisma.legalDocument.findUnique({ where: { id } })
    if (!doc) throw new NotFoundException('Document introuvable')
    if (doc.publishedAt) throw new BadRequestException('Ce document est déjà publié')

    const updated = await this.prisma.legalDocument.update({
      where: { id },
      data: { publishedAt: new Date() },
    })

    await this.audit.log({
      actorId, actorRole, action: 'legal.publish',
      resourceType: 'LegalDocument', resourceId: id,
      metadata: { type: doc.type, version: doc.version },
    })
    return updated
  }

  // ── Abonnements ──────────────────────────────────────────────

  async getSubscriptions(query: QuerySubscriptionsDto) {
    const { page, limit, status, userId } = query
    const skip = (page - 1) * limit

    const where = {
      ...(status && { status: status as 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED' }),
      ...(userId && { userId }),
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.subscription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startedAt: 'desc' },
        include: {
          user: { select: { id: true, email: true, role: true } },
          plan: { select: { id: true, name: true, slug: true, priceEur: true, interval: true } },
        },
      }),
      this.prisma.subscription.count({ where }),
    ])

    return { items, total, page, limit }
  }

  async getSubscriptionStats() {
    const [byStatus, byPlan, total, plans] = await this.prisma.$transaction([
      this.prisma.subscription.groupBy({ by: ['status'], _count: true, orderBy: { status: 'asc' } }),
      this.prisma.subscription.groupBy({ by: ['planId'], _count: true, orderBy: { planId: 'asc' } }),
      this.prisma.subscription.count(),
      this.prisma.subscriptionPlan.findMany({ select: { id: true, name: true } }),
    ])

    const planMap = Object.fromEntries(plans.map(p => [p.id, p.name]))

    return {
      total,
      byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count])),
      byPlan: Object.fromEntries(byPlan.map(s => [planMap[s.planId] ?? s.planId, s._count])),
    }
  }

  async grantSubscription(actorId: string, actorRole: string, dto: GrantSubscriptionDto) {
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } })
    if (!user) throw new NotFoundException('Utilisateur introuvable')

    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: dto.planId } })
    if (!plan) throw new NotFoundException('Plan introuvable')

    const subscription = await this.prisma.subscription.upsert({
      where: { userId: dto.userId },
      create: {
        userId: dto.userId,
        planId: dto.planId,
        status: 'ACTIVE',
        ...(dto.expiresAt && { expiresAt: new Date(dto.expiresAt) }),
      },
      update: {
        planId: dto.planId,
        status: 'ACTIVE',
        cancelledAt: null,
        ...(dto.expiresAt && { expiresAt: new Date(dto.expiresAt) }),
      },
      include: {
        user: { select: { id: true, email: true } },
        plan: { select: { id: true, name: true } },
      },
    })

    await this.audit.log({
      actorId, actorRole, action: 'subscription.grant',
      resourceType: 'Subscription', resourceId: subscription.id,
      metadata: { userId: dto.userId, planId: dto.planId, planName: plan.name },
    })

    return subscription
  }

  async revokeSubscription(actorId: string, actorRole: string, subscriptionId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { id: subscriptionId } })
    if (!sub) throw new NotFoundException('Abonnement introuvable')

    const updated = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    })

    await this.audit.log({
      actorId, actorRole, action: 'subscription.revoke',
      resourceType: 'Subscription', resourceId: subscriptionId,
      metadata: { userId: sub.userId },
    })

    return updated
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
      this.prisma.user.groupBy({ by: ['role'], where: { deletedAt: null }, _count: true, orderBy: { role: 'asc' } }),
      this.prisma.video.count(),
      this.prisma.video.groupBy({ by: ['validationStatus'], _count: true, orderBy: { validationStatus: 'asc' } }),
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
