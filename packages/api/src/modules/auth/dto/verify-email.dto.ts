import { IsString, Length } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class VerifyEmailDto {
  @ApiProperty()
  @IsString()
  @Length(64, 64)
  declare token: string
}
