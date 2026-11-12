import { IsUUID, IsInt, IsBoolean, IsOptional, Min } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class RecordWatchDto {
  @ApiProperty()
  @IsUUID()
  videoId!: string

  @ApiPropertyOptional({ default: 0, description: 'Secondes regardées' })
  @IsOptional()
  @IsInt()
  @Min(0)
  durationWatchedSec = 0

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  completed = false
}
