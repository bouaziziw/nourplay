import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import { AuditService } from '../../common/audit/audit.service'
import { QueryQueueDto } from './dto/query-queue.dto'
import { ReviewVideoDto, ReviewAction } from './dto/review-video.dto'
import { QueryReportsDto } from './dto/query-reports.dto'
import { ResolveReportDto } from './dto/resolve-report.dto'
import { VideoValidationStatus } from '@nourplay/db'

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── File d'attente ────────────────────────────────────────────

  async getPendingQueue(query: QueryQueueDto) {
    const { page, limit, ageRating } = query
    const skip = (page - 1) * limit

    const where = {
      validationStatus: VideoValidationStatus.NEEDS_REVIEW,
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

    if (video.validationStatus !== VideoValidationStatus.NEEDS_REVIEW) {
      throw new BadRequestException('La vidéo n\'est pas en attente de révision')
    }

    if (dto.action === ReviewAction.REJECT && !dto.reason) {
      throw new BadRequestException('Une raison est obligatoire pour rejeter une vidéo')
    }

    const newStatus = dto.action === ReviewAction.APPROVE
      ? VideoValidationStatus.APPROVED
      : VideoValidationStatus.REJECTED

    const updated = await this.prisma.video.update({
      where: { id: videoId },
      data: {
        validationStatus: newStatus,
        ...(dto.action === ReviewAction.REJECT && {
          validationLog: { ...((video.validationLog as object) ?? {}), rejectionReason: dto.reason },
        }),
      },
      select: { id: true, title: true, validationStatus: true },
    })

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
