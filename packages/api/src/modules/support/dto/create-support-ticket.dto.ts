import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateSupportTicketDto {
  @ApiProperty({ description: 'Catégorie du message', example: 'TECHNICAL_ISSUE' })
  @IsNotEmpty({ message: 'La catégorie est obligatoire' })
  @IsString()
  category!: string

  @ApiProperty({ description: 'Objet du message', example: 'Impossible de bloquer la lecture' })
  @IsNotEmpty({ message: 'L’objet du message est obligatoire' })
  @IsString()
  @MinLength(3, { message: 'L’objet doit contenir au moins 3 caractères' })
  @MaxLength(200, { message: 'L’objet ne peut pas dépasser 200 caractères' })
  subject!: string

  @ApiProperty({ description: 'Message détaillé', example: 'Bonjour, je souhaiterais signaler...' })
  @IsNotEmpty({ message: 'Le message est obligatoire' })
  @IsString()
  @MinLength(10, { message: 'Le message doit contenir au moins 10 caractères' })
  @MaxLength(5000, { message: 'Le message ne peut pas dépasser 5000 caractères' })
  message!: string

  @ApiPropertyOptional({ description: 'Identifiant du profil enfant concerné' })
  @IsOptional()
  @IsUUID('4', { message: 'Identifiant de profil invalide' })
  childProfileId?: string
}
