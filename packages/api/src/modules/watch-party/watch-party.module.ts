import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { PrismaModule } from '../../common/prisma/prisma.module'
import { WatchPartyGateway } from './watch-party.gateway'
import { WatchPartyService } from './watch-party.service'
import { WatchPartyController } from './watch-party.controller'

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.accessSecret'),
      }),
    }),
  ],
  controllers: [WatchPartyController],
  providers: [WatchPartyGateway, WatchPartyService],
})
export class WatchPartyModule {}
