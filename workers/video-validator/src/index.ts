import { Worker, Queue } from 'bullmq'
import { PrismaClient } from '@nourplay/db'
import { Redis } from 'ioredis'
import { validateVideo } from './validator.worker'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
const QUEUE_NAME = 'video-validation'

const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null })
const prisma = new PrismaClient()

export const videoValidationQueue = new Queue(QUEUE_NAME, { connection })

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const { videoId } = job.data as { videoId: string }
    console.log(`[validator] Processing video ${videoId}`)

    const video = await prisma.video.findUnique({ where: { id: videoId } })
    if (!video) {
      console.warn(`[validator] Video ${videoId} not found, skipping`)
      return
    }

    const result = await validateVideo({
      title: video.title,
      description: video.description ?? '',
      language: video.language ?? 'fr',
    })

    const status =
      result.score >= 0.85
        ? 'APPROVED'
        : result.score >= 0.6
          ? 'NEEDS_REVIEW'
          : 'REJECTED'

    await prisma.video.update({
      where: { id: videoId },
      data: {
        validationStatus: status,
        validationScore: result.score,
        validationLog: result.log as never,
      },
    })

    console.log(`[validator] Video ${videoId} → ${status} (score: ${result.score.toFixed(2)})`)
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
