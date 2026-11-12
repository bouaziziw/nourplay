import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { VideoService } from './video.service'

const makePrisma = () => ({
  videoSource: { findFirst: vi.fn() },
  video: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  playlist: { findFirst: vi.fn() },
  videoReport: { create: vi.fn() },
})

const makeQueue = () => ({
  add: vi.fn().mockResolvedValue(undefined),
  getJob: vi.fn().mockResolvedValue(null),
})

const makeCache = () => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
})
const makeAudit = () => ({ log: vi.fn().mockResolvedValue({}) })

const YOUTUBE_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
const VIMEO_URL = 'https://vimeo.com/123456789'

describe('VideoService', () => {
  let service: VideoService
  let prisma: ReturnType<typeof makePrisma>
  let queue: ReturnType<typeof makeQueue>
  let cache: ReturnType<typeof makeCache>
  let audit: ReturnType<typeof makeAudit>

  beforeEach(() => {
    vi.clearAllMocks()
    prisma = makePrisma()
    queue = makeQueue()
    cache = makeCache()
    audit = makeAudit()
    service = new VideoService(prisma as never, cache as never, queue as never, audit as never)
  })

  // ── submit ────────────────────────────────────────────────────

  describe('submit', () => {
    it('throws BadRequestException for unsupported URL', async () => {
      await expect(
        service.submit('user-1', { url: 'https://example.com/video' }),
      ).rejects.toThrow(BadRequestException)
    })

    describe('revalidateAllPending', () => {
      it('queues every pending video at priority in batches', async () => {
        prisma.video.findMany
          .mockResolvedValueOnce([{ id: 'vid-1' }, { id: 'vid-2' }])

        await expect(service.revalidateAllPending()).resolves.toEqual({ queued: 2 })

        expect(prisma.video.findMany).toHaveBeenCalledWith(expect.objectContaining({
          where: { validationStatus: 'PENDING' },
          take: 500,
        }))
        expect(queue.add).toHaveBeenCalledTimes(2)
        expect(queue.add).toHaveBeenCalledWith('validate', { videoId: 'vid-1' }, expect.objectContaining({
          priority: 1,
          jobId: 'video-validation-vid-1',
        }))
      })
    })

    it('throws BadRequestException when source is not active/allowed', async () => {
      prisma.videoSource.findFirst.mockResolvedValue(null)
      await expect(
        service.submit('user-1', { url: YOUTUBE_URL }),
      ).rejects.toThrow(BadRequestException)
    })

    it('returns existing APPROVED video without queuing', async () => {
      const existing = { id: 'vid-1', validationStatus: 'APPROVED' }
      prisma.videoSource.findFirst.mockResolvedValue({ id: 'src-1', slug: 'youtube', embedAllowed: true, isActive: true })
      prisma.video.findUnique.mockResolvedValue(existing)

      const result = await service.submit('user-1', { url: YOUTUBE_URL })

      expect(result).toBe(existing)
      expect(prisma.video.create).not.toHaveBeenCalled()
      expect(queue.add).not.toHaveBeenCalled()
    })

    it('re-queues the submitter’s existing PENDING video at priority', async () => {
      const existing = { id: 'vid-1', submittedById: 'user-1', validationStatus: 'PENDING' }
      prisma.videoSource.findFirst.mockResolvedValue({ id: 'src-1', slug: 'youtube', embedAllowed: true, isActive: true })
      prisma.video.findUnique.mockResolvedValue(existing)

      const result = await service.submit('user-1', { url: YOUTUBE_URL })

      expect(result).toBe(existing)
      expect(prisma.video.create).not.toHaveBeenCalled()
      expect(queue.add).toHaveBeenCalledWith('validate', { videoId: 'vid-1' }, expect.objectContaining({
        jobId: 'video-validation-vid-1',
        priority: 1,
      }))
    })

    it('does not let another user claim an existing pending submission', async () => {
      prisma.videoSource.findFirst.mockResolvedValue({ id: 'src-1', slug: 'youtube', embedAllowed: true, isActive: true })
      prisma.video.findUnique.mockResolvedValue({
        id: 'vid-1',
        submittedById: 'other-user',
        validationStatus: 'PENDING',
      })

      await expect(service.submit('user-1', { url: YOUTUBE_URL }))
        .rejects.toThrow('Cette vidéo a déjà été soumise')
      expect(queue.add).not.toHaveBeenCalled()
    })

    it('creates a new video and queues priority validation automatically', async () => {
      const created = { id: 'vid-new', validationStatus: 'PENDING' }
      prisma.videoSource.findFirst.mockResolvedValue({ id: 'src-1', slug: 'youtube', embedAllowed: true, isActive: true })
      prisma.video.findUnique.mockResolvedValue(null)
      prisma.video.create.mockResolvedValue(created)

      const result = await service.submit('user-1', { url: YOUTUBE_URL })

      expect(prisma.video.create).toHaveBeenCalledOnce()
      expect(queue.add).toHaveBeenCalledWith('validate', { videoId: 'vid-new' }, expect.objectContaining({
        jobId: 'video-validation-vid-new',
        priority: 1,
      }))
      expect(result).toBe(created)
    })

    it('replaces a completed validation job when a pending video is retried', async () => {
      const completedJob = {
        getState: vi.fn().mockResolvedValue('completed'),
        remove: vi.fn().mockResolvedValue(undefined),
      }
      queue.getJob.mockResolvedValue(completedJob)
      prisma.videoSource.findFirst.mockResolvedValue({ id: 'src-1', slug: 'youtube', embedAllowed: true, isActive: true })
      prisma.video.findUnique.mockResolvedValue(null)
      prisma.video.create.mockResolvedValue({ id: 'vid-new', validationStatus: 'PENDING' })

      await service.submit('user-1', { url: YOUTUBE_URL })

      expect(completedJob.remove).toHaveBeenCalledOnce()
      expect(queue.add).toHaveBeenCalledOnce()
    })

    it('replaces an unprioritized waiting validation job with a priority 1 job', async () => {
      const waitingJob = {
        opts: { priority: 0 },
        getState: vi.fn().mockResolvedValue('waiting'),
        remove: vi.fn().mockResolvedValue(undefined),
      }
      queue.getJob.mockResolvedValue(waitingJob)
      prisma.videoSource.findFirst.mockResolvedValue({ id: 'src-1', slug: 'youtube', embedAllowed: true, isActive: true })
      prisma.video.findUnique.mockResolvedValue(null)
      prisma.video.create.mockResolvedValue({ id: 'vid-new', validationStatus: 'PENDING' })

      await service.submit('user-1', { url: YOUTUBE_URL })

      expect(waitingJob.remove).toHaveBeenCalledOnce()
      expect(queue.add).toHaveBeenCalledOnce()
    })

    it('handles Vimeo URLs', async () => {
      const created = { id: 'vid-vimeo', validationStatus: 'PENDING' }
      prisma.videoSource.findFirst.mockResolvedValue({ id: 'src-2', slug: 'vimeo', embedAllowed: true, isActive: true })
      prisma.video.findUnique.mockResolvedValue(null)
      prisma.video.create.mockResolvedValue(created)

      const result = await service.submit('user-1', { url: VIMEO_URL })

      const createCall = prisma.video.create.mock.calls[0][0].data
      expect(createCall.sourceSlug).toBeUndefined()
      expect(createCall.externalId).toBe('123456789')
      expect(result).toBe(created)
    })

    describe('approveSubmission', () => {
      it('approves only the submitter’s video and enqueues system validation', async () => {
        prisma.video.findFirst.mockResolvedValue({
          id: 'vid-1',
          title: 'Test',
          validationStatus: 'PENDING',
          submitterApprovedAt: null,
        })

        describe('playlist submission management', () => {
          it('sends only this user’s pending playlist videos to validation', async () => {
            prisma.playlist.findFirst.mockResolvedValue({ id: 'pl-1' })
            prisma.video.findMany.mockResolvedValue([{ id: 'vid-1' }, { id: 'vid-2' }])
            prisma.video.findFirst.mockResolvedValue({
              id: 'vid-1', title: 'Video', validationStatus: 'PENDING', submitterApprovedAt: null,
            })
            prisma.video.updateMany.mockResolvedValue({ count: 1 })

            const result = await service.approvePlaylistSubmissions('user-1', 'PARENT', 'pl-1')

            expect(prisma.video.findMany).toHaveBeenCalledWith(expect.objectContaining({
              where: expect.objectContaining({
                submittedById: 'user-1',
                validationStatus: 'PENDING',
                playlistVideos: { some: { playlistId: 'pl-1' } },
              }),
            }))
            expect(queue.add).toHaveBeenCalledTimes(2)
            expect(result).toEqual({ queued: 2 })
          })

          it('does not expose another user’s playlist to bulk approval', async () => {
            prisma.playlist.findFirst.mockResolvedValue(null)

            await expect(service.approvePlaylistSubmissions('user-1', 'PARENT', 'pl-2'))
              .rejects.toThrow(NotFoundException)
            expect(prisma.video.findMany).not.toHaveBeenCalled()
          })

          it('allows editing only a still-unapproved submission', async () => {
            prisma.video.updateMany.mockResolvedValue({ count: 1 })

            await expect(service.updateOwnSubmission('user-1', 'vid-1', '  New title  '))
              .resolves.toEqual({ id: 'vid-1', title: 'New title' })
            expect(prisma.video.updateMany).toHaveBeenCalledWith(expect.objectContaining({
              where: {
                id: 'vid-1',
                submittedById: 'user-1',
                validationStatus: 'PENDING',
                submitterApprovedAt: null,
              },
              data: { title: 'New title' },
            }))
          })

          it('permanently deletes a video and records an admin audit event', async () => {
            prisma.video.findUnique.mockResolvedValue({ id: 'vid-1', title: 'Removed' })
            prisma.video.delete.mockResolvedValue({ id: 'vid-1' })

            await expect(service.deleteVideoAsAdmin('admin-1', 'ADMIN', 'vid-1'))
              .resolves.toEqual({ id: 'vid-1' })
            expect(prisma.video.delete).toHaveBeenCalledWith({ where: { id: 'vid-1' } })
            expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
              actorId: 'admin-1',
              action: 'video.delete',
              resourceId: 'vid-1',
            }))
          })
        })
        prisma.video.updateMany.mockResolvedValue({ count: 1 })

        const result = await service.approveSubmission('user-1', 'PARENT', 'vid-1')

        expect(prisma.video.updateMany).toHaveBeenCalledWith(expect.objectContaining({
          where: expect.objectContaining({ submittedById: 'user-1', submitterApprovedAt: null }),
        }))
        expect(queue.add).toHaveBeenCalledWith('validate', { videoId: 'vid-1' }, expect.objectContaining({
          jobId: 'video-validation-vid-1',
        }))
        expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
          actorId: 'user-1',
          action: 'video.submitter_approve',
        }))
        expect(result.submitterApprovedAt).toBeInstanceOf(Date)
      })

      it('does not expose another user’s submission', async () => {
        prisma.video.findFirst.mockResolvedValue(null)

        await expect(service.approveSubmission('user-1', 'TEACHER', 'vid-2'))
          .rejects.toThrow(NotFoundException)
        expect(queue.add).not.toHaveBeenCalled()
      })

      it('does not approve a video already processed by the system', async () => {
        prisma.video.findFirst.mockResolvedValue({
          id: 'vid-1',
          title: 'Test',
          validationStatus: 'APPROVED',
          submitterApprovedAt: new Date(),
        })

        await expect(service.approveSubmission('user-1', 'PARENT', 'vid-1'))
          .rejects.toThrow(BadRequestException)
        expect(queue.add).not.toHaveBeenCalled()
      })
    })

    it.each([
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://m.youtube.com/watch?feature=share&v=dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ?t=10',
    ])('accepts supported YouTube URL format: %s', async url => {
      prisma.videoSource.findFirst.mockResolvedValue({ id: 'src-1', slug: 'youtube', embedAllowed: true, isActive: true })
      prisma.video.findUnique.mockResolvedValue(null)
      prisma.video.create.mockResolvedValue({ id: 'vid-new', validationStatus: 'PENDING' })

      await service.submit('user-1', { url })

      expect(prisma.video.create).toHaveBeenCalledOnce()
      expect(prisma.video.create.mock.calls[0][0].data.externalId).toBe('dQw4w9WgXcQ')
    })

    it('accepts private Vimeo player URLs and preserves their hash', async () => {
      prisma.videoSource.findFirst.mockResolvedValue({ id: 'src-2', slug: 'vimeo', embedAllowed: true, isActive: true })
      prisma.video.findUnique.mockResolvedValue(null)
      prisma.video.create.mockResolvedValue({ id: 'vid-vimeo', validationStatus: 'PENDING' })

      await service.submit('user-1', { url: 'https://player.vimeo.com/video/123456789?h=private123' })

      expect(prisma.video.create.mock.calls[0][0].data.embedUrl).toContain('?h=private123&')
    })

    it('rejects URLs that only mention an allowed host in their path', async () => {
      await expect(
        service.submit('user-1', { url: 'https://example.com/youtube.com/watch?v=dQw4w9WgXcQ' }),
      ).rejects.toThrow(BadRequestException)
      expect(prisma.videoSource.findFirst).not.toHaveBeenCalled()
    })
  })

  // ── findById ──────────────────────────────────────────────────

  describe('findById', () => {
    it('returns video when found', async () => {
      const video = { id: 'vid-1', title: 'Test', source: { name: 'YouTube', slug: 'youtube' }, tags: [] }
      prisma.video.findUnique.mockResolvedValue(video)

      expect(await service.findById('vid-1')).toBe(video)
    })

    it('throws NotFoundException when video does not exist', async () => {
      prisma.video.findUnique.mockResolvedValue(null)
      await expect(service.findById('missing')).rejects.toThrow(NotFoundException)
    })
  })

  // ── search ────────────────────────────────────────────────────

  describe('search', () => {
    it('returns paginated results with default page/limit', async () => {
      const items = [{ id: 'vid-1' }]
      prisma.video.findMany.mockResolvedValue(items)
      prisma.video.count.mockResolvedValue(1)

      const result = await service.search({ q: 'cat' })

      expect(result).toEqual({ items, total: 1, page: 1, limit: 20, pages: 1 })
      const whereArg = prisma.video.findMany.mock.calls[0][0].where
      expect(whereArg.validationStatus).toBe('APPROVED')
      expect(whereArg.title).toEqual({ contains: 'cat', mode: 'insensitive' })
    })

    it('caps limit at 50', async () => {
      prisma.video.findMany.mockResolvedValue([])
      prisma.video.count.mockResolvedValue(0)

      await service.search({ limit: 200 })

      expect(prisma.video.findMany.mock.calls[0][0].take).toBe(50)
    })
  })

  // ── report ────────────────────────────────────────────────────

  describe('report', () => {
    it('creates a report when video exists', async () => {
      prisma.video.findUnique.mockResolvedValue({ id: 'vid-1' })
      const report = { id: 'rep-1' }
      prisma.videoReport.create.mockResolvedValue(report)

      expect(await service.report('user-1', 'vid-1', 'INAPPROPRIATE')).toBe(report)
    })

    it('throws NotFoundException when video does not exist', async () => {
      prisma.video.findUnique.mockResolvedValue(null)
      await expect(service.report('user-1', 'missing', 'SPAM')).rejects.toThrow(NotFoundException)
    })
  })
})
