import { IsOptional, IsBoolean, IsInt, Min, Max } from 'class-validator'
import { Transform, Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class QueryReportsDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt() @Min(1)
  page = 1

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt() @Min(1) @Max(100)
  limit = 20

  @ApiPropertyOptional({ description: 'Filtrer par statut résolu/non résolu', default: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  resolved = false
}
