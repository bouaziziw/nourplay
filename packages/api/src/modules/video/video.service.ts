import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common'
import { Queue } from 'bullmq'
import { PrismaService } from '../../common/prisma/prisma.service'
import { CacheService } from '../../common/cache/cache.service'
import { VIDEO_VALIDATION_QUEUE } from '../../common/bull/bull.module'
import { SubmitVideoDto } from './dto/submit-video.dto'

const VIDEO_SEARCH_TTL = 120

const YOUTUBE_REGEX = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
const VIMEO_REGEX = /vimeo\.com\/(\d+)/

interface ParsedVideo {
  sourceSlug: string
  externalId: string
  embedUrl: string
  thumbnailUrl?: string
}

@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    @Inject(VIDEO_VALIDATION_QUEUE) private readonly validationQueue: Queue,
  ) {}

  async submit(userId: string, dto: SubmitVideoDto) {
    const parsed = this.parseVideoUrl(dto.url)
    if (!parsed) throw new BadRequestException('URL de vidéo non supportée (YouTube ou Vimeo uniquement)')

    const source = await this.prisma.videoSource.findFirst({
      where: { slug: parsed.sourceSlug, embedAllowed: true, isActive: true },
    })
    if (!source) throw new BadRequestException('Source vidéo non autorisée')

    // Déduplique : si la vidéo existe déjà et est approuvée, on la retourne
    const existing = await this.prisma.video.findUnique({
      where: { sourceId_externalId: { sourceId: source.id, externalId: parsed.externalId } },
    })
    if (existing?.validationStatus === 'APPROVED') return existing
    if (existing) {
      this.logger.log(`Video ${existing.id} already submitted with status ${existing.validationStatus}`)
      return existing
    }

    // Récupère les métadonnées via l'API YouTube si disponible
    const metadata = await this.fetchYouTubeMetadata(parsed.externalId, parsed.sourceSlug)

    const video = await this.prisma.video.create({
      data: {
        sourceId: source.id,
        externalId: parsed.externalId,
        embedUrl: parsed.embedUrl,
        title: metadata.title ?? `Vidéo ${parsed.externalId}`,
        description: metadata.description,
        durationSec: metadata.durationSec,
        thumbnailUrl: parsed.thumbnailUrl ?? metadata.thumbnailUrl,
        language: dto.language ?? metadata.language,
        ageRating: dto.ageRating ?? 'ALL',
        submittedById: userId,
        validationStatus: 'PENDING',
      },
    })

    // Envoie en file de validation IA
    await this.validationQueue.add('validate', { videoId: video.id }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    })

    this.logger.log(`Video ${video.id} submitted and queued for validation`)
    return video
  }

  async findById(id: string) {
    const video = await this.prisma.video.findUnique({
      where: { id },
      include: {
        source: { select: { name: true, slug: true } },
        tags: { include: { tag: true } },
      },
    })
    if (!video) throw new NotFoundException('Vidéo introuvable')
    return video
  }

  async findSimilar(videoId: string, limit = 4) {
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
      select: { ageRating: true, language: true },
    })
    if (!video) throw new NotFoundException('Vidéo introuvable')

    const videoSelect = {
      id: true, title: true, thumbnailUrl: true,
      embedUrl: true, durationSec: true, language: true, ageRating: true,
    }
    const baseWhere = { validationStatus: 'APPROVED' as const }

    // Tier 1: same ageRating + same language
    const tier1 = await this.prisma.video.findMany({
      where: {
        ...baseWhere,
        id: { not: videoId },
        ageRating: video.ageRating,
        ...(video.language ? { language: video.language } : {}),
      },
      select: videoSelect,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    if (tier1.length >= limit) return tier1

    // Tier 2: same ageRating, any language — fill remaining slots
    const found = tier1.map(v => v.id)
    const tier2 = await this.prisma.video.findMany({
      where: {
        ...baseWhere,
        id: { notIn: [videoId, ...found] },
        ageRating: video.ageRating,
      },
      select: videoSelect,
      orderBy: { createdAt: 'desc' },
      take: limit - tier1.length,
    })

    return [...tier1, ...tier2]
  }

  async listTags() {
    return this.prisma.tag.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, locale: true },
    })
  }

  async search(params: {
    q?: string
    language?: string
    ageRating?: string
    sourceSlug?: string
    tags?: string[]
    page?: number
    limit?: number
  }) {
    const { q, language, ageRating, sourceSlug, tags, page = 1, limit = 20 } = params
    const cacheKey = `videos:search:${q ?? '_'}:${language ?? '_'}:${ageRating ?? '_'}:${sourceSlug ?? '_'}:t${tags?.join(',') ?? '_'}:p${page}:l${limit}`

    type SearchResult = { items: unknown[]; total: number; page: number; limit: number; pages: number }
    const cached = await this.cache.get<SearchResult>(cacheKey)
    if (cached) return cached

    const skip = (page - 1) * Math.min(limit, 50)

    const where: Record<string, unknown> = { validationStatus: 'APPROVED' }
    if (language) where.language = language
    if (ageRating) where.ageRating = ageRating
    if (sourceSlug) where.source = { slug: sourceSlug }
    if (q) where.title = { contains: q, mode: 'insensitive' }
    if (tags?.length) where.tags = { some: { tagId: { in: tags } } }

    const [items, total] = await Promise.all([
      this.prisma.video.findMany({
        where,
        select: {
          id: true, title: true, thumbnailUrl: true,
          durationSec: true, language: true, ageRating: true,
          source: { select: { name: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Math.min(limit, 50),
      }),
      this.prisma.video.count({ where }),
    ])

    const result: SearchResult = { items, total, page, limit, pages: Math.ceil(total / limit) }
    await this.cache.set(cacheKey, result, VIDEO_SEARCH_TTL)
    return result
  }

  async report(userId: string, videoId: string, reason: string, description?: string) {
    const video = await this.prisma.video.findUnique({ where: { id: videoId } })
    if (!video) throw new NotFoundException('Vidéo introuvable')
    return this.prisma.videoReport.create({
      data: { videoId, reportedBy: userId, reason, description },
    })
  }

  private parseVideoUrl(url: string): ParsedVideo | null {
    const ytMatch = url.match(YOUTUBE_REGEX)
    if (ytMatch) {
      const id = ytMatch[1]
      return {
        sourceSlug: 'youtube',
        externalId: id,
        embedUrl: `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`,
        thumbnailUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
      }
    }
    const vimeoMatch = url.match(VIMEO_REGEX)
    if (vimeoMatch) {
      const id = vimeoMatch[1]
      return {
        sourceSlug: 'vimeo',
        externalId: id,
        embedUrl: `https://player.vimeo.com/video/${id}?title=0&byline=0&portrait=0`,
      }
    }
    return null
  }

  private async fetchYouTubeMetadata(videoId: string, sourceSlug: string) {
    if (sourceSlug !== 'youtube' || !process.env.YOUTUBE_API_KEY) return {}
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,contentDetails&key=${process.env.YOUTUBE_API_KEY}`,
      )
      const data = await res.json() as { items?: Array<{ snippet: { title: string; description: string; defaultAudioLanguage?: string; thumbnails: { high: { url: string } } }; contentDetails: { duration: string } }> }
      const item = data.items?.[0]
      if (!item) return {}
      const duration = this.parseISO8601Duration(item.contentDetails.duration)
      return {
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnailUrl: item.snippet.thumbnails.high?.url,
        language: item.snippet.defaultAudioLanguage,
        durationSec: duration,
      }
    } catch {
      return {}
    }
  }

  private parseISO8601Duration(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
    if (!match) return 0
    const h = parseInt(match[1] ?? '0')
    const m = parseInt(match[2] ?? '0')
    const s = parseInt(match[3] ?? '0')
    return h * 3600 + m * 60 + s
  }
}
