import { Injectable, Inject } from '@nestjs/common'
import { Redis } from 'ioredis'
import { REDIS_CLIENT } from '../bull/bull.module'

@Injectable()
export class CacheService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key)
      if (raw === null) return null
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(value))
    } catch {
      // Ignoré en cas d'erreur Redis
    }
  }

  async del(...keys: string[]): Promise<void> {
    try {
      if (keys.length > 0) await this.redis.del(...keys)
    } catch {
      // Ignoré en cas d'erreur Redis
    }
  }
}
