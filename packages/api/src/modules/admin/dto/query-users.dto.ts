import { IsEnum, IsOptional, IsString, IsBoolean, IsInt, Min, Max } from 'class-validator'
import { Transform, Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { UserRole } from '@nourplay/db'

export class QueryUsersDto {
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

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole

  @ApiPropertyOptional({ description: 'Recherche sur email' })
  @IsOptional()
  @IsString()
  search?: string

  @ApiPropertyOptional({ description: 'true = comptes soft-deleted seulement' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  deleted?: boolean
}
