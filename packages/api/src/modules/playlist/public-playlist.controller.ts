import { Controller, Get, Param } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { PlaylistService } from './playlist.service'

@ApiTags('Playlists')
@Controller({ path: 'playlists', version: '1' })
export class PublicPlaylistController {
  constructor(private readonly playlistService: PlaylistService) {}

  @Get('shared/:token')
  @ApiOperation({ summary: 'Accéder à une playlist via lien de partage public (sans authentification)' })
  findByShareToken(@Param('token') token: string) {
    return this.playlistService.findByShareToken(token)
  }
}
