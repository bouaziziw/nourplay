import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { randomBytes } from 'crypto'
import { PrismaService } from '../../common/prisma/prisma.service'
import { CreatePlaylistDto } from './dto/create-playlist.dto'
import { UpdatePlaylistDto } from './dto/update-playlist.dto'
import { AddVideoDto } from './dto/add-video.dto'
import { ReorderVideosDto } from './dto/reorder-videos.dto'
import { SharePlaylistDto } from './dto/share-playlist.dto'

const PLAYLIST_SELECT = {
  id: true,
  name: true,
  description: true,
  visibility: true,
  targetAgeGroup: true,
  languages: true,
  shareToken: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { playlistVideos: true } },
}

@Injectable()
export class PlaylistService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.playlist.findMany({
      where: { ownerId: userId, deletedAt: null },
      select: PLAYLIST_SELECT,
      orderBy: { updatedAt: 'desc' },
    })
  }

  async create(userId: string, dto: CreatePlaylistDto) {
    return this.prisma.playlist.create({
      data: {
        ownerId: userId,
        name: dto.name,
        description: dto.description,
        visibility: dto.visibility,
        targetAgeGroup: dto.targetAgeGroup ?? [],
        languages: dto.languages ?? [],
      },
      select: PLAYLIST_SELECT,
    })
  }

  async findOne(userId: string, playlistId: string) {
    const playlist = await this.prisma.playlist.findFirst({
      where: {
        id: playlistId,
        deletedAt: null,
        OR: [
          { ownerId: userId },
          { accesses: { some: { grantedTo: userId } } },
        ],
      },
      include: {
        playlistVideos: {
          where: { video: { validationStatus: 'APPROVED' } },
          orderBy: { position: 'asc' },
          include: {
            video: {
              select: {
                id: true,
                title: true,
                thumbnailUrl: true,
                durationSec: true,
                embedUrl: true,
                language: true,
                ageRating: true,
              },
            },
          },
        },
      },
    })
    if (!playlist) throw new NotFoundException('Playlist introuvable')
    return playlist
  }

  async update(userId: string, playlistId: string, dto: UpdatePlaylistDto) {
    await this.assertOwner(userId, playlistId)
    return this.prisma.playlist.update({
      where: { id: playlistId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.visibility && { visibility: dto.visibility }),
        ...(dto.targetAgeGroup && { targetAgeGroup: dto.targetAgeGroup }),
        ...(dto.languages && { languages: dto.languages }),
      },
      select: PLAYLIST_SELECT,
    })
  }

  async remove(userId: string, playlistId: string) {
    await this.assertOwner(userId, playlistId)
    await this.prisma.playlist.update({
      where: { id: playlistId },
      data: { deletedAt: new Date() },
    })
  }

  async addVideo(userId: string, playlistId: string, dto: AddVideoDto) {
    await this.assertOwnerOrEditor(userId, playlistId)

    const video = await this.prisma.video.findFirst({
      where: { id: dto.videoId, validationStatus: 'APPROVED' },
    })
    if (!video) throw new BadRequestException('Vidéo introuvable ou non approuvée')

    const maxPos = await this.prisma.playlistVideo.aggregate({
      where: { playlistId },
      _max: { position: true },
    })
    const position = dto.position ?? (maxPos._max.position ?? -1) + 1

    return this.prisma.playlistVideo.create({
      data: { playlistId, videoId: dto.videoId, position, addedById: userId },
    })
  }

  async removeVideo(userId: string, playlistId: string, videoId: string) {
    await this.assertOwnerOrEditor(userId, playlistId)
    const pv = await this.prisma.playlistVideo.findUnique({
      where: { playlistId_videoId: { playlistId, videoId } },
    })
    if (!pv) throw new NotFoundException('Vidéo non trouvée dans cette playlist')
    await this.prisma.playlistVideo.delete({
      where: { playlistId_videoId: { playlistId, videoId } },
    })
  }

  async reorderVideos(userId: string, playlistId: string, dto: ReorderVideosDto) {
    await this.assertOwnerOrEditor(userId, playlistId)
    await this.prisma.$transaction(
      dto.videoIds.map((videoId, position) =>
        this.prisma.playlistVideo.updateMany({
          where: { playlistId, videoId },
          data: { position },
        }),
      ),
    )
  }

  async share(userId: string, playlistId: string, dto: SharePlaylistDto) {
    await this.assertOwner(userId, playlistId)
    const target = await this.prisma.user.findUnique({
      where: { email: dto.email, deletedAt: null },
      select: { id: true },
    })
    if (!target) throw new NotFoundException('Utilisateur introuvable')
    return this.prisma.playlistAccess.upsert({
      where: { playlistId_grantedTo: { playlistId, grantedTo: target.id } },
      update: { role: dto.role },
      create: { playlistId, grantedTo: target.id, role: dto.role },
    })
  }

  async revokeShare(userId: string, playlistId: string, targetUserId: string) {
    await this.assertOwner(userId, playlistId)
    await this.prisma.playlistAccess.deleteMany({
      where: { playlistId, grantedTo: targetUserId },
    })
  }

  async generateShareLink(userId: string, playlistId: string) {
    await this.assertOwner(userId, playlistId)
    const shareToken = randomBytes(24).toString('hex')
    const playlist = await this.prisma.playlist.update({
      where: { id: playlistId },
      data: { shareToken, visibility: 'SHARED_LINK' },
      select: { shareToken: true },
    })
    return { shareToken: playlist.shareToken }
  }

  private async assertOwner(userId: string, playlistId: string) {
    const playlist = await this.prisma.playlist.findFirst({
      where: { id: playlistId, ownerId: userId, deletedAt: null },
    })
    if (!playlist) throw new NotFoundException('Playlist introuvable')
  }

  private async assertOwnerOrEditor(userId: string, playlistId: string) {
    const playlist = await this.prisma.playlist.findFirst({
      where: {
        id: playlistId,
        deletedAt: null,
        OR: [
          { ownerId: userId },
          { accesses: { some: { grantedTo: userId, role: 'EDITOR' } } },
        ],
      },
    })
    if (!playlist) throw new ForbiddenException('Accès refusé à cette playlist')
  }
}
