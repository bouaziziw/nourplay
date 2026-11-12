import { Worker, Queue } from 'bullmq'
import { PrismaClient } from '@nourplay/db'
import { Redis } from 'ioredis'
import { validateVideo } from './validator.worker'

const REDIS_URL = process.env.REDIS_URL
if (!REDIS_URL) {
  throw new Error('REDIS_URL is required to start the video validator worker')
}
const QUEUE_NAME = 'video-validation'

const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null })
const prisma = new PrismaClient()

export const videoValidationQueue = new Queue(QUEUE_NAME, { connection })

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
      console.warn(`[validator] Video ${videoId} is no longer pending, skipping`)
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

    const updated = await prisma.$transaction(async tx => {
      const statusUpdate = await tx.video.updateMany({
        where: { id: videoId, validationStatus: 'PENDING' },
        data: {
          validationStatus: result.status,
          validationScore: result.score,
          validationLog: result.log as never,
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
        const statuses = playlist.playlistVideos.map(({ video: playlistVideo }) => playlistVideo.validationStatus)
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
          playlist_decision: rejected === statuses.length ? 'REJETE' as const
            : rejected > 0 || needsReview > 0 ? 'A_VERIFIER' as const : 'APPROUVE' as const,
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

    console.log(`[validator] Video ${videoId} → ${result.status} (confidence: ${result.score.toFixed(2)})`)
  },
  {
    connection,
    concurrency: 5,
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
  },
)

worker.on('failed', (job, err) => {
  console.error(`[validator] Job ${job?.id} failed:`, err.message)
})

process.on('SIGTERM', async () => {
  await worker.close()
  await prisma.$disconnect()
  connection.disconnect()
})

console.log(`[validator] Worker started, listening on queue "${QUEUE_NAME}"`)
