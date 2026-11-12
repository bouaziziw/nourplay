import { Injectable, NotFoundException } from '@nestjs/common'
import { createHash } from 'crypto'
import { PrismaService } from '../../common/prisma/prisma.service'
import { CreateConsentDto } from './dto/create-consent.dto'
import { ConsentType } from '@nourplay/db'

@Injectable()
export class ConsentService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserConsents(userId: string) {
    return this.prisma.consentRecord.findMany({
      where: { userId, revokedAt: null },
      select: { id: true, type: true, version: true, consentedAt: true },
      orderBy: { consentedAt: 'desc' },
    })
  }

  async record(userId: string, dto: CreateConsentDto, ip: string, userAgent?: string) {
    const ipHash = createHash('sha256').update(ip).digest('hex')
    return this.prisma.consentRecord.create({
      data: {
        userId,
        type: dto.type,
        version: dto.version,
        ipHash,
        userAgent,
      },
      select: { id: true, type: true, version: true, consentedAt: true },
    })
  }

  async revoke(userId: string, type: ConsentType) {
    await this.prisma.consentRecord.updateMany({
      where: { userId, type, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }

  async getHistory(userId: string) {
    return this.prisma.consentRecord.findMany({
      where: { userId },
      select: { id: true, type: true, version: true, consentedAt: true, revokedAt: true },
      orderBy: { consentedAt: 'desc' },
    })
  }
}
