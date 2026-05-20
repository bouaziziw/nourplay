import {
  Controller,
  Get,
  Post,
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
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import { UserService } from './user.service'
import { CreateProfileDto } from './dto/create-profile.dto'
import { UpdateProfileDto } from './dto/update-profile.dto'
import { VerifyPinDto } from './dto/verify-pin.dto'
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
}
