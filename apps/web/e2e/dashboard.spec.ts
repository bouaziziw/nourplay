import { test, expect } from '@playwright/test'
import { loginAsParent as loginAs } from './auth-helper'

test.describe('Dashboard (requires valid test account)', () => {
  // These tests are skipped unless TEST_EMAIL and TEST_PASSWORD env vars are set.
  // Run with: TEST_EMAIL=... TEST_PASSWORD=... pnpm e2e
  test.skip(!process.env.TEST_EMAIL, 'TEST_EMAIL not set')

  test('dashboard home renders after login', async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!)
    await expect(page.locator('nav').getByRole('link', { name: 'NourPlay', exact: true })).toBeVisible()
    await expect(page.getByRole('main').getByRole('heading', { name: /playlists/i })).toBeVisible()
  })

  test('notification bell is visible in nav', async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!)
    await expect(page.locator('button[aria-label="Notifications"]')).toBeVisible()
  })

  test('account page renders', async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!)
    await page.locator('nav a[href$="/dashboard/account"]').click()
    await expect(page.getByRole('heading', { name: 'Mon compte' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Vos droits RGPD' })).toBeVisible()
  })

  test('playlists page renders', async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!)
    await page.locator('nav').getByRole('link', { name: 'Playlists', exact: true }).first().click()
    await expect(page).toHaveURL(/\/dashboard\/playlists/)
  })

  test('logout navigates to login', async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!)
    await page.getByRole('button', { name: 'Déconnexion' }).click()
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 8_000 })
  })
})
