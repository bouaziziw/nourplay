import {
  Controller, Get, Patch, Param, Body, Query,
  ParseUUIDPipe, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { ModerationService } from './moderation.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import { QueryQueueDto } from './dto/query-queue.dto'
import { ReviewVideoDto } from './dto/review-video.dto'
import { QueryReportsDto } from './dto/query-reports.dto'
import { ResolveReportDto } from './dto/resolve-report.dto'
import { UserRole } from '@nourplay/db'

@ApiTags('Moderation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MODERATOR, UserRole.ADMIN)
@Controller({ path: 'moderation', version: '1' })
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  // ── File d'attente ────────────────────────────────────────────

  @Get('queue')
  @ApiOperation({ summary: 'Vidéos en attente de révision humaine' })
  getPendingQueue(@Query() query: QueryQueueDto) {
    return this.moderationService.getPendingQueue(query)
  }

  @Patch('videos/:id/review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approuver ou rejeter une vidéo' })
  reviewVideo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewVideoDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.moderationService.reviewVideo(actor.sub, actor.role, id, dto)
  }

  // ── Signalements ──────────────────────────────────────────────

  @Get('reports')
  @ApiOperation({ summary: 'Liste des signalements' })
  getReports(@Query() query: QueryReportsDto) {
    return this.moderationService.getReports(query)
  }

  @Get('reports/:id')
  @ApiOperation({ summary: 'Détail d\'un signalement' })
  getReport(@Param('id', ParseUUIDPipe) id: string) {
    return this.moderationService.getReport(id)
  }

  @Patch('reports/:id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Résoudre un signalement' })
  resolveReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveReportDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.moderationService.resolveReport(actor.sub, actor.role, id, dto)
  }
}
