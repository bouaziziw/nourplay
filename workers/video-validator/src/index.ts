import dotenv from 'dotenv'
import path from 'node:path'
import fs from 'node:fs'
import { Worker, Queue } from 'bullmq'
import { PrismaClient } from '@nourplay/db'
import { Redis } from 'ioredis'
import { validateVideo } from './validator.worker'

// Charger le fichier d'environnement (.env) depuis le répertoire courant ou la racine du monorepo
const candidateEnvFiles = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../../.env'),
]

for (const envFile of candidateEnvFiles) {
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile })
  }
}

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
const QUEUE_NAME = 'video-validation'
const CONCURRENCY = Math.max(1, Number(process.env.VALIDATOR_CONCURRENCY) || 5)

console.log(`[validator] Initializing with Redis: ${REDIS_URL.replace(/:\/\/[^@]*@/, '://***@')} (concurrency: ${CONCURRENCY})`)

const connectionOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times: number) => Math.min(times * 1000, 15000),
  tls: REDIS_URL.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
}

const connection = new Redis(REDIS_URL, connectionOptions)
const prisma = new PrismaClient()

connection.on('connect', () => {
  console.log('[validator] Redis connection established')
})

let lastRedisError = 0
connection.on('error', (err) => {
  const now = Date.now()
  if (now - lastRedisError > 10000) {
    lastRedisError = now
    console.warn('[validator] Redis connection error:', err.message)
  }
})

// File BullMQ dédiée pour l'export éventuel sans bloquer la connexion du worker
let _queueInstance: Queue | null = null
export function getVideoValidationQueue(): Queue {
  if (!_queueInstance) {
    _queueInstance = new Queue(QUEUE_NAME, {
      connection: new Redis(REDIS_URL, connectionOptions),
    })
  }
  return _queueInstance
}

export const videoValidationQueue = new Proxy({} as Queue, {
  get(_target, prop) {
    const queue = getVideoValidationQueue() as unknown as Record<string, unknown>
    const val = queue[prop as string]
    return typeof val === 'function' ? val.bind(queue) : val
  },
})

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const { videoId } = job.data as { videoId: string }
    console.log(`[validator] Processing video ${videoId}`)

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: {
        source: { select: { slug: true } },
        tags: { select: { tag: { select: { name: true } } } },
        playlistVideos: {
          select: {
            playlist: {
              select: {
                id: true,
                name: true,
                _count: { select: { playlistVideos: true } },
              },
            },
          },
        },
      },
    })
    if (!video) {
      console.warn(`[validator] Video ${videoId} not found, skipping`)
      return
    }
    if (video.validationStatus !== 'PENDING') {
      console.warn(`[validator] Video ${videoId} is no longer pending (${video.validationStatus}), skipping`)
      return
    }

    const result = await validateVideo({
      videoId: video.id,
      title: video.title,
      description: video.description ?? '',
      language: video.language ?? 'fr',
      requestedAgeRating: video.ageRating,
      durationSec: video.durationSec,
      sourceSlug: video.source.slug,
      thumbnailUrl: video.thumbnailUrl,
      tags: video.tags.map(({ tag }) => tag.name),
      playlists: video.playlistVideos.map(({ playlist }) => ({
        id: playlist.id,
        name: playlist.name,
        totalVideos: playlist._count.playlistVideos,
      })),
    })

    const assessedAgeRatingMap: Record<string, 'ALL' | 'AGE_4_PLUS' | 'AGE_7_PLUS' | 'AGE_10_PLUS' | 'AGE_13_PLUS'> = {
      all_ages: 'ALL',
      '7_plus': 'AGE_7_PLUS',
      '13_plus': 'AGE_13_PLUS',
      '16_plus': 'AGE_13_PLUS',
      '18_plus': 'AGE_13_PLUS',
    }
    const evaluatedAgeRating = assessedAgeRatingMap[result.log.age_rating] ?? 'ALL'

    const updated = await prisma.$transaction(async tx => {
      const statusUpdate = await tx.video.updateMany({
        where: { id: videoId, validationStatus: 'PENDING' },
        data: {
          validationStatus: result.status,
          validationScore: result.score,
          validationLog: result.log as never,
          ...(result.status === 'APPROVED' && evaluatedAgeRating ? { ageRating: evaluatedAgeRating } : {}),
        },
      })
      if (statusUpdate.count === 0) return false

      const playlistIds = video.playlistVideos.map(({ playlist }) => playlist.id)
      const playlists = playlistIds.length
        ? await tx.playlist.findMany({
            where: { id: { in: playlistIds } },
            select: {
              id: true,
              name: true,
              playlistVideos: { select: { video: { select: { validationStatus: true } } } },
            },
          })
        : []
      const assessments = playlists.map(playlist => {
        const statuses = playlist.playlistVideos
          .map(({ video: playlistVideo }) => playlistVideo?.validationStatus)
          .filter((status): status is NonNullable<typeof status> => Boolean(status))
        const approved = statuses.filter(status => status === 'APPROVED').length
        const rejected = statuses.filter(status => status === 'REJECTED').length
        const needsReview = statuses.length - approved - rejected
        return {
          playlist_id: playlist.id,
          playlist_name: playlist.name,
          is_playlist: true,
          total_videos: statuses.length,
          approved,
          rejected,
          needs_review: needsReview,
          playlist_decision:
            statuses.length === 0
              ? ('A_VERIFIER' as const)
              : rejected === statuses.length
                ? ('REJETE' as const)
                : rejected > 0 || needsReview > 0
                  ? ('A_VERIFIER' as const)
                  : ('APPROUVE' as const),
        }
      })

      const report = {
        ...result.log,
        playlist_assessment: assessments[0] ?? {
          is_playlist: false,
          total_videos: 0,
          approved: 0,
          rejected: 0,
          needs_review: 0,
          playlist_decision: 'A_VERIFIER',
        },
        playlist_assessments: assessments,
      }
      await tx.video.update({
        where: { id: videoId },
        data: { validationLog: report as never },
      })
      return true
    })

    if (!updated) {
      console.warn(`[validator] Video ${videoId} was manually reviewed while validation was running`)
      return
    }

    console.log(`[validator] Video ${videoId} → ${result.status} (confidence: ${result.score.toFixed(2)}, model: ${result.log.model})`)
  },
  {
    connection,
    concurrency: CONCURRENCY,
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
  },
)

worker.on('ready', () => {
  console.log(`[validator] Worker ready and listening on queue "${QUEUE_NAME}"`)
})

worker.on('active', (job) => {
  console.log(`[validator] Job ${job.id} active (videoId: ${job.data?.videoId})`)
})

worker.on('completed', (job) => {
  console.log(`[validator] Job ${job.id} completed`)
})

worker.on('failed', (job, err) => {
  console.error(`[validator] Job ${job?.id} failed:`, err.message)
})

let lastWorkerError = 0
worker.on('error', (err) => {
  const now = Date.now()
  if (now - lastWorkerError > 10000) {
    lastWorkerError = now
    console.warn('[validator] Worker error:', err.message)
  }
})

let isShuttingDown = false
const shutdown = async (signal: string) => {
  if (isShuttingDown) return
  isShuttingDown = true
  console.log(`[validator] Received ${signal}, closing worker gracefully...`)
  try {
    await worker.close()
    if (_queueInstance) {
      await _queueInstance.close()
    }
    await prisma.$disconnect()
    connection.disconnect()
    console.log('[validator] Worker shutdown complete')
    process.exit(0)
  } catch (err) {
    console.error('[validator] Error during shutdown:', err)
    process.exit(1)
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
