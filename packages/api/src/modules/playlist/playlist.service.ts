import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  BadGatewayException,
  ServiceUnavailableException,
  Inject,
  Logger,
} from '@nestjs/common'
import { Queue } from 'bullmq'
import { Cron, CronExpression } from '@nestjs/schedule'
import { randomBytes } from 'crypto'
import { Prisma, VideoValidationStatus } from '@nourplay/db'
import { PrismaService } from '../../common/prisma/prisma.service'
import { SubscriptionService } from '../subscription/subscription.service'
import { allowedAgeRatings } from '../../common/age-utils'
import { CreatePlaylistDto } from './dto/create-playlist.dto'
import { UpdatePlaylistDto } from './dto/update-playlist.dto'
import { AddVideoDto } from './dto/add-video.dto'
import { ReorderVideosDto } from './dto/reorder-videos.dto'
import { SharePlaylistDto } from './dto/share-playlist.dto'
import { SchedulePlaylistDto } from './dto/schedule-playlist.dto'
import { VIDEO_VALIDATION_QUEUE } from '../../common/bull/bull.module'

const PLAYLIST_SELECT = {
  id: true,
  name: true,
  description: true,
  visibility: true,
  targetAgeGroup: true,
  languages: true,
  shareToken: true,
  scheduledPublishAt: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { playlistVideos: true } },
}

interface YouTubePlaylistVideo {
  externalId: string
  publishedAt?: string
  title?: string
  description?: string
  defaultLanguage?: string
  defaultAudioLanguage?: string
  thumbnails?: Record<string, { url: string }>
}

@Injectable()
export class PlaylistService {
  private readonly logger = new Logger(PlaylistService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionService: SubscriptionService,
    @Inject(VIDEO_VALIDATION_QUEUE) private readonly validationQueue: Queue,
  ) {}

  async findAll(userId: string) {
    return this.prisma.playlist.findMany({
      where: { ownerId: userId, deletedAt: null },
      select: PLAYLIST_SELECT,
      orderBy: { updatedAt: 'desc' },
    })
  }

