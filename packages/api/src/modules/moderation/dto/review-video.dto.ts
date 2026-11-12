import { IsEnum, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export enum ReviewAction {
  APPROVE = 'approve',
  REJECT = 'reject',
}

export class ReviewVideoDto {
  @ApiProperty({ enum: ReviewAction })
  @IsEnum(ReviewAction)
  action!: ReviewAction

  @ApiPropertyOptional({ description: 'Obligatoire si action = reject' })
  @ValidateIf(o => o.action === ReviewAction.REJECT)
  @IsString()
  @MaxLength(1000)
  reason?: string
}
