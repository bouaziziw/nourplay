import { IsOptional, IsString, MaxLength } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class ResolveReportDto {
  @ApiPropertyOptional({ description: 'Note interne de modération' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string
}
