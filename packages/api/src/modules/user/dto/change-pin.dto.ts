import { IsString, Matches } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

const PIN_REGEX = /^\d{4,6}$/

export class ChangePinDto {
  @ApiProperty({ example: '1234' })
  @IsString()
  @Matches(PIN_REGEX, { message: 'PIN actuel invalide' })
  currentPin: string

  @ApiProperty({ example: '5678' })
  @IsString()
  @Matches(PIN_REGEX, { message: 'Nouveau PIN invalide' })
  newPin: string
}
