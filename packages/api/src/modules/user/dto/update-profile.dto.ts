import { IsEnum, IsInt, IsObject, IsOptional, IsString, Length, Max, Min } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { AgeGroup } from '@nourplay/db'

export class UpdateProfileDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(1, 30)
  displayName?: string

  @ApiProperty({ enum: AgeGroup, required: false })
  @IsOptional()
  @IsEnum(AgeGroup)
  ageGroup?: AgeGroup

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(480)
  dailyLimitMin?: number

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  sessionLimitMin?: number

  @ApiProperty({
    required: false,
    description: 'Planning de visionnage { "mon": ["08:00-12:00"], ... }',
  })
  @IsOptional()
  @IsObject()
  viewingSchedule?: Record<string, string[]>

  @ApiProperty({ required: false, description: 'Clé S3 de l\'avatar (ex: avatars/uuid.webp)' })
  @IsOptional()
  @IsString()
  avatarKey?: string | null
}
