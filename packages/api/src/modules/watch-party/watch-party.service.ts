import { Injectable, NotFoundException } from '@nestjs/common'
import { randomBytes } from 'crypto'
import { PrismaService } from '../../common/prisma/prisma.service'
import { CreateWatchPartyDto } from './dto/create-watch-party.dto'

@Injectable()
export class WatchPartyService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateWatchPartyDto) {
    const playlist = await this.prisma.playlist.findFirst({
      where: { id: dto.playlistId, ownerId: userId, deletedAt: null },
      select: { id: true },
    })
    if (!playlist) throw new NotFoundException('Playlist introuvable')

    let code: string
    do {
      code = randomBytes(3).toString('hex').toUpperCase()
    } while (await this.prisma.watchParty.findUnique({ where: { code } }))

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    return this.prisma.watchParty.create({
      data: { code, hostId: userId, playlistId: dto.playlistId, expiresAt },
      select: { id: true, code: true, hostId: true, playlistId: true, expiresAt: true },
    })
  }

  async findByCode(code: string) {
    const party = await this.prisma.watchParty.findUnique({
      where: { code },
      select: {
        id: true,
        code: true,
        hostId: true,
        expiresAt: true,
        playlist: {
          select: {
            id: true,
            name: true,
            _count: { select: { playlistVideos: true } },
          },
        },
      },
    })
    if (!party || party.expiresAt < new Date()) {
      throw new NotFoundException('Salle introuvable ou expirée')
    }
    return party
  }
}
