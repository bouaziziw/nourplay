import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  ServiceUnavailableException,
  Inject,
  Logger,
  OnModuleInit,
  Optional,
} from '@nestjs/common'
import { Queue } from 'bullmq'
import { Prisma } from '@nourplay/db'
import { PrismaService } from '../../common/prisma/prisma.service'
import { CacheService } from '../../common/cache/cache.service'
import { AuditService } from '../../common/audit/audit.service'
import { VIDEO_VALIDATION_QUEUE } from '../../common/bull/bull.module'
import { VideoValidationService, extractRejectionReason } from './video-validation.service'
import { EmailService } from '../../common/email/email.service'
import { allowedAgeRatings } from '../../common/age-utils'
import { safeFetch } from '../../common/http/safe-fetch'
import { SubmitVideoDto } from './dto/submit-video.dto'

const VIDEO_SEARCH_TTL = 120

const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/
const VIMEO_ID_REGEX = /^\d+$/

interface ParsedVideo {
  sourceSlug: string
  externalId: string
  embedUrl: string
  thumbnailUrl?: string
}

@Injectable()
export class VideoService implements OnModuleInit {
  private readonly logger = new Logger(VideoService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    @Inject(VIDEO_VALIDATION_QUEUE) private readonly validationQueue: Queue,
    private readonly audit: AuditService,
    @Optional() private readonly videoValidationService?: VideoValidationService,
    @Optional() private readonly email?: EmailService,
  ) {}

  async onModuleInit() {
    await this.ensureDefaultSources()
  }

  async ensureDefaultSources() {
    try {
      await this.prisma.videoSource.upsert({
        where: { slug: 'youtube' },
        update: { embedAllowed: true, isActive: true },
        create: {
          name: 'YouTube',
          slug: 'youtube',
          baseUrl: 'https://www.youtube.com',
          embedAllowed: true,
          cguVersion: '2024-01',
          cguCheckedAt: new Date(),
          embedPolicy: {
            embedUrl: 'https://www.youtube.com/embed/{id}',
            allowFullscreen: true,
            requiresConsent: false,
          },
        },
      })
      await this.prisma.videoSource.upsert({
        where: { slug: 'vimeo' },
        update: { embedAllowed: true, isActive: true },
        create: {
          name: 'Vimeo',
          slug: 'vimeo',
          baseUrl: 'https://vimeo.com',
          embedAllowed: true,
          cguVersion: '2024-01',
          cguCheckedAt: new Date(),
          embedPolicy: {
            embedUrl: 'https://player.vimeo.com/video/{id}',
            allowFullscreen: true,
            requiresConsent: false,
          },
        },
      })
      this.logger.log('Default video sources (YouTube, Vimeo) verified and active')
    } catch (err) {
      this.logger.warn(`Could not ensure default video sources: ${err instanceof Error ? err.message : err}`)
    }
  }

  async submit(userId: string, dto: SubmitVideoDto) {
    const parsed = this.parseVideoUrl(dto.url)
    if (!parsed) throw new BadRequestException('URL de vidéo non supportée (YouTube ou Vimeo uniquement)')

    let source = await this.prisma.videoSource.findFirst({
      where: { slug: parsed.sourceSlug, embedAllowed: true, isActive: true },
    })
    if (!source && (parsed.sourceSlug === 'youtube' || parsed.sourceSlug === 'vimeo')) {
      await this.ensureDefaultSources()
      source = await this.prisma.videoSource.findFirst({
        where: { slug: parsed.sourceSlug, embedAllowed: true, isActive: true },
      })
    }
    if (!source) throw new BadRequestException('Source vidéo non autorisée')

    // Déduplique : si la vidéo existe déjà et est approuvée, on la retourne
    const existing = await this.prisma.video.findUnique({
      where: { sourceId_externalId: { sourceId: source.id, externalId: parsed.externalId } },
    })
    if (existing?.validationStatus === 'APPROVED') return existing
    if (existing) {
      if (existing.submittedById !== userId) {
        throw new ConflictException('Cette vidéo a déjà été soumise et suit son processus de validation')
      }
      this.logger.log(`Video ${existing.id} already submitted with status ${existing.validationStatus}`)
      if (existing.validationStatus === 'PENDING') {
        await this.enqueueValidation(existing.id)
      }
      return existing
    }

    // Récupère les métadonnées via l'API YouTube si disponible
    const metadata = await this.fetchYouTubeMetadata(parsed.externalId, parsed.sourceSlug)

    const video = await this.prisma.video.create({
      data: {
        sourceId: source.id,
        externalId: parsed.externalId,
        embedUrl: parsed.embedUrl,
        title: metadata.title ?? `Vidéo ${parsed.externalId}`,
        description: metadata.description,
        durationSec: metadata.durationSec,
        thumbnailUrl: parsed.thumbnailUrl ?? metadata.thumbnailUrl,
        language: dto.language ?? metadata.language,
        ageRating: dto.ageRating ?? 'ALL',
        submittedById: userId,
        validationStatus: 'PENDING',
      },
    })

    await this.enqueueValidation(video.id)
    if (this.videoValidationService) {
      void this.videoValidationService.validateVideoById(video.id).catch(err => {
        this.logger.warn(`Direct validation failed for video ${video.id}: ${err.message}`)
      })
    }
    this.logger.log(`Video ${video.id} submitted and queued for priority validation`)
    return video
  }

