import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'

@Injectable()
export class ModerationService {
  constructor(private prisma: PrismaService) {}

  getPendingQueue() {
    return this.prisma.video.findMany({
      where: {
        validationStatus: 'NEEDS_REVIEW',
      },
    })
  }
}
