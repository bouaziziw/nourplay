import { Global, Logger, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Queue } from 'bullmq'
import { Redis } from 'ioredis'

export const REDIS_CLIENT = 'REDIS_CLIENT'
export const VIDEO_VALIDATION_QUEUE = 'VIDEO_VALIDATION_QUEUE'
export const QUEUE_NAME_VIDEO_VALIDATION = 'video-validation'

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const logger = new Logger('BullModule')
        const redisUrl = config.get<string>('redis.url', 'redis://localhost:6379')
        const client = new Redis(redisUrl, {
          maxRetriesPerRequest: null,
          lazyConnect: true,
          retryStrategy: (times) => Math.min(times * 1000, 15000),
        })
        let lastLogged = 0
        client.on('error', (err) => {
          const now = Date.now()
          if (now - lastLogged > 15000) {
            lastLogged = now
            logger.warn(`Redis connection error: ${err.message}`)
          }
        })
        return client
      },
    },
    {
      provide: VIDEO_VALIDATION_QUEUE,
      inject: [REDIS_CLIENT],
      useFactory: (connection: Redis) => {
        const queue = new Queue(QUEUE_NAME_VIDEO_VALIDATION, { connection })
        queue.on('error', () => {
          // Handled via connection
        })
        return queue
      },
    },
  ],
  exports: [REDIS_CLIENT, VIDEO_VALIDATION_QUEUE],
})
export class BullModule {}
