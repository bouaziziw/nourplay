import { resolve } from 'node:path'
import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { ScheduleModule } from '@nestjs/schedule'
import { PrismaModule } from './common/prisma/prisma.module'
import { BullModule } from './common/bull/bull.module'
import { EmailModule } from './common/email/email.module'
import { RedisTokenModule } from './common/redis/redis-token.module'
import { CacheModule } from './common/cache/cache.module'
import { AuditModule } from './common/audit/audit.module'
import { GdprModule } from './modules/gdpr/gdpr.module'
import { AuthModule } from './modules/auth/auth.module'
import { UserModule } from './modules/user/user.module'
import { PlaylistModule } from './modules/playlist/playlist.module'
import { VideoModule } from './modules/video/video.module'
import { ConsentModule } from './modules/consent/consent.module'
import { ModerationModule } from './modules/moderation/moderation.module'
import { AdminModule } from './modules/admin/admin.module'
import { NotificationModule } from './modules/notification/notification.module'
import { LegalModule } from './modules/legal/legal.module'
import { SubscriptionModule } from './modules/subscription/subscription.module'
import { StorageModule } from './modules/storage/storage.module'
import { WatchPartyModule } from './modules/watch-party/watch-party.module'
import { appConfig, validateConfig } from './config/app.config'

@Module({
  imports: [
    // ── Config ──────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolve(__dirname, '../../../.env'),
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
    EmailModule,
    RedisTokenModule,
    CacheModule,
    AuditModule,

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
    LegalModule,
    SubscriptionModule,
    StorageModule,
    WatchPartyModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
