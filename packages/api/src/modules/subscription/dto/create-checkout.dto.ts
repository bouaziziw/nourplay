import { IsUUID } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateCheckoutDto {
  @ApiProperty({ description: 'ID du plan d\'abonnement' })
  @IsUUID()
  planId: string
}
