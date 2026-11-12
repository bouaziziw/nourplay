import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common'
import * as argon2 from 'argon2'
import { PrismaService } from '../../common/prisma/prisma.service'
import { SubscriptionService } from '../subscription/subscription.service'
import { EmailService } from '../../common/email/email.service'
import { NotificationService } from '../notification/notification.service'
import { CreateProfileDto } from './dto/create-profile.dto'
import { UpdateProfileDto } from './dto/update-profile.dto'
import { RecordWatchDto } from './dto/record-watch.dto'

const PIN_SELECT = {
  id: true,
  displayName: true,
  ageGroup: true,
  avatarKey: true,
  birthYear: true,
  dailyLimitMin: true,
  sessionLimitMin: true,
  viewingSchedule: true,
  createdAt: true,
}

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionService: SubscriptionService,
    private readonly emailService: EmailService,
    private readonly notificationService: NotificationService,
  ) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: { id: true, email: true, role: true, locale: true, weeklyDigestEnabled: true, createdAt: true, emailVerified: true, twoFactorEnabled: true, parentPinHash: true },
    })
    if (!user) throw new NotFoundException('Utilisateur introuvable')
    const { parentPinHash, ...safeUser } = user
    return { ...safeUser, parentPinConfigured: Boolean(parentPinHash) }
  }

  async updateDigestPreference(userId: string, enabled: boolean) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { weeklyDigestEnabled: enabled },
      select: { id: true, weeklyDigestEnabled: true },
    })
  }

  async updateLocale(userId: string, locale: string) {
    const VALID = ['fr', 'en', 'ar', 'es']
    if (!VALID.includes(locale)) throw new BadRequestException('Locale invalide')
    return this.prisma.user.update({
      where: { id: userId },
      data: { locale },
      select: { id: true, locale: true },
    })
  }

  // ── Profils enfants ──────────────────────────────────────────

  async getProfiles(userId: string) {
    return this.prisma.childProfile.findMany({
      where: { userId, deletedAt: null },
      select: PIN_SELECT,
      orderBy: { createdAt: 'asc' },
    })
  }

  async getMyLimits(userId: string) {
    const [{ maxProfiles, maxPlaylists, planSlug }, currentProfiles, currentPlaylists] =
      await Promise.all([
        this.subscriptionService.getUserPlanLimits(userId),
        this.prisma.childProfile.count({ where: { userId, deletedAt: null } }),
        this.prisma.playlist.count({ where: { ownerId: userId, deletedAt: null } }),
      ])
    return {
      planSlug,
      profiles: { current: currentProfiles, max: maxProfiles },
      playlists: { current: currentPlaylists, max: maxPlaylists },
    }
  }

  async createProfile(userId: string, dto: CreateProfileDto) {
    const count = await this.prisma.childProfile.count({
      where: { userId, deletedAt: null },
    })

    const { maxProfiles, planSlug } = await this.subscriptionService.getUserPlanLimits(userId)
    if (count >= maxProfiles) {
      throw new BadRequestException(
        planSlug === 'free'
          ? 'Votre forfait gratuit est limité à 1 profil enfant. Passez à Premium pour créer des profils illimités.'
          : `Maximum de profils enfants atteint (${maxProfiles})`,
      )
    }

    const pinHash = await this.hashPin(dto.pin)

    return this.prisma.childProfile.create({
      data: {
        userId,
        displayName: dto.displayName,
        ageGroup: dto.ageGroup,
        birthYear: dto.birthYear,
        pinHash,
        dailyLimitMin: dto.dailyLimitMin,
        sessionLimitMin: dto.sessionLimitMin,
      },
      select: PIN_SELECT,
    })
  }

  async getProfile(userId: string, profileId: string) {
    const profile = await this.prisma.childProfile.findFirst({
      where: { id: profileId, userId, deletedAt: null },
      select: PIN_SELECT,
    })
    if (!profile) throw new NotFoundException('Profil introuvable')
    return profile
  }

  async updateProfile(userId: string, profileId: string, dto: UpdateProfileDto) {
    await this.assertProfileOwner(userId, profileId)
    return this.prisma.childProfile.update({
      where: { id: profileId },
      data: {
        ...(dto.displayName && { displayName: dto.displayName }),
        ...(dto.ageGroup && { ageGroup: dto.ageGroup }),
        ...(dto.dailyLimitMin !== undefined && { dailyLimitMin: dto.dailyLimitMin }),
        ...(dto.sessionLimitMin !== undefined && { sessionLimitMin: dto.sessionLimitMin }),
        ...(dto.viewingSchedule !== undefined && { viewingSchedule: dto.viewingSchedule }),
        ...('avatarKey' in dto && { avatarKey: dto.avatarKey }),
      },
      select: PIN_SELECT,
    })
  }

  async deleteProfile(userId: string, profileId: string) {
    await this.assertProfileOwner(userId, profileId)
    await this.prisma.childProfile.update({
      where: { id: profileId },
      data: { deletedAt: new Date() },
    })
  }

  async verifyPin(userId: string, profileId: string, pin: string): Promise<boolean> {
    const profile = await this.prisma.childProfile.findFirst({
      where: { id: profileId, userId, deletedAt: null },
      select: { pinHash: true },
    })
    if (!profile) throw new NotFoundException('Profil introuvable')

    const valid = await argon2.verify(profile.pinHash, pin)
    if (!valid) throw new UnauthorizedException('PIN incorrect')
    return true
  }

  async changePin(userId: string, profileId: string, currentPin: string, newPin: string) {
    const profile = await this.prisma.childProfile.findFirst({
      where: { id: profileId, userId, deletedAt: null },
      select: { pinHash: true },
    })
    if (!profile) throw new NotFoundException('Profil introuvable')

    const valid = await argon2.verify(profile.pinHash, currentPin)
    if (!valid) throw new UnauthorizedException('PIN actuel incorrect')

    const newHash = await this.hashPin(newPin)
    await this.prisma.childProfile.update({ where: { id: profileId }, data: { pinHash: newHash } })
    return { changed: true }
  }

  async getWatchHistory(userId: string, profileId: string, limit = 50) {
    await this.assertProfileOwner(userId, profileId)
    return this.prisma.watchHistory.findMany({
      where: { profileId },
      include: {
        video: {
          select: { id: true, title: true, thumbnailUrl: true, durationSec: true, embedUrl: true },
        },
      },
      orderBy: { watchedAt: 'desc' },
      take: limit,
    })
  }

  async clearWatchHistory(userId: string, profileId: string) {
    await this.assertProfileOwner(userId, profileId)
    await this.prisma.watchHistory.deleteMany({ where: { profileId } })
  }

  async recordWatchEvent(userId: string, profileId: string, dto: RecordWatchDto) {
    const [profile, video] = await Promise.all([
      this.prisma.childProfile.findFirst({
        where: { id: profileId, userId, deletedAt: null },
        select: { id: true, displayName: true, dailyLimitMin: true, userId: true, viewingSchedule: true },
      }),
      this.prisma.video.findUnique({
        where: { id: dto.videoId },
        select: { id: true, validationStatus: true },
      }),
    ])

    if (!profile) throw new NotFoundException('Profil introuvable')
    if (!video) throw new NotFoundException('Vidéo introuvable')
    if (!this.isWithinSchedule(profile.viewingSchedule as Record<string, string[]> | null)) {
      throw new ForbiddenException('Visionnage non autorisé en dehors des plages horaires configurées')
    }

    const entry = await this.prisma.watchHistory.create({
      data: {
        profileId,
        videoId: dto.videoId,
        durationWatchedSec: dto.durationWatchedSec,
        completed: dto.completed,
      },
    })

    if (profile.dailyLimitMin) {
      this.checkScreenTimeLimit(
        profile.userId,
        profileId,
        profile.displayName,
        profile.dailyLimitMin,
        dto.durationWatchedSec,
      ).catch(() => {})
    }

    this.checkCategoryTimeLimits(
      profile.userId,
      profileId,
      profile.displayName,
      dto.videoId,
      dto.durationWatchedSec,
    ).catch(() => {})

    return entry
  }

  private async checkScreenTimeLimit(
    userId: string,
    profileId: string,
    profileName: string,
    limitMin: number,
    justWatchedSec: number,
  ) {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const agg = await this.prisma.watchHistory.aggregate({
      where: { profileId, watchedAt: { gte: startOfDay } },
      _sum: { durationWatchedSec: true },
    })

    const totalSec = agg._sum.durationWatchedSec ?? 0
    const prevSec = totalSec - justWatchedSec
    const limitSec = limitMin * 60

    if (prevSec < limitSec && totalSec >= limitSec) {
      const watchedMin = Math.round(totalSec / 60)

      void this.prisma.notification.create({
        data: {
          userId,
          type: 'SCREEN_TIME_ALERT',
          payload: { profileName, limitMin, watchedMin },
        },
      })

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, locale: true },
      })
      if (user?.email) {
        await this.emailService.sendScreenTimeAlertEmail(
          user.email,
          profileName,
          limitMin,
          watchedMin,
          user.locale ?? 'fr',
        )
      }
    }
  }

  private async checkCategoryTimeLimits(
    userId: string,
    profileId: string,
    profileName: string,
    videoId: string,
    justWatchedSec: number,
  ) {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const [videoTags, limits] = await Promise.all([
      this.prisma.videoTag.findMany({
        where: { videoId },
        select: { tagId: true, tag: { select: { name: true } } },
      }),
      this.prisma.profileCategoryLimit.findMany({
        where: { profileId },
        select: { tagId: true, dailyLimitMin: true },
      }),
    ])

    if (!videoTags.length || !limits.length) return

    const limitMap = new Map(limits.map(l => [l.tagId, l.dailyLimitMin]))

    for (const { tagId, tag } of videoTags) {
      const limitMin = limitMap.get(tagId)
      if (!limitMin) continue

      const agg = await this.prisma.watchHistory.aggregate({
        where: {
          profileId,
          watchedAt: { gte: startOfDay },
          video: { tags: { some: { tagId } } },
        },
        _sum: { durationWatchedSec: true },
      })

      const totalSec = agg._sum.durationWatchedSec ?? 0
      const prevSec = totalSec - justWatchedSec
      const limitSec = limitMin * 60

      if (prevSec < limitSec && totalSec >= limitSec) {
        void this.prisma.notification.create({
          data: {
            userId,
            type: 'CATEGORY_TIME_ALERT',
            payload: { profileName, tagName: tag.name, limitMin, watchedMin: Math.round(totalSec / 60) },
          },
        })
      }
    }
  }

  // ── Progression vidéo ────────────────────────────────────────

  async exportWatchHistoryCsv(userId: string, profileId: string): Promise<string> {
    await this.assertProfileOwner(userId, profileId)
    const rows = await this.prisma.watchHistory.findMany({
      where: { profileId },
      include: { video: { select: { title: true, durationSec: true } } },
      orderBy: { watchedAt: 'desc' },
    })

    const header = 'Date,Titre,"Durée regardée (min)","Vidéo terminée"'
    const lines = rows.map(r => {
      const date = r.watchedAt.toISOString().replace('T', ' ').slice(0, 16)
      const title = this.csvEscape(r.video.title)
      const watched = Math.round(r.durationWatchedSec / 60)
      const completed = r.completed ? 'Oui' : 'Non'
      return `${date},${title},${watched},${completed}`
    })
    return '﻿' + header + '\n' + lines.join('\n')
  }

  async getInProgressVideos(userId: string, profileId: string, limit = 10) {
    await this.assertProfileOwner(userId, profileId)
    return this.prisma.videoProgress.findMany({
      where: { profileId, completed: false, positionSec: { gte: 10 } },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        video: {
          select: {
            id: true, title: true, thumbnailUrl: true,
            durationSec: true, embedUrl: true,
          },
        },
      },
    })
  }

  async getVideoProgress(userId: string, profileId: string, videoId: string) {
    await this.assertProfileOwner(userId, profileId)
    const row = await this.prisma.videoProgress.findUnique({
      where: { profileId_videoId: { profileId, videoId } },
    })
    return { positionSec: row?.positionSec ?? 0, completed: row?.completed ?? false }
  }

  async upsertVideoProgress(userId: string, profileId: string, videoId: string, positionSec: number) {
    await this.assertProfileOwner(userId, profileId)
    const video = await this.prisma.video.findUnique({ where: { id: videoId }, select: { id: true } })
    if (!video) throw new NotFoundException('Vidéo introuvable')

    const completed = positionSec >= 270 // mark complete after 4.5 min watched (heuristic)
    return this.prisma.videoProgress.upsert({
      where: { profileId_videoId: { profileId, videoId } },
      create: { profileId, videoId, positionSec, completed },
      update: { positionSec, ...(completed && { completed }) },
    })
  }

  // ── Privé ──────────────────────────────────────────────────

  // ── Filtres de contenu (UserBlock) ───────────────────────────

  async getBlocks(userId: string, profileId?: string) {
    return this.prisma.userBlock.findMany({
      where: { userId, ...(profileId ? { profileId } : {}) },
      orderBy: { createdAt: 'desc' },
    })
  }

  async createBlock(userId: string, dto: { profileId?: string; type: string; value: string }) {
    if (dto.profileId) {
      await this.assertProfileOwner(userId, dto.profileId)
    }
    return this.prisma.userBlock.create({
      data: { userId, profileId: dto.profileId ?? null, type: dto.type as never, value: dto.value },
    })
  }

  async deleteBlock(userId: string, blockId: string) {
    const block = await this.prisma.userBlock.findUnique({ where: { id: blockId } })
    if (!block || block.userId !== userId) throw new NotFoundException('Filtre introuvable')
    await this.prisma.userBlock.delete({ where: { id: blockId } })
  }

  async getProfileAnalytics(userId: string, profileId: string) {
    await this.assertProfileOwner(userId, profileId)

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [todayAgg, weekAgg, monthAgg, monthCompleted, topVideos, allMonthRaw] = await Promise.all([
      this.prisma.watchHistory.aggregate({
        where: { profileId, watchedAt: { gte: todayStart } },
        _sum: { durationWatchedSec: true },
        _count: { id: true },
      }),
      this.prisma.watchHistory.aggregate({
        where: { profileId, watchedAt: { gte: weekAgo } },
        _sum: { durationWatchedSec: true },
        _count: { id: true },
      }),
      this.prisma.watchHistory.aggregate({
        where: { profileId, watchedAt: { gte: monthAgo } },
        _sum: { durationWatchedSec: true },
        _count: { id: true },
      }),
      this.prisma.watchHistory.count({
        where: { profileId, watchedAt: { gte: monthAgo }, completed: true },
      }),
      this.prisma.watchHistory.groupBy({
        by: ['videoId'],
        where: { profileId, watchedAt: { gte: monthAgo } },
        _count: { id: true },
        _sum: { durationWatchedSec: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
      this.prisma.watchHistory.findMany({
        where: { profileId, watchedAt: { gte: monthAgo } },
        select: { watchedAt: true, durationWatchedSec: true },
      }),
    ])

    const dateKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

    // Build per-day map for the last 30 days
    const monthDayMap = new Map<string, number>()
    for (let i = 29; i >= 0; i--) {
      monthDayMap.set(dateKey(new Date(now.getTime() - i * 24 * 60 * 60 * 1000)), 0)
    }
    for (const entry of allMonthRaw) {
      const key = dateKey(new Date(entry.watchedAt))
      if (monthDayMap.has(key)) monthDayMap.set(key, (monthDayMap.get(key) ?? 0) + entry.durationWatchedSec)
    }
    const watchTimeByMonth = Array.from(monthDayMap.entries()).map(([date, watchedSec]) => ({ date, watchedSec }))
    const watchTimeByDay = watchTimeByMonth.slice(-7)

    const videoIds = topVideos.map(w => w.videoId)
    const videos = videoIds.length
      ? await this.prisma.video.findMany({
          where: { id: { in: videoIds } },
          select: { id: true, title: true, thumbnailUrl: true, durationSec: true },
        })
      : []
    const videoMap = new Map(videos.map(v => [v.id, v]))
    const monthTotal = monthAgg._count.id

    return {
      today: {
        watchedSec: todayAgg._sum.durationWatchedSec ?? 0,
        count: todayAgg._count.id,
      },
      week: {
        watchedSec: weekAgg._sum.durationWatchedSec ?? 0,
        count: weekAgg._count.id,
      },
      month: {
        watchedSec: monthAgg._sum.durationWatchedSec ?? 0,
        count: monthTotal,
        completionRate: monthTotal > 0 ? Math.round((monthCompleted / monthTotal) * 100) : 0,
      },
      watchTimeByDay,
      watchTimeByMonth,
      topVideos: topVideos
        .map(w => ({
          video: videoMap.get(w.videoId) ?? null,
          watchCount: w._count.id,
          totalWatchedSec: w._sum.durationWatchedSec ?? 0,
        }))
        .filter(w => w.video !== null),
    }
  }

  // ── Temps de visionnage quotidien ───────────────────────────

  async getDailyWatchTime(userId: string, profileId: string): Promise<{ watchedSec: number }> {
    await this.assertProfileOwner(userId, profileId)
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const agg = await this.prisma.watchHistory.aggregate({
      where: { profileId, watchedAt: { gte: startOfDay } },
      _sum: { durationWatchedSec: true },
    })
    return { watchedSec: agg._sum.durationWatchedSec ?? 0 }
  }

  // ── Limites par catégorie ────────────────────────────────────

  async getCategoryLimits(userId: string, profileId: string) {
    await this.assertProfileOwner(userId, profileId)
    return this.prisma.profileCategoryLimit.findMany({
      where: { profileId },
      include: { tag: { select: { id: true, name: true, locale: true } } },
      orderBy: { tag: { name: 'asc' } },
    })
  }

  async upsertCategoryLimit(userId: string, profileId: string, tagId: string, dailyLimitMin: number) {
    await this.assertProfileOwner(userId, profileId)
    if (!Number.isInteger(dailyLimitMin) || dailyLimitMin < 1 || dailyLimitMin > 480) {
      throw new BadRequestException('La limite doit être entre 1 et 480 minutes.')
    }
    const tag = await this.prisma.tag.findUnique({ where: { id: tagId }, select: { id: true } })
    if (!tag) throw new NotFoundException('Catégorie introuvable')

    return this.prisma.profileCategoryLimit.upsert({
      where: { profileId_tagId: { profileId, tagId } },
      create: { profileId, tagId, dailyLimitMin },
      update: { dailyLimitMin },
      include: { tag: { select: { id: true, name: true, locale: true } } },
    })
  }

  async deleteCategoryLimit(userId: string, profileId: string, tagId: string) {
    await this.assertProfileOwner(userId, profileId)
    await this.prisma.profileCategoryLimit.deleteMany({ where: { profileId, tagId } })
  }

  // ── Favoris par profil enfant ────────────────────────────────

  async getFavorites(userId: string, profileId: string) {
    await this.assertProfileOwner(userId, profileId)
    return this.prisma.videoFavorite.findMany({
      where: { profileId },
      include: {
        video: {
          select: { id: true, title: true, thumbnailUrl: true, durationSec: true, ageRating: true, language: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async addFavorite(userId: string, profileId: string, videoId: string) {
    await this.assertProfileOwner(userId, profileId)

    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
      select: { id: true, validationStatus: true },
    })
    if (!video) throw new NotFoundException('Vidéo introuvable')
    if (video.validationStatus !== 'APPROVED') {
      throw new BadRequestException('Seules les vidéos approuvées peuvent être mises en favoris')
    }

    return this.prisma.videoFavorite.upsert({
      where: { profileId_videoId: { profileId, videoId } },
      create: { profileId, videoId },
      update: {},
      select: { id: true, videoId: true, createdAt: true },
    })
  }

  async removeFavorite(userId: string, profileId: string, videoId: string) {
    await this.assertProfileOwner(userId, profileId)
    await this.prisma.videoFavorite.deleteMany({ where: { profileId, videoId } })
  }

  // ── Évaluations vidéo ────────────────────────────────────────

  async rateVideo(userId: string, profileId: string, videoId: string, rating: 'THUMBS_UP' | 'THUMBS_DOWN' | null) {
    await this.assertProfileOwner(userId, profileId)
    if (rating === null) {
      await this.prisma.videoRating.deleteMany({ where: { profileId, videoId } })
      return { rating: null }
    }
    const video = await this.prisma.video.findUnique({ where: { id: videoId }, select: { id: true } })
    if (!video) throw new NotFoundException('Vidéo introuvable')
    const result = await this.prisma.videoRating.upsert({
      where: { profileId_videoId: { profileId, videoId } },
      update: { rating: rating as never },
      create: { profileId, videoId, rating: rating as never },
    })
    return { rating: result.rating }
  }

  async getVideoRating(userId: string, profileId: string, videoId: string) {
    await this.assertProfileOwner(userId, profileId)
    const row = await this.prisma.videoRating.findUnique({
      where: { profileId_videoId: { profileId, videoId } },
    })
    return { rating: row?.rating ?? null }
  }

  async getProfileRatings(userId: string, profileId: string) {
    await this.assertProfileOwner(userId, profileId)
    return this.prisma.videoRating.findMany({
      where: { profileId },
      orderBy: { ratedAt: 'desc' },
      include: {
        video: { select: { id: true, title: true, thumbnailUrl: true } },
      },
    })
  }

  // ── File d'approbation parentale ─────────────────────────────

  async requestApproval(userId: string, profileId: string, videoId: string) {
    await this.assertProfileOwner(userId, profileId)
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
      select: { id: true, title: true, ageRating: true, validationStatus: true },
    })
    if (!video) throw new NotFoundException('Vidéo introuvable')
    if (video.validationStatus !== 'APPROVED') throw new BadRequestException('Vidéo non disponible')

    const req = await this.prisma.parentalApprovalRequest.upsert({
      where: { profileId_videoId: { profileId, videoId } },
      create: { profileId, videoId, status: 'PENDING' },
      update: { status: 'PENDING', requestedAt: new Date(), resolvedAt: null },
      include: {
        video: { select: { id: true, title: true, thumbnailUrl: true, ageRating: true } },
        profile: { select: { id: true, displayName: true } },
      },
    })

    void this.notificationService.create({
      userId,
      type: 'APPROVAL_REQUESTED',
      payload: {
        profileName: req.profile.displayName,
        videoTitle: req.video.title,
        videoId,
        requestId: req.id,
      },
    })

    return req
  }

  async getApprovalRequests(userId: string, status?: string) {
    const profiles = await this.prisma.childProfile.findMany({
      where: { userId, deletedAt: null },
      select: { id: true },
    })
    const profileIds = profiles.map(p => p.id)

    const where: Record<string, unknown> = { profileId: { in: profileIds } }
    if (status && status !== 'ALL') where.status = status

    return this.prisma.parentalApprovalRequest.findMany({
      where,
      include: {
        video: { select: { id: true, title: true, thumbnailUrl: true, ageRating: true } },
        profile: { select: { id: true, displayName: true, ageGroup: true } },
      },
      orderBy: { requestedAt: 'desc' },
    })
  }

  async resolveApproval(userId: string, requestId: string, action: 'APPROVED' | 'DENIED') {
    const req = await this.prisma.parentalApprovalRequest.findFirst({
      where: { id: requestId, profile: { userId } },
      select: { id: true, status: true, profileId: true },
    })
    if (!req) throw new NotFoundException('Demande introuvable')
    if (req.status !== 'PENDING') throw new BadRequestException('Cette demande a déjà été traitée.')

    return this.prisma.parentalApprovalRequest.update({
      where: { id: requestId },
      data: { status: action, resolvedAt: new Date() },
      include: {
        video: { select: { id: true, title: true, thumbnailUrl: true, ageRating: true } },
        profile: { select: { id: true, displayName: true } },
      },
    })
  }

  async getVideoApprovalStatus(userId: string, profileId: string, videoId: string) {
    await this.assertProfileOwner(userId, profileId)
    const req = await this.prisma.parentalApprovalRequest.findUnique({
      where: { profileId_videoId: { profileId, videoId } },
      select: { id: true, status: true, requestedAt: true, resolvedAt: true },
    })
    return { status: req?.status ?? null, requestId: req?.id ?? null, requestedAt: req?.requestedAt ?? null }
  }

  private isWithinSchedule(schedule: Record<string, string[]> | null): boolean {
    if (!schedule) return true
    const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
    const day = DAY_KEYS[new Date().getDay()]
    const slots = schedule[day]
    if (!slots?.length) return false
    const now = new Date()
    const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    return slots.some((slot: string) => {
      const [start, end] = slot.split('-')
      return current >= start && current <= end
    })
  }

  private csvEscape(value: string | null | undefined): string {
    if (value == null) return ''
    const str = String(value)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  private async assertProfileOwner(userId: string, profileId: string) {
    const profile = await this.prisma.childProfile.findFirst({
      where: { id: profileId, userId, deletedAt: null },
      select: { id: true },
    })
    if (!profile) throw new NotFoundException('Profil introuvable')
  }

  private async hashPin(pin: string): Promise<string> {
    return argon2.hash(pin, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
    })
  }
}
