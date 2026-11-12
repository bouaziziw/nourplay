/**
 * Auth integration tests — Supertest against a real NestJS app
 * with mocked Prisma / Redis / Email so no real services are needed.
 */
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import { JwtModule, JwtService } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { ConfigModule } from '@nestjs/config'
import cookieParser from 'cookie-parser'
import supertest from 'supertest'
import { createHash } from 'crypto'
import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest'

import { AuthController } from '../src/modules/auth/auth.controller'
import { AuthService } from '../src/modules/auth/auth.service'
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy'
import { LocalStrategy } from '../src/modules/auth/strategies/local.strategy'
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard'
import { PrismaService } from '../src/common/prisma/prisma.service'
import { EmailService } from '../src/common/email/email.service'
import { RedisTokenService } from '../src/common/redis/redis-token.service'

// ── Module-level mocks ────────────────────────────────────────────────────────

vi.mock('argon2', () => ({
  hash: vi.fn().mockResolvedValue('$argon2id$hashed'),
  verify: vi.fn().mockResolvedValue(true),
  argon2id: 2,
}))

vi.mock('otplib', () => ({
  authenticator: {
    generateSecret: vi.fn().mockReturnValue('TOTP_SECRET_32'),
    keyuri: vi.fn().mockReturnValue('otpauth://totp/NourPlay:test%40example.com?secret=TOTP_SECRET_32'),
    verify: vi.fn().mockReturnValue(true),
  },
}))

vi.mock('qrcode', () => ({
  toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,iVBORfake'),
}))

// ── Shared state ──────────────────────────────────────────────────────────────

const TEST_JWT_SECRET = 'e2e-test-jwt-secret-32-chars-ok!!'

/** Simulates Redis for token operations */
const tokenStore = new Map<string, string>()
/** Simulates Prisma in-memory state for users */
const usersDb = new Map<string, any>()
/** Simulates RefreshToken table */
const refreshTokensDb = new Map<string, any>()

// ── Mock factories ────────────────────────────────────────────────────────────

function buildMockPrisma() {
  return {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  }
}

function buildMockEmailService() {
  return {
    sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  }
}

