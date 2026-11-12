import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../../common/prisma/prisma.service'
import { EmailService } from '../../common/email/email.service'

@Injectable()
export class UserTasksService {
  private readonly logger = new Logger(UserTasksService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  // ── Weekly digest — every Monday at 08:00 ──────────────────
  // Sends one email per parent summarising each child's watch activity
  // for the past 7 days. Skips profiles with no watch history that week.

  @Cron('0 8 * * 1', { name: 'weekly-digest' })
  async sendWeeklyDigests() {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const users = await this.prisma.user.findMany({
      where: { deletedAt: null, weeklyDigestEnabled: true },
      select: {
        id: true,
        email: true,
        locale: true,
        childProfiles: {
          where: { deletedAt: null },
          select: {
            id: true,
            displayName: true,
            dailyLimitMin: true,
            watchHistory: {
              where: { watchedAt: { gte: weekAgo } },
              select: {
                videoId: true,
                durationWatchedSec: true,
                video: { select: { id: true, title: true, thumbnailUrl: true } },
              },
            },
          },
        },
      },
    })

    const weekLabel = this.formatWeekLabel(weekAgo, new Date())
    let sent = 0

    for (const user of users) {
      const activeProfiles = user.childProfiles.filter(p => p.watchHistory.length > 0)
      if (activeProfiles.length === 0) continue

      const digests = activeProfiles.map(p => {
        const totalWatchedSec = p.watchHistory.reduce((s, h) => s + h.durationWatchedSec, 0)

        const videoMap = new Map<string, { title: string; thumbnailUrl: string | null; watchCount: number }>()
        for (const h of p.watchHistory) {
          const e = videoMap.get(h.videoId)
          if (e) {
            e.watchCount++
          } else {
            videoMap.set(h.videoId, { title: h.video.title, thumbnailUrl: h.video.thumbnailUrl, watchCount: 1 })
          }
        }
        const topVideos = [...videoMap.values()]
          .sort((a, b) => b.watchCount - a.watchCount)
          .slice(0, 3)

        return {
          profileName: p.displayName,
          totalWatchedSec,
          videoCount: p.watchHistory.length,
          dailyLimitMin: p.dailyLimitMin,
          topVideos,
        }
      })

      await this.email
        .sendWeeklySummaryEmail(user.email, user.locale ?? 'fr', digests, weekLabel)
        .catch(err => this.logger.warn(`Weekly digest failed for ${user.id}: ${err}`))

      sent++
    }

    this.logger.log(`Weekly digests sent to ${sent} parent(s)`)
  }

  private formatWeekLabel(from: Date, to: Date): string {
    const fmt = (d: Date) =>
      d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
    return `${fmt(from)} – ${fmt(to)}`
  }
}
