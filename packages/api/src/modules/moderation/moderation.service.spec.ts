import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NotFoundException, BadRequestException } from '@nestjs/common'
import { ModerationService } from './moderation.service'
import { ReviewAction } from './dto/review-video.dto'
import { VideoValidationStatus } from '@nourplay/db'

const makePrisma = () => ({
  video: { findUnique: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
  videoReport: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), count: vi.fn() },
  user: { findUnique: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
  notification: {
    create: vi.fn().mockResolvedValue({}),
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  $transaction: vi.fn(),
})

const makeAudit = () => ({ log: vi.fn().mockResolvedValue({}) })
const makeEmail = () => ({ sendVideoReviewEmail: vi.fn().mockResolvedValue(undefined) })

const ACTOR = { id: 'mod-uuid', role: 'MODERATOR' }

describe('ModerationService', () => {
  let service: ModerationService
  let prisma: ReturnType<typeof makePrisma>
  let audit: ReturnType<typeof makeAudit>
  let email: ReturnType<typeof makeEmail>

  beforeEach(() => {
    vi.clearAllMocks()
    prisma = makePrisma()
    audit = makeAudit()
    email = makeEmail()
    service = new ModerationService(prisma as never, audit as never, email as never)
  })

  describe('getPendingQueue', () => {
    it('retourne la file paginée triée FIFO', async () => {
      const items = [{ id: 'v1', title: 'Test', validationStatus: 'NEEDS_REVIEW' }]
      prisma.$transaction.mockImplementation(async () => {
        expect(prisma.video.findMany.mock.calls[0][0].where.validationStatus.in).toEqual([
          VideoValidationStatus.PENDING,
          VideoValidationStatus.NEEDS_REVIEW,
        ])
        return [items, 1]
      })

      const result = await service.getPendingQueue({ page: 1, limit: 20 })

      expect(result).toEqual({ items, total: 1, page: 1, limit: 20 })
    })
  })

  describe('reviewVideo', () => {
    const pendingVideo = {
      id: 'v1', title: 'Test',
      validationStatus: VideoValidationStatus.PENDING,
      validationLog: null,
      ageRating: 'ALL',
      submittedById: null,
    }

    it('approuve une vidéo et écrit un audit log', async () => {
      prisma.video.findUnique.mockResolvedValue(pendingVideo)
      prisma.video.updateMany.mockResolvedValue({ count: 1 })

      const result = await service.reviewVideo(ACTOR.id, ACTOR.role, 'v1', {
        action: ReviewAction.APPROVE,
      })

      expect(result.validationStatus).toBe('APPROVED')
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'video.approve' }))
    })

    it('does not fail the review when email delivery is unavailable', async () => {
      prisma.video.findUnique.mockResolvedValue({
        ...pendingVideo,
        submittedById: 'submitter-1',
      })
      prisma.video.updateMany.mockResolvedValue({ count: 1 })
      prisma.user.findUnique.mockResolvedValue({
        email: 'parent@example.test',
        locale: 'fr',
      })
      email.sendVideoReviewEmail.mockRejectedValue(new Error('RESEND_API_KEY manquant'))

      const result = await service.reviewVideo(ACTOR.id, ACTOR.role, 'v1', {
        action: ReviewAction.APPROVE,
      })
      await new Promise(resolve => setImmediate(resolve))

      expect(result.validationStatus).toBe('APPROVED')
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'video.approve' }))
    })

    it('rejette une vidéo avec une raison obligatoire', async () => {
      prisma.video.findUnique.mockResolvedValue(pendingVideo)
      prisma.video.updateMany.mockResolvedValue({ count: 1 })

      await service.reviewVideo(ACTOR.id, ACTOR.role, 'v1', {
        action: ReviewAction.REJECT,
        reason: 'Contenu inapproprié',
      })

      const updateCall = prisma.video.updateMany.mock.calls[0][0]
      expect(updateCall.data.validationStatus).toBe(VideoValidationStatus.REJECTED)
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'video.reject' }))
    })

    it('diffuse une notification VIDEO_PUBLISHED aux parents ayant des profils compatibles', async () => {
      prisma.video.findUnique.mockResolvedValue({ ...pendingVideo, ageRating: 'AGE_7_PLUS' })
      prisma.video.updateMany.mockResolvedValue({ count: 1 })
      // Two eligible parents
      prisma.user.findMany.mockResolvedValue([{ id: 'u-1' }, { id: 'u-2' }])

      await service.reviewVideo(ACTOR.id, ACTOR.role, 'v1', { action: ReviewAction.APPROVE })
      // Give the fire-and-forget chain time to settle
      await new Promise(r => setImmediate(r))

      expect(prisma.notification.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ userId: 'u-1', type: 'VIDEO_PUBLISHED' }),
            expect.objectContaining({ userId: 'u-2', type: 'VIDEO_PUBLISHED' }),
          ]),
        }),
      )
    })

    it('ne diffuse pas de notification VIDEO_PUBLISHED lors d\'un rejet', async () => {
      prisma.video.findUnique.mockResolvedValue(pendingVideo)
      prisma.video.updateMany.mockResolvedValue({ count: 1 })

      await service.reviewVideo(ACTOR.id, ACTOR.role, 'v1', { action: ReviewAction.REJECT, reason: 'spam' })
      await new Promise(r => setImmediate(r))

      expect(prisma.notification.createMany).not.toHaveBeenCalled()
    })

    it('lève BadRequest si la vidéo ne peut plus être examinée manuellement', async () => {
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
