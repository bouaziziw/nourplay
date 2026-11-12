import { ApiProperty } from '@nestjs/swagger'
import { IsString, Matches, MinLength } from 'class-validator'

export class SetParentPinDto {
  @ApiProperty({ minLength: 1 })
  @IsString()
  @MinLength(1)
  declare password: string

  @ApiProperty({ example: '123456', pattern: '^\\d{6}$' })
  @IsString()
  @Matches(/^\d{6}$/)
  declare pin: string
}
