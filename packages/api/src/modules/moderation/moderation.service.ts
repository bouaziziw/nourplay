import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common'
import { Prisma, AgeGroup } from '@nourplay/db'
import { PrismaService } from '../../common/prisma/prisma.service'
import { AuditService } from '../../common/audit/audit.service'
import { EmailService } from '../../common/email/email.service'
import { QueryQueueDto } from './dto/query-queue.dto'
import { ReviewVideoDto, ReviewAction } from './dto/review-video.dto'
import { QueryReportsDto } from './dto/query-reports.dto'
import { ResolveReportDto } from './dto/resolve-report.dto'
import { VideoValidationStatus } from '@nourplay/db'

// Maps a video's age rating to the child profile age groups that can watch it
const AGE_RATING_TO_GROUPS: Record<string, AgeGroup[]> = {
  ALL: [AgeGroup.AGE_0_3, AgeGroup.AGE_4_6, AgeGroup.AGE_7_9, AgeGroup.AGE_10_12, AgeGroup.AGE_13_15],
  AGE_4_PLUS: [AgeGroup.AGE_4_6, AgeGroup.AGE_7_9, AgeGroup.AGE_10_12, AgeGroup.AGE_13_15],
  AGE_7_PLUS: [AgeGroup.AGE_7_9, AgeGroup.AGE_10_12, AgeGroup.AGE_13_15],
  AGE_10_PLUS: [AgeGroup.AGE_10_12, AgeGroup.AGE_13_15],
  AGE_13_PLUS: [AgeGroup.AGE_13_15],
}

