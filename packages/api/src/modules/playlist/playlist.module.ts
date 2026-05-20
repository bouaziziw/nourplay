import { Module } from '@nestjs/common'
import { PlaylistController } from './playlist.controller'
import { PlaylistService } from './playlist.service'
import { PrismaService } from '../../common/prisma/prisma.service'

@Module({
  controllers: [PlaylistController],
  providers: [PlaylistService, PrismaService],
  exports: [PlaylistService],
})
export class PlaylistModule {}
