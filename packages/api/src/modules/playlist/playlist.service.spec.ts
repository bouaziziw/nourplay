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
    createMany: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
    updateMany: vi.fn(),
    aggregate: vi.fn(),
  },
  playlistAccess: {
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  },
  video: { findFirst: vi.fn(), createMany: vi.fn(), findMany: vi.fn() },
  videoSource: { findFirst: vi.fn() },
  user: { findUnique: vi.fn() },
  childProfile: { findFirst: vi.fn() },
  userBlock: { findMany: vi.fn() },
  $transaction: vi.fn(),
})

const makeSubscriptionService = () => ({
  getUserPlanLimits: vi.fn().mockResolvedValue({ maxProfiles: 1, maxPlaylists: 5, planSlug: 'free' }),
})
const makeValidationQueue = () => ({
  add: vi.fn().mockResolvedValue(undefined),
  getJob: vi.fn().mockResolvedValue(null),
})

describe('PlaylistService', () => {
  let service: PlaylistService
  let prisma: ReturnType<typeof makePrisma>
  let subscriptionService: ReturnType<typeof makeSubscriptionService>
  let validationQueue: ReturnType<typeof makeValidationQueue>

  beforeEach(() => {
    vi.clearAllMocks()
    prisma = makePrisma()
    subscriptionService = makeSubscriptionService()
    validationQueue = makeValidationQueue()
    service = new PlaylistService(prisma as never, subscriptionService as never, validationQueue as never)
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

    it('rejects non-YouTube URLs before making an external request', async () => {
      await expect(service.create('user-1', {
        name: 'External',
        importExternalPlaylist: true,
        externalPlaylistUrl: 'https://example.com/playlist?list=PLabcdefghij',
      } as never)).rejects.toThrow(BadRequestException)
    })

    it('imports all accessible videos from a YouTube channel in one database transaction', async () => {
      const previousApiKey = process.env.YOUTUBE_API_KEY
      process.env.YOUTUBE_API_KEY = 'test-key'
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [{ contentDetails: { relatedPlaylists: { uploads: 'UUabcdefghij123456789012' } } }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [{
              snippet: {
                title: 'Nature',
                description: 'Une vidéo',
                resourceId: { videoId: 'abcdefghijk' },
              },
            }],
            nextPageToken: 'next-page',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [{
              snippet: {
                title: 'Océan',
                resourceId: { videoId: 'abcdefghijl' },
              },
            }],
          }),
        })
      vi.stubGlobal('fetch', fetchMock)

      const createdPlaylist = { id: 'pl-import', name: 'Imported', _count: { playlistVideos: 0 } }
      const tx = {
        playlist: { create: vi.fn().mockResolvedValue(createdPlaylist) },
        video: {
          createMany: vi.fn().mockResolvedValue({ count: 1 }),
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'vid-1',
              externalId: 'abcdefghijk',
              validationStatus: 'PENDING',
              submittedById: 'user-1',
              submitterApprovedAt: null,
            },
            {
              id: 'vid-2',
              externalId: 'abcdefghijl',
              validationStatus: 'PENDING',
              submittedById: 'user-1',
              submitterApprovedAt: null,
            },
          ]),
        },
        playlistVideo: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
      }
      prisma.videoSource.findFirst.mockResolvedValue({ id: 'source-youtube' })
      prisma.$transaction.mockImplementation(callback => callback(tx as never))

      try {
        const result = await service.create('user-1', {
          name: 'Imported',
          visibility: 'PRIVATE',
          importExternalPlaylist: true,
          externalPlaylistUrl: 'https://www.youtube.com/@playlistname',
        } as never)

        expect(fetchMock).toHaveBeenCalledTimes(3)
        const channelRequest = new URL(fetchMock.mock.calls[0][0] as URL)
        expect(channelRequest.pathname).toBe('/youtube/v3/channels')
        expect(channelRequest.searchParams.get('forHandle')).toBe('playlistname')
        expect(fetchMock.mock.calls[1][0].searchParams.get('playlistId')).toBe('UUabcdefghij123456789012')
        expect(tx.video.createMany.mock.calls[0][0].data).toMatchObject([
          { externalId: 'abcdefghijk', title: 'Nature', validationStatus: 'PENDING' },
          { externalId: 'abcdefghijl', title: 'Océan', validationStatus: 'PENDING' },
        ])
        expect(tx.playlistVideo.createMany.mock.calls[0][0].data).toEqual([
          { playlistId: 'pl-import', videoId: 'vid-1', position: 0, addedById: 'user-1' },
          { playlistId: 'pl-import', videoId: 'vid-2', position: 1, addedById: 'user-1' },
        ])
        expect(result).toMatchObject({
          id: 'pl-import',
          importedVideoCount: 2,
          pendingValidationCount: 2,
          skippedVideoCount: 0,
          validationQueueFailedCount: 0,
        })
        expect(validationQueue.add).toHaveBeenCalledTimes(2)
        expect(validationQueue.add).toHaveBeenCalledWith('validate', { videoId: 'vid-1' }, expect.objectContaining({
          jobId: 'video-validation-vid-1',
          priority: 1,
        }))
      } finally {
        vi.unstubAllGlobals()
        if (previousApiKey === undefined) delete process.env.YOUTUBE_API_KEY
        else process.env.YOUTUBE_API_KEY = previousApiKey
      }
    })
  })

  // ── findOne ───────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns playlist when found', async () => {
      const playlist = { id: 'pl-1', playlistVideos: [] }
      prisma.playlist.findFirst.mockResolvedValue(playlist)

      expect(await service.findOne('user-1', 'pl-1')).toBe(playlist)
      expect(prisma.playlist.findFirst.mock.calls[0][0].include.playlistVideos.where.video.OR).toEqual(
        expect.arrayContaining([
          { validationStatus: 'APPROVED' },
          {
            validationStatus: { in: ['PENDING', 'NEEDS_REVIEW', 'REJECTED'] },
            submittedById: 'user-1',
          },
        ]),
      )
    })

    it('does not expose unapproved submissions to child profiles', async () => {
      prisma.childProfile.findFirst.mockResolvedValue({ ageGroup: 'AGE_7_9' })
      prisma.userBlock.findMany.mockResolvedValue([])
      prisma.playlist.findFirst.mockResolvedValue({ id: 'pl-1', playlistVideos: [] })

      await service.findOne('user-1', 'pl-1', 'profile-1')

      expect(prisma.playlist.findFirst.mock.calls[0][0].include.playlistVideos.where.video.OR)
        .toEqual([{ validationStatus: 'APPROVED', ageRating: { in: expect.any(Array) } }])
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

  // ── schedule ──────────────────────────────────────────────────

  describe('schedule', () => {
    const futureDate = new Date(Date.now() + 86_400_000).toISOString()

    it('persiste une date future', async () => {
      prisma.playlist.findFirst.mockResolvedValue({ id: 'pl-1' })
      const updated = { id: 'pl-1', scheduledPublishAt: futureDate }
      prisma.playlist.update.mockResolvedValue(updated)

      const result = await service.schedule('user-1', 'pl-1', { scheduledPublishAt: futureDate })

      expect(result).toBe(updated)
      const data = prisma.playlist.update.mock.calls[0][0].data
      expect(data.scheduledPublishAt).toBeInstanceOf(Date)
    })

    it('efface la date si scheduledPublishAt est null', async () => {
      prisma.playlist.findFirst.mockResolvedValue({ id: 'pl-1' })
      prisma.playlist.update.mockResolvedValue({ id: 'pl-1', scheduledPublishAt: null })

      await service.schedule('user-1', 'pl-1', { scheduledPublishAt: null })

      expect(prisma.playlist.update.mock.calls[0][0].data.scheduledPublishAt).toBeNull()
    })

    it('lève BadRequestException si la date est dans le passé', async () => {
      prisma.playlist.findFirst.mockResolvedValue({ id: 'pl-1' })
      const pastDate = new Date(Date.now() - 1000).toISOString()

      await expect(
        service.schedule('user-1', 'pl-1', { scheduledPublishAt: pastDate }),
      ).rejects.toThrow(BadRequestException)
    })
  })

  // ── publishScheduled ──────────────────────────────────────────

  describe('publishScheduled', () => {
    it('publie les playlists dont la date est échue', async () => {
      prisma.playlist.findMany.mockResolvedValue([{ id: 'pl-1' }, { id: 'pl-2' }])
      prisma.playlist.update.mockResolvedValue({})

      await service.publishScheduled()

      expect(prisma.playlist.update).toHaveBeenCalledTimes(2)
      const firstCall = prisma.playlist.update.mock.calls[0][0]
      expect(firstCall.data.visibility).toBe('SHARED_LINK')
      expect(firstCall.data.scheduledPublishAt).toBeNull()
      expect(typeof firstCall.data.shareToken).toBe('string')
    })

    it('ne fait rien si aucune playlist n\'est échue', async () => {
      prisma.playlist.findMany.mockResolvedValue([])

      await service.publishScheduled()

      expect(prisma.playlist.update).not.toHaveBeenCalled()
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
