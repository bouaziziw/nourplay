import { IsString, Length } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class SetupTotpDto {
  @ApiProperty({ description: 'Code TOTP 6 chiffres pour confirmer l\'activation' })
  @IsString()
  @Length(6, 6)
  declare code: string
}
