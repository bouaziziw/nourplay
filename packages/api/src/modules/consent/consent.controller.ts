import { Controller, Get, Post, Delete, Body, Param, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { Request } from 'express'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import { ConsentService } from './consent.service'
import { CreateConsentDto } from './dto/create-consent.dto'
import { ConsentType } from '@nourplay/db'

@ApiTags('Consentements RGPD')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'consent', version: '1' })
export class ConsentController {
  constructor(private readonly consentService: ConsentService) {}

  @Get('current')
  @ApiOperation({ summary: 'Consentements actifs de l\'utilisateur' })
  getCurrent(@CurrentUser() user: JwtPayload) {
    return this.consentService.getUserConsents(user.sub)
  }

  @Get('history')
  @ApiOperation({ summary: 'Historique complet des consentements' })
  getHistory(@CurrentUser() user: JwtPayload) {
    return this.consentService.getHistory(user.sub)
  }

  @Post()
  @ApiOperation({ summary: 'Enregistrer un consentement' })
  record(@CurrentUser() user: JwtPayload, @Body() dto: CreateConsentDto, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || '0.0.0.0'
    return this.consentService.record(user.sub, dto, ip, req.headers['user-agent'])
  }

  @Delete(':type')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Révoquer un consentement' })
  revoke(@CurrentUser() user: JwtPayload, @Param('type') type: ConsentType) {
    return this.consentService.revoke(user.sub, type)
  }
}
