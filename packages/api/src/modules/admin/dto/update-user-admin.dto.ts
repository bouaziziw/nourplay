import { IsEnum, IsOptional, IsBoolean, IsEmail, IsString, Length } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { UserRole } from '@nourplay/db'

export class UpdateUserAdminDto {
  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole

  @ApiPropertyOptional({ description: 'true = bannir (soft-delete), false = restaurer' })
  @IsOptional()
  @IsBoolean()
  banned?: boolean

  @ApiPropertyOptional({ description: 'Nouvelle adresse email' })
  @IsOptional()
  @IsEmail({}, { message: 'Format d’email invalide' })
  email?: string

  @ApiPropertyOptional({ description: 'Nouveau mot de passe' })
  @IsOptional()
  @IsString()
  @Length(8, 128, { message: 'Le mot de passe doit comporter entre 8 et 128 caractères' })
  password?: string
}
