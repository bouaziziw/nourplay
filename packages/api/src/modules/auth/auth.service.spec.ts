import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ConflictException, UnauthorizedException } from '@nestjs/common'
import { AuthService } from './auth.service'
import { UserRole } from '@nourplay/db'

vi.mock('argon2', () => ({
  hash: vi.fn().mockResolvedValue('$argon2id$hashed'),
  verify: vi.fn().mockResolvedValue(true),
  argon2id: 2,
}))

const makePrisma = () => ({
  user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
  refreshToken: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
})

const makeJwt = () => ({ sign: vi.fn().mockReturnValue('mock_access_token') })

const makeConfig = () => ({
  get: vi.fn((key: string, def?: unknown) => {
    const map: Record<string, unknown> = {
      'jwt.accessSecret': 'test-secret-32-chars-minimum-ok',
      'jwt.refreshTtl': 604800,
    }
    return map[key] ?? def
  }),
})

const makeEmailService = () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
})

const makeTokenService = () => ({
  createEmailVerificationToken: vi.fn().mockResolvedValue('test-verify-token'),
  consumeEmailVerificationToken: vi.fn().mockResolvedValue(null),
  createPasswordResetToken: vi.fn().mockResolvedValue('test-reset-token'),
  consumePasswordResetToken: vi.fn().mockResolvedValue(null),
  redis: {
    setex: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
  },
})

