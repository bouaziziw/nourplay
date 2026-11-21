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
  const rawCorsOrigins = config.get<string>('CORS_ORIGINS', 'http://localhost:3000')
  const configuredOrigins = rawCorsOrigins
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean)

  const isAllowedOrigin = (origin: string): boolean => {
    const cleanOrigin = origin.replace(/\/$/, '')

    // 1. Exact match in configured CORS_ORIGINS
    if (configuredOrigins.includes(cleanOrigin)) return true

    // 2. Localhost for dev / staging
    if (/^https?:\/\/localhost(:\d+)?$/.test(cleanOrigin)) return true

    // 3. Known production & staging domains
    if (
      cleanOrigin === 'https://nour-play.app' ||
      cleanOrigin === 'https://www.nour-play.app' ||
      cleanOrigin === 'https://nourplay.vercel.app'
    ) {
      return true
    }

    // 4. Any Vercel deployment for Nourplay (preview branches, PRs, hashes)
    if (
      /^https:\/\/nourplay(-[a-zA-Z0-9_-]+)?\.vercel\.app$/.test(cleanOrigin) ||
      /^https:\/\/nourplay-admin(-[a-zA-Z0-9_-]+)?\.vercel\.app$/.test(cleanOrigin) ||
      /^https:\/\/[a-zA-Z0-9_-]+-bouaziziws-projects\.vercel\.app$/.test(cleanOrigin)
    ) {
      return true
    }

    return false
  }

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
    origin: (origin, callback) => {
      // Allow non-browser requests (server-to-server, curl, mobile native app)
      if (!origin) {
        return callback(null, true)
      }
      if (isAllowedOrigin(origin)) {
        return callback(null, true)
      }
      logger.warn(`CORS blocked for origin: ${origin}`)
      return callback(null, false)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cookie'],
  })
  logger.log(`CORS configured for: ${configuredOrigins.join(', ')} and *.vercel.app`)

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
