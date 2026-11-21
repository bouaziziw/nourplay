import { UnauthorizedException } from '@nestjs/common'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CronController } from './cron.controller'

describe('CronController', () => {
  const originalSecret = process.env.CRON_SECRET

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = originalSecret
  })

  function makeController() {
    const playlists = { publishScheduled: vi.fn().mockResolvedValue(undefined) }
    const users = { sendWeeklyDigests: vi.fn().mockResolvedValue(undefined) }
    const subscriptions = {
      sendExpiryReminders: vi.fn().mockResolvedValue(undefined),
      markExpiredSubscriptions: vi.fn().mockResolvedValue(undefined),
    }
    return {
      controller: new CronController(playlists as never, users as never, subscriptions as never),
      playlists,
      users,
      subscriptions,
    }
  }

  it('rejects missing or incorrect credentials without running tasks', async () => {
    const { controller, playlists } = makeController()
    process.env.CRON_SECRET = 'test-secret'
    await expect(controller.publishScheduled()).rejects.toThrow(UnauthorizedException)
    await expect(controller.publishScheduled('Bearer wrong')).rejects.toThrow(UnauthorizedException)
    delete process.env.CRON_SECRET
    await expect(controller.publishScheduled('Bearer test-secret')).rejects.toThrow(UnauthorizedException)
    expect(playlists.publishScheduled).not.toHaveBeenCalled()
  })

  it('runs each corresponding task with valid credentials', async () => {
    const { controller, playlists, users, subscriptions } = makeController()
    process.env.CRON_SECRET = 'test-secret'
    const authorization = 'Bearer test-secret'
    expect(await controller.publishScheduled(authorization)).toEqual({ ok: true })
    expect(await controller.weeklyDigest(authorization)).toEqual({ ok: true })
    expect(await controller.subscriptionReminders(authorization)).toEqual({ ok: true })
    expect(await controller.subscriptionCleanup(authorization)).toEqual({ ok: true })
    expect(playlists.publishScheduled).toHaveBeenCalledOnce()
    expect(users.sendWeeklyDigests).toHaveBeenCalledOnce()
    expect(subscriptions.sendExpiryReminders).toHaveBeenCalledOnce()
    expect(subscriptions.markExpiredSubscriptions).toHaveBeenCalledOnce()
  })
})
