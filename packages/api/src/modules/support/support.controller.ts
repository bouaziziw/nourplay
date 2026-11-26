import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { SupportService } from './support.service'
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import { Throttle } from '@nestjs/throttler'

@ApiTags('support')
@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get('categories')
  @ApiOperation({ summary: 'Liste des catégories de contact support' })
  getCategories() {
    return this.supportService.getCategories()
  }

  @Post('contact')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Envoyer un message de contact ou support aux administrateurs' })
  @ApiResponse({ status: 200, description: 'Message transmis avec succès' })
  async submitContact(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSupportTicketDto,
  ) {
    return this.supportService.submitContact(user.sub, dto)
  }
}
