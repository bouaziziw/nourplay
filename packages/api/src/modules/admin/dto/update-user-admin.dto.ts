import { IsEnum, IsOptional, IsBoolean } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { UserRole } from '@nourplay/db'

export class UpdateUserAdminDto {
  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole

  @ApiPropertyOptional({ description: 'true = bannir (soft-delete), false = restaurer' })
  @IsOptional()
  @IsBoolean()
  banned?: boolean
}
