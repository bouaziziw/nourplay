import { IsEmail } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class ForgotPasswordDto {
  @ApiProperty({ example: 'parent@exemple.fr' })
  @IsEmail()
  declare email: string
}
