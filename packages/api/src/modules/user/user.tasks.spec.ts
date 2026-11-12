import { describe, it, expect, beforeEach, vi } from 'vitest'
import { UserTasksService } from './user.tasks'

const makePrisma = () => ({
  user: {
    findMany: vi.fn(),
  },
})

const makeEmail = () => ({
  sendWeeklySummaryEmail: vi.fn().mockResolvedValue(undefined),
})

const makeUser = (overrides = {}) => ({
  id: 'user-1',
  email: 'parent@test.com',
  locale: 'fr',
  childProfiles: [],
  ...overrides,
})

const makeProfile = (overrides = {}) => ({
  id: 'profile-1',
  displayName: 'Emma',
  dailyLimitMin: null,
  watchHistory: [],
  ...overrides,
})

const makeHistory = (videoId: string, title: string, durationWatchedSec = 120) => ({
  videoId,
  durationWatchedSec,
  video: { id: videoId, title, thumbnailUrl: null },
})

describe('UserTasksService', () => {
  let service: UserTasksService
  let prisma: ReturnType<typeof makePrisma>
  let email: ReturnType<typeof makeEmail>

  beforeEach(() => {
    vi.clearAllMocks()
    prisma = makePrisma()
    email = makeEmail()
    service = new UserTasksService(prisma as never, email as never)
  })

  describe('sendWeeklyDigests', () => {
    it('ne fait rien si aucun utilisateur n\'a de profil actif cette semaine', async () => {
      prisma.user.findMany.mockResolvedValue([
        makeUser({ childProfiles: [makeProfile()] }), // profile has no history
      ])

      await service.sendWeeklyDigests()

      expect(email.sendWeeklySummaryEmail).not.toHaveBeenCalled()
    })

    it('ne fait rien si la liste d\'utilisateurs est vide', async () => {
      prisma.user.findMany.mockResolvedValue([])

      await service.sendWeeklyDigests()

      expect(email.sendWeeklySummaryEmail).not.toHaveBeenCalled()
    })

    it('envoie un email par parent ayant au moins un profil actif', async () => {
      prisma.user.findMany.mockResolvedValue([
        makeUser({
          childProfiles: [
            makeProfile({ watchHistory: [makeHistory('v1', 'Vidéo 1'), makeHistory('v1', 'Vidéo 1')] }),
          ],
        }),
      ])

      await service.sendWeeklyDigests()

      expect(email.sendWeeklySummaryEmail).toHaveBeenCalledTimes(1)
      expect(email.sendWeeklySummaryEmail).toHaveBeenCalledWith(
        'parent@test.com',
        'fr',
        expect.any(Array),
        expect.any(String),
      )
    })

    it('n\'inclut que les profils ayant de l\'historique cette semaine', async () => {
      prisma.user.findMany.mockResolvedValue([
        makeUser({
          childProfiles: [
            makeProfile({ id: 'p1', displayName: 'Emma', watchHistory: [makeHistory('v1', 'Vidéo 1')] }),
            makeProfile({ id: 'p2', displayName: 'Lucas', watchHistory: [] }), // no history — excluded
          ],
        }),
      ])

      await service.sendWeeklyDigests()

      const [, , digests] = email.sendWeeklySummaryEmail.mock.calls[0]
      expect(digests).toHaveLength(1)
      expect(digests[0].profileName).toBe('Emma')
    })

    it('calcule correctement le temps total et le nombre de vidéos', async () => {
      const history = [
        makeHistory('v1', 'Vidéo 1', 300),
        makeHistory('v2', 'Vidéo 2', 120),
        makeHistory('v1', 'Vidéo 1', 180),
      ]
      prisma.user.findMany.mockResolvedValue([
        makeUser({ childProfiles: [makeProfile({ watchHistory: history })] }),
      ])

      await service.sendWeeklyDigests()

      const [, , digests] = email.sendWeeklySummaryEmail.mock.calls[0]
      expect(digests[0].totalWatchedSec).toBe(600)
      expect(digests[0].videoCount).toBe(3)
    })

    it('agrège les vidéos par videoId et trie par nombre de vues décroissant', async () => {
      const history = [
        makeHistory('v1', 'Vidéo 1', 60),
        makeHistory('v2', 'Vidéo 2', 60),
        makeHistory('v2', 'Vidéo 2', 60),
        makeHistory('v3', 'Vidéo 3', 60),
        makeHistory('v3', 'Vidéo 3', 60),
        makeHistory('v3', 'Vidéo 3', 60),
      ]
      prisma.user.findMany.mockResolvedValue([
        makeUser({ childProfiles: [makeProfile({ watchHistory: history })] }),
      ])

      await service.sendWeeklyDigests()

      const [, , digests] = email.sendWeeklySummaryEmail.mock.calls[0]
      const top = digests[0].topVideos
      expect(top[0].watchCount).toBe(3) // v3
      expect(top[1].watchCount).toBe(2) // v2
      expect(top[2].watchCount).toBe(1) // v1
      expect(top.length).toBeLessThanOrEqual(3)
    })

    it('inclut la limite journalière dans le digest si elle est définie', async () => {
      prisma.user.findMany.mockResolvedValue([
        makeUser({
          childProfiles: [
            makeProfile({ dailyLimitMin: 60, watchHistory: [makeHistory('v1', 'Vidéo 1')] }),
          ],
        }),
      ])

      await service.sendWeeklyDigests()

      const [, , digests] = email.sendWeeklySummaryEmail.mock.calls[0]
      expect(digests[0].dailyLimitMin).toBe(60)
    })

    it('continue les envois si un email échoue', async () => {
      prisma.user.findMany.mockResolvedValue([
        makeUser({ id: 'u1', email: 'fail@test.com', childProfiles: [makeProfile({ watchHistory: [makeHistory('v1', 'Vidéo 1')] })] }),
        makeUser({ id: 'u2', email: 'ok@test.com', childProfiles: [makeProfile({ watchHistory: [makeHistory('v2', 'Vidéo 2')] })] }),
      ])
      email.sendWeeklySummaryEmail.mockRejectedValueOnce(new Error('SMTP'))

      await expect(service.sendWeeklyDigests()).resolves.not.toThrow()
      expect(email.sendWeeklySummaryEmail).toHaveBeenCalledTimes(2)
    })

    it('passe la locale de l\'utilisateur à l\'email', async () => {
      prisma.user.findMany.mockResolvedValue([
        makeUser({ locale: 'en', childProfiles: [makeProfile({ watchHistory: [makeHistory('v1', 'Video 1')] })] }),
      ])

      await service.sendWeeklyDigests()

      expect(email.sendWeeklySummaryEmail).toHaveBeenCalledWith(
        expect.any(String),
        'en',
        expect.any(Array),
        expect.any(String),
      )
    })
  })
})
