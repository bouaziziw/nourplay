import { test, expect } from '@playwright/test'

async function loginAs(page: Parameters<typeof test.fn>[0]['page'], email: string, password: string) {
  await page.goto('/login')
  await page.fill('input[type=email]', email)
  await page.fill('input[type=password]', password)
  await page.click('button[type=submit]')
  await page.waitForURL(/\/dashboard/, { timeout: 10_000 })
}

// ── Child interface without a session ─────────────────────────────────────────

test.describe('Child interface (no session)', () => {
  test('/child/favorites redirects to profile selector when no session', async ({ page }) => {
    await page.goto('/child/favorites')
    await expect(page).toHaveURL(/\/child$/, { timeout: 8_000 })
  })

  test('/child/playlists redirects to profile selector when no session', async ({ page }) => {
    await page.goto('/child/playlists')
    await expect(page).toHaveURL(/\/child$/, { timeout: 8_000 })
  })

  test('/child/watch/some-id redirects to profile selector when no session', async ({ page }) => {
    await page.goto('/child/watch/00000000-0000-0000-0000-000000000000')
    await expect(page).toHaveURL(/\/child$/, { timeout: 8_000 })
  })
})

// ── Profile selector (authenticated parent) ───────────────────────────────────

test.describe('Child profile selector (authenticated)', () => {
  test.skip(!process.env.TEST_EMAIL, 'TEST_EMAIL not set')

  test('"Qui regarde ?" heading is visible', async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!)
    await page.goto('/child')
    await expect(page.locator('h1:has-text("Qui regarde")')).toBeVisible({ timeout: 8_000 })
  })

  test('back-to-dashboard button is present', async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!)
    await page.goto('/child')
    await expect(
      page.locator('button:has-text("tableau de bord"), a:has-text("tableau de bord")')
    ).toBeVisible({ timeout: 8_000 })
  })

  test('profile cards or empty state renders', async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!)
    await page.goto('/child')
    // Either profile cards or "Aucun profil" empty state
    await expect(
      page.locator('button.group, text=Aucun profil')
    ).toBeVisible({ timeout: 8_000 })
  })
})

// ── Child header (feature B/E: daily limit indicator + favorites link) ─────────

test.describe('Child header controls', () => {
  test.skip(!process.env.TEST_EMAIL, 'TEST_EMAIL not set')
  test.skip(!process.env.TEST_CHILD_PROFILE_ID, 'TEST_CHILD_PROFILE_ID not set')
  test.skip(!process.env.TEST_CHILD_PIN, 'TEST_CHILD_PIN not set')

  // Set up a child session by injecting it into sessionStorage directly
  test.beforeEach(async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!)
    await page.goto('/child')

    // Inject session so we bypass the PIN flow
    await page.evaluate(
      ({ profileId, pin }) => {
        const session = {
          profileId,
          displayName: 'Test',
          ageGroup: 'AGE_4_6',
          dailyLimitMin: 60,
          sessionLimitMin: null,
          viewingSchedule: null,
          activatedAt: Date.now(),
        }
        sessionStorage.setItem('nourplay_child_session', JSON.stringify(session))
      },
      { profileId: process.env.TEST_CHILD_PROFILE_ID!, pin: process.env.TEST_CHILD_PIN! },
    )
  })

  test('child playlists page renders after session injection', async ({ page }) => {
    await page.goto('/child/playlists')
    await expect(page).toHaveURL(/\/child\/playlists/)
    await expect(page.locator('h1:has-text("playlists")')).toBeVisible({ timeout: 8_000 })
  })

  test('favorites heart link is visible in the child header', async ({ page }) => {
    await page.goto('/child/playlists')
    // The heart SVG link in the sticky header
    await expect(page.locator('a[title="Mes favoris"]')).toBeVisible({ timeout: 8_000 })
  })

  test('favorites page renders after session injection', async ({ page }) => {
    await page.goto('/child/favorites')
    await expect(page).toHaveURL(/\/child\/favorites/)
    await expect(
      page.locator('h1:has-text("favoris")')
    ).toBeVisible({ timeout: 8_000 })
  })

  test('favorites page shows empty state or video grid', async ({ page }) => {
    await page.goto('/child/favorites')
    await expect(
      page.locator('p:has-text("Aucun favori"), .grid')
    ).toBeVisible({ timeout: 10_000 })
  })
})
