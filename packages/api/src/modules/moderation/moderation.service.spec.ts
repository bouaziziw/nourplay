import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NotFoundException, BadRequestException } from '@nestjs/common'
import { ModerationService } from './moderation.service'
import { ReviewAction } from './dto/review-video.dto'
import { VideoValidationStatus } from '@nourplay/db'

const makePrisma = () => ({
  video: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), count: vi.fn() },
  videoReport: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), count: vi.fn() },
  $transaction: vi.fn(),
})

const makeAudit = () => ({ log: vi.fn().mockResolvedValue({}) })

const ACTOR = { id: 'mod-uuid', role: 'MODERATOR' }

describe('ModerationService', () => {
  let service: ModerationService
  let prisma: ReturnType<typeof makePrisma>
  let audit: ReturnType<typeof makeAudit>

  beforeEach(() => {
    vi.clearAllMocks()
    prisma = makePrisma()
    audit = makeAudit()
    service = new ModerationService(prisma as never, audit as never)
  })

  describe('getPendingQueue', () => {
    it('retourne la file paginée triée FIFO', async () => {
      const items = [{ id: 'v1', title: 'Test', validationStatus: 'NEEDS_REVIEW' }]
      prisma.$transaction.mockResolvedValue([items, 1])

      const result = await service.getPendingQueue({ page: 1, limit: 20 })

      expect(result).toEqual({ items, total: 1, page: 1, limit: 20 })
    })
  })

  describe('reviewVideo', () => {
    const pendingVideo = {
      id: 'v1', title: 'Test',
      validationStatus: VideoValidationStatus.NEEDS_REVIEW,
      validationLog: null,
    }

    it('approuve une vidéo et écrit un audit log', async () => {
      prisma.video.findUnique.mockResolvedValue(pendingVideo)
      prisma.video.update.mockResolvedValue({ id: 'v1', validationStatus: 'APPROVED' })

      const result = await service.reviewVideo(ACTOR.id, ACTOR.role, 'v1', {
        action: ReviewAction.APPROVE,
      })

      expect(result.validationStatus).toBe('APPROVED')
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'video.approve' }))
    })

    it('rejette une vidéo avec une raison obligatoire', async () => {
      prisma.video.findUnique.mockResolvedValue(pendingVideo)
      prisma.video.update.mockResolvedValue({ id: 'v1', validationStatus: 'REJECTED' })

      await service.reviewVideo(ACTOR.id, ACTOR.role, 'v1', {
        action: ReviewAction.REJECT,
        reason: 'Contenu inapproprié',
      })

      const updateCall = prisma.video.update.mock.calls[0][0]
      expect(updateCall.data.validationStatus).toBe(VideoValidationStatus.REJECTED)
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'video.reject' }))
    })

    it('lève BadRequest si la vidéo n\'est pas en NEEDS_REVIEW', async () => {
      prisma.video.findUnique.mockResolvedValue({
        ...pendingVideo, validationStatus: VideoValidationStatus.APPROVED,
      })

      await expect(
        service.reviewVideo(ACTOR.id, ACTOR.role, 'v1', { action: ReviewAction.APPROVE }),
      ).rejects.toThrow(BadRequestException)
    })

    it('lève NotFoundException si la vidéo est introuvable', async () => {
      prisma.video.findUnique.mockResolvedValue(null)

      await expect(
        service.reviewVideo(ACTOR.id, ACTOR.role, 'missing', { action: ReviewAction.APPROVE }),
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('resolveReport', () => {
    it('résout un signalement et écrit un audit log', async () => {
      prisma.videoReport.findUnique.mockResolvedValue({
        id: 'r1', videoId: 'v1', resolved: false,
      })
      prisma.videoReport.update.mockResolvedValue({ id: 'r1', resolved: true })

      const result = await service.resolveReport(ACTOR.id, ACTOR.role, 'r1', { notes: 'Traité' })

      expect(result.resolved).toBe(true)
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'report.resolve' }))
    })

    it('lève BadRequest si le signalement est déjà résolu', async () => {
      prisma.videoReport.findUnique.mockResolvedValue({ id: 'r1', resolved: true })

      await expect(
        service.resolveReport(ACTOR.id, ACTOR.role, 'r1', {}),
      ).rejects.toThrow(BadRequestException)
    })

    it('lève NotFoundException si le signalement est introuvable', async () => {
      prisma.videoReport.findUnique.mockResolvedValue(null)

      await expect(
        service.resolveReport(ACTOR.id, ACTOR.role, 'missing', {}),
      ).rejects.toThrow(NotFoundException)
    })
  })
})
