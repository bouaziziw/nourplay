import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { VideoService } from './video.service'

const makePrisma = () => ({
  videoSource: { findFirst: vi.fn() },
  video: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
  },
  videoReport: { create: vi.fn() },
})

const makeQueue = () => ({ add: vi.fn().mockResolvedValue(undefined) })

const YOUTUBE_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
const VIMEO_URL = 'https://vimeo.com/123456789'

describe('VideoService', () => {
  let service: VideoService
  let prisma: ReturnType<typeof makePrisma>
  let queue: ReturnType<typeof makeQueue>

  beforeEach(() => {
    vi.clearAllMocks()
    prisma = makePrisma()
    queue = makeQueue()
    service = new VideoService(prisma as never, queue as never)
  })

  // ── submit ────────────────────────────────────────────────────

  describe('submit', () => {
    it('throws BadRequestException for unsupported URL', async () => {
      await expect(
        service.submit('user-1', { url: 'https://example.com/video' }),
      ).rejects.toThrow(BadRequestException)
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

    it('returns existing PENDING video without re-queuing', async () => {
      const existing = { id: 'vid-1', validationStatus: 'PENDING' }
      prisma.videoSource.findFirst.mockResolvedValue({ id: 'src-1', slug: 'youtube', embedAllowed: true, isActive: true })
      prisma.video.findUnique.mockResolvedValue(existing)

      const result = await service.submit('user-1', { url: YOUTUBE_URL })

      expect(result).toBe(existing)
      expect(prisma.video.create).not.toHaveBeenCalled()
    })

    it('creates a new video and enqueues it for validation', async () => {
      const created = { id: 'vid-new', validationStatus: 'PENDING' }
      prisma.videoSource.findFirst.mockResolvedValue({ id: 'src-1', slug: 'youtube', embedAllowed: true, isActive: true })
      prisma.video.findUnique.mockResolvedValue(null)
      prisma.video.create.mockResolvedValue(created)

      const result = await service.submit('user-1', { url: YOUTUBE_URL })

      expect(prisma.video.create).toHaveBeenCalledOnce()
      expect(queue.add).toHaveBeenCalledWith(
        'validate',
        { videoId: 'vid-new' },
        expect.any(Object),
      )
      expect(result).toBe(created)
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
