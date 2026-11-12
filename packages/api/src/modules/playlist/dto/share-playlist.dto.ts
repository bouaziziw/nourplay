import { IsEmail, IsEnum } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { PlaylistAccessRole } from '@nourplay/db'

export class SharePlaylistDto {
  @ApiProperty({ example: 'collegue@ecole.fr' })
  @IsEmail()
  email: string

  @ApiProperty({ enum: PlaylistAccessRole, default: PlaylistAccessRole.VIEWER })
  @IsEnum(PlaylistAccessRole)
  role: PlaylistAccessRole = PlaylistAccessRole.VIEWER
}
