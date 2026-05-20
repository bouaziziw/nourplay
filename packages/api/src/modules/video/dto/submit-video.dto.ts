import { IsString, IsUrl, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { AgeRating } from '@nourplay/db'

export class SubmitVideoDto {
  @ApiProperty({ example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
  @IsUrl({ protocols: ['https'], require_tld: true })
  url: string

  @ApiProperty({ enum: AgeRating, required: false, default: AgeRating.ALL })
  @IsOptional()
  @IsEnum(AgeRating)
  ageRating?: AgeRating

  @ApiProperty({ required: false, example: 'fr' })
  @IsOptional()
  @IsString()
  language?: string
}
