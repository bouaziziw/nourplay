import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { createHash, randomBytes } from 'crypto'
import * as argon2 from 'argon2'
import { authenticator } from 'otplib'
import { toDataURL } from 'qrcode'
import { PrismaService } from '../../common/prisma/prisma.service'
import { EmailService } from '../../common/email/email.service'
import { RedisTokenService } from '../../common/redis/redis-token.service'
import { RegisterDto } from './dto/register.dto'

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
    private readonly tokenService: RedisTokenService,
  ) {}

  // ── Register & Email verification ───────────────────────────

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (existing) throw new ConflictException('Un compte avec cet email existe déjà')

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    })

    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash, role: dto.role, locale: dto.locale },
      select: { id: true, email: true, role: true, locale: true, createdAt: true },
    })

    await this.sendVerificationEmail(user.id, dto.email, dto.locale)
    this.logger.log(`New user registered: ${user.email} (${user.role})`)
    return user
  }

  async sendVerificationEmail(userId: string, email: string, locale = 'fr') {
    const token = await this.tokenService.createEmailVerificationToken(userId)
    await this.emailService.sendVerificationEmail(email, token, locale)
  }

  async verifyEmail(token: string) {
    const userId = await this.tokenService.consumeEmailVerificationToken(token)
    if (!userId) throw new BadRequestException('Token invalide ou expiré')

    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true, emailVerifiedAt: new Date() },
    })
    return { verified: true }
  }

  // ── Login ────────────────────────────────────────────────────

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email, deletedAt: null },
      select: { id: true, email: true, role: true, passwordHash: true, emailVerified: true, twoFactorEnabled: true },
    })
    if (!user || !user.passwordHash) return null
    const valid = await argon2.verify(user.passwordHash, password)
    if (!valid) return null
    const { passwordHash: _, ...result } = user
    return result
  }

  async login(userId: string, email: string, role: string, fingerprint: string) {
    const accessToken = this.jwtService.sign({ sub: userId, email, role })
    const refreshToken = await this.generateRefreshToken(userId, fingerprint)
    return { accessToken, refreshToken }
  }

  async refreshTokens(tokenHash: string, fingerprint: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true, role: true, deletedAt: true } } },
    })

    if (!stored || stored.revokedAt || stored.expiresAt < new Date() || stored.user.deletedAt) {
      throw new UnauthorizedException('Session expirée, reconnectez-vous')
    }

    if (stored.fingerprint !== fingerprint) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId },
        data: { revokedAt: new Date() },
      })
      throw new UnauthorizedException('Session compromise, reconnectez-vous')
    }

    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } })
    const { user } = stored
    const accessToken = this.jwtService.sign({ sub: user.id, email: user.email, role: user.role })
    const newRefreshToken = await this.generateRefreshToken(user.id, fingerprint)
    return { accessToken, refreshToken: newRefreshToken }
  }

  async revokeRefreshToken(tokenHash: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }

  // ── Password reset ────────────────────────────────────────────

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email, deletedAt: null },
      select: { id: true, locale: true },
    })
    // Pas de feedback d'existence (prévention énumération email)
    if (!user) return

    const token = await this.tokenService.createPasswordResetToken(user.id)
    await this.emailService.sendPasswordResetEmail(email, token, user.locale)
  }

  async resetPassword(token: string, newPassword: string) {
    const userId = await this.tokenService.consumePasswordResetToken(token)
    if (!userId) throw new BadRequestException('Token invalide ou expiré')

    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    })

    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } })
    // Révoque toutes les sessions existantes
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return { reset: true }
  }

  // ── 2FA TOTP ─────────────────────────────────────────────────

  async initTotp(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, twoFactorEnabled: true },
    })
    if (!user) throw new NotFoundException('Utilisateur introuvable')
    if (user.twoFactorEnabled) throw new BadRequestException('La 2FA est déjà activée')

    const secret = authenticator.generateSecret()
    const appName = this.config.get<string>('TOTP_APP_NAME', 'NourPlay')
    const otpauth = authenticator.keyuri(user.email, appName, secret)
    const qrCode = await toDataURL(otpauth)

    // Stocke le secret temporaire en Redis (TTL 10 min, pas encore validé)
    await this.tokenService['redis'].setex(`totp_setup:${userId}`, 600, secret)

    return { secret, qrCode, otpauth }
  }

  async enableTotp(userId: string, code: string) {
    const secret = await this.tokenService['redis'].get(`totp_setup:${userId}`)
    if (!secret) throw new BadRequestException('Aucune configuration 2FA en cours. Recommencez.')

    const valid = authenticator.verify({ token: code, secret })
    if (!valid) throw new UnauthorizedException('Code TOTP incorrect')

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true, twoFactorSecret: secret },
    })
    await this.tokenService['redis'].del(`totp_setup:${userId}`)
    return { enabled: true }
  }

  async verifyTotp(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true, twoFactorSecret: true },
    })
    if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException('2FA non activée')
    }
    return authenticator.verify({ token: code, secret: user.twoFactorSecret })
  }

  async disableTotp(userId: string, code: string) {
    const valid = await this.verifyTotp(userId, code)
    if (!valid) throw new UnauthorizedException('Code TOTP incorrect')

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    })
    return { disabled: true }
  }

  // ── Magic link ───────────────────────────────────────────────

  async requestMagicLink(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email, deletedAt: null },
      select: { id: true, locale: true },
    })
    // Réponse identique si l'email n'existe pas (prévention énumération)
    if (!user) return

    const token = await this.tokenService.createMagicLinkToken(email)
    await this.emailService.sendMagicLinkEmail(email, token, user.locale)
  }

  async loginWithMagicLink(token: string, fingerprint: string) {
    const email = await this.tokenService.consumeMagicLinkToken(token)
    if (!email) throw new UnauthorizedException('Lien invalide ou expiré')

    let user = await this.prisma.user.findUnique({
      where: { email, deletedAt: null },
      select: { id: true, email: true, role: true, emailVerified: true },
    })

    if (!user) {
      // Création automatique d'un compte si l'email est inconnu (premier usage magic link)
      user = await this.prisma.user.create({
        data: { email, role: 'PARENT', emailVerified: true, emailVerifiedAt: new Date() },
        select: { id: true, email: true, role: true, emailVerified: true },
      })
      this.logger.log(`New account created via magic link: ${email}`)
    } else if (!user.emailVerified) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true, emailVerifiedAt: new Date() },
      })
    }

    return this.login(user.id, user.email, user.role, fingerprint)
  }

  // ── OAuth helpers ─────────────────────────────────────────────

  async findOrCreateOAuthUser(profile: { googleId: string; email: string; locale?: string }) {
    let user = await this.prisma.user.findFirst({
      where: { OR: [{ googleId: profile.googleId }, { email: profile.email }], deletedAt: null },
      select: { id: true, email: true, role: true, googleId: true },
    })

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          googleId: profile.googleId,
          role: 'PARENT',
          locale: profile.locale ?? 'fr',
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
        select: { id: true, email: true, role: true, googleId: true },
      })
    } else if (!user.googleId) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { googleId: profile.googleId, emailVerified: true },
        select: { id: true, email: true, role: true, googleId: true },
      })
    }

    return user
  }

  // ── Helpers ───────────────────────────────────────────────────

  buildFingerprint(userAgent: string, ip: string): string {
    const ipSubnet = ip.split('.').slice(0, 3).join('.')
    return createHash('sha256').update(`${ipSubnet}|${userAgent}`).digest('hex')
  }

  private async generateRefreshToken(userId: string, fingerprint: string): Promise<string> {
    const rawToken = randomBytes(48).toString('hex')
    const tokenHash = createHash('sha256').update(rawToken).digest('hex')
    const ttl = this.config.get<number>('jwt.refreshTtl', 604800)

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, fingerprint, expiresAt: new Date(Date.now() + ttl * 1000) },
    })
    return rawToken
  }
}
