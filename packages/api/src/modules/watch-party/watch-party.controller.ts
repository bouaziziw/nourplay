import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import { WatchPartyService } from './watch-party.service'
import { CreateWatchPartyDto } from './dto/create-watch-party.dto'

@ApiTags('Watch Party')
@Controller({ path: 'watch-parties', version: '1' })
export class WatchPartyController {
  constructor(private readonly watchPartyService: WatchPartyService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Créer une salle de co-visionnage' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateWatchPartyDto) {
    return this.watchPartyService.create(user.sub, dto)
  }

  @Get('code/:code')
  @ApiOperation({ summary: 'Obtenir les infos d\'une salle par son code' })
  findByCode(@Param('code') code: string) {
    return this.watchPartyService.findByCode(code.toUpperCase())
  }
}
