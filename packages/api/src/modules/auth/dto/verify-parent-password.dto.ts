import { ApiProperty } from '@nestjs/swagger'
import { IsString, MinLength } from 'class-validator'

export class VerifyParentPasswordDto {
  @ApiProperty({ minLength: 1 })
  @IsString()
  @MinLength(1)
  declare password: string
}
