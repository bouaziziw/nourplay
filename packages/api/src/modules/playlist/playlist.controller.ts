import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  ParseUUIDPipe, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import { PlaylistService } from './playlist.service'
import { CreatePlaylistDto } from './dto/create-playlist.dto'
import { UpdatePlaylistDto } from './dto/update-playlist.dto'
import { AddVideoDto } from './dto/add-video.dto'
import { ReorderVideosDto } from './dto/reorder-videos.dto'
import { SharePlaylistDto } from './dto/share-playlist.dto'

@ApiTags('Playlists')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'playlists', version: '1' })
export class PlaylistController {
  constructor(private readonly playlistService: PlaylistService) {}

  @Get()
  @ApiOperation({ summary: 'Liste des playlists du compte' })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.playlistService.findAll(user.sub)
  }

  @Post()
  @ApiOperation({ summary: 'Créer une playlist' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreatePlaylistDto) {
    return this.playlistService.create(user.sub, dto)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'une playlist avec ses vidéos' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.playlistService.findOne(user.sub, id)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour une playlist' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlaylistDto,
  ) {
    return this.playlistService.update(user.sub, id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer une playlist' })
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.playlistService.remove(user.sub, id)
  }

  @Post(':id/videos')
  @ApiOperation({ summary: 'Ajouter une vidéo à la playlist' })
  addVideo(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddVideoDto,
  ) {
    return this.playlistService.addVideo(user.sub, id, dto)
  }

  @Delete(':id/videos/:videoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Retirer une vidéo de la playlist' })
  removeVideo(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('videoId', ParseUUIDPipe) videoId: string,
  ) {
    return this.playlistService.removeVideo(user.sub, id, videoId)
  }

  @Patch(':id/videos/reorder')
  @ApiOperation({ summary: 'Réordonner les vidéos de la playlist' })
  reorder(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReorderVideosDto,
  ) {
    return this.playlistService.reorderVideos(user.sub, id, dto)
  }

  @Post(':id/share')
  @ApiOperation({ summary: 'Partager la playlist avec un utilisateur' })
  share(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SharePlaylistDto,
  ) {
    return this.playlistService.share(user.sub, id, dto)
  }

  @Delete(':id/share/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Révoquer l\'accès d\'un utilisateur' })
  revokeShare(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
  ) {
    return this.playlistService.revokeShare(user.sub, id, targetUserId)
  }

  @Post(':id/share-link')
  @ApiOperation({ summary: 'Générer un lien de partage public' })
  generateShareLink(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.playlistService.generateShareLink(user.sub, id)
  }
}
