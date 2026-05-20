import { Module } from '@nestjs/common'
import { VideoController } from './video.controller'
import { VideoService } from './video.service'
import { PrismaService } from '../../common/prisma/prisma.service'

@Module({
  controllers: [VideoController],
  providers: [VideoService, PrismaService],
  exports: [VideoService],
})
export class VideoModule {}
