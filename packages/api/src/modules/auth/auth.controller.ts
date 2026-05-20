import {
  Controller, Post, Body, Req, Res, Get,
  HttpCode, HttpStatus, UseGuards, Query,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { Request, Response } from 'express'
import { Throttle } from '@nestjs/throttler'
import { AuthGuard } from '@nestjs/passport'
import { AuthService } from './auth.service'
import { RegisterDto } from './dto/register.dto'
import { LoginDto } from './dto/login.dto'
import { VerifyEmailDto } from './dto/verify-email.dto'
import { ForgotPasswordDto } from './dto/forgot-password.dto'
import { ResetPasswordDto } from './dto/reset-password.dto'
import { SetupTotpDto } from './dto/setup-totp.dto'
import { VerifyTotpDto } from './dto/verify-totp.dto'
import { LocalAuthGuard } from './guards/local-auth.guard'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { Public } from '../../common/decorators/public.decorator'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'

const REFRESH_COOKIE = 'refresh_token'
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/v1/auth',
}

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── Register / Email ─────────────────────────────────────────

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Créer un compte — envoie un email de vérification' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto)
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Vérifier l\'adresse email avec le token reçu' })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token)
  }

  @UseGuards(JwtAuthGuard)
  @Post('resend-verification')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 3, ttl: 300000 } })
  @ApiOperation({ summary: 'Renvoyer l\'email de vérification' })
  async resendVerification(@CurrentUser() user: JwtPayload, @Req() req: Request) {
    const dbUser = await this.authService['prisma'].user.findUnique({
      where: { id: user.sub },
      select: { email: true, locale: true },
    })
    if (dbUser) await this.authService.sendVerificationEmail(user.sub, dbUser.email, dbUser.locale)
  }

  // ── Login ─────────────────────────────────────────────────────

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Connexion email + mot de passe' })
  async login(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = req.user as { id: string; email: string; role: string; twoFactorEnabled?: boolean }
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || ''
    const fingerprint = this.authService.buildFingerprint(req.headers['user-agent'] || '', ip)

    if (user.twoFactorEnabled) {
      return { requiresTwoFactor: true, userId: user.id }
    }

    const { accessToken, refreshToken } = await this.authService.login(user.id, user.email, user.role, fingerprint)
    res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS)
    return { accessToken }
  }

  @Public()
  @Post('login/2fa')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Compléter la connexion avec le code TOTP' })
  async loginWith2fa(
    @Body() body: { userId: string; code: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const valid = await this.authService.verifyTotp(body.userId, body.code)
    if (!valid) throw new Error('Code TOTP incorrect')

    const user = await this.authService['prisma'].user.findUnique({
      where: { id: body.userId },
      select: { id: true, email: true, role: true },
    })
    if (!user) throw new Error('Utilisateur introuvable')

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || ''
    const fingerprint = this.authService.buildFingerprint(req.headers['user-agent'] || '', ip)
    const { accessToken, refreshToken } = await this.authService.login(user.id, user.email, user.role, fingerprint)
    res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS)
    return { accessToken }
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotation du refresh token' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE]
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || ''
    const fingerprint = this.authService.buildFingerprint(req.headers['user-agent'] || '', ip)
    const { accessToken, refreshToken } = await this.authService.refreshTokens(token, fingerprint)
    res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS)
    return { accessToken }
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Déconnexion' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE]
    if (token) {
      const { createHash } = await import('crypto')
      const tokenHash = createHash('sha256').update(token).digest('hex')
      await this.authService.revokeRefreshToken(tokenHash)
    }
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' })
  }

  // ── Password reset ────────────────────────────────────────────

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 3, ttl: 300000 } })
  @ApiOperation({ summary: 'Demande de réinitialisation du mot de passe' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email)
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Réinitialiser le mot de passe avec le token' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password)
  }

  // ── 2FA TOTP ─────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('2fa/init')
  @ApiOperation({ summary: 'Initialiser la 2FA — retourne le QR code' })
  initTotp(@CurrentUser() user: JwtPayload) {
    return this.authService.initTotp(user.sub)
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/enable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activer la 2FA après scan du QR code' })
  enableTotp(@CurrentUser() user: JwtPayload, @Body() dto: SetupTotpDto) {
    return this.authService.enableTotp(user.sub, dto.code)
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Désactiver la 2FA' })
  disableTotp(@CurrentUser() user: JwtPayload, @Body() dto: VerifyTotpDto) {
    return this.authService.disableTotp(user.sub, dto.code)
  }

  // ── OAuth Google ──────────────────────────────────────────────

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initier l\'authentification Google' })
  googleAuth() { /* handled by Passport */ }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Callback Google OAuth' })
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const googleUser = req.user as { googleId: string; email: string }
    const user = await this.authService.findOrCreateOAuthUser(googleUser)
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || ''
    const fingerprint = this.authService.buildFingerprint(req.headers['user-agent'] || '', ip)
    const { accessToken, refreshToken } = await this.authService.login(user.id, user.email, user.role, fingerprint)

    const appUrl = process.env.APP_URL || 'http://localhost:3000'
    res.cookie(REFRESH_COOKIE, refreshToken, { ...COOKIE_OPTIONS, path: '/' })
    res.redirect(`${appUrl}/auth/callback?token=${accessToken}`)
  }
}
