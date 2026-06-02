import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { IsString, IsInt, IsIn, Min, Max } from 'class-validator'
import { Throttle } from '@nestjs/throttler'
import { StorageService } from './storage.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'

class PresignedUrlDto {
  @IsString()
  @IsIn(['avatars', 'thumbnails'])
  folder!: string

  @IsString()
  contentType!: string

  @IsInt()
  @Min(1)
  @Max(5 * 1024 * 1024)
  sizeBytes!: number
}

@ApiTags('Storage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'storage', version: '1' })
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('presigned-url')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Obtenir une URL signée pour upload direct vers S3/R2' })
  getPresignedUrl(
    @CurrentUser() _user: JwtPayload,
    @Body() dto: PresignedUrlDto,
  ) {
    return this.storageService.getPresignedUploadUrl(dto.folder, dto.contentType, dto.sizeBytes)
  }
}
