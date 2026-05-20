import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NotFoundException, ForbiddenException } from '@nestjs/common'
import { NotificationService } from './notification.service'

const makePrisma = () => ({
  notification: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  $transaction: vi.fn(),
})

const USER_ID = 'user-uuid-1'
const NOTIF = { id: 'n1', userId: USER_ID, type: 'video.approved', payload: {}, readAt: null, createdAt: new Date() }

describe('NotificationService', () => {
  let service: NotificationService
  let prisma: ReturnType<typeof makePrisma>

  beforeEach(() => {
    vi.clearAllMocks()
    prisma = makePrisma()
    service = new NotificationService(prisma as never)
  })

  describe('findForUser', () => {
    it('retourne les notifications paginées avec compteur non-lues', async () => {
      prisma.$transaction.mockResolvedValue([[NOTIF], 1, 1])

      const result = await service.findForUser(USER_ID)

      expect(result.items).toHaveLength(1)
      expect(result.unread).toBe(1)
      expect(result.total).toBe(1)
    })
  })

  describe('markRead', () => {
    it('met readAt à la date courante', async () => {
      prisma.notification.findUnique.mockResolvedValue(NOTIF)
      prisma.notification.update.mockResolvedValue({ ...NOTIF, readAt: new Date() })

      const result = await service.markRead(USER_ID, 'n1')
      expect(result.readAt).toBeInstanceOf(Date)
    })

    it('lève ForbiddenException si la notification appartient à un autre utilisateur', async () => {
      prisma.notification.findUnique.mockResolvedValue({ ...NOTIF, userId: 'other-user' })

      await expect(service.markRead(USER_ID, 'n1')).rejects.toThrow(ForbiddenException)
    })

    it('lève NotFoundException si introuvable', async () => {
      prisma.notification.findUnique.mockResolvedValue(null)

      await expect(service.markRead(USER_ID, 'missing')).rejects.toThrow(NotFoundException)
    })
  })

  describe('markAllRead', () => {
    it('retourne le nombre de notifications mises à jour', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 3 })

      const result = await service.markAllRead(USER_ID)
      expect(result).toEqual({ updated: 3 })
    })
  })

  describe('create', () => {
    it('crée une notification avec le bon type et payload', async () => {
      prisma.notification.create.mockResolvedValue({ id: 'n2', type: 'video.approved', payload: { videoId: 'v1' } })

      const result = await service.create({ userId: USER_ID, type: 'video.approved', payload: { videoId: 'v1' } })

      expect(result.type).toBe('video.approved')
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: { userId: USER_ID, type: 'video.approved', payload: { videoId: 'v1' } },
      })
    })
  })
})
