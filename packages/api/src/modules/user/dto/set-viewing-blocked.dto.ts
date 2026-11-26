import { IsBoolean } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class SetViewingBlockedDto {
  @ApiProperty({ description: 'Indique si le visionnage est bloqué pour le profil enfant', example: true })
  @IsBoolean()
  blocked: boolean
}
