import {
  Controller, Get, Patch, Query, Param, Body,
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

  // ── Logs d'audit ──────────────────────────────────────────────

  @Get('audit-logs')
  @ApiOperation({ summary: 'Journal d\'audit paginé' })
  getAuditLogs(@Query() query: QueryAuditLogsDto) {
    return this.adminService.getAuditLogs(query)
  }
}
