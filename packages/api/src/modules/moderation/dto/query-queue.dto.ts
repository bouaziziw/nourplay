import { IsOptional, IsInt, Min, Max, IsEnum } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { AgeRating } from '@nourplay/db'

export class QueryQueueDto {
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

  @ApiPropertyOptional({ enum: AgeRating })
  @IsOptional()
  @IsEnum(AgeRating)
  ageRating?: AgeRating
}
