import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { createHash, randomBytes } from 'crypto'
import * as argon2 from 'argon2'
import { PrismaService } from '../../common/prisma/prisma.service'
import { RegisterDto } from './dto/register.dto'

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

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
      data: {
        email: dto.email,
        passwordHash,
        role: dto.role,
        locale: dto.locale,
      },
      select: { id: true, email: true, role: true, locale: true, createdAt: true },
    })

    this.logger.log(`New user registered: ${user.email} (${user.role})`)
    return user
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email, deletedAt: null },
      select: { id: true, email: true, role: true, passwordHash: true, emailVerified: true },
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
      // Vol de token potentiel : on révoque tout
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId },
        data: { revokedAt: new Date() },
      })
      throw new UnauthorizedException('Session compromise, reconnectez-vous')
    }

    // Rotation : révoquer l'ancien, émettre un nouveau
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    })

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

  private async generateRefreshToken(userId: string, fingerprint: string): Promise<string> {
    const rawToken = randomBytes(48).toString('hex')
    const tokenHash = createHash('sha256').update(rawToken).digest('hex')
    const ttl = this.config.get<number>('jwt.refreshTtl', 604800)

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        fingerprint,
        expiresAt: new Date(Date.now() + ttl * 1000),
      },
    })

    return rawToken
  }

  buildFingerprint(userAgent: string, ip: string): string {
    // On hash l'IP subnet (/24) + user-agent, pas l'IP exacte (RGPD)
    const ipSubnet = ip.split('.').slice(0, 3).join('.')
    return createHash('sha256').update(`${ipSubnet}|${userAgent}`).digest('hex')
  }
}
