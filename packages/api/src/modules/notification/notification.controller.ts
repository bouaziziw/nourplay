import {
  Controller, Get, Post, Patch, Delete, Param, Query, Body,
  ParseUUIDPipe, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { NotificationService } from './notification.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import { IsOptional, IsBoolean, IsInt, IsString, IsIn, Min, Max } from 'class-validator'
import { Transform, Type } from 'class-transformer'

class RegisterTokenDto {
  @IsString()
  token!: string

  @IsIn(['ios', 'android'])
  platform!: string
}

class UnregisterTokenDto {
  @IsString()
  token!: string
}

class QueryNotificationsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit = 20

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unread?: boolean
}

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'notifications', version: '1' })
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Mes notifications (paginées)' })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: QueryNotificationsDto) {
    return this.notificationService.findForUser(user.sub, query.page, query.limit, query.unread)
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marquer une notification comme lue' })
  markRead(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.notificationService.markRead(user.sub, id)
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marquer toutes les notifications comme lues' })
  markAllRead(@CurrentUser() user: JwtPayload) {
    return this.notificationService.markAllRead(user.sub)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer une notification' })
  deleteNotification(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.notificationService.deleteNotification(user.sub, id)
  }

  // ── Device tokens ─────────────────────────────────────────────

  @Post('device-tokens')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Enregistrer un token push Expo' })
  registerToken(@CurrentUser() user: JwtPayload, @Body() dto: RegisterTokenDto) {
    return this.notificationService.registerToken(user.sub, dto.token, dto.platform)
  }

  @Delete('device-tokens/unregister')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer un token push Expo' })
  unregisterToken(@CurrentUser() user: JwtPayload, @Body() dto: UnregisterTokenDto) {
    return this.notificationService.unregisterToken(user.sub, dto.token)
  }
}
