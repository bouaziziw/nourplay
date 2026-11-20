import { IsEmail, IsOptional } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class ResendVerificationDto {
  @ApiPropertyOptional({ example: 'parent@exemple.fr', description: 'Adresse email du compte à vérifier' })
  @IsOptional()
  @IsEmail({}, { message: 'Format d\'email invalide' })
  declare email?: string
}
