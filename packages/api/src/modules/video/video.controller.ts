import {
  Controller, Get, Post, Patch, Delete, Body, Param, ParseUUIDPipe,
  UseGuards, Query, HttpCode, HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { IsBoolean, IsString, IsOptional, IsArray, IsUUID, IsEnum, IsNotEmpty, IsUrl, IsObject, MaxLength } from 'class-validator'
import { UserRole } from '@nourplay/db'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import { VideoService } from './video.service'
import { SubmitVideoDto } from './dto/submit-video.dto'

class BulkUpdateStatusDto {
  @IsArray() @IsUUID('4', { each: true }) ids: string[]
  @IsEnum(['APPROVE', 'REJECT']) action: 'APPROVE' | 'REJECT'
  @IsOptional() @IsString() rejectionReason?: string
}

class CreateSourceDto {
  @IsString() @IsNotEmpty() name: string
  @IsString() @IsNotEmpty() slug: string
  @IsString() @IsNotEmpty() baseUrl: string
  @IsOptional() @IsBoolean() embedAllowed?: boolean
  @IsOptional() @IsString() cguVersion?: string
  @IsOptional() @IsObject() embedPolicy?: Record<string, unknown>
}

class UpdateSourceDto {
  @IsOptional() @IsBoolean() embedAllowed?: boolean
  @IsOptional() @IsBoolean() isActive?: boolean
  @IsOptional() @IsString() cguVersion?: string
  @IsOptional() @IsUrl() baseUrl?: string
  @IsOptional() embedPolicy?: Record<string, unknown> | null
}

class ReportVideoDto {
  @IsString() reason: string
  @IsOptional() @IsString() description?: string
}

class UpdateOwnSubmissionDto {
  @IsString() @IsNotEmpty() @MaxLength(200) title: string
}

@ApiTags('Vidéos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'videos', version: '1' })
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  // ── Admin ────────────────────────────────────────────────────

  @Get('admin/queue')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: '[Admin] File de modération des vidéos' })
  @ApiQuery({ name: 'status', required: false, enum: ['ALL', 'PENDING', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED'] })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  adminQueue(
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.videoService.adminListVideos({ status, q, page: +page, limit: +limit })
  }

  @Patch('admin/bulk')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Approuver / rejeter plusieurs vidéos en masse' })
  bulkUpdateStatus(@Body() dto: BulkUpdateStatusDto) {
    return this.videoService.bulkUpdateStatus(dto.ids, dto.action, dto.rejectionReason)
  }

  @Post('admin/revalidate-pending')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Relancer en priorité la validation automatique des vidéos en attente' })
  revalidateAllPending() {
    return this.videoService.revalidateAllPending()
  }

  @Delete('admin/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Supprimer définitivement une vidéo' })
  deleteAsAdmin(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.videoService.deleteVideoAsAdmin(user.sub, user.role, id)
  }

  // ── Sources vidéo ─────────────────────────────────────────────

  @Get('sources')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: '[Admin] Liste des sources vidéo' })
  listSources() {
    return this.videoService.listSources()
  }

  @Post('sources')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[Admin] Créer une source vidéo' })
  createSource(@Body() dto: CreateSourceDto) {
    return this.videoService.createSource(dto)
  }

  @Patch('sources/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Modifier une source vidéo (embedAllowed, isActive, cguVersion…)' })
  updateSource(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSourceDto,
  ) {
    return this.videoService.updateSource(id, dto)
  }

  @Post('sources/:id/verify')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Enregistrer une vérification manuelle des CGU d\'une source' })
  verifySource(@Param('id', ParseUUIDPipe) id: string) {
    return this.videoService.verifySource(id)
  }

  // ── Public / User ────────────────────────────────────────────

  @Patch('playlists/:playlistId/submissions/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PARENT, UserRole.TEACHER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Envoyer en validation toutes les vidéos en attente de sa playlist' })
  approvePlaylistSubmissions(
    @CurrentUser() user: JwtPayload,
    @Param('playlistId', ParseUUIDPipe) playlistId: string,
  ) {
    return this.videoService.approvePlaylistSubmissions(user.sub, user.role, playlistId)
  }

  @Post()
  @ApiOperation({ summary: 'Soumettre une vidéo pour validation' })
  submit(@CurrentUser() user: JwtPayload, @Body() dto: SubmitVideoDto) {
    return this.videoService.submit(user.sub, dto)
  }

  @Get('submissions')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PARENT, UserRole.TEACHER)
  @ApiOperation({ summary: 'Liste des vidéos soumises par l’utilisateur connecté' })
  listMySubmissions(@CurrentUser() user: JwtPayload) {
    return this.videoService.listMySubmissions(user.sub)
  }

  @Patch('submissions/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PARENT, UserRole.TEACHER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Modifier le titre de sa vidéo avant son approbation' })
  updateOwnSubmission(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOwnSubmissionDto,
  ) {
    return this.videoService.updateOwnSubmission(user.sub, id, dto.title)
  }

  @Patch(':id/submitter-approval')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PARENT, UserRole.TEACHER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approuver son ajout et lancer la validation automatique' })
  approveSubmission(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.videoService.approveSubmission(user.sub, user.role, id)
  }

  @Get('tags')
  @ApiOperation({ summary: 'Liste des tags disponibles' })
  listTags() {
    return this.videoService.listTags()
  }

  @Get('autocomplete')
  @ApiOperation({ summary: 'Suggestions de titres pour la recherche' })
  @ApiQuery({ name: 'q', required: true })
  autocomplete(@Query('q') q = '', @Query('limit') limit = 6) {
    return this.videoService.autocomplete(q, +limit)
  }

  @Get('search')
  @ApiOperation({ summary: 'Rechercher des vidéos approuvées' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'language', required: false })
  @ApiQuery({ name: 'ageRating', required: false })
  @ApiQuery({ name: 'source', required: false })
  @ApiQuery({ name: 'tags', required: false, description: 'IDs séparés par virgule' })
  @ApiQuery({ name: 'profileId', required: false, description: 'Filtre par tranche d\'âge du profil enfant' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  search(
    @CurrentUser() user: JwtPayload,
    @Query('q') q?: string,
    @Query('language') language?: string,
    @Query('ageRating') ageRating?: string,
    @Query('source') sourceSlug?: string,
    @Query('tags') tags?: string,
    @Query('profileId') profileId?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.videoService.search({
      q, language, ageRating, sourceSlug,
      tags: tags ? tags.split(',').filter(Boolean) : undefined,
      userId: user.sub,
      profileId,
      page: +page, limit: +limit,
    })
  }

  @Get(':id/similar')
  @ApiOperation({ summary: 'Vidéos similaires' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findSimilar(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit = 4,
  ) {
    return this.videoService.findSimilar(id, +limit)
  }

  @Get(':id/ratings')
  @ApiOperation({ summary: 'Aggregate pouce haut/bas pour une vidéo' })
  getRatings(@Param('id', ParseUUIDPipe) id: string) {
    return this.videoService.getRatingsSummary(id)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'une vidéo' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.videoService.findById(id)
  }

  @Post(':id/report')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Signaler une vidéo' })
  report(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportVideoDto,
  ) {
    return this.videoService.report(user.sub, id, dto.reason, dto.description)
  }
}
