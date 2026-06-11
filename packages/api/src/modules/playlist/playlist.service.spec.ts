import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common'
import { PlaylistService } from './playlist.service'

const makePrisma = () => ({
  playlist: {
    findMany: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  playlistVideo: {
    create: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
    updateMany: vi.fn(),
    aggregate: vi.fn(),
  },
  playlistAccess: {
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  },
  video: { findFirst: vi.fn() },
  user: { findUnique: vi.fn() },
  $transaction: vi.fn(),
})

const makeSubscriptionService = () => ({
  getUserPlanLimits: vi.fn().mockResolvedValue({ maxProfiles: 1, maxPlaylists: 5, planSlug: 'free' }),
})

describe('PlaylistService', () => {
  let service: PlaylistService
  let prisma: ReturnType<typeof makePrisma>
  let subscriptionService: ReturnType<typeof makeSubscriptionService>

  beforeEach(() => {
    vi.clearAllMocks()
    prisma = makePrisma()
    subscriptionService = makeSubscriptionService()
    service = new PlaylistService(prisma as never, subscriptionService as never)
  })

  // ── findAll ───────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns playlists for the user', async () => {
      const playlists = [{ id: 'pl-1', name: 'Nature' }]
      prisma.playlist.findMany.mockResolvedValue(playlists)

      expect(await service.findAll('user-1')).toBe(playlists)
      expect(prisma.playlist.findMany.mock.calls[0][0].where).toMatchObject({
        ownerId: 'user-1',
        deletedAt: null,
      })
    })
  })

  // ── create ────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a playlist with default arrays when under the limit', async () => {
      prisma.playlist.count.mockResolvedValue(2)
      subscriptionService.getUserPlanLimits.mockResolvedValue({ maxProfiles: 1, maxPlaylists: 5, planSlug: 'free' })
      const created = { id: 'pl-new', name: 'Animals' }
      prisma.playlist.create.mockResolvedValue(created)

      const result = await service.create('user-1', { name: 'Animals', visibility: 'PRIVATE' } as never)

      expect(result).toBe(created)
      const data = prisma.playlist.create.mock.calls[0][0].data
      expect(data.targetAgeGroup).toEqual([])
      expect(data.languages).toEqual([])
    })

    it('lève BadRequestException quand la limite de playlists est atteinte', async () => {
      prisma.playlist.count.mockResolvedValue(5)
      subscriptionService.getUserPlanLimits.mockResolvedValue({ maxProfiles: 1, maxPlaylists: 5, planSlug: 'free' })

      await expect(
        service.create('user-1', { name: 'Trop', visibility: 'PRIVATE' } as never),
      ).rejects.toThrow(BadRequestException)
    })
  })

  // ── findOne ───────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns playlist when found', async () => {
      const playlist = { id: 'pl-1', playlistVideos: [] }
      prisma.playlist.findFirst.mockResolvedValue(playlist)

      expect(await service.findOne('user-1', 'pl-1')).toBe(playlist)
    })

    it('throws NotFoundException when playlist does not exist', async () => {
      prisma.playlist.findFirst.mockResolvedValue(null)
      await expect(service.findOne('user-1', 'missing')).rejects.toThrow(NotFoundException)
    })
  })

  // ── update ────────────────────────────────────────────────────

  describe('update', () => {
    it('updates when user owns the playlist', async () => {
      prisma.playlist.findFirst
        .mockResolvedValueOnce({ id: 'pl-1', ownerId: 'user-1' }) // assertOwner
        .mockResolvedValueOnce({ id: 'pl-1', name: 'Updated' })   // update return
      const updated = { id: 'pl-1', name: 'Updated' }
      prisma.playlist.update.mockResolvedValue(updated)

      expect(await service.update('user-1', 'pl-1', { name: 'Updated' } as never)).toBe(updated)
    })

    it('throws NotFoundException when user does not own playlist', async () => {
      prisma.playlist.findFirst.mockResolvedValue(null)
      await expect(service.update('user-2', 'pl-1', {} as never)).rejects.toThrow(NotFoundException)
    })
  })

  // ── remove ────────────────────────────────────────────────────

  describe('remove', () => {
    it('soft-deletes the playlist', async () => {
      prisma.playlist.findFirst.mockResolvedValue({ id: 'pl-1' })
      prisma.playlist.update.mockResolvedValue({})

      await service.remove('user-1', 'pl-1')

      expect(prisma.playlist.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date)
    })
  })

  // ── addVideo ──────────────────────────────────────────────────

  describe('addVideo', () => {
    it('adds an approved video to the playlist', async () => {
      prisma.playlist.findFirst.mockResolvedValue({ id: 'pl-1' }) // assertOwnerOrEditor
      prisma.video.findFirst.mockResolvedValue({ id: 'vid-1', validationStatus: 'APPROVED' })
      prisma.playlistVideo.aggregate.mockResolvedValue({ _max: { position: 2 } })
      const pv = { playlistId: 'pl-1', videoId: 'vid-1', position: 3 }
      prisma.playlistVideo.create.mockResolvedValue(pv)

      const result = await service.addVideo('user-1', 'pl-1', { videoId: 'vid-1' } as never)

      expect(result).toBe(pv)
      expect(prisma.playlistVideo.create.mock.calls[0][0].data.position).toBe(3)
    })

    it('throws BadRequestException when video is not approved', async () => {
      prisma.playlist.findFirst.mockResolvedValue({ id: 'pl-1' })
      prisma.video.findFirst.mockResolvedValue(null)

      await expect(
        service.addVideo('user-1', 'pl-1', { videoId: 'vid-pending' } as never),
      ).rejects.toThrow(BadRequestException)
    })

    it('throws ForbiddenException when user has no edit access', async () => {
      prisma.playlist.findFirst.mockResolvedValue(null)

      await expect(
        service.addVideo('user-2', 'pl-1', { videoId: 'vid-1' } as never),
      ).rejects.toThrow(ForbiddenException)
    })
  })

  // ── removeVideo ───────────────────────────────────────────────

  describe('removeVideo', () => {
    it('deletes the playlist-video entry', async () => {
      prisma.playlist.findFirst.mockResolvedValue({ id: 'pl-1' })
      prisma.playlistVideo.findUnique.mockResolvedValue({ playlistId: 'pl-1', videoId: 'vid-1' })
      prisma.playlistVideo.delete.mockResolvedValue({})

      await service.removeVideo('user-1', 'pl-1', 'vid-1')

      expect(prisma.playlistVideo.delete).toHaveBeenCalledOnce()
    })

    it('throws NotFoundException when video is not in playlist', async () => {
      prisma.playlist.findFirst.mockResolvedValue({ id: 'pl-1' })
      prisma.playlistVideo.findUnique.mockResolvedValue(null)

      await expect(service.removeVideo('user-1', 'pl-1', 'vid-x')).rejects.toThrow(NotFoundException)
    })
  })

  // ── share ─────────────────────────────────────────────────────

  describe('share', () => {
    it('upserts access for target user', async () => {
      prisma.playlist.findFirst.mockResolvedValue({ id: 'pl-1' })
      prisma.user.findUnique.mockResolvedValue({ id: 'user-2' })
      const access = { playlistId: 'pl-1', grantedTo: 'user-2', role: 'VIEWER' }
      prisma.playlistAccess.upsert.mockResolvedValue(access)

      const result = await service.share('user-1', 'pl-1', { email: 'b@test.com', role: 'VIEWER' } as never)
      expect(result).toBe(access)
    })

    it('throws NotFoundException when target email does not exist', async () => {
      prisma.playlist.findFirst.mockResolvedValue({ id: 'pl-1' })
      prisma.user.findUnique.mockResolvedValue(null)

      await expect(
        service.share('user-1', 'pl-1', { email: 'ghost@x.com', role: 'VIEWER' } as never),
      ).rejects.toThrow(NotFoundException)
    })
  })

  // ── generateShareLink ─────────────────────────────────────────

  describe('generateShareLink', () => {
    it('generates a token and updates visibility', async () => {
      prisma.playlist.findFirst.mockResolvedValue({ id: 'pl-1' })
      prisma.playlist.update.mockResolvedValue({ shareToken: 'abc123' })

      const result = await service.generateShareLink('user-1', 'pl-1')

      expect(result).toEqual({ shareToken: 'abc123' })
      const data = prisma.playlist.update.mock.calls[0][0].data
      expect(data.visibility).toBe('SHARED_LINK')
      expect(typeof data.shareToken).toBe('string')
      expect(data.shareToken.length).toBeGreaterThan(0)
    })
  })

  // ── findByShareToken ──────────────────────────────────────────

  describe('findByShareToken', () => {
    it('returns playlist for valid token', async () => {
      const playlist = { id: 'pl-1', playlistVideos: [] }
      prisma.playlist.findFirst.mockResolvedValue(playlist)

      expect(await service.findByShareToken('tok123')).toBe(playlist)
    })

    it('throws NotFoundException for invalid token', async () => {
      prisma.playlist.findFirst.mockResolvedValue(null)
      await expect(service.findByShareToken('bad-tok')).rejects.toThrow(NotFoundException)
    })
  })
})
