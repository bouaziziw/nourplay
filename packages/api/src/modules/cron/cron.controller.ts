import { createHash, timingSafeEqual } from 'node:crypto'
import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { PlaylistService } from '../playlist/playlist.service'
import { SubscriptionTasksService } from '../subscription/subscription.tasks'
import { UserTasksService } from '../user/user.tasks'

@SkipThrottle()
@Controller({ path: 'cron', version: '1' })
export class CronController {
  constructor(
    private readonly playlists: PlaylistService,
    private readonly users: UserTasksService,
    private readonly subscriptions: SubscriptionTasksService,
  ) {}

  private assertAuthorized(authorization?: string) {
    const secret = process.env.CRON_SECRET
    if (!secret || !authorization) throw new UnauthorizedException()

    const digest = (value: string) => createHash('sha256').update(value).digest()
    if (!timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`))) {
      throw new UnauthorizedException()
    }
  }

  @Get('publish-scheduled')
  async publishScheduled(@Headers('authorization') authorization?: string) {
    this.assertAuthorized(authorization)
    await this.playlists.publishScheduled()
    return { ok: true }
  }

  @Get('weekly-digest')
  async weeklyDigest(@Headers('authorization') authorization?: string) {
    this.assertAuthorized(authorization)
    await this.users.sendWeeklyDigests()
    return { ok: true }
  }

  @Get('subscription-reminders')
  async subscriptionReminders(@Headers('authorization') authorization?: string) {
    this.assertAuthorized(authorization)
    await this.subscriptions.sendExpiryReminders()
    return { ok: true }
  }

  @Get('subscription-cleanup')
  async subscriptionCleanup(@Headers('authorization') authorization?: string) {
    this.assertAuthorized(authorization)
    await this.subscriptions.markExpiredSubscriptions()
    return { ok: true }
  }
}
