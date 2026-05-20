import { Global, Module } from '@nestjs/common'
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
        const redisUrl = config.get<string>('redis.url', 'redis://localhost:6379')
        return new Redis(redisUrl, { maxRetriesPerRequest: null, lazyConnect: true })
      },
    },
    {
      provide: VIDEO_VALIDATION_QUEUE,
      inject: [REDIS_CLIENT],
      useFactory: (connection: Redis) =>
        new Queue(QUEUE_NAME_VIDEO_VALIDATION, { connection }),
    },
  ],
  exports: [REDIS_CLIENT, VIDEO_VALIDATION_QUEUE],
})
export class BullModule {}
