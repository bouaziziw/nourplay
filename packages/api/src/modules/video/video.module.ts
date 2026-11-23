import { Module } from '@nestjs/common'
import { VideoController } from './video.controller'
import { VideoService } from './video.service'
import { VideoValidationService } from './video-validation.service'

@Module({
  controllers: [VideoController],
  providers: [VideoService, VideoValidationService],
  exports: [VideoService, VideoValidationService],
})
export class VideoModule {}
