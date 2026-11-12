import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  Res,
} from '@nestjs/common'
import type { Response } from 'express'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import { UserService } from './user.service'
import { CreateProfileDto } from './dto/create-profile.dto'
import { UpdateProfileDto } from './dto/update-profile.dto'
import { VerifyPinDto } from './dto/verify-pin.dto'
import { ChangePinDto } from './dto/change-pin.dto'
import { RecordWatchDto } from './dto/record-watch.dto'

@ApiTags('Users & Profils')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'users', version: '1' })
export class UserController {
  constructor(private readonly userService: UserService) {}

  // ── Compte ────────────────────────────────────────────────────

  @Get('me')
  @ApiOperation({ summary: 'Profil du compte connecté' })
  getMe(@CurrentUser() user: JwtPayload) {
    return this.userService.findById(user.sub)
  }

  // ── Langue ───────────────────────────────────────────────────

  @Patch('me/locale')
  @ApiOperation({ summary: 'Mettre à jour la langue de l\'interface' })
  updateLocale(@CurrentUser() user: JwtPayload, @Body() body: { locale: string }) {
    return this.userService.updateLocale(user.sub, body.locale)
  }

  @Patch('me/digest')
  @ApiOperation({ summary: 'Activer ou désactiver le résumé hebdomadaire par email' })
  updateDigest(@CurrentUser() user: JwtPayload, @Body() body: { enabled: boolean }) {
    return this.userService.updateDigestPreference(user.sub, body.enabled)
  }

  // ── Limites du forfait ───────────────────────────────────────

  @Get('me/limits')
  @ApiOperation({ summary: 'Limites du forfait actuel (profils, playlists)' })
  getLimits(@CurrentUser() user: JwtPayload) {
    return this.userService.getMyLimits(user.sub)
  }

  // ── Profils enfants ──────────────────────────────────────────

  @Get('me/profiles')
  @ApiOperation({ summary: 'Liste des profils enfants du compte' })
  getProfiles(@CurrentUser() user: JwtPayload) {
    return this.userService.getProfiles(user.sub)
  }

  @Post('me/profiles')
  @ApiOperation({ summary: 'Créer un profil enfant' })
  createProfile(@CurrentUser() user: JwtPayload, @Body() dto: CreateProfileDto) {
    return this.userService.createProfile(user.sub, dto)
  }

  @Get('me/profiles/:profileId')
  @ApiOperation({ summary: 'Détail d\'un profil enfant' })
  @ApiParam({ name: 'profileId', type: 'string', format: 'uuid' })
  getProfile(
    @CurrentUser() user: JwtPayload,
    @Param('profileId', ParseUUIDPipe) profileId: string,
  ) {
    return this.userService.getProfile(user.sub, profileId)
  }

  @Patch('me/profiles/:profileId')
  @ApiOperation({ summary: 'Mettre à jour un profil enfant' })
  updateProfile(
    @CurrentUser() user: JwtPayload,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(user.sub, profileId, dto)
  }

