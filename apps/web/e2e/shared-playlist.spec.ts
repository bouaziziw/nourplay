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
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('NourPlay branding is visible on shared page', async ({ page }) => {
    await page.goto('/shared/sometoken')
    await expect(page.locator('text=NourPlay')).toBeVisible()
  })
})
