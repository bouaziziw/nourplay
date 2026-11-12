import { IsEmail, IsString } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class LoginDto {
  @ApiProperty({ example: 'parent@exemple.fr' })
  @IsEmail()
  declare email: string

  @ApiProperty()
  @IsString()
  declare password: string
}
