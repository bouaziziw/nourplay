import { Controller, Get, Inject } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../common/prisma/prisma.service'

interface HealthResponse {
  status: 'ok' | 'degraded'
  timestamp: string
  version: string
  uptime: number
  environment: string
  services: {
    database: 'ok' | 'error'
    redis: 'ok' | 'error'
  }
}

@SkipThrottle()
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: any,
  ) {}

  @Get()
  async health(): Promise<HealthResponse> {
    const startTime = process.uptime()
    const nodeEnv = this.config.get<string>('NODE_ENV', 'development')
    const deploymentId = process.env.VERCEL_DEPLOYMENT_ID || 'local'

    let dbStatus: 'ok' | 'error' = 'ok'
    let redisStatus: 'ok' | 'error' = 'ok'

    try {
      await this.prisma.$queryRaw`SELECT 1`
    } catch {
      dbStatus = 'error'
    }

    try {
      if (this.redis) {
        await this.redis.ping()
      }
    } catch {
      redisStatus = 'error'
    }

    const status = dbStatus === 'ok' && redisStatus === 'ok' ? 'ok' : 'degraded'

    return {
      status,
      timestamp: new Date().toISOString(),
      version: '1.0',
      uptime: startTime,
      environment: nodeEnv,
      services: {
        database: dbStatus,
        redis: redisStatus,
      },
    }
  }

  @Get('live')
  live() {
    return { status: 'alive', timestamp: new Date().toISOString() }
  }

  @Get('ready')
  async ready(): Promise<HealthResponse> {
    return this.health()
  }
}
