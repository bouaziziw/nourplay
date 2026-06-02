import { NestFactory } from '@nestjs/core'
import { ValidationPipe, VersioningType } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { ConfigService } from '@nestjs/config'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
    rawBody: true,
  })

  const config = app.get(ConfigService)
  const nodeEnv = config.get<string>('NODE_ENV', 'development')
  const port = config.get<number>('PORT', 4000)
  const corsOrigins = config.get<string>('CORS_ORIGINS', 'http://localhost:3000').split(',')

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
  }

  await app.listen(port)
  console.log(`NourPlay API running on http://localhost:${port}/api`)
  if (nodeEnv !== 'production') {
    console.log(`Swagger docs at http://localhost:${port}/api/docs`)
  }
}

bootstrap()
