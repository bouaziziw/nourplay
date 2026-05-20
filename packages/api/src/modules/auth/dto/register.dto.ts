import { IsEmail, IsEnum, IsString, Matches, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { UserRole } from '@nourplay/db'

export class RegisterDto {
  @ApiProperty({ example: 'parent@exemple.fr' })
  @IsEmail({}, { message: 'Adresse email invalide' })
  declare email: string

  @ApiProperty({ minLength: 12, description: 'Min 12 caractères, 1 majuscule, 1 chiffre, 1 spécial' })
  @IsString()
  @MinLength(12)
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, {
    message: 'Le mot de passe doit contenir au moins une majuscule, un chiffre et un caractère spécial',
  })
  declare password: string

  @ApiProperty({ enum: [UserRole.PARENT, UserRole.TEACHER], default: UserRole.PARENT })
  @IsEnum([UserRole.PARENT, UserRole.TEACHER])
  role: UserRole = UserRole.PARENT

  @ApiProperty({ example: 'fr', required: false })
  @IsString()
  locale: string = 'fr'
}
