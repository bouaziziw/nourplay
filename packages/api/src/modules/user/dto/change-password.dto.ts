import { IsOptional, IsString, Length } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class ChangePasswordDto {
  @ApiPropertyOptional({ description: 'Mot de passe actuel (requis si un mot de passe est déjà défini)' })
  @IsOptional()
  @IsString()
  @Length(1, 128)
  currentPassword?: string

  @ApiProperty({ description: 'Nouveau mot de passe (au moins 8 caractères)' })
  @IsString()
  @Length(8, 128, { message: 'Le mot de passe doit comporter entre 8 et 128 caractères' })
  newPassword: string
}
