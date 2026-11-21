import { test, expect } from '@playwright/test'
import { loginAsParent as loginAs } from './auth-helper'

// ── Unauthenticated ───────────────────────────────────────────────────────────

test.describe('Video library (unauthenticated)', () => {
  test('redirects to login', async ({ page }) => {
    await page.goto('/dashboard/videos')
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 8_000 })
  })
})

// ── Authenticated ─────────────────────────────────────────────────────────────

test.describe('Video library (authenticated)', () => {
  test.skip(!process.env.TEST_EMAIL, 'TEST_EMAIL not set')

  test('page renders with title and submit button', async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!)
    await page.locator('nav').getByRole('link', { name: 'Vidéothèque', exact: true }).first().click()
    await expect(page.locator('h1:has-text("Vidéothèque")')).toBeVisible()
    await expect(page.locator('a:has-text("Soumettre")')).toBeVisible()
  })

  test('search form has title input, language select, age-rating select', async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!)
    await page.locator('nav').getByRole('link', { name: 'Vidéothèque', exact: true }).first().click()
    await expect(page.locator('input[placeholder*="titre"]')).toBeVisible()
    // Two <select> elements: language then age rating
    await expect(page.locator('main select')).toHaveCount(2)
    await expect(page.locator('button[type=submit]:has-text("Rechercher")')).toBeVisible()
  })

  test('language dropdown contains Français and English options', async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!)
    await page.locator('nav').getByRole('link', { name: 'Vidéothèque', exact: true }).first().click()
    const langSelect = page.locator('main select').first()
    await expect(langSelect.locator('option[value="fr"]')).toHaveCount(1)
    await expect(langSelect.locator('option[value="en"]')).toHaveCount(1)
    await expect(langSelect.locator('option[value="ar"]')).toHaveCount(1)
  })

  test('age rating dropdown contains Tous publics and 4+ options', async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!)
    await page.locator('nav').getByRole('link', { name: 'Vidéothèque', exact: true }).first().click()
    const ageSelect = page.locator('main select').nth(1)
    await expect(ageSelect.locator('option:has-text("Tous publics")')).toHaveCount(1)
    await expect(ageSelect.locator('option:has-text("4+")')).toHaveCount(1)
    await expect(ageSelect.locator('option:has-text("7+")')).toHaveCount(1)
  })

  test('initial page load shows results grid or empty state', async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!)
    await page.locator('nav').getByRole('link', { name: 'Vidéothèque', exact: true }).first().click()
    // Either a results grid, or an empty-state paragraph
    await expect(
      page.locator('.grid, p:has-text("Lancez"), p:has-text("Aucun résultat")')
    ).toBeVisible({ timeout: 10_000 })
  })

  test('filtering by age rating and clicking search does not crash', async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!)
    await page.locator('nav').getByRole('link', { name: 'Vidéothèque', exact: true }).first().click()
    await page.locator('main select').nth(1).selectOption('AGE_4_PLUS')
    await page.click('button[type=submit]:has-text("Rechercher")')
    await expect(
      page.locator('.grid, p:has-text("Lancez"), p:has-text("Aucun résultat")')
    ).toBeVisible({ timeout: 10_000 })
  })

  test('add-to-playlist button appears on video card hover', async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!)
    await page.route('**/api/v1/videos/search*', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      json: {
        items: [{
          id: 'video-id',
          title: 'Vidéo de test',
          thumbnailUrl: null,
          embedUrl: 'https://www.youtube.com/watch?v=test',
          durationSec: 60,
          language: 'fr',
          ageRating: 'ALL',
        }],
        total: 1,
        page: 1,
        pages: 1,
      },
    }))
    await page.locator('nav').getByRole('link', { name: 'Vidéothèque', exact: true }).first().click()
    await page.getByRole('button', { name: 'Rechercher' }).click()
    const card = page.locator('.group').filter({ hasText: 'Vidéo de test' })
    await expect(card).toBeVisible({ timeout: 15_000 })
    await card.hover()
    await expect(card.getByRole('button', { name: '+ Playlist' })).toBeVisible()
  })
})
