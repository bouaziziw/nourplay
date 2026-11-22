import { IsEmail, IsIn, IsOptional, IsBoolean, MaxLength } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'parent@nourplay.app' })
  @IsOptional()
  @IsEmail({}, { message: 'Format d’email invalide' })
  @MaxLength(255)
  email?: string

  @ApiPropertyOptional({ example: 'fr', enum: ['fr', 'en', 'ar', 'es'] })
  @IsOptional()
  @IsIn(['fr', 'en', 'ar', 'es'], { message: 'Langue non supportée' })
  locale?: string

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  weeklyDigestEnabled?: boolean
}