const VIDEO_QUEUE_SELECT = {
  id: true,
  title: true,
  description: true,
  embedUrl: true,
  thumbnailUrl: true,
  durationSec: true,
  language: true,
  ageRating: true,
  validationStatus: true,
  validationScore: true,
  validationLog: true,
  createdAt: true,
  source: { select: { name: true, slug: true } },
}

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
  ) {}

  // ── File d'attente ────────────────────────────────────────────

  async getPendingQueue(query: QueryQueueDto) {
    const { page, limit, ageRating } = query
    const skip = (page - 1) * limit

    const where = {
      validationStatus: { in: [VideoValidationStatus.PENDING, VideoValidationStatus.NEEDS_REVIEW] },
      ...(ageRating && { ageRating }),
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.video.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' }, // FIFO — les plus anciens en premier
        select: VIDEO_QUEUE_SELECT,
      }),
      this.prisma.video.count({ where }),
    ])

    return { items, total, page, limit }
  }

  async reviewVideo(
    actorId: string,
    actorRole: string,
    videoId: string,
    dto: ReviewVideoDto,
  ) {
    const video = await this.prisma.video.findUnique({ where: { id: videoId } })
    if (!video) throw new NotFoundException('Vidéo introuvable')

    if (
      video.validationStatus !== VideoValidationStatus.PENDING
      && video.validationStatus !== VideoValidationStatus.NEEDS_REVIEW
    ) {
      throw new BadRequestException('La vidéo n’est plus en attente de validation ou de révision')
    }

    if (dto.action === ReviewAction.REJECT && !dto.reason) {
      throw new BadRequestException('Une raison est obligatoire pour rejeter une vidéo')
    }

    const newStatus = dto.action === ReviewAction.APPROVE
      ? VideoValidationStatus.APPROVED
      : VideoValidationStatus.REJECTED

    const result = await this.prisma.video.updateMany({
      where: { id: videoId, validationStatus: video.validationStatus },
      data: {
        validationStatus: newStatus,
        ...(dto.action === ReviewAction.REJECT && {
          validationLog: { ...((video.validationLog as object) ?? {}), rejectionReason: dto.reason },
        }),
      },
    })
    if (result.count !== 1) {
      throw new BadRequestException('La vidéo a été traitée entre-temps. Actualisez la file.')
    }
    const updated = { ...video, validationStatus: newStatus }

    // Notify the submitter by email + in-app notification
    if (video.submittedById) {
      const submitter = await this.prisma.user.findUnique({
        where: { id: video.submittedById },
        select: { email: true, locale: true },
      })
      if (submitter) {
        const action = dto.action === ReviewAction.APPROVE ? 'approve' : 'reject'
        void this.email
          .sendVideoReviewEmail(submitter.email, video.title, action, dto.reason, submitter.locale)
          .catch(error => {
            this.logger.error(
              `Failed to send video review email for video ${videoId}`,
              error instanceof Error ? error.stack : String(error),
            )
          })
        void this.prisma.notification.create({
          data: {
            userId: video.submittedById,
            type: dto.action === ReviewAction.APPROVE ? 'VIDEO_APPROVED' : 'VIDEO_REJECTED',
            payload: {
              videoId,
              videoTitle: video.title,
              ...(dto.reason && { reason: dto.reason }),
            } as Prisma.InputJsonValue,
          },
        }).catch(error => {
          this.logger.error(
            `Failed to create video review notification for video ${videoId}`,
            error instanceof Error ? error.stack : String(error),
          )
        })
      }
    }

    // On approval, broadcast "new content" notification to relevant parents
    if (dto.action === ReviewAction.APPROVE) {
      const groups = AGE_RATING_TO_GROUPS[updated.ageRating] ?? Object.values(AgeGroup)
      void this.prisma.user.findMany({
        where: {
          role: 'PARENT',
          deletedAt: null,
          childProfiles: { some: { deletedAt: null, ageGroup: { in: groups } } },
          NOT: video.submittedById ? { id: video.submittedById } : undefined,
        },
        select: { id: true },
      }).then(recipients =>
        recipients.length > 0
          ? this.prisma.notification.createMany({
              data: recipients.map(u => ({
                userId: u.id,
                type: 'VIDEO_PUBLISHED',
                payload: { videoId, videoTitle: video.title, ageRating: updated.ageRating } as Prisma.InputJsonValue,
              })),
              skipDuplicates: true,
            })
          : null,
      ).catch(error => {
        this.logger.error(
          `Failed to broadcast publication notification for video ${videoId}`,
          error instanceof Error ? error.stack : String(error),
        )
      })
    }

    await this.audit.log({
      actorId,
      actorRole,
      action: `video.${dto.action}`,
      resourceType: 'Video',
      resourceId: videoId,
      metadata: dto.action === ReviewAction.REJECT ? { reason: dto.reason } : undefined,
    })

    return updated
  }

  // ── Signalements ──────────────────────────────────────────────

  async getReports(query: QueryReportsDto) {
    const { page, limit, resolved } = query
    const skip = (page - 1) * limit

    const where = { resolved }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.videoReport.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          video: { select: { id: true, title: true, thumbnailUrl: true, validationStatus: true } },
          reporter: { select: { id: true, email: true } },
        },
      }),
      this.prisma.videoReport.count({ where }),
    ])

    return { items, total, page, limit }
  }

  async getReport(reportId: string) {
    const report = await this.prisma.videoReport.findUnique({
      where: { id: reportId },
      include: {
        video: { select: { id: true, title: true, embedUrl: true, thumbnailUrl: true, validationStatus: true } },
        reporter: { select: { id: true, email: true, role: true } },
      },
    })
    if (!report) throw new NotFoundException('Signalement introuvable')
    return report
  }

  async resolveReport(
    actorId: string,
    actorRole: string,
    reportId: string,
    dto: ResolveReportDto,
  ) {
    const report = await this.prisma.videoReport.findUnique({ where: { id: reportId } })
    if (!report) throw new NotFoundException('Signalement introuvable')
    if (report.resolved) throw new BadRequestException('Signalement déjà résolu')

    const updated = await this.prisma.videoReport.update({
      where: { id: reportId },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        ...(dto.notes && { description: dto.notes }),
      },
    })

    await this.audit.log({
      actorId,
      actorRole,
      action: 'report.resolve',
      resourceType: 'VideoReport',
      resourceId: reportId,
      metadata: { videoId: report.videoId, notes: dto.notes },
    })

    return updated
  }
}
