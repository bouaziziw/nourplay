import { IsUUID, IsInt, IsOptional, Min } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class AddVideoDto {
  @ApiProperty()
  @IsUUID()
  videoId: string

  @ApiProperty({ required: false, description: 'Position dans la playlist (0-based)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number
}
