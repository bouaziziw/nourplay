import { test, expect } from '@playwright/test'

test.describe('Shared playlist viewer', () => {
  test('shows not-found state for invalid token', async ({ page }) => {
    await page.goto('/shared/invalidtoken000000000000000000000000000000000000')
    // Should show the not-found UI — no redirect, no crash
    await expect(page.locator('text=/introuvable|not found/i')).toBeVisible({ timeout: 8_000 })
  })

  test('page does not require authentication', async ({ page }) => {
    // Even an unauthenticated visit should render the shared page (not redirect to login)
    await page.goto('/shared/sometoken')
    await expect(page).not.toHaveURL(/\/auth\/login/)
  })

  test('NourPlay branding is visible on shared page', async ({ page }) => {
    await page.route('**/api/v1/playlists/shared/validtoken', route => route.fulfill({
      json: {
        id: 'playlist-id',
        name: 'Playlist de test',
        description: null,
        visibility: 'PUBLIC',
        targetAgeGroup: [],
        languages: [],
        scheduledPublishAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        playlistVideos: [],
      },
    }))
    await page.goto('/shared/validtoken')
    await expect(page.locator('body').getByText('NourPlay', { exact: true })).toBeVisible()
  })
})
