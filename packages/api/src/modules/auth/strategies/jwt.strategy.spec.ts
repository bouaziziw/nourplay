import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../../common/prisma/prisma.service'
import { JwtStrategy } from './jwt.strategy'

describe('JwtStrategy', () => {
  const user = { id: 'user-1', email: 'user@example.com', role: 'PARENT' }
  let findUnique: ReturnType<typeof vi.fn>
  let strategy: JwtStrategy

  beforeEach(() => {
    findUnique = vi.fn()
    const config = { get: () => 'test-secret' } as ConfigService
    const prisma = { user: { findUnique } } as unknown as PrismaService
    strategy = new JwtStrategy(config, prisma)
  })

  it('returns the authenticated user with the subject expected by CurrentUser', async () => {
    findUnique.mockResolvedValue(user)

    await expect(strategy.validate({ sub: user.id, email: user.email, role: user.role }))
      .resolves.toEqual({ ...user, sub: user.id })
  })

  it('rejects users that no longer exist or are deleted', async () => {
    findUnique.mockResolvedValue(null)

    await expect(strategy.validate({ sub: user.id, email: user.email, role: user.role }))
      .rejects.toThrow(UnauthorizedException)
  })
})
