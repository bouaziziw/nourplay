import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { UserService } from './user.service'

vi.mock('argon2', () => ({
  hash: vi.fn().mockResolvedValue('$argon2id$hashed_pin'),
  verify: vi.fn().mockResolvedValue(true),
  argon2id: 2,
}))

const makePrisma = () => ({
  user: { findUnique: vi.fn() },
  childProfile: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  watchHistory: {
    findMany: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
    aggregate: vi.fn(),
  },
  notification: {
    create: vi.fn().mockResolvedValue({ id: 'n1' }),
  },
  userBlock: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  video: { findUnique: vi.fn() },
  videoProgress: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  videoFavorite: {
    findMany: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  },
  videoRating: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  },
})

const makeSubscriptionService = () => ({
  getUserPlanLimits: vi.fn().mockResolvedValue({ maxProfiles: 1, maxPlaylists: 5, planSlug: 'free' }),
})

describe('UserService', () => {
  let service: UserService
  let prisma: ReturnType<typeof makePrisma>
  let subscriptionService: ReturnType<typeof makeSubscriptionService>

  beforeEach(() => {
    vi.clearAllMocks()
    prisma = makePrisma()
    subscriptionService = makeSubscriptionService()
    service = new UserService(prisma as never, subscriptionService as never)
  })

  // ── findById ──────────────────────────────────────────────────

  describe('findById', () => {
    it('returns user when found', async () => {
      const user = { id: 'u-1', email: 'a@test.com', role: 'PARENT', parentPinHash: 'secret-hash' }
      prisma.user.findUnique.mockResolvedValue(user)

      expect(await service.findById('u-1')).toEqual({
        id: 'u-1',
        email: 'a@test.com',
        role: 'PARENT',
        parentPinConfigured: true,
      })
    })

    it('throws NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      await expect(service.findById('missing')).rejects.toThrow(NotFoundException)
    })
  })

  // ── getProfiles ───────────────────────────────────────────────

  describe('getProfiles', () => {
    it('returns child profiles for the user', async () => {
      const profiles = [{ id: 'p-1', displayName: 'Alice' }]
      prisma.childProfile.findMany.mockResolvedValue(profiles)

      expect(await service.getProfiles('u-1')).toBe(profiles)
      expect(prisma.childProfile.findMany.mock.calls[0][0].where).toMatchObject({
        userId: 'u-1',
        deletedAt: null,
      })
    })
  })

  // ── createProfile ─────────────────────────────────────────────

  describe('createProfile', () => {
    const dto = { displayName: 'Bob', ageGroup: 'K6', pin: '1234' } as never

    it('crée un profil quand le compte est en dessous de la limite', async () => {
      prisma.childProfile.count.mockResolvedValue(0)
      subscriptionService.getUserPlanLimits.mockResolvedValue({ maxProfiles: 1, maxPlaylists: 5, planSlug: 'free' })
      const profile = { id: 'p-new', displayName: 'Bob' }
      prisma.childProfile.create.mockResolvedValue(profile)

      const result = await service.createProfile('u-1', dto)

      expect(result).toBe(profile)
      const data = prisma.childProfile.create.mock.calls[0][0].data
      expect(data.pinHash).toBe('$argon2id$hashed_pin')
    })

    it('lève BadRequestException avec message free quand la limite gratuite est atteinte', async () => {
      prisma.childProfile.count.mockResolvedValue(1)
      subscriptionService.getUserPlanLimits.mockResolvedValue({ maxProfiles: 1, maxPlaylists: 5, planSlug: 'free' })

      await expect(service.createProfile('u-1', dto)).rejects.toThrow(BadRequestException)
    })

    it('lève BadRequestException avec message générique pour les plans premium', async () => {
      prisma.childProfile.count.mockResolvedValue(999)
      subscriptionService.getUserPlanLimits.mockResolvedValue({ maxProfiles: 999, maxPlaylists: 999, planSlug: 'premium-monthly' })

      await expect(service.createProfile('u-1', dto)).rejects.toThrow(BadRequestException)
    })
  })

  // ── getProfile ────────────────────────────────────────────────

  describe('getProfile', () => {
    it('returns profile when owned by user', async () => {
      const profile = { id: 'p-1', displayName: 'Alice' }
      prisma.childProfile.findFirst.mockResolvedValue(profile)

      expect(await service.getProfile('u-1', 'p-1')).toBe(profile)
    })

    it('throws NotFoundException when profile not found', async () => {
      prisma.childProfile.findFirst.mockResolvedValue(null)
      await expect(service.getProfile('u-1', 'missing')).rejects.toThrow(NotFoundException)
    })
  })

  // ── updateProfile ─────────────────────────────────────────────

  describe('updateProfile', () => {
    it('updates profile fields', async () => {
      prisma.childProfile.findFirst
        .mockResolvedValueOnce({ id: 'p-1' }) // assertProfileOwner
      const updated = { id: 'p-1', displayName: 'Alice2' }
      prisma.childProfile.update.mockResolvedValue(updated)

      const result = await service.updateProfile('u-1', 'p-1', { displayName: 'Alice2' } as never)
      expect(result).toBe(updated)
    })

    it('throws NotFoundException when profile not owned', async () => {
      prisma.childProfile.findFirst.mockResolvedValue(null)
      await expect(service.updateProfile('u-2', 'p-1', {} as never)).rejects.toThrow(NotFoundException)
    })
  })

  // ── deleteProfile ─────────────────────────────────────────────

  describe('deleteProfile', () => {
    it('soft-deletes the profile', async () => {
      prisma.childProfile.findFirst.mockResolvedValue({ id: 'p-1' })
      prisma.childProfile.update.mockResolvedValue({})

      await service.deleteProfile('u-1', 'p-1')

      expect(prisma.childProfile.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date)
    })
  })

  // ── verifyPin ─────────────────────────────────────────────────

  describe('verifyPin', () => {
    it('returns true for a valid PIN', async () => {
      prisma.childProfile.findFirst.mockResolvedValue({ pinHash: '$argon2id$hashed_pin' })

      expect(await service.verifyPin('u-1', 'p-1', '1234')).toBe(true)
    })

    it('throws UnauthorizedException for an invalid PIN', async () => {
      const argon2 = await import('argon2')
      vi.mocked(argon2.verify).mockResolvedValueOnce(false)
      prisma.childProfile.findFirst.mockResolvedValue({ pinHash: '$argon2id$hashed_pin' })

      await expect(service.verifyPin('u-1', 'p-1', '0000')).rejects.toThrow(UnauthorizedException)
    })

    it('throws NotFoundException when profile not found', async () => {
      prisma.childProfile.findFirst.mockResolvedValue(null)
      await expect(service.verifyPin('u-1', 'missing', '1234')).rejects.toThrow(NotFoundException)
    })
  })

  // ── recordWatchEvent ──────────────────────────────────────────

  describe('recordWatchEvent', () => {
    it('creates a watch history entry', async () => {
      prisma.childProfile.findFirst.mockResolvedValue({ id: 'p-1' })
      prisma.video.findUnique.mockResolvedValue({ id: 'vid-1', validationStatus: 'APPROVED' })
      const entry = { id: 'wh-1' }
      prisma.watchHistory.create.mockResolvedValue(entry)

      const result = await service.recordWatchEvent('u-1', 'p-1', {
        videoId: 'vid-1',
        durationWatchedSec: 120,
        completed: false,
      })

      expect(result).toBe(entry)
    })

    it('throws NotFoundException when video does not exist', async () => {
      prisma.childProfile.findFirst.mockResolvedValue({ id: 'p-1' })
      prisma.video.findUnique.mockResolvedValue(null)

      await expect(
        service.recordWatchEvent('u-1', 'p-1', { videoId: 'bad', durationWatchedSec: 0, completed: false }),
      ).rejects.toThrow(NotFoundException)
    })

    describe('viewing schedule enforcement', () => {
      afterEach(() => vi.useRealTimers())

      it('autorise le visionnage quand aucune plage horaire n\'est configurée', async () => {
        prisma.childProfile.findFirst.mockResolvedValue({ id: 'p-1', viewingSchedule: null, dailyLimitMin: null })
        prisma.video.findUnique.mockResolvedValue({ id: 'v-1', validationStatus: 'APPROVED' })
        prisma.watchHistory.create.mockResolvedValue({ id: 'wh-1' })

        await expect(
          service.recordWatchEvent('u-1', 'p-1', { videoId: 'v-1', durationWatchedSec: 60, completed: false }),
        ).resolves.not.toThrow()
      })

      it('autorise le visionnage quand l\'heure actuelle est dans une plage horaire', async () => {
        // Monday 10:00
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2024-01-15T10:00:00')) // Monday

        prisma.childProfile.findFirst.mockResolvedValue({
          id: 'p-1',
          viewingSchedule: { mon: ['08:00-12:00'] },
          dailyLimitMin: null,
        })
        prisma.video.findUnique.mockResolvedValue({ id: 'v-1', validationStatus: 'APPROVED' })
        prisma.watchHistory.create.mockResolvedValue({ id: 'wh-1' })

        await expect(
          service.recordWatchEvent('u-1', 'p-1', { videoId: 'v-1', durationWatchedSec: 60, completed: false }),
        ).resolves.not.toThrow()
      })

      it('bloque le visionnage quand l\'heure actuelle est hors plage horaire', async () => {
        // Monday 20:00 — outside 08:00-12:00
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2024-01-15T20:00:00'))

        prisma.childProfile.findFirst.mockResolvedValue({
          id: 'p-1',
          viewingSchedule: { mon: ['08:00-12:00'] },
          dailyLimitMin: null,
        })
        prisma.video.findUnique.mockResolvedValue({ id: 'v-1', validationStatus: 'APPROVED' })

        await expect(
          service.recordWatchEvent('u-1', 'p-1', { videoId: 'v-1', durationWatchedSec: 60, completed: false }),
        ).rejects.toThrow(ForbiddenException)
      })

      it('bloque le visionnage si aucune plage n\'est définie pour le jour en cours', async () => {
        // Monday 10:00 — schedule only has tue
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2024-01-15T10:00:00'))

        prisma.childProfile.findFirst.mockResolvedValue({
          id: 'p-1',
          viewingSchedule: { tue: ['08:00-20:00'] },
          dailyLimitMin: null,
        })
        prisma.video.findUnique.mockResolvedValue({ id: 'v-1', validationStatus: 'APPROVED' })

        await expect(
          service.recordWatchEvent('u-1', 'p-1', { videoId: 'v-1', durationWatchedSec: 60, completed: false }),
        ).rejects.toThrow(ForbiddenException)
      })

      it('autorise si le visionnage tombe exactement sur le début de la plage', async () => {
        // Monday exactly 08:00
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2024-01-15T08:00:00'))

        prisma.childProfile.findFirst.mockResolvedValue({
          id: 'p-1',
          viewingSchedule: { mon: ['08:00-12:00'] },
          dailyLimitMin: null,
        })
        prisma.video.findUnique.mockResolvedValue({ id: 'v-1', validationStatus: 'APPROVED' })
        prisma.watchHistory.create.mockResolvedValue({ id: 'wh-1' })

        await expect(
          service.recordWatchEvent('u-1', 'p-1', { videoId: 'v-1', durationWatchedSec: 60, completed: false }),
        ).resolves.not.toThrow()
      })
    })

    describe('screen time in-app notification', () => {
      it('crée une notification SCREEN_TIME_ALERT quand la limite journalière est franchie', async () => {
        prisma.childProfile.findFirst.mockResolvedValue({
          id: 'p-1',
          displayName: 'Emma',
          dailyLimitMin: 30,
          userId: 'u-1',
          viewingSchedule: null,
        })
        prisma.video.findUnique.mockResolvedValue({ id: 'v-1', validationStatus: 'APPROVED' })
        prisma.watchHistory.create.mockResolvedValue({ id: 'wh-1' })
        // Simulates: previously 29 min, now crosses 30 min limit
        prisma.watchHistory.aggregate.mockResolvedValue({ _sum: { durationWatchedSec: 1860 } }) // 31 min total
        prisma.user.findUnique.mockResolvedValue({ email: 'parent@test.com', locale: 'fr' })

        await service.recordWatchEvent('u-1', 'p-1', { videoId: 'v-1', durationWatchedSec: 120, completed: false })

        // Give the async check time to settle
        await new Promise(r => setImmediate(r))

        expect(prisma.notification.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              userId: 'u-1',
              type: 'SCREEN_TIME_ALERT',
            }),
          }),
        )
      })

      it('ne crée pas de notification si la limite n\'est pas franchie', async () => {
        prisma.childProfile.findFirst.mockResolvedValue({
          id: 'p-1',
          displayName: 'Emma',
          dailyLimitMin: 60,
          userId: 'u-1',
          viewingSchedule: null,
        })
        prisma.video.findUnique.mockResolvedValue({ id: 'v-1', validationStatus: 'APPROVED' })
        prisma.watchHistory.create.mockResolvedValue({ id: 'wh-1' })
        // Total stays below 60 min
        prisma.watchHistory.aggregate.mockResolvedValue({ _sum: { durationWatchedSec: 600 } }) // 10 min

        await service.recordWatchEvent('u-1', 'p-1', { videoId: 'v-1', durationWatchedSec: 120, completed: false })
        await new Promise(r => setImmediate(r))

        expect(prisma.notification.create).not.toHaveBeenCalled()
      })
    })
  })

  // ── deleteBlock ───────────────────────────────────────────────

  describe('deleteBlock', () => {
    it('deletes block owned by user', async () => {
      prisma.userBlock.findUnique.mockResolvedValue({ id: 'b-1', userId: 'u-1' })
      prisma.userBlock.delete.mockResolvedValue({})

      await service.deleteBlock('u-1', 'b-1')
      expect(prisma.userBlock.delete).toHaveBeenCalledOnce()
    })

    it('throws NotFoundException when block not owned', async () => {
      prisma.userBlock.findUnique.mockResolvedValue({ id: 'b-1', userId: 'u-2' })
      await expect(service.deleteBlock('u-1', 'b-1')).rejects.toThrow(NotFoundException)
    })

    it('throws NotFoundException when block does not exist', async () => {
      prisma.userBlock.findUnique.mockResolvedValue(null)
      await expect(service.deleteBlock('u-1', 'missing')).rejects.toThrow(NotFoundException)
    })
  })

  // ── getFavorites ──────────────────────────────────────────────

  describe('getFavorites', () => {
    it('retourne les favoris du profil', async () => {
      prisma.childProfile.findFirst.mockResolvedValue({ id: 'p-1' })
      const favorites = [{ id: 'f-1', video: { id: 'v-1', title: 'Test' } }]
      prisma.videoFavorite.findMany.mockResolvedValue(favorites)

      expect(await service.getFavorites('u-1', 'p-1')).toBe(favorites)
    })

    it('lève NotFoundException si le profil n\'appartient pas à l\'utilisateur', async () => {
      prisma.childProfile.findFirst.mockResolvedValue(null)

      await expect(service.getFavorites('u-2', 'p-1')).rejects.toThrow(NotFoundException)
      expect(prisma.videoFavorite.findMany).not.toHaveBeenCalled()
    })
  })

  // ── addFavorite ───────────────────────────────────────────────

  describe('addFavorite', () => {
    it('ajoute la vidéo aux favoris (upsert idempotent)', async () => {
      prisma.childProfile.findFirst.mockResolvedValue({ id: 'p-1' })
      prisma.video.findUnique.mockResolvedValue({ id: 'v-1', validationStatus: 'APPROVED' })
      const favorite = { id: 'f-1', videoId: 'v-1', createdAt: new Date() }
      prisma.videoFavorite.upsert.mockResolvedValue(favorite)

      expect(await service.addFavorite('u-1', 'p-1', 'v-1')).toBe(favorite)
      expect(prisma.videoFavorite.upsert.mock.calls[0][0].where).toEqual({
        profileId_videoId: { profileId: 'p-1', videoId: 'v-1' },
      })
    })

    it('lève NotFoundException si la vidéo est introuvable', async () => {
      prisma.childProfile.findFirst.mockResolvedValue({ id: 'p-1' })
      prisma.video.findUnique.mockResolvedValue(null)

      await expect(service.addFavorite('u-1', 'p-1', 'bad-id')).rejects.toThrow(NotFoundException)
      expect(prisma.videoFavorite.upsert).not.toHaveBeenCalled()
    })

    it('lève BadRequestException si la vidéo n\'est pas APPROVED', async () => {
      prisma.childProfile.findFirst.mockResolvedValue({ id: 'p-1' })
      prisma.video.findUnique.mockResolvedValue({ id: 'v-1', validationStatus: 'PENDING' })

      await expect(service.addFavorite('u-1', 'p-1', 'v-1')).rejects.toThrow(BadRequestException)
    })

    it('lève NotFoundException si le profil n\'appartient pas à l\'utilisateur', async () => {
      prisma.childProfile.findFirst.mockResolvedValue(null)

      await expect(service.addFavorite('u-2', 'p-1', 'v-1')).rejects.toThrow(NotFoundException)
    })
  })

  // ── removeFavorite ────────────────────────────────────────────

  describe('removeFavorite', () => {
    it('supprime le favori du profil', async () => {
      prisma.childProfile.findFirst.mockResolvedValue({ id: 'p-1' })
      prisma.videoFavorite.deleteMany.mockResolvedValue({ count: 1 })

      await service.removeFavorite('u-1', 'p-1', 'v-1')

      expect(prisma.videoFavorite.deleteMany).toHaveBeenCalledWith({
        where: { profileId: 'p-1', videoId: 'v-1' },
      })
    })

    it('ne lève pas d\'erreur si le favori n\'existait pas (deleteMany = 0)', async () => {
      prisma.childProfile.findFirst.mockResolvedValue({ id: 'p-1' })
      prisma.videoFavorite.deleteMany.mockResolvedValue({ count: 0 })

      await expect(service.removeFavorite('u-1', 'p-1', 'v-gone')).resolves.not.toThrow()
    })

    it('lève NotFoundException si le profil n\'appartient pas à l\'utilisateur', async () => {
      prisma.childProfile.findFirst.mockResolvedValue(null)

      await expect(service.removeFavorite('u-2', 'p-1', 'v-1')).rejects.toThrow(NotFoundException)
    })
  })

  // ── getVideoRating ────────────────────────────────────────────

  describe('getVideoRating', () => {
    it('returns the saved rating for an owned profile', async () => {
      prisma.childProfile.findFirst.mockResolvedValue({ id: 'p-1' })
      prisma.videoRating.findUnique.mockResolvedValue({ rating: 'THUMBS_UP' })

      await expect(service.getVideoRating('u-1', 'p-1', 'v-1'))
        .resolves.toEqual({ rating: 'THUMBS_UP' })
    })

    it('returns null when the profile has not rated the video', async () => {
      prisma.childProfile.findFirst.mockResolvedValue({ id: 'p-1' })
      prisma.videoRating.findUnique.mockResolvedValue(null)

      await expect(service.getVideoRating('u-1', 'p-1', 'v-1'))
        .resolves.toEqual({ rating: null })
    })

    it('does not read ratings for profiles not owned by the user', async () => {
      prisma.childProfile.findFirst.mockResolvedValue(null)

      await expect(service.getVideoRating('u-2', 'p-1', 'v-1')).rejects.toThrow(NotFoundException)
      expect(prisma.videoRating.findUnique).not.toHaveBeenCalled()
    })
  })

  // ── Video progress ────────────────────────────────────────────

  describe('getVideoProgress', () => {
    it('returns the saved progress for an owned profile', async () => {
      prisma.childProfile.findFirst.mockResolvedValue({ id: 'p-1' })
      prisma.videoProgress.findUnique.mockResolvedValue({ positionSec: 42, completed: false })

      await expect(service.getVideoProgress('u-1', 'p-1', 'v-1'))
        .resolves.toEqual({ positionSec: 42, completed: false })
    })

    it('returns default progress when no position has been saved', async () => {
      prisma.childProfile.findFirst.mockResolvedValue({ id: 'p-1' })
      prisma.videoProgress.findUnique.mockResolvedValue(null)

      await expect(service.getVideoProgress('u-1', 'p-1', 'v-1'))
        .resolves.toEqual({ positionSec: 0, completed: false })
    })
  })

  describe('upsertVideoProgress', () => {
    it('saves progress for an existing video', async () => {
      prisma.childProfile.findFirst.mockResolvedValue({ id: 'p-1' })
      prisma.video.findUnique.mockResolvedValue({ id: 'v-1' })
      prisma.videoProgress.upsert.mockResolvedValue({ profileId: 'p-1', videoId: 'v-1', positionSec: 42 })

      await service.upsertVideoProgress('u-1', 'p-1', 'v-1', 42)

      expect(prisma.videoProgress.upsert).toHaveBeenCalledWith({
        where: { profileId_videoId: { profileId: 'p-1', videoId: 'v-1' } },
        create: { profileId: 'p-1', videoId: 'v-1', positionSec: 42, completed: false },
        update: { positionSec: 42 },
      })
    })

    it('rejects attempts to save progress for a missing video', async () => {
      prisma.childProfile.findFirst.mockResolvedValue({ id: 'p-1' })
      prisma.video.findUnique.mockResolvedValue(null)

      await expect(service.upsertVideoProgress('u-1', 'p-1', 'v-1', 42)).rejects.toThrow(NotFoundException)
      expect(prisma.videoProgress.upsert).not.toHaveBeenCalled()
    })
  })
})
