import { IsString, Length } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class VerifyTotpDto {
  @ApiProperty()
  @IsString()
  @Length(6, 6)
  declare code: string
}
