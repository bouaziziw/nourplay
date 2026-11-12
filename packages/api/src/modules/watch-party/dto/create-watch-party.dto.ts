import { IsUUID } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateWatchPartyDto {
  @ApiProperty({ description: 'ID de la playlist à co-visionner' })
  @IsUUID()
  playlistId: string
}
