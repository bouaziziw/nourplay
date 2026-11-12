import { IsEnum, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { AgeGroup } from '@nourplay/db'

export class CreateProfileDto {
  @ApiProperty({ example: 'Petit Loup', maxLength: 30 })
  @IsString()
  @Length(1, 30)
  displayName: string

  @ApiProperty({ enum: AgeGroup })
  @IsEnum(AgeGroup)
  ageGroup: AgeGroup

  @ApiProperty({ example: 2019, required: false, description: 'Année de naissance (pas la date exacte)' })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(new Date().getFullYear())
  birthYear?: number

  @ApiProperty({ description: 'PIN 4 chiffres', example: '1234' })
  @IsString()
  @Matches(/^\d{4,6}$/, { message: 'Le PIN doit contenir 4 à 6 chiffres' })
  pin: string

  @ApiProperty({ required: false, description: 'Limite quotidienne en minutes' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(480)
  dailyLimitMin?: number

  @ApiProperty({ required: false, description: 'Limite par session en minutes' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  sessionLimitMin?: number
}