  async create(userId: string, dto: CreatePlaylistDto) {
    const count = await this.prisma.playlist.count({
      where: { ownerId: userId, deletedAt: null },
    })
    const { maxPlaylists, planSlug } = await this.subscriptionService.getUserPlanLimits(userId)
    if (count >= maxPlaylists) {
      throw new BadRequestException(
        planSlug === 'free'
          ? 'Votre forfait gratuit est limité à 5 playlists. Passez à Premium pour créer des playlists illimitées.'
          : `Maximum de playlists atteint (${maxPlaylists})`,
      )
    }

    if (dto.importExternalPlaylist) {
      if (!dto.externalPlaylistUrl) {
        throw new BadRequestException('URL de playlist YouTube requise pour l’import')
      }
      return this.createWithYouTubePlaylist(userId, dto, dto.externalPlaylistUrl)
    }

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

  private async createWithYouTubePlaylist(userId: string, dto: CreatePlaylistDto, externalPlaylistUrl: string) {
    const playlistItems = await this.fetchYouTubePlaylist(externalPlaylistUrl)
    const source = await this.prisma.videoSource.findFirst({
      where: { slug: 'youtube', embedAllowed: true, isActive: true },
      select: { id: true },
    })
    if (!source) throw new BadRequestException('La source YouTube n’est pas autorisée')

    const result = await this.prisma.$transaction(async tx => {
      const playlist = await tx.playlist.create({
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

      await tx.video.createMany({
        data: playlistItems.map(item => {
          const thumbnails = item.thumbnails ?? {}
          return {
            sourceId: source.id,
            externalId: item.externalId,
            embedUrl: `https://www.youtube.com/embed/${item.externalId}?rel=0&modestbranding=1`,
            title: item.title || `Vidéo ${item.externalId}`,
            description: item.description,
            thumbnailUrl: thumbnails.maxres?.url ?? thumbnails.standard?.url
              ?? thumbnails.high?.url ?? thumbnails.medium?.url ?? thumbnails.default?.url,
            language: item.defaultAudioLanguage ?? item.defaultLanguage,
            publishedAt: item.publishedAt ? new Date(item.publishedAt) : undefined,
            submittedById: userId,
            validationStatus: 'PENDING',
          }
        }),
        skipDuplicates: true,
      })

      const importedIds = playlistItems.map(item => item.externalId)
      const videos = await tx.video.findMany({
        where: { sourceId: source.id, externalId: { in: importedIds } },
        select: { id: true, externalId: true, validationStatus: true, submittedById: true, submitterApprovedAt: true },
      })
      const availableVideos = videos.filter(video =>
        video.validationStatus !== 'REJECTED'
        && (video.validationStatus === 'APPROVED' || video.submittedById === userId),
      )
      const videoIdByExternalId = new Map(availableVideos.map(video => [video.externalId, video.id]))
      const playlistVideos = importedIds.flatMap((externalId, position) => {
        const videoId = videoIdByExternalId.get(externalId)
        return videoId ? [{ playlistId: playlist.id, videoId, position, addedById: userId }] : []
      })

      if (playlistVideos.length > 0) {
        await tx.playlistVideo.createMany({ data: playlistVideos, skipDuplicates: true })
      }

      return {
        ...playlist,
        _count: { playlistVideos: playlistVideos.length },
        importedVideoCount: playlistVideos.length,
        pendingValidationVideoIds: videos.filter(video =>
          video.validationStatus === 'PENDING' && video.submittedById === userId,
        ).map(video => video.id),
        skippedVideoCount: playlistItems.length - playlistVideos.length,
      }
    })

    const queueResults = await Promise.allSettled(result.pendingValidationVideoIds.map(async videoId => {
      const jobId = `video-validation-${videoId}`
      const existingJob = await this.validationQueue.getJob(jobId)
      if (existingJob) {
        const state = await existingJob.getState()
        if (
          state === 'completed'
          || state === 'failed'
          || ((state === 'waiting' || state === 'delayed') && existingJob.opts.priority !== 1)
        ) {
          await existingJob.remove()
        }
      }
      return this.validationQueue.add('validate', { videoId }, {
        jobId,
        priority: 1,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      })
    }))
    const validationQueueFailedCount = queueResults.filter(queueResult => queueResult.status === 'rejected').length
    if (validationQueueFailedCount > 0) {
      this.logger.error(
        `Failed to enqueue priority validation for ${validationQueueFailedCount} imported playlist video(s)`,
        queueResults
          .filter((queueResult): queueResult is PromiseRejectedResult => queueResult.status === 'rejected')
          .map(queueResult => queueResult.reason instanceof Error ? queueResult.reason.stack : String(queueResult.reason))
          .join('\n'),
      )
    }

    const { pendingValidationVideoIds, ...playlistResult } = result
    return {
      ...playlistResult,
      pendingValidationCount: pendingValidationVideoIds.length,
      validationQueueFailedCount,
    }
  }

  private async fetchYouTubePlaylist(url: string): Promise<YouTubePlaylistVideo[]> {
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      throw new BadRequestException('URL de playlist YouTube invalide')
    }

    const allowedHosts = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com']
    if (parsedUrl.protocol !== 'https:' || !allowedHosts.includes(parsedUrl.hostname.toLowerCase())) {
      throw new BadRequestException('Seules les playlists YouTube publiques sont prises en charge')
    }

    const apiKey = process.env.YOUTUBE_API_KEY
    if (!apiKey) {
      throw new ServiceUnavailableException('L’import YouTube nécessite la configuration de YOUTUBE_API_KEY')
    }

    const playlistId = await this.resolveYouTubePlaylistId(parsedUrl, apiKey)
    const items: YouTubePlaylistVideo[] = []
    const pageTokens = new Set<string>()
    let pageToken: string | undefined

    do {
      const apiUrl = new URL('https://www.googleapis.com/youtube/v3/playlistItems')
      apiUrl.searchParams.set('part', 'snippet')
      apiUrl.searchParams.set('maxResults', '50')
      apiUrl.searchParams.set('playlistId', playlistId)
      apiUrl.searchParams.set('key', apiKey)
      if (pageToken) apiUrl.searchParams.set('pageToken', pageToken)

      let response: Response
      try {
        response = await fetch(apiUrl)
      } catch {
        throw new BadGatewayException('Impossible de joindre l’API YouTube pour importer cette playlist')
      }
      if (!response.ok) {
        throw new BadGatewayException(
          'Playlist YouTube inaccessible : elle est peut-être privée, supprimée ou indisponible',
        )
      }

      let data: {
        items?: Array<{
          snippet?: Omit<YouTubePlaylistVideo, 'externalId'> & { resourceId?: { videoId?: string } }
        }>
        nextPageToken?: string
      }
      try {
        data = await response.json() as typeof data
      } catch {
        throw new BadGatewayException('Réponse invalide reçue de l’API YouTube')
      }

      items.push(...(data.items ?? []).flatMap(item => {
        const snippet = item.snippet
        const externalId = snippet?.resourceId?.videoId
        if (!snippet || !externalId) return []
        return [{ ...snippet, externalId }]
      }))
      pageToken = data.nextPageToken
      if (pageToken) {
        if (pageTokens.has(pageToken)) {
          throw new BadGatewayException('La pagination de la playlist YouTube est invalide')
        }
        pageTokens.add(pageToken)
      }
    } while (pageToken)

    if (items.length === 0) {
      throw new BadRequestException('Cette playlist YouTube est vide ou ne contient aucune vidéo accessible')
    }
    return [...new Map(items.map(item => [item.externalId, item])).values()]
  }

  private async resolveYouTubePlaylistId(url: URL, apiKey: string): Promise<string> {
    const playlistId = url.searchParams.get('list')
    if (playlistId) {
      if (!/^[a-zA-Z0-9_-]{10,100}$/.test(playlistId)) {
        throw new BadRequestException('Cette URL ne contient pas d’identifiant de playlist YouTube valide')
      }
      return playlistId
    }

    const pathSegments = url.pathname.split('/').filter(Boolean)
    const handle = pathSegments[0]?.match(/^@([a-zA-Z0-9._-]{3,30})$/)?.[1]
    const channelId = pathSegments[0] === 'channel' ? pathSegments[1] : undefined
    if (!handle && (!channelId || !/^UC[a-zA-Z0-9_-]{22}$/.test(channelId))) {
      throw new BadRequestException(
        'Collez une URL de playlist YouTube ou une URL de chaîne comme https://www.youtube.com/@playlistname',
      )
    }

    const apiUrl = new URL('https://www.googleapis.com/youtube/v3/channels')
    apiUrl.searchParams.set('part', 'contentDetails')
    apiUrl.searchParams.set('key', apiKey)
    if (handle) apiUrl.searchParams.set('forHandle', handle)
    else apiUrl.searchParams.set('id', channelId!)

    let response: Response
    try {
      response = await fetch(apiUrl)
    } catch {
      throw new BadGatewayException('Impossible de joindre l’API YouTube pour récupérer la chaîne')
    }
    if (!response.ok) {
      throw new BadGatewayException('Chaîne YouTube inaccessible ou introuvable')
    }

    let data: { items?: Array<{ contentDetails?: { relatedPlaylists?: { uploads?: string } } }> }
    try {
      data = await response.json() as typeof data
    } catch {
      throw new BadGatewayException('Réponse invalide reçue de l’API YouTube')
    }

    const uploadsPlaylistId = data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
    if (!uploadsPlaylistId) {
      throw new BadRequestException('La chaîne YouTube est introuvable ou ne contient aucune vidéo publique')
    }
    return uploadsPlaylistId
  }

  async findOne(userId: string, playlistId: string, profileId?: string) {
    let ageFilter: ReturnType<typeof allowedAgeRatings> | undefined
    const blockConditions: Prisma.VideoWhereInput[] = []

    if (profileId) {
      const [profile, blocks] = await Promise.all([
        this.prisma.childProfile.findFirst({
          where: { id: profileId, userId, deletedAt: null },
          select: { ageGroup: true },
        }),
        this.prisma.userBlock.findMany({
          where: { userId, OR: [{ profileId }, { profileId: null }] },
          select: { type: true, value: true },
        }),
      ])

      if (profile) ageFilter = allowedAgeRatings(profile.ageGroup)

      const keywordBlacklist = blocks.filter(b => b.type === 'KEYWORD_BLACKLIST').map(b => b.value)
      const channelBlacklist = blocks.filter(b => b.type === 'CHANNEL_BLACKLIST').map(b => b.value)
      const keywordWhitelist = blocks.filter(b => b.type === 'KEYWORD_WHITELIST').map(b => b.value)
      const channelWhitelist = blocks.filter(b => b.type === 'CHANNEL_WHITELIST').map(b => b.value)

      for (const keyword of keywordBlacklist) {
        blockConditions.push({ NOT: { title: { contains: keyword, mode: 'insensitive' } } })
      }
      if (channelBlacklist.length > 0) {
        blockConditions.push({ NOT: { source: { slug: { in: channelBlacklist } } } })
      }
      if (keywordWhitelist.length > 0) {
        blockConditions.push({ OR: keywordWhitelist.map(k => ({ title: { contains: k, mode: 'insensitive' } })) })
      }
      if (channelWhitelist.length > 0) {
        blockConditions.push({ source: { slug: { in: channelWhitelist } } })
      }
    }

    const visibleVideoStatuses: Prisma.VideoWhereInput[] = [
      { validationStatus: VideoValidationStatus.APPROVED },
      ...(!profileId
        ? [{
            validationStatus: {
              in: [
                VideoValidationStatus.PENDING,
                VideoValidationStatus.NEEDS_REVIEW,
                VideoValidationStatus.REJECTED,
              ],
            },
            submittedById: userId,
          }]
        : []),
    ]

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
          where: {
            video: {
              OR: visibleVideoStatuses.map(status => ({
                ...status,
                ...(ageFilter ? { ageRating: { in: ageFilter } } : {}),
                ...(blockConditions.length > 0 ? { AND: blockConditions } : {}),
              })),
            },
          },
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
                validationStatus: true,
                submitterApprovedAt: true,
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

  async schedule(userId: string, playlistId: string, dto: SchedulePlaylistDto) {
    await this.assertOwner(userId, playlistId)
    let date: Date | null = null
    if (dto.scheduledPublishAt != null) {
      date = new Date(dto.scheduledPublishAt)
      if (isNaN(date.getTime())) throw new BadRequestException('Date invalide')
      if (date <= new Date()) throw new BadRequestException('La date doit être dans le futur')
    }
    return this.prisma.playlist.update({
      where: { id: playlistId },
      data: { scheduledPublishAt: date },
      select: { id: true, scheduledPublishAt: true },
    })
  }

  async findScheduled(userRole: string) {
    if (userRole !== 'ADMIN' && userRole !== 'MODERATOR') {
      throw new ForbiddenException('Accès réservé aux administrateurs')
    }
    return this.prisma.playlist.findMany({
      where: { scheduledPublishAt: { not: null }, deletedAt: null },
      select: {
        id: true,
        name: true,
        visibility: true,
        scheduledPublishAt: true,
        targetAgeGroup: true,
        _count: { select: { playlistVideos: true } },
        owner: { select: { id: true, email: true } },
      },
      orderBy: { scheduledPublishAt: 'asc' },
    })
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async publishScheduled() {
    const due = await this.prisma.playlist.findMany({
      where: {
        scheduledPublishAt: { lte: new Date() },
        visibility: 'PRIVATE' as never,
        deletedAt: null,
      },
      select: { id: true },
    })
    if (due.length === 0) return
    await Promise.allSettled(
      due.map(({ id }) =>
        this.prisma.playlist.update({
          where: { id },
          data: {
            visibility: 'SHARED_LINK' as never,
            shareToken: randomBytes(24).toString('hex'),
            scheduledPublishAt: null,
          },
        }),
      ),
    )
  }

  async duplicatePlaylist(userId: string, playlistId: string) {
    const original = await this.prisma.playlist.findFirst({
      where: { id: playlistId, ownerId: userId, deletedAt: null },
      include: {
        playlistVideos: {
          orderBy: { position: 'asc' },
          select: { videoId: true, position: true },
        },
      },
    })
    if (!original) throw new NotFoundException('Playlist introuvable')

    const count = await this.prisma.playlist.count({
      where: { ownerId: userId, deletedAt: null },
    })
    const { maxPlaylists, planSlug } = await this.subscriptionService.getUserPlanLimits(userId)
    if (count >= maxPlaylists) {
      throw new BadRequestException(
        planSlug === 'free'
          ? 'Votre forfait gratuit est limité à 5 playlists. Passez à Premium pour créer des playlists illimitées.'
          : `Maximum de playlists atteint (${maxPlaylists})`,
      )
    }

    return this.prisma.$transaction(async (tx) => {
      const copy = await tx.playlist.create({
        data: {
          ownerId: userId,
          name: `Copie de ${original.name}`,
          description: original.description,
          visibility: original.visibility,
          targetAgeGroup: original.targetAgeGroup,
          languages: original.languages,
        },
        select: PLAYLIST_SELECT,
      })
      if (original.playlistVideos.length > 0) {
        await tx.playlistVideo.createMany({
          data: original.playlistVideos.map(pv => ({
            playlistId: copy.id,
            videoId: pv.videoId,
            position: pv.position,
            addedById: userId,
          })),
        })
      }
      return copy
    })
  }

  async findByShareToken(shareToken: string) {
    const playlist = await this.prisma.playlist.findFirst({
      where: { shareToken, visibility: 'SHARED_LINK', deletedAt: null },
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
    if (!playlist) throw new NotFoundException('Playlist introuvable ou accès non autorisé')
    return playlist
  }

  private async assertOwner(userId: string, playlistId: string) {
    const playlist = await this.prisma.playlist.findFirst({
      where: { id: playlistId, ownerId: userId, deletedAt: null },
    })
    if (!playlist) throw new NotFoundException('Playlist introuvable')
  }

  async exportCsv(userId: string, playlistId: string): Promise<string> {
    const playlist = await this.prisma.playlist.findFirst({
      where: {
        id: playlistId,
        deletedAt: null,
        OR: [
          { ownerId: userId },
          { accesses: { some: { grantedTo: userId } } },
        ],
      },
      select: {
        name: true,
        playlistVideos: {
          orderBy: { position: 'asc' },
          select: {
            position: true,
            video: {
              select: {
                title: true,
                embedUrl: true,
                durationSec: true,
                ageRating: true,
                language: true,
              },
            },
          },
        },
      },
    })
    if (!playlist) throw new NotFoundException('Playlist introuvable ou accès non autorisé')

    const header = 'Position,Titre,URL,Durée (sec),Classification,Langue'
    const lines = playlist.playlistVideos.map(pv => {
      const title = this.csvEscape(pv.video.title)
      const url = this.csvEscape(pv.video.embedUrl)
      const dur = pv.video.durationSec ?? ''
      const rating = pv.video.ageRating
      const lang = pv.video.language ?? ''
      return `${pv.position},${title},${url},${dur},${rating},${lang}`
    })
    return '﻿' + header + '\n' + lines.join('\n')
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

  private csvEscape(value: string | null | undefined): string {
    if (value == null) return ''
    const str = String(value)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }
}