  @Delete('me/profiles/:profileId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un profil enfant (soft delete)' })
  deleteProfile(
    @CurrentUser() user: JwtPayload,
    @Param('profileId', ParseUUIDPipe) profileId: string,
  ) {
    return this.userService.deleteProfile(user.sub, profileId)
  }

  @Post('me/profiles/:profileId/pin/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Vérifier le PIN d\'un profil enfant' })
  verifyPin(
    @CurrentUser() user: JwtPayload,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Body() dto: VerifyPinDto,
  ) {
    return this.userService.verifyPin(user.sub, profileId, dto.pin)
  }

  @Patch('me/profiles/:profileId/pin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Changer le PIN d\'un profil enfant' })
  changePin(
    @CurrentUser() user: JwtPayload,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Body() dto: ChangePinDto,
  ) {
    return this.userService.changePin(user.sub, profileId, dto.currentPin, dto.newPin)
  }

  @Get('me/profiles/:profileId/history/export')
  @ApiOperation({ summary: 'Export CSV de l\'historique de visionnage' })
  async exportHistory(
    @CurrentUser() user: JwtPayload,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Res() res: Response,
  ) {
    const csv = await this.userService.exportWatchHistoryCsv(user.sub, profileId)
    const date = new Date().toISOString().slice(0, 10)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="historique-${profileId}-${date}.csv"`)
    res.send(csv)
  }

  @Get('me/profiles/:profileId/history')
  @ApiOperation({ summary: 'Historique de visionnage d\'un profil' })
  getHistory(
    @CurrentUser() user: JwtPayload,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.userService.getWatchHistory(user.sub, profileId, Math.min(limit, 100))
  }

  @Post('me/profiles/:profileId/history')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Enregistrer un événement de visionnage' })
  recordWatch(
    @CurrentUser() user: JwtPayload,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Body() dto: RecordWatchDto,
  ) {
    return this.userService.recordWatchEvent(user.sub, profileId, dto)
  }

  @Delete('me/profiles/:profileId/history')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Effacer l\'historique d\'un profil (droit à l\'oubli)' })
  clearHistory(
    @CurrentUser() user: JwtPayload,
    @Param('profileId', ParseUUIDPipe) profileId: string,
  ) {
    return this.userService.clearWatchHistory(user.sub, profileId)
  }

  @Get('me/profiles/:profileId/analytics')
  @ApiOperation({ summary: 'Statistiques de visionnage d\'un profil (30 jours)' })
  getProfileAnalytics(
    @CurrentUser() user: JwtPayload,
    @Param('profileId', ParseUUIDPipe) profileId: string,
  ) {
    return this.userService.getProfileAnalytics(user.sub, profileId)
  }

  @Get('me/profiles/:profileId/daily-watch-time')
  @ApiOperation({ summary: 'Temps de visionnage du jour pour un profil enfant' })
  @ApiParam({ name: 'profileId', type: 'string', format: 'uuid' })
  getDailyWatchTime(
    @CurrentUser() user: JwtPayload,
    @Param('profileId', ParseUUIDPipe) profileId: string,
  ) {
    return this.userService.getDailyWatchTime(user.sub, profileId)
  }

  // ── Progression vidéo ────────────────────────────────────────

  @Get('me/profiles/:profileId/in-progress')
  @ApiOperation({ summary: 'Vidéos en cours pour un profil (non terminées, ≥ 10s)' })
  getInProgress(
    @CurrentUser() user: JwtPayload,
    @Param('profileId', ParseUUIDPipe) profileId: string,
  ) {
    return this.userService.getInProgressVideos(user.sub, profileId)
  }

  @Get('me/profiles/:profileId/progress/:videoId')
  @ApiOperation({ summary: 'Position de reprise d\'une vidéo' })
  getProgress(
    @CurrentUser() user: JwtPayload,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Param('videoId', ParseUUIDPipe) videoId: string,
  ) {
    return this.userService.getVideoProgress(user.sub, profileId, videoId)
  }

  @Put('me/profiles/:profileId/progress/:videoId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sauvegarder la position de lecture' })
  saveProgress(
    @CurrentUser() user: JwtPayload,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Param('videoId', ParseUUIDPipe) videoId: string,
    @Body() body: { positionSec: number },
  ) {
    return this.userService.upsertVideoProgress(user.sub, profileId, videoId, body.positionSec)
  }

  // ── Évaluations vidéo ────────────────────────────────────────

  @Get('me/profiles/:profileId/ratings')
  @ApiOperation({ summary: 'Toutes les évaluations d\'un profil enfant' })
  getProfileRatings(
    @CurrentUser() user: JwtPayload,
    @Param('profileId', ParseUUIDPipe) profileId: string,
  ) {
    return this.userService.getProfileRatings(user.sub, profileId)
  }

  @Get('me/profiles/:profileId/ratings/:videoId')
  @ApiOperation({ summary: 'Évaluation d\'un profil pour une vidéo' })
  getVideoRating(
    @CurrentUser() user: JwtPayload,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Param('videoId', ParseUUIDPipe) videoId: string,
  ) {
    return this.userService.getVideoRating(user.sub, profileId, videoId)
  }

  @Put('me/profiles/:profileId/ratings/:videoId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Évaluer une vidéo (pouce haut/bas, null = supprimer)' })
  rateVideo(
    @CurrentUser() user: JwtPayload,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Param('videoId', ParseUUIDPipe) videoId: string,
    @Body() body: { rating: 'THUMBS_UP' | 'THUMBS_DOWN' | null },
  ) {
    return this.userService.rateVideo(user.sub, profileId, videoId, body.rating)
  }

  // ── Favoris par profil enfant ────────────────────────────────

  @Get('me/profiles/:profileId/favorites')
  @ApiOperation({ summary: 'Vidéos en favoris d\'un profil enfant' })
  getFavorites(
    @CurrentUser() user: JwtPayload,
    @Param('profileId', ParseUUIDPipe) profileId: string,
  ) {
    return this.userService.getFavorites(user.sub, profileId)
  }

  @Post('me/profiles/:profileId/favorites/:videoId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Ajouter une vidéo aux favoris d\'un profil' })
  addFavorite(
    @CurrentUser() user: JwtPayload,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Param('videoId', ParseUUIDPipe) videoId: string,
  ) {
    return this.userService.addFavorite(user.sub, profileId, videoId)
  }

  @Delete('me/profiles/:profileId/favorites/:videoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Retirer une vidéo des favoris d\'un profil' })
  removeFavorite(
    @CurrentUser() user: JwtPayload,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Param('videoId', ParseUUIDPipe) videoId: string,
  ) {
    return this.userService.removeFavorite(user.sub, profileId, videoId)
  }

  // ── Limites par catégorie ────────────────────────────────────

  @Get('me/profiles/:profileId/category-limits')
  @ApiOperation({ summary: 'Liste des limites de temps par catégorie' })
  getCategoryLimits(
    @CurrentUser() user: JwtPayload,
    @Param('profileId', ParseUUIDPipe) profileId: string,
  ) {
    return this.userService.getCategoryLimits(user.sub, profileId)
  }

  @Put('me/profiles/:profileId/category-limits/:tagId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Définir ou modifier une limite journalière pour une catégorie' })
  upsertCategoryLimit(
    @CurrentUser() user: JwtPayload,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Param('tagId', ParseUUIDPipe) tagId: string,
    @Body() body: { dailyLimitMin: number },
  ) {
    return this.userService.upsertCategoryLimit(user.sub, profileId, tagId, body.dailyLimitMin)
  }

  @Delete('me/profiles/:profileId/category-limits/:tagId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer la limite de temps pour une catégorie' })
  deleteCategoryLimit(
    @CurrentUser() user: JwtPayload,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Param('tagId', ParseUUIDPipe) tagId: string,
  ) {
    return this.userService.deleteCategoryLimit(user.sub, profileId, tagId)
  }

  // ── Approbations parentales ──────────────────────────────────

  @Post('me/profiles/:profileId/approval-requests')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Demander l\'autorisation parentale pour une vidéo' })
  requestApproval(
    @CurrentUser() user: JwtPayload,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Body() body: { videoId: string },
  ) {
    return this.userService.requestApproval(user.sub, profileId, body.videoId)
  }

  @Get('me/approval-requests')
  @ApiOperation({ summary: 'Demandes d\'approbation en attente pour tous les profils du compte' })
  getApprovalRequests(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
  ) {
    return this.userService.getApprovalRequests(user.sub, status)
  }

  @Patch('me/approval-requests/:requestId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approuver ou refuser une demande parentale' })
  resolveApproval(
    @CurrentUser() user: JwtPayload,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() body: { action: 'APPROVED' | 'DENIED' },
  ) {
    return this.userService.resolveApproval(user.sub, requestId, body.action)
  }

  @Get('me/profiles/:profileId/approval-requests/:videoId')
  @ApiOperation({ summary: 'Statut d\'approbation d\'une vidéo pour un profil' })
  getVideoApprovalStatus(
    @CurrentUser() user: JwtPayload,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Param('videoId', ParseUUIDPipe) videoId: string,
  ) {
    return this.userService.getVideoApprovalStatus(user.sub, profileId, videoId)
  }

  // ── Filtres de contenu ──────────────────────────────────────

  @Get('me/blocks')
  @ApiOperation({ summary: 'Liste des filtres de contenu (listes blanches/noires)' })
  getBlocks(
    @CurrentUser() user: JwtPayload,
    @Query('profileId') profileId?: string,
  ) {
    return this.userService.getBlocks(user.sub, profileId)
  }

  @Post('me/blocks')
  @ApiOperation({ summary: 'Créer un filtre de contenu' })
  createBlock(
    @CurrentUser() user: JwtPayload,
    @Body() body: { profileId?: string; type: string; value: string },
  ) {
    return this.userService.createBlock(user.sub, body)
  }

  @Delete('me/blocks/:blockId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un filtre de contenu' })
  deleteBlock(
    @CurrentUser() user: JwtPayload,
    @Param('blockId', ParseUUIDPipe) blockId: string,
  ) {
    return this.userService.deleteBlock(user.sub, blockId)
  }
}
