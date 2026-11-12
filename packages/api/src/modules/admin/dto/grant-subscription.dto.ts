import { IsUUID, IsOptional, IsDateString } from 'class-validator'

export class GrantSubscriptionDto {
  @IsUUID()
  userId!: string

  @IsUUID()
  planId!: string

  @IsOptional()
  @IsDateString()
  expiresAt?: string
}
