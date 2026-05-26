import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common'
import { createHash } from 'crypto'
import * as argon2 from 'argon2'
import { PrismaService } from '../../common/prisma/prisma.service'
import { CreateProfileDto } from './dto/create-profile.dto'
import { UpdateProfileDto } from './dto/update-profile.dto'
import { RecordWatchDto } from './dto/record-watch.dto'

const PIN_SELECT = {
  id: true,
  displayName: true,
  ageGroup: true,
  avatarKey: true,
  birthYear: true,
  dailyLimitMin: true,
  sessionLimitMin: true,
  viewingSchedule: true,
  createdAt: true,
}

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: { id: true, email: true, role: true, locale: true, createdAt: true, emailVerified: true, twoFactorEnabled: true },
    })
    if (!user) throw new NotFoundException('Utilisateur introuvable')
    return user
  }

  // ── Profils enfants ──────────────────────────────────────────

  async getProfiles(userId: string) {
    return this.prisma.childProfile.findMany({
      where: { userId, deletedAt: null },
      select: PIN_SELECT,
      orderBy: { createdAt: 'asc' },
    })
  }

  async createProfile(userId: string, dto: CreateProfileDto) {
    const count = await this.prisma.childProfile.count({
      where: { userId, deletedAt: null },
    })
    if (count >= 6) {
      throw new BadRequestException('Maximum 6 profils enfants par compte')
    }

    const pinHash = await this.hashPin(dto.pin)

    return this.prisma.childProfile.create({
      data: {
        userId,
        displayName: dto.displayName,
        ageGroup: dto.ageGroup,
        birthYear: dto.birthYear,
        pinHash,
        dailyLimitMin: dto.dailyLimitMin,
        sessionLimitMin: dto.sessionLimitMin,
      },
      select: PIN_SELECT,
    })
  }

  async getProfile(userId: string, profileId: string) {
    const profile = await this.prisma.childProfile.findFirst({
      where: { id: profileId, userId, deletedAt: null },
      select: PIN_SELECT,
    })
    if (!profile) throw new NotFoundException('Profil introuvable')
    return profile
  }

  async updateProfile(userId: string, profileId: string, dto: UpdateProfileDto) {
    await this.assertProfileOwner(userId, profileId)
    return this.prisma.childProfile.update({
      where: { id: profileId },
      data: {
        ...(dto.displayName && { displayName: dto.displayName }),
        ...(dto.ageGroup && { ageGroup: dto.ageGroup }),
        ...(dto.dailyLimitMin !== undefined && { dailyLimitMin: dto.dailyLimitMin }),
        ...(dto.sessionLimitMin !== undefined && { sessionLimitMin: dto.sessionLimitMin }),
        ...(dto.viewingSchedule !== undefined && { viewingSchedule: dto.viewingSchedule }),
      },
      select: PIN_SELECT,
    })
  }

  async deleteProfile(userId: string, profileId: string) {
    await this.assertProfileOwner(userId, profileId)
    await this.prisma.childProfile.update({
      where: { id: profileId },
      data: { deletedAt: new Date() },
    })
  }

  async verifyPin(userId: string, profileId: string, pin: string): Promise<boolean> {
    const profile = await this.prisma.childProfile.findFirst({
      where: { id: profileId, userId, deletedAt: null },
      select: { pinHash: true },
    })
    if (!profile) throw new NotFoundException('Profil introuvable')

    const valid = await argon2.verify(profile.pinHash, pin)
    if (!valid) throw new UnauthorizedException('PIN incorrect')
    return true
  }

  async getWatchHistory(userId: string, profileId: string, limit = 50) {
    await this.assertProfileOwner(userId, profileId)
    return this.prisma.watchHistory.findMany({
      where: { profileId },
      include: {
        video: {
          select: { id: true, title: true, thumbnailUrl: true, durationSec: true, embedUrl: true },
        },
      },
      orderBy: { watchedAt: 'desc' },
      take: limit,
    })
  }

  async clearWatchHistory(userId: string, profileId: string) {
    await this.assertProfileOwner(userId, profileId)
    await this.prisma.watchHistory.deleteMany({ where: { profileId } })
  }

  async recordWatchEvent(userId: string, profileId: string, dto: RecordWatchDto) {
    await this.assertProfileOwner(userId, profileId)

    const video = await this.prisma.video.findUnique({
      where: { id: dto.videoId },
      select: { id: true, validationStatus: true },
    })
    if (!video) throw new NotFoundException('Vidéo introuvable')

    return this.prisma.watchHistory.create({
      data: {
        profileId,
        videoId: dto.videoId,
        durationWatchedSec: dto.durationWatchedSec,
        completed: dto.completed,
      },
    })
  }

  // ── Privé ──────────────────────────────────────────────────

  // ── Filtres de contenu (UserBlock) ───────────────────────────

  async getBlocks(userId: string, profileId?: string) {
    return this.prisma.userBlock.findMany({
      where: { userId, ...(profileId ? { profileId } : {}) },
      orderBy: { createdAt: 'desc' },
    })
  }

  async createBlock(userId: string, dto: { profileId?: string; type: string; value: string }) {
    if (dto.profileId) {
      await this.assertProfileOwner(userId, dto.profileId)
    }
    return this.prisma.userBlock.create({
      data: { userId, profileId: dto.profileId ?? null, type: dto.type as never, value: dto.value },
    })
  }

  async deleteBlock(userId: string, blockId: string) {
    const block = await this.prisma.userBlock.findUnique({ where: { id: blockId } })
    if (!block || block.userId !== userId) throw new NotFoundException('Filtre introuvable')
    await this.prisma.userBlock.delete({ where: { id: blockId } })
  }

  private async assertProfileOwner(userId: string, profileId: string) {
    const profile = await this.prisma.childProfile.findFirst({
      where: { id: profileId, userId, deletedAt: null },
      select: { id: true },
    })
    if (!profile) throw new NotFoundException('Profil introuvable')
  }

  private async hashPin(pin: string): Promise<string> {
    return argon2.hash(pin, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
    })
  }
}
