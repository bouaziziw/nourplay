import { Injectable, Inject, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Redis } from 'ioredis'
import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { REDIS_CLIENT } from '../bull/bull.module'

const TTL = {
  EMAIL_VERIFY: 60 * 60 * 24,      // 24h
  PASSWORD_RESET: 60 * 60,          // 1h
  MAGIC_LINK: 60 * 15,              // 15min
}

@Injectable()
export class RedisTokenService {
  private readonly logger = new Logger(RedisTokenService.name)
  private readonly secret: string

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {
    this.secret =
      this.config.get<string>('JWT_ACCESS_SECRET') ||
      this.config.get<string>('COOKIE_SECRET') ||
      'nourplay-fallback-signing-secret-32-chars'
  }

  private signFallbackToken(payload: { sub: string; type: string; exp: number }): string {
    const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
    const hmac = createHmac('sha256', this.secret).update(data).digest('base64url')
    return `np_${data}_${hmac}`
  }

  private verifyFallbackToken(token: string, expectedType: string): string | null {
    if (!token.startsWith('np_')) return null
    const parts = token.slice(3).split('_')
    if (parts.length !== 2) return null
    const [data, signature] = parts
    const expectedHmac = createHmac('sha256', this.secret).update(data).digest('base64url')
    try {
      if (signature.length !== expectedHmac.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedHmac))) {
        return null
      }
      const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as { sub: string; type: string; exp: number }
      if (parsed.type !== expectedType || typeof parsed.sub !== 'string' || typeof parsed.exp !== 'number') {
        return null
      }
      if (Date.now() > parsed.exp) {
        return null
      }
      return parsed.sub
    } catch {
      return null
    }
  }

  async createEmailVerificationToken(userId: string): Promise<string> {
    try {
      const token = randomBytes(32).toString('hex')
      await this.redis.setex(`email_verify:${token}`, TTL.EMAIL_VERIFY, userId)
      return token
    } catch (err) {
      this.logger.warn(`Redis indisponible pour createEmailVerificationToken, fallback signé utilisé: ${(err as Error).message}`)
      return this.signFallbackToken({ sub: userId, type: 'email_verify', exp: Date.now() + TTL.EMAIL_VERIFY * 1000 })
    }
  }

  async consumeEmailVerificationToken(token: string): Promise<string | null> {
    if (token.startsWith('np_')) {
      return this.verifyFallbackToken(token, 'email_verify')
    }

    try {
      const key = `email_verify:${token}`
      const userId = await this.redis.get(key)
      if (userId) await this.redis.del(key)
      return userId
    } catch (err) {
      this.logger.error(`Erreur Redis lors de consumeEmailVerificationToken: ${(err as Error).message}`)
      return null
    }
  }

  async createPasswordResetToken(userId: string): Promise<string> {
    const token = randomBytes(32).toString('hex')
    // Invalide les anciens tokens de reset
    const old = await this.redis.get(`pwd_reset_user:${userId}`)
    if (old) await this.redis.del(`pwd_reset:${old}`)

    await this.redis.setex(`pwd_reset:${token}`, TTL.PASSWORD_RESET, userId)
    await this.redis.setex(`pwd_reset_user:${userId}`, TTL.PASSWORD_RESET, token)
    return token
  }

  async consumePasswordResetToken(token: string): Promise<string | null> {
    const userId = await this.redis.get(`pwd_reset:${token}`)
    if (userId) {
      await this.redis.del(`pwd_reset:${token}`)
      await this.redis.del(`pwd_reset_user:${userId}`)
    }
    return userId
  }

  async createMagicLinkToken(email: string): Promise<string> {
    const token = randomBytes(32).toString('hex')
    await this.redis.setex(`magic_link:${token}`, TTL.MAGIC_LINK, email)
    return token
  }

  async consumeMagicLinkToken(token: string): Promise<string | null> {
    const key = `magic_link:${token}`
    const email = await this.redis.get(key)
    if (email) await this.redis.del(key)
    return email
  }
}
