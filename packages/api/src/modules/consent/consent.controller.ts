import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ConsentService } from './consent.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'

@ApiTags('Consent RGPD')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'consent', version: '1' })
export class ConsentController {
  constructor(private readonly consentService: ConsentService) {}

  @Get('current')
  getCurrent(@CurrentUser() user: JwtPayload) {
    return this.consentService.getUserConsents(user.sub)
  }
}
