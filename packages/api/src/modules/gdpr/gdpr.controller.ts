import { Controller, Get, Post, Patch, Param, ParseUUIDPipe, UseGuards, Query, Body } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { IsEnum, IsOptional, IsString } from 'class-validator'
import { GdprRequestStatus, UserRole } from '@nourplay/db'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import { GdprService } from './gdpr.service'

class UpdateRequestStatusDto {
  @IsEnum(GdprRequestStatus) status: GdprRequestStatus
  @IsOptional() @IsString() notes?: string
}

@ApiTags('RGPD — Droits utilisateurs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'gdpr', version: '1' })
export class GdprController {
  constructor(private readonly gdprService: GdprService) {}

  // ── Droits utilisateur ──────────────────────────────────────

  @Post('export')
  @ApiOperation({ summary: 'Demander un export de mes données (droit d\'accès)' })
  requestExport(@CurrentUser() user: JwtPayload) {
    return this.gdprService.requestExport(user.sub)
  }

  @Post('delete')
  @ApiOperation({ summary: 'Demander la suppression de mon compte (droit à l\'effacement)' })
  requestDeletion(@CurrentUser() user: JwtPayload) {
    return this.gdprService.requestDeletion(user.sub)
  }

  @Get('my-requests')
  @ApiOperation({ summary: 'Toutes mes demandes RGPD' })
  getMyRequests(@CurrentUser() user: JwtPayload) {
    return this.gdprService.getUserRequests(user.sub)
  }

  @Get('requests/:id')
  @ApiOperation({ summary: 'Statut d\'une demande RGPD' })
  getRequest(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.gdprService.getRequest(user.sub, id)
  }

  @Get('my-data')
  @ApiOperation({ summary: 'Accéder à toutes mes données personnelles (JSON)' })
  getMyData(@CurrentUser() user: JwtPayload) {
    return this.gdprService.getUserData(user.sub)
  }

  // ── Admin ────────────────────────────────────────────────────

  @Get('admin/stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: '[Admin] Statistiques de conformité RGPD' })
  getAdminStats() {
    return this.gdprService.getAdminStats()
  }

  @Get('admin/requests')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: '[Admin] Liste paginée des demandes RGPD' })
  listAdminRequests(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.gdprService.listAdminRequests({ status, type, page: +page, limit: +limit })
  }

  @Patch('admin/requests/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: '[Admin] Mettre à jour le statut d\'une demande RGPD' })
  updateRequestStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRequestStatusDto,
  ) {
    return this.gdprService.updateRequestStatus(user.sub, id, dto.status, dto.notes)
  }
}
