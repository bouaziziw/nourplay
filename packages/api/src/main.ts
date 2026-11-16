import { NestFactory } from '@nestjs/core'
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { ConfigService } from '@nestjs/config'
import { IoAdapter } from '@nestjs/platform-socket.io'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { AppModule } from './app.module'

async function bootstrap() {
  const logger = new Logger('Bootstrap')

  const app = await NestFactory.create(AppModule, {
    logger: process.env.VERCEL ? ['error', 'warn', 'log'] : ['error', 'warn', 'log', 'debug'],
    rawBody: true,
  })

  app.useWebSocketAdapter(new IoAdapter(app))

  const config = app.get(ConfigService)
  const nodeEnv = config.get<string>('NODE_ENV', 'development')
  const port = config.get<number>('PORT', 4000)
  const corsOrigins = config
    .get<string>('CORS_ORIGINS', 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())

  // ── Vercel Info ───────────────────────────────────────────────
  if (process.env.VERCEL) {
    logger.log(`🚀 Running on Vercel`)
    logger.log(`📍 Region: ${process.env.VERCEL_REGION || 'unknown'}`)
    logger.log(`🔗 Deployment URL: ${process.env.VERCEL_DEPLOYMENT_URL || 'unknown'}`)
  }

  // ── Sécurité ──────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          frameSrc: [
            "'self'",
            'https://www.youtube.com',
            'https://player.vimeo.com',
            'https://www.dailymotion.com',
          ],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
    }),
  )
  app.use(cookieParser(config.get<string>('COOKIE_SECRET')))

  // ── CORS ──────────────────────────────────────────────────────
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
  logger.debug(`CORS configured for origins: ${corsOrigins.join(', ')}`)

  // ── Validation globale ────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  // ── Versioning API ────────────────────────────────────────────
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
  app.setGlobalPrefix('api')

  // ── Swagger (dev/staging uniquement) ─────────────────────────
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('NourPlay API')
      .setDescription('API de la plateforme de curation vidéo NourPlay')
      .setVersion('1.0')
      .addBearerAuth()
      .addCookieAuth('refresh_token')
      .build()
    const document = SwaggerModule.createDocument(app, swaggerConfig)
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    })
    logger.log(`📚 Swagger docs available at /api/docs`)
  }

  // ── Graceful Shutdown ─────────────────────────────────────────
  process.on('SIGTERM', async () => {
    logger.warn('SIGTERM received, shutting down gracefully...')
    await app.close()
    process.exit(0)
  })

  await app.listen(port)
  logger.log(`✅ NourPlay API running on http://localhost:${port}/api`)
  logger.log(`🔐 Environment: ${nodeEnv}`)
  logger.log(`⏱️  Uptime tracking enabled at /api/v1/health`)
}

bootstrap().catch((error) => {
  console.error('❌ Failed to bootstrap application:', error)
  process.exit(1)
})
