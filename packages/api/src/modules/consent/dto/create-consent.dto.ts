import { IsEnum, IsString } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { ConsentType } from '@nourplay/db'

export class CreateConsentDto {
  @ApiProperty({ enum: ConsentType })
  @IsEnum(ConsentType)
  type: ConsentType

  @ApiProperty({ example: '2026-01', description: 'Version des CGU/politique consentie' })
  @IsString()
  version: string
}
