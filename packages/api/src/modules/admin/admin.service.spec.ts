import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NotFoundException, BadRequestException } from '@nestjs/common'
import { AdminService } from './admin.service'
import { UserRole } from '@nourplay/db'

const makePrisma = () => ({
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    groupBy: vi.fn(),
  },
  video: { count: vi.fn(), groupBy: vi.fn() },
  videoReport: { count: vi.fn() },
  gdprRequest: { count: vi.fn() },
  auditLog: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(),
})

const makeAudit = () => ({ log: vi.fn().mockResolvedValue({}) })

const ACTOR = { id: 'admin-uuid', role: 'ADMIN' }

describe('AdminService', () => {
  let service: AdminService
  let prisma: ReturnType<typeof makePrisma>
  let audit: ReturnType<typeof makeAudit>

  beforeEach(() => {
    vi.clearAllMocks()
    prisma = makePrisma()
    audit = makeAudit()
    service = new AdminService(prisma as never, audit as never)
  })

  describe('getUsers', () => {
    it('retourne une liste paginée avec total', async () => {
      const users = [{ id: 'u1', email: 'a@b.com', role: 'PARENT' }]
      prisma.$transaction.mockResolvedValue([users, 1])

      const result = await service.getUsers({ page: 1, limit: 20 })

      expect(result).toEqual({ items: users, total: 1, page: 1, limit: 20 })
      expect(prisma.$transaction).toHaveBeenCalledOnce()
    })
  })

  describe('getUserById', () => {
    it('retourne l\'utilisateur avec ses compteurs', async () => {
      const user = { id: 'u1', email: 'a@b.com', _count: { childProfiles: 2 } }
      prisma.user.findUnique.mockResolvedValue(user)

      expect(await service.getUserById('u1')).toEqual(user)
    })

    it('lève NotFoundException si introuvable', async () => {
      prisma.user.findUnique.mockResolvedValue(null)

      await expect(service.getUserById('missing')).rejects.toThrow(NotFoundException)
    })
  })

  describe('updateUser', () => {
    it('change le rôle et écrit un audit log', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: UserRole.PARENT })
      prisma.user.update.mockResolvedValue({ id: 'u1', role: UserRole.TEACHER })

      await service.updateUser(ACTOR.id, ACTOR.role, 'u1', { role: UserRole.TEACHER })

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { role: UserRole.TEACHER },
      })
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'user.update' }))
    })

    it('bannit l\'utilisateur en mettant deletedAt', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: UserRole.PARENT })
      prisma.user.update.mockResolvedValue({})

      await service.updateUser(ACTOR.id, ACTOR.role, 'u1', { banned: true })

      const call = prisma.user.update.mock.calls[0][0]
      expect(call.data.deletedAt).toBeInstanceOf(Date)
    })

    it('lève BadRequest si on tente de rétrograder le dernier admin', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: UserRole.ADMIN })
      prisma.user.count.mockResolvedValue(1)

      await expect(
        service.updateUser(ACTOR.id, ACTOR.role, 'u1', { role: UserRole.MODERATOR }),
      ).rejects.toThrow(BadRequestException)
    })

    it('lève NotFoundException si utilisateur introuvable', async () => {
      prisma.user.findUnique.mockResolvedValue(null)

      await expect(
        service.updateUser(ACTOR.id, ACTOR.role, 'missing', { role: UserRole.TEACHER }),
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('getStats', () => {
    it('retourne les statistiques agrégées', async () => {
      prisma.$transaction.mockResolvedValue([
        10,
        [{ role: 'PARENT', _count: 8 }, { role: 'TEACHER', _count: 2 }],
        5,
        [{ validationStatus: 'APPROVED', _count: 4 }, { validationStatus: 'PENDING', _count: 1 }],
        2,
        1,
      ])

      const stats = await service.getStats()

      expect(stats.users.total).toBe(10)
      expect(stats.users.byRole.PARENT).toBe(8)
      expect(stats.videos.total).toBe(5)
      expect(stats.moderation.pendingReports).toBe(2)
      expect(stats.gdpr.pendingRequests).toBe(1)
    })
  })
})
