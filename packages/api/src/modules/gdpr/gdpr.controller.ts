import { Controller, Get, Post, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import { GdprService } from './gdpr.service'

@ApiTags('RGPD — Droits utilisateurs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'gdpr', version: '1' })
export class GdprController {
  constructor(private readonly gdprService: GdprService) {}

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
}
