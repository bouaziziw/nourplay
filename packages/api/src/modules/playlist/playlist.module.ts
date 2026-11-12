import { Module } from '@nestjs/common'
import { PlaylistController } from './playlist.controller'
import { PublicPlaylistController } from './public-playlist.controller'
import { PlaylistService } from './playlist.service'
import { PrismaService } from '../../common/prisma/prisma.service'
import { SubscriptionModule } from '../subscription/subscription.module'

@Module({
  imports: [SubscriptionModule],
  controllers: [PublicPlaylistController, PlaylistController],
  providers: [PlaylistService, PrismaService],
  exports: [PlaylistService],
})
export class PlaylistModule {}
