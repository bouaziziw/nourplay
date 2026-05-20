import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import { UserService } from './user.service'

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'users', version: '1' })
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiOperation({ summary: 'Profil de l\'utilisateur connecté' })
  getMe(@CurrentUser() user: JwtPayload) {
    return this.userService.findById(user.sub)
  }

  @Get('me/profiles')
  @ApiOperation({ summary: 'Profils enfants du compte' })
  getProfiles(@CurrentUser() user: JwtPayload) {
    return this.userService.getProfiles(user.sub)
  }
}
