import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'

@Injectable()
export class PlaylistService {
  constructor(private prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.playlist.findMany({
      where: {
        ownerId: userId,
        deletedAt: null,
      },
    })
  }
}
