import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  ParseUUIDPipe, UseGuards, HttpCode, HttpStatus, Res,
} from '@nestjs/common'
import { Response } from 'express'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import { PlaylistService } from './playlist.service'
import { CreatePlaylistDto } from './dto/create-playlist.dto'
import { UpdatePlaylistDto } from './dto/update-playlist.dto'
import { AddVideoDto } from './dto/add-video.dto'
import { ReorderVideosDto } from './dto/reorder-videos.dto'
import { SharePlaylistDto } from './dto/share-playlist.dto'
import { SchedulePlaylistDto } from './dto/schedule-playlist.dto'

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

  @Get('scheduled')
  @ApiOperation({ summary: 'Calendrier de publication (admin/modérateur)' })
  findScheduled(@CurrentUser() user: JwtPayload) {
    return this.playlistService.findScheduled(user.role)
  }

  @Patch(':id/schedule')
  @ApiOperation({ summary: 'Planifier la publication automatique d\'une playlist' })
  schedule(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SchedulePlaylistDto,
  ) {
    return this.playlistService.schedule(user.sub, id, dto)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'une playlist avec ses vidéos' })
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('profileId') profileId?: string,
  ) {
    return this.playlistService.findOne(user.sub, id, profileId)
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

  @Get(':id/export')
  @ApiOperation({ summary: 'Exporter la playlist en CSV' })
  async exportCsv(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const csv = await this.playlistService.exportCsv(user.sub, id)
    const date = new Date().toISOString().slice(0, 10)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="playlist-${id}-${date}.csv"`)
    res.send(csv)
  }

  @Post(':id/duplicate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Dupliquer une playlist' })
  duplicate(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.playlistService.duplicatePlaylist(user.sub, id)
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
