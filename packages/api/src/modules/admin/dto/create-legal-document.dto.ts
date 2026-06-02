import { IsEnum, IsString, MinLength, MaxLength, Matches } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { ConsentType } from '@nourplay/db'

export class CreateLegalDocumentDto {
  @ApiProperty({ enum: ['TERMS', 'PRIVACY'], description: 'Type de document légal' })
  @IsEnum({ TERMS: 'TERMS', PRIVACY: 'PRIVACY' }, { message: 'type must be TERMS or PRIVACY' })
  type: string

  @ApiProperty({ example: '2026-01-01', description: 'Identifiant de version (date ISO)' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'version must be an ISO date (YYYY-MM-DD)' })
  version: string

  @ApiProperty({ description: 'Contenu Markdown du document' })
  @IsString()
  @MinLength(10)
  @MaxLength(200_000)
  content: string
}