function buildMockTokenService() {
  return {
    createEmailVerificationToken: vi.fn((userId: string) => {
      const token = `verify_${userId}`
      tokenStore.set(`email_verify:${token}`, userId)
      return Promise.resolve(token)
    }),
    consumeEmailVerificationToken: vi.fn((token: string) => {
      const key = `email_verify:${token}`
      const userId = tokenStore.get(key) ?? null
      if (userId) tokenStore.delete(key)
      return Promise.resolve(userId)
    }),
    createPasswordResetToken: vi.fn((userId: string) => {
      const token = `reset_${userId}`
      tokenStore.set(`pwd_reset:${token}`, userId)
      return Promise.resolve(token)
    }),
    consumePasswordResetToken: vi.fn((token: string) => {
      const key = `pwd_reset:${token}`
      const userId = tokenStore.get(key) ?? null
      if (userId) tokenStore.delete(key)
      return Promise.resolve(userId)
    }),
    redis: {
      setex: vi.fn((key: string, _ttl: number, value: string) => {
        tokenStore.set(key, value)
        return Promise.resolve('OK')
      }),
      get: vi.fn((key: string) => Promise.resolve(tokenStore.get(key) ?? null)),
      del: vi.fn((key: string) => {
        tokenStore.delete(key)
        return Promise.resolve(1)
      }),
    },
  }
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('Auth — integration (Supertest)', () => {
  let app: INestApplication
  let jwtService: JwtService
  let mockPrisma: ReturnType<typeof buildMockPrisma>
  let mockEmail: ReturnType<typeof buildMockEmailService>
  let mockTokens: ReturnType<typeof buildMockTokenService>

  const TEST_USER = {
    id: 'user-uuid-1',
    email: 'parent@example.com',
    role: 'PARENT',
    passwordHash: '$argon2id$hashed',
    emailVerified: true,
    twoFactorEnabled: false,
    twoFactorSecret: null,
    deletedAt: null,
    locale: 'fr',
  }

  beforeAll(async () => {
    mockPrisma = buildMockPrisma()
    mockEmail = buildMockEmailService()
    mockTokens = buildMockTokenService()

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({
            jwt: { accessSecret: TEST_JWT_SECRET, accessTtl: 900, refreshTtl: 604800 },
            APP_URL: 'http://localhost:3000',
            TOTP_APP_NAME: 'NourPlay',
            GOOGLE_CLIENT_ID: 'test-client-id',
            GOOGLE_CLIENT_SECRET: 'test-client-secret',
            GOOGLE_CALLBACK_URL: 'http://localhost:4000/api/v1/auth/google/callback',
          })],
        }),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: TEST_JWT_SECRET,
          signOptions: { expiresIn: '15m' },
        }),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtStrategy,
        LocalStrategy,
        // Stub GoogleStrategy — OAuth20 instantiation requires live credentials
        { provide: 'GoogleStrategy', useValue: {} },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EmailService, useValue: mockEmail },
        { provide: RedisTokenService, useValue: mockTokens },
      ],
    }).compile()

    app = module.createNestApplication()
    app.use(cookieParser())
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }))
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
    app.setGlobalPrefix('api')
    await app.init()

    jwtService = module.get(JwtService)
  })

  afterAll(async () => {
    await app?.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    tokenStore.clear()
    usersDb.clear()
    refreshTokensDb.clear()
    // Restore token service mock implementations after vi.clearAllMocks
    mockTokens.createEmailVerificationToken.mockImplementation((userId: string) => {
      const token = `verify_${userId}`
      tokenStore.set(`email_verify:${token}`, userId)
      return Promise.resolve(token)
    })
    mockTokens.consumeEmailVerificationToken.mockImplementation((token: string) => {
      const key = `email_verify:${token}`
      const userId = tokenStore.get(key) ?? null
      if (userId) tokenStore.delete(key)
      return Promise.resolve(userId)
    })
    mockTokens.createPasswordResetToken.mockImplementation((userId: string) => {
      const token = `reset_${userId}`
      tokenStore.set(`pwd_reset:${token}`, userId)
      return Promise.resolve(token)
    })
    mockTokens.consumePasswordResetToken.mockImplementation((token: string) => {
      const key = `pwd_reset:${token}`
      const userId = tokenStore.get(key) ?? null
      if (userId) tokenStore.delete(key)
      return Promise.resolve(userId)
    })
    mockTokens.redis.setex.mockImplementation((key: string, _ttl: number, value: string) => {
      tokenStore.set(key, value)
      return Promise.resolve('OK')
    })
    mockTokens.redis.get.mockImplementation((key: string) => Promise.resolve(tokenStore.get(key) ?? null))
    mockTokens.redis.del.mockImplementation((key: string) => {
      tokenStore.delete(key)
      return Promise.resolve(1)
    })
    mockPrisma.refreshToken.create.mockResolvedValue({})
    mockPrisma.refreshToken.update.mockResolvedValue({})
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 })
    // JwtStrategy.validate — return user by default
    mockPrisma.user.findUnique.mockResolvedValue(TEST_USER)
  })

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const validBearerToken = () =>
    jwtService.sign({ sub: TEST_USER.id, email: TEST_USER.email, role: TEST_USER.role })

  // ── POST /api/v1/auth/register ──────────────────────────────────────────────

  describe('POST /api/v1/auth/register', () => {
    it('201: crée un compte et retourne les données sans hash', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null) // aucun doublon
      mockPrisma.user.create.mockResolvedValue({
        id: TEST_USER.id, email: TEST_USER.email,
        role: 'PARENT', locale: 'fr', createdAt: new Date(),
      })

      const res = await supertest(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'parent@example.com', password: 'StrongPass1!', role: 'PARENT', locale: 'fr' })
        .expect(201)

      expect(res.body.email).toBe('parent@example.com')
      expect(res.body).not.toHaveProperty('passwordHash')
      expect(mockEmail.sendVerificationEmail).toHaveBeenCalledOnce()
    })

    it('409: email déjà utilisé', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'existing' })

      await supertest(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'parent@example.com', password: 'StrongPass1!', role: 'PARENT', locale: 'fr' })
        .expect(409)
    })

    it('400: email manquant', async () => {
      await supertest(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ password: 'StrongPass1!', role: 'PARENT' })
        .expect(400)
    })

    it('400: role invalide', async () => {
      await supertest(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'test@example.com', password: 'StrongPass1!', role: 'ADMIN' })
        .expect(400)
    })
  })

  // ── POST /api/v1/auth/verify-email ──────────────────────────────────────────

  describe('POST /api/v1/auth/verify-email', () => {
    it('200: vérifie l\'email avec un token valide', async () => {
      // Simule un token créé lors du register
      tokenStore.set(`email_verify:verify_${TEST_USER.id}`, TEST_USER.id)
      mockPrisma.user.update.mockResolvedValue({})

      const res = await supertest(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .send({ token: `verify_${TEST_USER.id}` })
        .expect(200)

      expect(res.body).toEqual({ verified: true })
    })

    it('400: token invalide ou expiré', async () => {
      await supertest(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .send({ token: 'invalid-token-xyz' })
        .expect(400)
    })
  })

  // ── POST /api/v1/auth/login ─────────────────────────────────────────────────

  describe('POST /api/v1/auth/login', () => {
    it('200: retourne accessToken + cookie refresh_token', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(TEST_USER) // LocalStrategy.validate
      mockPrisma.refreshToken.create.mockResolvedValue({})

      const res = await supertest(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'parent@example.com', password: 'StrongPass1!' })
        .expect(200)

      expect(res.body).toHaveProperty('accessToken')
      expect(res.headers['set-cookie']).toBeDefined()
      const cookie = res.headers['set-cookie'] as unknown as string[]
      expect(cookie.some((c: string) => c.startsWith('refresh_token='))).toBe(true)
    })

    it('401: credentials incorrects', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      await supertest(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'parent@example.com', password: 'WrongPass' })
        .expect(401)
    })

    it('200: retourne requiresTwoFactor si 2FA activée', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        ...TEST_USER, twoFactorEnabled: true,
      })

      const res = await supertest(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'parent@example.com', password: 'StrongPass1!' })
        .expect(200)

      expect(res.body).toEqual({ requiresTwoFactor: true, userId: TEST_USER.id })
    })

    it('400: email manquant', async () => {
      await supertest(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ password: 'StrongPass1!' })
        .expect(400)
    })
  })

  // ── POST /api/v1/auth/refresh ───────────────────────────────────────────────

  describe('POST /api/v1/auth/refresh', () => {
    it('200: rafraîchit les tokens et retourne un nouveau cookie', async () => {
      const rawToken = 'a'.repeat(96)
      const tokenHash = createHash('sha256').update(rawToken).digest('hex')

      mockPrisma.refreshToken.findUnique.mockResolvedValueOnce({
        id: 'rt-1',
        userId: TEST_USER.id,
        tokenHash,
        fingerprint: service_fingerprint(),
        revokedAt: null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        user: { id: TEST_USER.id, email: TEST_USER.email, role: TEST_USER.role, deletedAt: null },
      })

      const res = await supertest(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', `refresh_token=${rawToken}`)
        .expect(200)

      expect(res.body).toHaveProperty('accessToken')
      const cookie = res.headers['set-cookie'] as unknown as string[]
      expect(cookie.some((c: string) => c.startsWith('refresh_token='))).toBe(true)
    })

    it('401: pas de cookie refresh_token', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValueOnce(null)

      await supertest(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .expect(401)
    })
  })

  // ── POST /api/v1/auth/logout ────────────────────────────────────────────────

  describe('POST /api/v1/auth/logout', () => {
    it('204: déconnecte et efface le cookie', async () => {
      const rawToken = 'b'.repeat(96)
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 })

      const res = await supertest(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${validBearerToken()}`)
        .set('Cookie', `refresh_token=${rawToken}`)
        .expect(204)

      const cookie = res.headers['set-cookie'] as unknown as string[] | undefined
      if (cookie) {
        expect(cookie.some((c: string) => c.includes('refresh_token=;'))).toBe(true)
      }
    })

    it('401: sans JWT', async () => {
      await supertest(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .expect(401)
    })
  })

  // ── POST /api/v1/auth/forgot-password ──────────────────────────────────────

  describe('POST /api/v1/auth/forgot-password', () => {
    it('204: envoie un email si l\'utilisateur existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: TEST_USER.id, locale: 'fr' })

      await supertest(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'parent@example.com' })
        .expect(204)

      expect(mockEmail.sendPasswordResetEmail).toHaveBeenCalledOnce()
    })

    it('204: ne révèle pas l\'inexistence de l\'email (anti-énumération)', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      await supertest(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'ghost@example.com' })
        .expect(204)

      expect(mockEmail.sendPasswordResetEmail).not.toHaveBeenCalled()
    })

    it('400: email invalide', async () => {
      await supertest(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'not-an-email' })
        .expect(400)
    })
  })

  // ── POST /api/v1/auth/reset-password ───────────────────────────────────────

  describe('POST /api/v1/auth/reset-password', () => {
    it('200: réinitialise le mot de passe avec un token valide', async () => {
      tokenStore.set(`pwd_reset:reset_${TEST_USER.id}`, TEST_USER.id)
      mockPrisma.user.update.mockResolvedValue({})
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 0 })

      const res = await supertest(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({ token: `reset_${TEST_USER.id}`, password: 'NewPassword1!' })
        .expect(200)

      expect(res.body).toEqual({ reset: true })
    })

    it('400: token invalide', async () => {
      await supertest(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({ token: 'bad-token', password: 'NewPassword1!' })
        .expect(400)
    })
  })

  // ── POST /api/v1/auth/2fa/init ──────────────────────────────────────────────

  describe('POST /api/v1/auth/2fa/init', () => {
    it('200: retourne secret + qrCode pour un utilisateur sans 2FA', async () => {
      mockPrisma.user.findUnique.mockImplementation((args: any) => {
        // JwtStrategy.validate or initTotp lookup
        if (args?.where?.id === TEST_USER.id) {
          return Promise.resolve({ ...TEST_USER, twoFactorEnabled: false })
        }
        return Promise.resolve(null)
      })

      const res = await supertest(app.getHttpServer())
        .post('/api/v1/auth/2fa/init')
        .set('Authorization', `Bearer ${validBearerToken()}`)
        .expect(201)

      expect(res.body).toHaveProperty('secret')
      expect(res.body).toHaveProperty('qrCode')
      expect(res.body).toHaveProperty('otpauth')
    })

    it('401: non authentifié', async () => {
      await supertest(app.getHttpServer())
        .post('/api/v1/auth/2fa/init')
        .expect(401)
    })
  })
})

// ── Utility ───────────────────────────────────────────────────────────────────

/** Returns the fingerprint that the server computes for localhost requests in tests. */
function service_fingerprint(): string {
  // In tests, req.ip is undefined/empty, user-agent is supertest default
  // The AuthService.buildFingerprint hashes `<ipSubnet>|<userAgent>`
  const { createHash } = require('crypto')
  const ip = ''
  const ua = ''
  const ipSubnet = ip.split('.').slice(0, 3).join('.')
  return createHash('sha256').update(`${ipSubnet}|${ua}`).digest('hex')
}
