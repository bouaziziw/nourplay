import { IsOptional, IsString, IsUUID, IsDateString, IsInt, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class QueryAuditLogsDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt() @Min(1)
  page = 1

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt() @Min(1) @Max(200)
  limit = 50

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  actorId?: string

  @ApiPropertyOptional({ example: 'video.approve' })
  @IsOptional()
  @IsString()
  action?: string

  @ApiPropertyOptional({ example: 'Video' })
  @IsOptional()
  @IsString()
  resourceType?: string

  @ApiPropertyOptional({ example: '2026-01-01T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  dateTo?: string
}
