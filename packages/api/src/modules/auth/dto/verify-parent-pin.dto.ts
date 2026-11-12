import { ApiProperty } from '@nestjs/swagger'
import { IsString, Matches } from 'class-validator'

export class VerifyParentPinDto {
  @ApiProperty({ example: '123456', pattern: '^\\d{6}$' })
  @IsString()
  @Matches(/^\d{6}$/)
  declare pin: string
}
