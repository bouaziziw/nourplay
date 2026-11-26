import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NotFoundException } from '@nestjs/common'
import { SupportService, SUPPORT_CATEGORIES } from './support.service'

const makePrisma = () => ({
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  childProfile: {
    findFirst: vi.fn(),
  },
  notification: {
    createMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
})

const makeEmail = () => ({
  sendSupportMessageToAdmins: vi.fn().mockResolvedValue(undefined),
  sendSupportConfirmationToParent: vi.fn().mockResolvedValue(undefined),
})

const makeAudit = () => ({
  log: vi.fn().mockResolvedValue({}),
})

describe('SupportService', () => {
  let service: SupportService
  let prisma: ReturnType<typeof makePrisma>
  let email: ReturnType<typeof makeEmail>
  let audit: ReturnType<typeof makeAudit>

  beforeEach(() => {
    vi.clearAllMocks()
    prisma = makePrisma()
    email = makeEmail()
    audit = makeAudit()
    service = new SupportService(prisma as never, email as never, audit as never)
  })

  describe('getCategories', () => {
    it('returns the list of support categories', () => {
      expect(service.getCategories()).toEqual(SUPPORT_CATEGORIES)
      expect(SUPPORT_CATEGORIES.length).toBeGreaterThan(0)
    })
  })

  describe('submitContact', () => {
    const parentUser = {
      id: 'parent-123',
      email: 'parent@example.com',
      role: 'PARENT',
      locale: 'fr',
    }

    const validDto = {
      category: 'TECHNICAL_ISSUE',
      subject: 'Problème de lecture vidéo',
      message: 'La vidéo ne se charge pas sur la tablette de mon fils.',
    }

    it('throws NotFoundException when parent user is not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null)

      await expect(service.submitContact('unknown-id', validDto)).rejects.toThrow(
        NotFoundException,
      )
    })

    it('successfully sends message to admins, sends confirmation to parent, creates notifications, and logs audit', async () => {
      prisma.user.findUnique.mockResolvedValue(parentUser)
      prisma.user.findMany.mockResolvedValue([
        { id: 'admin-1', email: 'admin1@nourplay.com' },
        { id: 'admin-2', email: 'superadmin@nourplay.com' },
      ])

      const result = await service.submitContact(parentUser.id, validDto)

      expect(result.success).toBe(true)
      expect(result.recipientsCount).toBe(2)

      // Vérifie l'envoi d'email aux admins
      expect(email.sendSupportMessageToAdmins).toHaveBeenCalledWith(
        expect.arrayContaining(['admin1@nourplay.com', 'superadmin@nourplay.com']),
        expect.objectContaining({
          parentEmail: 'parent@example.com',
          category: 'TECHNICAL_ISSUE',
          subject: 'Problème de lecture vidéo',
          message: 'La vidéo ne se charge pas sur la tablette de mon fils.',
        }),
      )

      // Vérifie l'accusé de réception envoyé au parent
      expect(email.sendSupportConfirmationToParent).toHaveBeenCalledWith(
        'parent@example.com',
        expect.objectContaining({
          category: 'TECHNICAL_ISSUE',
          subject: 'Problème de lecture vidéo',
          locale: 'fr',
        }),
      )

      // Vérifie la notification in-app pour chaque admin
      expect(prisma.notification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            userId: 'admin-1',
            type: 'SUPPORT_MESSAGE',
          }),
          expect.objectContaining({
            userId: 'admin-2',
            type: 'SUPPORT_MESSAGE',
          }),
        ]),
      })

      // Vérifie le log d'audit
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: parentUser.id,
          actorRole: 'PARENT',
          action: 'support.contact_submitted',
          resourceType: 'SupportTicket',
        }),
      )
    })

    it('includes child profile name if childProfileId is supplied', async () => {
      prisma.user.findUnique.mockResolvedValue(parentUser)
      prisma.childProfile.findFirst.mockResolvedValue({ displayName: 'Youssef' })
      prisma.user.findMany.mockResolvedValue([{ id: 'admin-1', email: 'admin@nourplay.com' }])

      await service.submitContact(parentUser.id, {
        ...validDto,
        childProfileId: 'child-profile-uuid',
      })

      expect(prisma.childProfile.findFirst).toHaveBeenCalledWith({
        where: { id: 'child-profile-uuid', userId: parentUser.id, deletedAt: null },
        select: { displayName: true },
      })

      expect(email.sendSupportMessageToAdmins).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          childProfileName: 'Youssef',
        }),
      )
    })

    it('uses fallback email when no admin is found in database', async () => {
      prisma.user.findUnique.mockResolvedValue(parentUser)
      prisma.user.findMany.mockResolvedValue([])

      const result = await service.submitContact(parentUser.id, validDto)

      expect(result.success).toBe(true)
      expect(email.sendSupportMessageToAdmins).toHaveBeenCalledWith(
        expect.arrayContaining(['support@nour-play.app']),
        expect.anything(),
      )
    })
  })
})
