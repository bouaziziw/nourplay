import { IsArray, IsUUID } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class ReorderVideosDto {
  @ApiProperty({ type: [String], description: 'IDs des vidéos dans le nouvel ordre' })
  @IsArray()
  @IsUUID('4', { each: true })
  videoIds: string[]
}
