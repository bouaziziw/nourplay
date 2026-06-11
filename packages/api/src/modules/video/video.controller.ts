import {
  Controller, Get, Post, Body, Param, ParseUUIDPipe,
  UseGuards, Query, HttpCode, HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { IsString, IsOptional } from 'class-validator'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import { VideoService } from './video.service'
import { SubmitVideoDto } from './dto/submit-video.dto'

class ReportVideoDto {
  @IsString() reason: string
  @IsOptional() @IsString() description?: string
}

@ApiTags('Vidéos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'videos', version: '1' })
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @Post()
  @ApiOperation({ summary: 'Soumettre une vidéo pour validation' })
  submit(@CurrentUser() user: JwtPayload, @Body() dto: SubmitVideoDto) {
    return this.videoService.submit(user.sub, dto)
  }

  @Get('tags')
  @ApiOperation({ summary: 'Liste des tags disponibles' })
  listTags() {
    return this.videoService.listTags()
  }

  @Get('search')
  @ApiOperation({ summary: 'Rechercher des vidéos approuvées' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'language', required: false })
  @ApiQuery({ name: 'ageRating', required: false })
  @ApiQuery({ name: 'source', required: false })
  @ApiQuery({ name: 'tags', required: false, description: 'IDs séparés par virgule' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  search(
    @Query('q') q?: string,
    @Query('language') language?: string,
    @Query('ageRating') ageRating?: string,
    @Query('source') sourceSlug?: string,
    @Query('tags') tags?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.videoService.search({
      q, language, ageRating, sourceSlug,
      tags: tags ? tags.split(',').filter(Boolean) : undefined,
      page: +page, limit: +limit,
    })
  }

  @Get(':id/similar')
  @ApiOperation({ summary: 'Vidéos similaires' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findSimilar(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit = 4,
  ) {
    return this.videoService.findSimilar(id, +limit)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'une vidéo' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.videoService.findById(id)
  }

  @Post(':id/report')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Signaler une vidéo' })
  report(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportVideoDto,
  ) {
    return this.videoService.report(user.sub, id, dto.reason, dto.description)
  }
}
