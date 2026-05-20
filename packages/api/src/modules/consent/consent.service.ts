import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'

@Injectable()
export class ConsentService {
  constructor(private prisma: PrismaService) {}

  getUserConsents(userId: string) {
    return this.prisma.consentRecord.findMany({
      where: {
        userId,
        revokedAt: null,
      },
    })
  }
}
