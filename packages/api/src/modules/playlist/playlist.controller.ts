import { Controller, Get, UseGuards, Version } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { PlaylistService } from './playlist.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'

@ApiTags('Playlists')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'playlists', version: '1' })
export class PlaylistController {
  constructor(private readonly playlistService: PlaylistService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.playlistService.findAll(user.sub)
  }
}
