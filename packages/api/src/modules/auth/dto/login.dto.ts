import { IsEmail, IsString } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class LoginDto {
  @ApiProperty({ example: 'parent@exemple.fr' })
  @IsEmail()
  email: string

  @ApiProperty()
  @IsString()
  password: string
}
