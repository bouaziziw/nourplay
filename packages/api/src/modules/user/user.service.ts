import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: { id: true, email: true, role: true, locale: true, createdAt: true, emailVerified: true },
    })
    if (!user) throw new NotFoundException('Utilisateur introuvable')
    return user
  }

  async getProfiles(userId: string) {
    return this.prisma.childProfile.findMany({
      where: { userId, deletedAt: null },
      select: { id: true, displayName: true, ageGroup: true, avatarKey: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })
  }
}