describe('AuthService', () => {
  let service: AuthService
  let prisma: ReturnType<typeof makePrisma>
  let jwt: ReturnType<typeof makeJwt>
  let config: ReturnType<typeof makeConfig>
  let emailService: ReturnType<typeof makeEmailService>
  let tokenService: ReturnType<typeof makeTokenService>

  beforeEach(() => {
    vi.clearAllMocks()
    prisma = makePrisma()
    jwt = makeJwt()
    config = makeConfig()
    emailService = makeEmailService()
    tokenService = makeTokenService()
    service = new AuthService(
      prisma as never,
      jwt as never,
      config as never,
      emailService as never,
      tokenService as never,
    )
  })

  describe('register', () => {
    it('crée un utilisateur si l\'email est disponible', async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      prisma.user.create.mockResolvedValue({
        id: 'uuid-1', email: 'test@example.com', role: UserRole.PARENT, locale: 'fr', createdAt: new Date(),
      })

      const result = await service.register({
        email: 'test@example.com', password: 'TestPassword1!', role: UserRole.PARENT, locale: 'fr',
      })

      expect(result.email).toBe('test@example.com')
      expect(prisma.user.create).toHaveBeenCalledOnce()
    })

    it('envoie un email de vérification après la création', async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      prisma.user.create.mockResolvedValue({
        id: 'uuid-1', email: 'test@example.com', role: UserRole.PARENT, locale: 'fr', createdAt: new Date(),
      })

      await service.register({ email: 'test@example.com', password: 'TestPassword1!', role: UserRole.PARENT, locale: 'fr' })

      expect(tokenService.createEmailVerificationToken).toHaveBeenCalledWith('uuid-1')
      expect(emailService.sendVerificationEmail).toHaveBeenCalledWith('test@example.com', 'test-verify-token', 'fr')
    })

    it('lève ConflictException si l\'email existe déjà', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing-id' })

      await expect(
        service.register({ email: 'dup@example.com', password: 'TestPassword1!', role: UserRole.PARENT, locale: 'fr' }),
      ).rejects.toThrow(ConflictException)

      expect(prisma.user.create).not.toHaveBeenCalled()
    })
  })

  describe('verifyEmail', () => {
    it('marque l\'email comme vérifié avec un token valide', async () => {
      tokenService.consumeEmailVerificationToken.mockResolvedValue('uuid-1')
      prisma.user.update.mockResolvedValue({})

      const result = await service.verifyEmail('valid-token')

      expect(result).toEqual({ verified: true })
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'uuid-1' },
        data: expect.objectContaining({ emailVerified: true }),
      })
    })

    it('lève BadRequestException si le token est invalide', async () => {
      tokenService.consumeEmailVerificationToken.mockResolvedValue(null)

      await expect(service.verifyEmail('invalid-token')).rejects.toThrow('Token invalide ou expiré')
    })
  })

  describe('validateUser', () => {
    it('retourne l\'utilisateur sans passwordHash si credentials valides', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'uuid-1', email: 'test@example.com', role: UserRole.PARENT,
        passwordHash: '$argon2id$hashed', emailVerified: true,
      })

      const result = await service.validateUser('test@example.com', 'correct')
      expect(result?.email).toBe('test@example.com')
      expect(result).not.toHaveProperty('passwordHash')
    })

    it('retourne null si l\'utilisateur n\'existe pas', async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      expect(await service.validateUser('unknown@example.com', 'any')).toBeNull()
    })

    it('retourne null si argon2.verify retourne false', async () => {
      const argon2 = await import('argon2')
      vi.mocked(argon2.verify).mockResolvedValueOnce(false)
      prisma.user.findUnique.mockResolvedValue({
        id: 'uuid-1', email: 'test@example.com', role: UserRole.PARENT,
        passwordHash: '$argon2id$hashed', emailVerified: true,
      })
      expect(await service.validateUser('test@example.com', 'wrong')).toBeNull()
    })
  })

  describe('setParentPin', () => {
    it('vérifie le mot de passe puis enregistre uniquement le hash du PIN', async () => {
      prisma.user.findUnique.mockResolvedValue({ passwordHash: '$argon2id$hashed' })
      prisma.user.update.mockResolvedValue({})

      await expect(service.setParentPin('uuid-1', 'correct', '123456')).resolves.toEqual({ configured: true })
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'uuid-1', deletedAt: null },
        select: { passwordHash: true },
      })
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'uuid-1' },
        data: { parentPinHash: '$argon2id$hashed' },
      })
    })

    it('refuse un compte sans mot de passe ou un mot de passe incorrect', async () => {
      prisma.user.findUnique.mockResolvedValue({ passwordHash: null })
      await expect(service.setParentPin('uuid-1', 'wrong', '123456')).rejects.toThrow(UnauthorizedException)

      prisma.user.findUnique.mockResolvedValue({ passwordHash: '$argon2id$hashed' })
      const argon2 = await import('argon2')
      vi.mocked(argon2.verify).mockResolvedValueOnce(false)
      await expect(service.setParentPin('uuid-1', 'wrong', '123456')).rejects.toThrow(UnauthorizedException)
      expect(prisma.user.update).not.toHaveBeenCalled()
    })
  })

  describe('verifyParentPassword', () => {
    it('valide le mot de passe du compte', async () => {
      prisma.user.findUnique.mockResolvedValue({ passwordHash: '$argon2id$hashed' })

      await expect(service.verifyParentPassword('uuid-1', 'correct')).resolves.toEqual({ verified: true })
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'uuid-1', deletedAt: null },
        select: { passwordHash: true },
      })
    })

    it('refuse un compte sans mot de passe ou un mot de passe incorrect', async () => {
      prisma.user.findUnique.mockResolvedValue({ passwordHash: null })
      await expect(service.verifyParentPassword('uuid-1', 'wrong')).rejects.toThrow(UnauthorizedException)

      prisma.user.findUnique.mockResolvedValue({ passwordHash: '$argon2id$hashed' })
      const argon2 = await import('argon2')
      vi.mocked(argon2.verify).mockResolvedValueOnce(false)
      await expect(service.verifyParentPassword('uuid-1', 'wrong')).rejects.toThrow(UnauthorizedException)
    })
  })

  describe('verifyParentPin', () => {
    it('valide le PIN depuis son hash', async () => {
      prisma.user.findUnique.mockResolvedValue({ parentPinHash: '$argon2id$hashed' })

      await expect(service.verifyParentPin('uuid-1', '123456')).resolves.toEqual({ verified: true })
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'uuid-1', deletedAt: null },
        select: { parentPinHash: true },
      })
    })

    it('refuse un PIN non configuré ou incorrect', async () => {
      prisma.user.findUnique.mockResolvedValue({ parentPinHash: null })
      await expect(service.verifyParentPin('uuid-1', '123456')).rejects.toThrow(UnauthorizedException)

      prisma.user.findUnique.mockResolvedValue({ parentPinHash: '$argon2id$hashed' })
      const argon2 = await import('argon2')
      vi.mocked(argon2.verify).mockResolvedValueOnce(false)
      await expect(service.verifyParentPin('uuid-1', '654321')).rejects.toThrow(UnauthorizedException)
    })
  })

  describe('buildFingerprint', () => {
    it('génère un hash SHA-256 de 64 caractères hex', () => {
      const fp = service.buildFingerprint('Mozilla/5.0', '192.168.1.42')
      expect(fp).toHaveLength(64)
      expect(fp).toMatch(/^[0-9a-f]{64}$/)
    })

    it('est identique pour des IPs dans le même /24', () => {
      expect(service.buildFingerprint('Mozilla/5.0', '192.168.1.10'))
        .toBe(service.buildFingerprint('Mozilla/5.0', '192.168.1.99'))
    })

    it('est différent pour des subnets /24 différents', () => {
      expect(service.buildFingerprint('Mozilla/5.0', '192.168.1.1'))
        .not.toBe(service.buildFingerprint('Mozilla/5.0', '10.0.0.1'))
    })
  })

  describe('login', () => {
    it('retourne accessToken JWT et refreshToken hex 96 chars', async () => {
      prisma.refreshToken.create.mockResolvedValue({})

      const result = await service.login('uuid-1', 'test@test.com', 'PARENT', 'fp')

      expect(result.accessToken).toBe('mock_access_token')
      expect(result.refreshToken).toHaveLength(96)
      expect(jwt.sign).toHaveBeenCalledWith({ sub: 'uuid-1', email: 'test@test.com', role: 'PARENT' })
    })

    it('stocke le hash SHA-256 du token brut', async () => {
      prisma.refreshToken.create.mockResolvedValue({})
      const { refreshToken } = await service.login('uuid-1', 'test@test.com', 'PARENT', 'fp')

      const { createHash } = await import('crypto')
      const expected = createHash('sha256').update(refreshToken).digest('hex')
      expect(prisma.refreshToken.create.mock.calls[0][0].data.tokenHash).toBe(expected)
    })
  })

  describe('refreshTokens', () => {
    it('lève UnauthorizedException si le token est révoqué', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1', userId: 'u-1', revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 10000), fingerprint: 'fp',
        user: { id: 'u-1', email: 'a@b.com', role: 'PARENT', deletedAt: null },
      })
      await expect(service.refreshTokens('token-hash', 'fp')).rejects.toThrow(UnauthorizedException)
    })

    it('lève UnauthorizedException si le token est expiré', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1', userId: 'u-1', revokedAt: null,
        expiresAt: new Date(Date.now() - 1000), fingerprint: 'fp',
        user: { id: 'u-1', email: 'a@b.com', role: 'PARENT', deletedAt: null },
      })
      await expect(service.refreshTokens('token-hash', 'fp')).rejects.toThrow(UnauthorizedException)
    })

    it('révoque TOUS les tokens et lève UnauthorizedException si fingerprint suspect', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1', userId: 'u-1', revokedAt: null,
        expiresAt: new Date(Date.now() + 10000), fingerprint: 'fp-original',
        user: { id: 'u-1', email: 'a@b.com', role: 'PARENT', deletedAt: null },
      })
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 })

      await expect(service.refreshTokens('token-hash', 'fp-different')).rejects.toThrow(UnauthorizedException)
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledOnce()
      expect(prisma.refreshToken.updateMany.mock.calls[0][0].where.userId).toBe('u-1')
    })
  })

  describe('forgotPassword', () => {
    it('envoie un email de reset si l\'utilisateur existe', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'uuid-1', locale: 'fr' })

      await service.forgotPassword('test@example.com')

      expect(tokenService.createPasswordResetToken).toHaveBeenCalledWith('uuid-1')
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith('test@example.com', 'test-reset-token', 'fr')
    })

    it('ne lève pas d\'exception si l\'email n\'existe pas (anti-énumération)', async () => {
      prisma.user.findUnique.mockResolvedValue(null)

      await expect(service.forgotPassword('unknown@example.com')).resolves.not.toThrow()
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled()
    })
  })
})
