import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
import { ScheduleModule } from '@nestjs/schedule'
import { PrismaModule } from './common/prisma/prisma.module'
import { BullModule } from './common/bull/bull.module'
import { GdprModule } from './modules/gdpr/gdpr.module'
import { AuthModule } from './modules/auth/auth.module'
import { UserModule } from './modules/user/user.module'
import { PlaylistModule } from './modules/playlist/playlist.module'
import { VideoModule } from './modules/video/video.module'
import { ConsentModule } from './modules/consent/consent.module'
import { ModerationModule } from './modules/moderation/moderation.module'
import { AdminModule } from './modules/admin/admin.module'
import { NotificationModule } from './modules/notification/notification.module'
import { appConfig, validateConfig } from './config/app.config'

@Module({
  imports: [
    // ── Config ──────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      validate: validateConfig,
      cache: true,
    }),

    // ── Rate limiting global ─────────────────────────────────────
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('RATE_LIMIT_TTL', 60) * 1000,
          limit: config.get<number>('RATE_LIMIT_MAX', 100),
        },
      ],
    }),

    // ── Tâches planifiées ────────────────────────────────────────
    ScheduleModule.forRoot(),

    // ── Infra partagée ───────────────────────────────────────────
    PrismaModule,
    BullModule,

    // ── Modules fonctionnels ─────────────────────────────────────
    AuthModule,
    UserModule,
    PlaylistModule,
    VideoModule,
    ConsentModule,
    ModerationModule,
    AdminModule,
    NotificationModule,
    GdprModule,
  ],
})
export class AppModule {}
