import { test, expect } from '@playwright/test'
import { loginAsParent as loginAs } from './auth-helper'

// ── Unauthenticated ───────────────────────────────────────────────────────────

test.describe('Profiles (unauthenticated)', () => {
  test('profile creation redirects to login', async ({ page }) => {
    await page.goto('/dashboard/profiles/new')
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 8_000 })
  })
})

// ── Authenticated ─────────────────────────────────────────────────────────────

test.describe('Profiles list (authenticated)', () => {
  test.skip(!process.env.TEST_EMAIL, 'TEST_EMAIL not set')

  test('dashboard renders with create-profile option', async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!)
    await expect(page.locator('a[href$="/dashboard/profiles/new"]').first()).toBeVisible({ timeout: 8_000 })
  })
})

// ── Profile detail + analytics (feature A) ────────────────────────────────────

test.describe('Profile analytics (authenticated)', () => {
  test.skip(!process.env.TEST_EMAIL, 'TEST_EMAIL not set')

  test('profile detail page has Statistiques tab', async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!)
    const profileLink = page.locator('a[title="Modifier"][href*="/dashboard/profiles/"]').first()
    await profileLink.click()
    await expect(page).toHaveURL(/\/dashboard\/profiles\//)

    // Stats tab button should be present
    await expect(
      page.locator('button:has-text("Statistiques")')
    ).toBeVisible({ timeout: 8_000 })
  })

  test('Statistiques tab shows today/week/month cards', async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!)
    const profileLink = page.locator('a[title="Modifier"][href*="/dashboard/profiles/"]').first()
    await profileLink.click()
    await page.locator('button:has-text("Statistiques")').click()

    await expect(page.locator('text=Aujourd\'hui')).toBeVisible({ timeout: 8_000 })
    await expect(page.getByText('7 derniers jours', { exact: true })).toBeVisible()
    await expect(page.getByText('30 derniers jours', { exact: true })).toBeVisible()
  })

  test('Statistiques tab shows 7-day bar chart section', async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!)
    const profileLink = page.locator('a[title="Modifier"][href*="/dashboard/profiles/"]').first()
    await profileLink.click()
    await page.locator('button:has-text("Statistiques")').click()

    // Feature A: daily chart heading
    await expect(
      page.locator('text=Visionnage par jour')
    ).toBeVisible({ timeout: 8_000 })
  })

  test('Statistiques tab shows top videos section', async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!)
    const profileLink = page.locator('a[title="Modifier"][href*="/dashboard/profiles/"]').first()
    await profileLink.click()
    await page.locator('button:has-text("Statistiques")').click()

    await expect(
      page.locator('text=Vidéos les plus regardées')
    ).toBeVisible({ timeout: 8_000 })
  })
})
