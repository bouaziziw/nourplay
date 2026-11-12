import {
  Controller, Get, Post, Patch, Delete, Query, Param, Body,
  ParseUUIDPipe, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { AdminService } from './admin.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import { QueryUsersDto } from './dto/query-users.dto'
import { UpdateUserAdminDto } from './dto/update-user-admin.dto'
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto'
import { CreateLegalDocumentDto } from './dto/create-legal-document.dto'
import { QuerySubscriptionsDto } from './dto/query-subscriptions.dto'
import { GrantSubscriptionDto } from './dto/grant-subscription.dto'
import { UserRole } from '@nourplay/db'

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ── Statistiques ──────────────────────────────────────────────

  @Get('stats')
  @ApiOperation({ summary: 'Statistiques globales de la plateforme' })
  getStats() {
    return this.adminService.getStats()
  }

  // ── Utilisateurs ──────────────────────────────────────────────

  @Get('users')
  @ApiOperation({ summary: 'Liste paginée des utilisateurs' })
  getUsers(@Query() query: QueryUsersDto) {
    return this.adminService.getUsers(query)
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Détail d\'un utilisateur' })
  getUserById(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getUserById(id)
  }

  @Patch('users/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Modifier le rôle ou bannir/restaurer un utilisateur' })
  updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserAdminDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.adminService.updateUser(actor.sub, actor.role, id, dto)
  }

  // ── Abonnements ──────────────────────────────────────────────

  @Get('subscriptions')
  @ApiOperation({ summary: 'Liste paginée des abonnements utilisateurs' })
  getSubscriptions(@Query() query: QuerySubscriptionsDto) {
    return this.adminService.getSubscriptions(query)
  }

  @Get('subscriptions/stats')
  @ApiOperation({ summary: 'Statistiques des abonnements par statut et par plan' })
  getSubscriptionStats() {
    return this.adminService.getSubscriptionStats()
  }

  @Post('subscriptions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Attribuer manuellement un abonnement à un utilisateur' })
  grantSubscription(@Body() dto: GrantSubscriptionDto, @CurrentUser() actor: JwtPayload) {
    return this.adminService.grantSubscription(actor.sub, actor.role, dto)
  }

  @Delete('subscriptions/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Révoquer un abonnement' })
  revokeSubscription(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: JwtPayload) {
    return this.adminService.revokeSubscription(actor.sub, actor.role, id)
  }

  // ── Conformité RGPD ───────────────────────────────────────────

  @Get('compliance')
  @ApiOperation({ summary: 'Tableau de bord de conformité RGPD' })
  getComplianceStats() {
    return this.adminService.getComplianceStats()
  }

  // ── Logs d'audit ──────────────────────────────────────────────

  @Get('audit-logs')
  @ApiOperation({ summary: 'Journal d\'audit paginé' })
  getAuditLogs(@Query() query: QueryAuditLogsDto) {
    return this.adminService.getAuditLogs(query)
  }

  // ── Textes légaux ─────────────────────────────────────────────

  @Get('legal')
  @ApiOperation({ summary: 'Liste des documents légaux (CGU, confidentialité…)' })
  listLegalDocuments() {
    return this.adminService.listLegalDocuments()
  }

  @Get('legal/:id')
  @ApiOperation({ summary: 'Détail d\'un document légal avec contenu Markdown' })
  getLegalDocument(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getLegalDocument(id)
  }

  @Post('legal')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Créer un nouveau document légal (brouillon)' })
  createLegalDocument(@Body() dto: CreateLegalDocumentDto, @CurrentUser() actor: JwtPayload) {
    return this.adminService.createLegalDocument(actor.sub, actor.role, dto)
  }

  @Patch('legal/:id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publier un brouillon (définit publishedAt)' })
  publishLegalDocument(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: JwtPayload) {
    return this.adminService.publishLegalDocument(actor.sub, actor.role, id)
  }
}