  async revalidateAllPending() {
    const batchSize = 500
    let cursor: string | undefined
    let queued = 0

    while (true) {
      const videos = await this.prisma.video.findMany({
        where: { validationStatus: 'PENDING' },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: batchSize,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })
      if (videos.length === 0) break

      const results = await Promise.allSettled(
        videos.map(video => this.enqueueValidation(video.id)),
      )
      const failedCount = results.filter(result => result.status === 'rejected').length
      queued += videos.length - failedCount
      if (failedCount > 0) {
        this.logger.error(
          `Failed to enqueue ${failedCount} pending video validation job(s)`,
          results
            .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
            .map(result => result.reason instanceof Error ? result.reason.stack : String(result.reason))
            .join('\n'),
        )
        throw new ServiceUnavailableException(
          `Validation relancée pour ${queued} vidéo(s), mais la file est indisponible. Réessayez.`,
        )
      }

      cursor = videos[videos.length - 1].id
      if (videos.length < batchSize) break
    }

    if (this.videoValidationService) {
      const directResult = await this.videoValidationService.processPendingVideos(30)
      return {
        queued,
        processed: directResult.processed,
        approved: directResult.approved,
        rejected: directResult.rejected,
        needsReview: directResult.needsReview,
      }
    }

    return { queued }
  }

  private async enqueueValidation(videoId: string) {
    try {
      const jobId = `video-validation-${videoId}`
      const existingJob = await this.validationQueue.getJob(jobId)
      if (existingJob) {
        const state = await existingJob.getState()
        if (
          state === 'completed'
          || state === 'failed'
          || ((state === 'waiting' || state === 'delayed') && existingJob.opts.priority !== 1)
        ) {
          await existingJob.remove()
        }
      }

      await this.validationQueue.add('validate', { videoId }, {
        jobId,
        priority: 1,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      })
    } catch (error) {
      this.logger.error(
        `Failed to enqueue priority validation for video ${videoId}`,
        error instanceof Error ? error.stack : String(error),
      )
      throw new ServiceUnavailableException(
        'La vidéo a été enregistrée, mais la file de validation est indisponible. Réessayez pour relancer son traitement.',
      )
    }
  }

