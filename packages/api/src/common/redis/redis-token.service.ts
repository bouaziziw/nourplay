import { Injectable, Inject } from '@nestjs/common'
import { Redis } from 'ioredis'
import { randomBytes } from 'crypto'
import { REDIS_CLIENT } from '../bull/bull.module'

const TTL = {
  EMAIL_VERIFY: 60 * 60 * 24,      // 24h
  PASSWORD_RESET: 60 * 60,          // 1h
  MAGIC_LINK: 60 * 15,              // 15min
}

@Injectable()
export class RedisTokenService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async createEmailVerificationToken(userId: string): Promise<string> {
    const token = randomBytes(32).toString('hex')
    await this.redis.setex(`email_verify:${token}`, TTL.EMAIL_VERIFY, userId)
    return token
  }

  async consumeEmailVerificationToken(token: string): Promise<string | null> {
    const key = `email_verify:${token}`
    const userId = await this.redis.get(key)
    if (userId) await this.redis.del(key)
    return userId
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
