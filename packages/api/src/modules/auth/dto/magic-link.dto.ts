import { IsEmail } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class MagicLinkDto {
  @ApiProperty({ example: 'parent@example.com' })
  @IsEmail()
  email: string
}
