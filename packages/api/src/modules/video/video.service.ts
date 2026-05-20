import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'

@Injectable()
export class VideoService {
  constructor(private prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.video.findUnique({
      where: { id },
    })
  }
}
