import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ModerationService } from './moderation.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { UserRole } from '@nourplay/db'

@ApiTags('Moderation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'moderation', version: '1' })
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Get('queue')
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  getPendingQueue() {
    return this.moderationService.getPendingQueue()
  }
}