  async listMySubmissions(userId: string) {
    const videos = await this.prisma.video.findMany({
      where: { submittedById: userId },
      select: {
        id: true,
        title: true,
        thumbnailUrl: true,
        validationStatus: true,
        validationLog: true,
        submitterApprovedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return videos.map(video => ({
      id: video.id,
      title: video.title,
      thumbnailUrl: video.thumbnailUrl,
      validationStatus: video.validationStatus,
      submitterApprovedAt: video.submitterApprovedAt,
      createdAt: video.createdAt,
      rejectionReason: video.validationStatus === 'REJECTED'
        ? extractRejectionReason(video.validationLog as Record<string, unknown> | null)
        : undefined,
    }))
  }

  async approveSubmission(userId: string, userRole: string, videoId: string) {
    const video = await this.prisma.video.findFirst({
      where: { id: videoId, submittedById: userId },
      select: {
        id: true,
        title: true,
        validationStatus: true,
        submitterApprovedAt: true,
      },
    })
    if (!video) throw new NotFoundException('Vidéo introuvable')
    if (video.validationStatus !== 'PENDING') {
      throw new BadRequestException('Cette vidéo a déjà été traitée par le système')
    }

    if (!video.submitterApprovedAt) {
      const approval = await this.prisma.video.updateMany({
        where: {
          id: videoId,
          submittedById: userId,
          validationStatus: 'PENDING',
          submitterApprovedAt: null,
        },
        data: { submitterApprovedAt: new Date() },
      })

      if (approval.count > 0) {
        await this.audit.log({
          actorId: userId,
          actorRole: userRole,
          action: 'video.submitter_approve',
          resourceType: 'Video',
          resourceId: videoId,
        })
      }
    }

    await this.enqueueValidation(videoId)
    if (this.videoValidationService) {
      void this.videoValidationService.validateVideoById(videoId).catch(err => {
        this.logger.warn(`Direct validation failed for video ${videoId}: ${err.message}`)
      })
    }

    this.logger.log(`Video ${videoId} approved by submitter and queued for validation`)
    return {
      id: video.id,
      title: video.title,
      validationStatus: video.validationStatus,
      submitterApprovedAt: video.submitterApprovedAt ?? new Date(),
    }
  }

  async approvePlaylistSubmissions(userId: string, userRole: string, playlistId: string) {
    const playlist = await this.prisma.playlist.findFirst({
      where: { id: playlistId, ownerId: userId, deletedAt: null },
      select: { id: true },
    })
    if (!playlist) throw new NotFoundException('Playlist introuvable')

    const videos = await this.prisma.video.findMany({
      where: {
        submittedById: userId,
        validationStatus: 'PENDING',
        playlistVideos: { some: { playlistId } },
      },
      select: { id: true },
    })
    const results = await Promise.allSettled(
      videos.map(video => this.approveSubmission(userId, userRole, video.id)),
    )
    const queued = results.filter(result => result.status === 'fulfilled').length
    const failed = results.length - queued
    if (failed > 0) {
      this.logger.error(`Failed to enqueue ${failed} of ${results.length} playlist video validations`)
      throw new ServiceUnavailableException(
        `${queued} vidéo(s) envoyée(s) en validation ; ${failed} n’ont pas pu être envoyées. Réessayez.`,
      )
    }
    return { queued }
  }

  async updateOwnSubmission(userId: string, videoId: string, title: string) {
    const updated = await this.prisma.video.updateMany({
      where: {
        id: videoId,
        submittedById: userId,
        validationStatus: 'PENDING',
        submitterApprovedAt: null,
      },
      data: { title: title.trim() },
    })
    if (updated.count !== 1) {
      throw new NotFoundException('Vidéo introuvable ou déjà envoyée en validation')
    }
    return { id: videoId, title: title.trim() }
  }

  async deleteVideoAsAdmin(actorId: string, actorRole: string, videoId: string) {
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
      select: { id: true, title: true },
    })
    if (!video) throw new NotFoundException('Vidéo introuvable')

    await this.prisma.video.delete({ where: { id: videoId } })
    await this.audit.log({
      actorId,
      actorRole,
      action: 'video.delete',
      resourceType: 'Video',
      resourceId: videoId,
      metadata: { title: video.title },
    })
    return { id: videoId }
  }

  async findById(id: string, userId?: string, profileId?: string) {
    if (profileId && userId) {
      let isBlocked = false
      try {
        const profile = await this.prisma.childProfile.findFirst({
          where: { id: profileId, userId, deletedAt: null },
          select: { isViewingBlocked: true },
        })
        isBlocked = Boolean(profile?.isViewingBlocked)
      } catch (err: any) {
        if (!err?.message?.includes('is_viewing_blocked') && err?.code !== 'P2021' && err?.code !== 'P2022') {
          throw err
        }
      }
      if (isBlocked) {
        throw new ForbiddenException('Le visionnage a été mis en pause par un parent.')
      }
    }
    const video = await this.prisma.video.findUnique({
      where: { id },
      include: {
        source: { select: { name: true, slug: true } },
        tags: { include: { tag: true } },
      },
    })
    if (!video) throw new NotFoundException('Vidéo introuvable')
    return video
  }

  async findSimilar(videoId: string, limit = 4) {
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
      select: { ageRating: true, language: true },
    })
    if (!video) throw new NotFoundException('Vidéo introuvable')

    const videoSelect = {
      id: true, title: true, thumbnailUrl: true,
      embedUrl: true, durationSec: true, language: true, ageRating: true,
    }
    const baseWhere = { validationStatus: 'APPROVED' as const }

