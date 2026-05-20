import { IsArray, IsEnum, IsOptional, IsString, Length } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { AgeGroup, PlaylistVisibility } from '@nourplay/db'

export class CreatePlaylistDto {
  @ApiProperty({ example: 'Sciences naturelles CE1' })
  @IsString()
  @Length(1, 100)
  name: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string

  @ApiProperty({ enum: PlaylistVisibility, default: PlaylistVisibility.PRIVATE })
  @IsOptional()
  @IsEnum(PlaylistVisibility)
  visibility?: PlaylistVisibility = PlaylistVisibility.PRIVATE

  @ApiProperty({ enum: AgeGroup, isArray: true, required: false })
  @IsOptional()
  @IsArray()
  @IsEnum(AgeGroup, { each: true })
  targetAgeGroup?: AgeGroup[]

  @ApiProperty({ isArray: true, required: false, example: ['fr', 'en'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[]
}
