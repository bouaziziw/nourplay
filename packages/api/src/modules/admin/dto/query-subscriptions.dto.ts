import { IsOptional, IsEnum, IsInt, Min, IsUUID } from 'class-validator'
import { Type } from 'class-transformer'

export class QuerySubscriptionsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit = 20

  @IsOptional()
  @IsEnum(['ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELLED', 'EXPIRED'])
  status?: string

  @IsOptional()
  @IsUUID()
  userId?: string
}