    // Tier 1: same ageRating + same language
    const tier1 = await this.prisma.video.findMany({
      where: {
        ...baseWhere,
        id: { not: videoId },
        ageRating: video.ageRating,
        ...(video.language ? { language: video.language } : {}),
      },
      select: videoSelect,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    if (tier1.length >= limit) return tier1

    // Tier 2: same ageRating, any language — fill remaining slots
    const found = tier1.map(v => v.id)
    const tier2 = await this.prisma.video.findMany({
      where: {
        ...baseWhere,
        id: { notIn: [videoId, ...found] },
        ageRating: video.ageRating,
      },
      select: videoSelect,
      orderBy: { createdAt: 'desc' },
      take: limit - tier1.length,
    })

    return [...tier1, ...tier2]
  }

  async autocomplete(q: string, limit = 6) {
    const term = q.trim()
    if (term.length < 2) return []
    return this.prisma.video.findMany({
      where: {
        validationStatus: 'APPROVED',
        title: { contains: term, mode: 'insensitive' },
      },
      select: { id: true, title: true, thumbnailUrl: true },
      take: limit,
      orderBy: { title: 'asc' },
    })
  }

  async listTags() {
    return this.prisma.tag.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, locale: true },
    })
  }

  async search(params: {
    q?: string
    language?: string
    ageRating?: string
    sourceSlug?: string
    tags?: string[]
    page?: number
    limit?: number
    userId?: string
    profileId?: string
  }) {
    const { q, language, ageRating, sourceSlug, tags, page = 1, limit = 20, userId, profileId } = params

    let ageRatingFilter: string | string[] | undefined = ageRating
    if (profileId && userId) {
      let profile: { ageGroup: any; isViewingBlocked?: boolean } | null = null
      try {
        profile = await this.prisma.childProfile.findFirst({
          where: { id: profileId, userId, deletedAt: null },
          select: { ageGroup: true, isViewingBlocked: true },
        })
      } catch (err: any) {
        if (err?.message?.includes('is_viewing_blocked') || err?.code === 'P2021' || err?.code === 'P2022') {
          profile = await this.prisma.childProfile.findFirst({
            where: { id: profileId, userId, deletedAt: null },
            select: { ageGroup: true },
          })
        } else {
          throw err
        }
      }
      if (profile?.isViewingBlocked) {
        return { items: [], total: 0, page, limit, pages: 0 }
      }
      if (profile) ageRatingFilter = allowedAgeRatings(profile.ageGroup) as unknown as string[]
    }

    const cacheKey = `videos:search:${q ?? '_'}:${language ?? '_'}:${Array.isArray(ageRatingFilter) ? ageRatingFilter.join('|') : (ageRatingFilter ?? '_')}:${sourceSlug ?? '_'}:t${tags?.join(',') ?? '_'}:p${page}:l${limit}`

    type SearchResult = { items: unknown[]; total: number; page: number; limit: number; pages: number }
    const cached = await this.cache.get<SearchResult>(cacheKey)
    if (cached) return cached

    const skip = (page - 1) * Math.min(limit, 50)

    const where: Record<string, unknown> = { validationStatus: 'APPROVED' }
    if (language) where.language = language
    if (ageRatingFilter) {
      where.ageRating = Array.isArray(ageRatingFilter) ? { in: ageRatingFilter } : ageRatingFilter
    }
    if (sourceSlug) where.source = { slug: sourceSlug }
    if (q) where.title = { contains: q, mode: 'insensitive' }
    if (tags?.length) where.tags = { some: { tagId: { in: tags } } }

    const [items, total] = await Promise.all([
      this.prisma.video.findMany({
        where,
        select: {
          id: true, title: true, thumbnailUrl: true,
          durationSec: true, language: true, ageRating: true,
          source: { select: { name: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Math.min(limit, 50),
      }),
      this.prisma.video.count({ where }),
    ])

    const result: SearchResult = { items, total, page, limit, pages: Math.ceil(total / limit) }
    await this.cache.set(cacheKey, result, VIDEO_SEARCH_TTL)
    return result
  }

  async adminListVideos(params: {
    status?: string
    q?: string
    page?: number
    limit?: number
  }) {
    const { status, q, page = 1, limit = 50 } = params
    const take = Math.min(limit, 100)
    const skip = (page - 1) * take

    const where: Record<string, unknown> = {}
    if (status && status !== 'ALL') where.validationStatus = status
    if (q) where.title = { contains: q, mode: 'insensitive' }

    const [items, total] = await Promise.all([
      this.prisma.video.findMany({
        where,
        select: {
          id: true, title: true, thumbnailUrl: true, validationStatus: true,
          ageRating: true, language: true, createdAt: true, submittedById: true,
          source: { select: { name: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.video.count({ where }),
    ])

    return { items, total, page, pages: Math.ceil(total / take) }
  }

  async bulkUpdateStatus(
    ids: string[],
    action: 'APPROVE' | 'REJECT',
    rejectionReason?: string,
  ) {
    if (!ids.length) return { updated: 0 }

    const finalReason = rejectionReason?.trim() || 'Contenu non conforme aux critères de sécurité et bienveillance pour les enfants.'

    const videos = await this.prisma.video.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        title: true,
        submittedById: true,
        validationLog: true,
      },
    })

    const submitterIds = videos.map(v => v.submittedById).filter((id): id is string => Boolean(id))
    const submitters = submitterIds.length > 0
      ? await this.prisma.user.findMany({
          where: { id: { in: submitterIds } },
          select: { id: true, email: true, locale: true },
        })
      : []
    const submitterMap = new Map(submitters.map(s => [s.id, s]))

    let updatedCount = 0
    for (const video of videos) {
      const data: Record<string, unknown> = {
        validationStatus: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        ...(action === 'REJECT' && {
          validationLog: { ...((video.validationLog as object) ?? {}), rejectionReason: finalReason },
        }),
      }

      await this.prisma.video.update({
        where: { id: video.id },
        data,
      })
      updatedCount++

      if (video.submittedById) {
        const submitter = submitterMap.get(video.submittedById)
        const emailAction = action === 'APPROVE' ? 'approve' : 'reject'
        const reasonToSend = action === 'REJECT' ? finalReason : undefined

        if (submitter?.email && this.email) {
          void this.email
            .sendVideoReviewEmail(
              submitter.email,
              video.title,
              emailAction,
              reasonToSend,
              submitter.locale,
            )
            .catch(error => {
              this.logger.error(
                `Failed to send bulk review email for video ${video.id}`,
                error instanceof Error ? error.stack : String(error),
              )
            })
        }

        void this.prisma.notification
          .create({
            data: {
              userId: video.submittedById,
              type: action === 'APPROVE' ? 'VIDEO_APPROVED' : 'VIDEO_REJECTED',
              payload: {
                videoId: video.id,
                videoTitle: video.title,
                ...(reasonToSend ? { reason: reasonToSend } : {}),
                automated: false,
              } as Prisma.InputJsonValue,
            },
          })
          .catch(error => {
            this.logger.error(
              `Failed to create bulk review notification for video ${video.id}`,
              error instanceof Error ? error.stack : String(error),
            )
          })
      }
    }

    return { updated: updatedCount }
  }

  async approveAllPending(actorId?: string, actorRole?: string) {
    const result = await this.prisma.video.updateMany({
      where: {
        validationStatus: {
          in: ['PENDING' as never, 'NEEDS_REVIEW' as never],
        },
      },
      data: {
        validationStatus: 'APPROVED' as never,
      },
    })

    if (actorId && actorRole && result.count > 0) {
      await this.audit.log({
        actorId,
        actorRole,
        action: 'video.bulk_approve_all',
        resourceType: 'Video',
        metadata: { count: result.count },
      }).catch(err => {
        this.logger.error('Failed to log audit for approveAllPending', err)
      })
    }

    return { updated: result.count }
  }

  async getRatingsSummary(videoId: string) {
    const [thumbsUp, thumbsDown] = await Promise.all([
      this.prisma.videoRating.count({ where: { videoId, rating: 'THUMBS_UP' as never } }),
      this.prisma.videoRating.count({ where: { videoId, rating: 'THUMBS_DOWN' as never } }),
    ])
    return { thumbsUp, thumbsDown, total: thumbsUp + thumbsDown }
  }

  async report(userId: string, videoId: string, reason: string, description?: string) {
    const video = await this.prisma.video.findUnique({ where: { id: videoId } })
    if (!video) throw new NotFoundException('Vidéo introuvable')
    return this.prisma.videoReport.create({
      data: { videoId, reportedBy: userId, reason, description },
    })
  }

  // ── Sources vidéo ────────────────────────────────────────────

  async listSources() {
    return this.prisma.videoSource.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { videos: true } } },
    })
  }

  async createSource(data: {
    name: string
    slug: string
    baseUrl: string
    embedAllowed?: boolean
    cguVersion?: string
    embedPolicy?: Record<string, unknown>
  }) {
    const conflict = await this.prisma.videoSource.findFirst({
      where: { OR: [{ name: data.name }, { slug: data.slug }] },
      select: { id: true },
    })
    if (conflict) throw new ConflictException('Une source avec ce nom ou ce slug existe déjà.')
    return this.prisma.videoSource.create({
      data: {
        name: data.name,
        slug: data.slug,
        baseUrl: data.baseUrl,
        embedAllowed: data.embedAllowed ?? false,
        cguVersion: data.cguVersion,
        embedPolicy: data.embedPolicy as Prisma.InputJsonValue | undefined,
        isActive: true,
      },
    })
  }

  async updateSource(
    id: string,
    data: {
      embedAllowed?: boolean
      isActive?: boolean
      cguVersion?: string
      embedPolicy?: Record<string, unknown> | null
      baseUrl?: string
    },
  ) {
    const source = await this.prisma.videoSource.findUnique({ where: { id }, select: { id: true } })
    if (!source) throw new NotFoundException('Source introuvable')
    const { embedPolicy, ...rest } = data
    const updateData: Prisma.VideoSourceUpdateInput = {
      ...rest,
      ...(embedPolicy !== undefined && {
        embedPolicy: embedPolicy === null ? Prisma.JsonNull : (embedPolicy as Prisma.InputJsonValue),
      }),
    }
    return this.prisma.videoSource.update({ where: { id }, data: updateData })
  }

  async verifySource(id: string) {
    const source = await this.prisma.videoSource.findUnique({ where: { id }, select: { id: true } })
    if (!source) throw new NotFoundException('Source introuvable')
    return this.prisma.videoSource.update({
      where: { id },
      data: { cguCheckedAt: new Date() },
    })
  }

  private parseVideoUrl(url: string): ParsedVideo | null {
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return null
    }

    if (parsedUrl.protocol !== 'https:') return null

    const hostname = parsedUrl.hostname.toLowerCase()
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtu.be'].includes(hostname)) {
      const pathSegments = parsedUrl.pathname.split('/').filter(Boolean)
      const id = hostname.endsWith('youtu.be')
        ? pathSegments[0]
        : parsedUrl.pathname === '/watch'
          ? parsedUrl.searchParams.get('v')
          : ['shorts', 'embed', 'live', 'v'].includes(pathSegments[0] ?? '')
            ? pathSegments[1]
            : undefined

      if (!id || !YOUTUBE_ID_REGEX.test(id)) return null
      return {
        sourceSlug: 'youtube',
        externalId: id,
        embedUrl: `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`,
        thumbnailUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
      }
    }

    if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(hostname)) {
      const pathSegments = parsedUrl.pathname.split('/').filter(Boolean)
      const id = hostname === 'player.vimeo.com' && pathSegments[0] === 'video'
        ? pathSegments[1]
        : pathSegments.find(segment => VIMEO_ID_REGEX.test(segment))

      if (!id || !VIMEO_ID_REGEX.test(id)) return null
      const privateHash = parsedUrl.searchParams.get('h')
      return {
        sourceSlug: 'vimeo',
        externalId: id,
        embedUrl: `https://player.vimeo.com/video/${id}${privateHash ? `?h=${encodeURIComponent(privateHash)}&` : '?'}title=0&byline=0&portrait=0`,
      }
    }

    return null
  }

  private async fetchYouTubeMetadata(videoId: string, sourceSlug: string) {
    if (sourceSlug !== 'youtube' || !process.env.YOUTUBE_API_KEY) return {}
    try {
      const res = await safeFetch(
        `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,contentDetails&key=${process.env.YOUTUBE_API_KEY}`,
      )
      const data = await res.json() as { items?: Array<{ snippet: { title: string; description: string; defaultAudioLanguage?: string; thumbnails: { high: { url: string } } }; contentDetails: { duration: string } }> }
      const item = data.items?.[0]
      if (!item) return {}
      const duration = this.parseISO8601Duration(item.contentDetails.duration)
      return {
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnailUrl: item.snippet.thumbnails.high?.url,
        language: item.snippet.defaultAudioLanguage,
        durationSec: duration,
      }
    } catch {
      return {}
    }
  }

  private parseISO8601Duration(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
    if (!match) return 0
    const h = parseInt(match[1] ?? '0')
    const m = parseInt(match[2] ?? '0')
    const s = parseInt(match[3] ?? '0')
    return h * 3600 + m * 60 + s
  }
}
