import { IsInt, Min, Max } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class AddWatchTimeDto {
  @ApiProperty({ description: 'Minutes additionnelles à ajouter', example: 15, minimum: 1, maximum: 480 })
  @IsInt()
  @Min(1)
  @Max(480)
  additionalMinutes: number
}
