import { Controller, Get, Param, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { VideoService } from './video.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'

@ApiTags('Videos')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'videos', version: '1' })
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.videoService.findById(id)
  }
}
