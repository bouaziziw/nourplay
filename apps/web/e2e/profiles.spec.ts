import { test, expect } from '@playwright/test'

async function loginAs(page: Parameters<typeof test.fn>[0]['page'], email: string, password: string) {
  await page.goto('/login')
  await page.fill('input[type=email]', email)
  await page.fill('input[type=password]', password)
  await page.click('button[type=submit]')
  await page.waitForURL(/\/child$/, { timeout: 10_000 })
  await page.getByRole('button', { name: 'Mode Parent' }).click()
  await page.getByLabel('Mot de passe du compte').fill(password)
  await page.getByRole('button', { name: 'Déverrouiller' }).click()
  await page.waitForURL(/\/dashboard/, { timeout: 10_000 })
}

// ── Unauthenticated ───────────────────────────────────────────────────────────

test.describe('Profiles (unauthenticated)', () => {
  test('profiles list redirects to login', async ({ page }) => {
    await page.goto('/dashboard/profiles')
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 })
  })
})

// ── Authenticated ─────────────────────────────────────────────────────────────

test.describe('Profiles list (authenticated)', () => {
  test.skip(!process.env.TEST_EMAIL, 'TEST_EMAIL not set')

  test('profiles page renders with create-profile option', async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!)
    await page.goto('/dashboard/profiles')
    await expect(page).toHaveURL(/\/dashboard\/profiles/)
    // Either shows a "create profile" link/button or existing profiles
    await expect(
      page.locator('a:has-text("Créer"), button:has-text("Créer"), a:has-text("Nouveau")')
        .or(page.locator('[href*="/profiles/new"]'))
        .or(page.locator('text=/profil/i'))
    ).toBeVisible({ timeout: 8_000 })
  })
})

// ── Profile detail + analytics (feature A) ────────────────────────────────────

test.describe('Profile analytics (authenticated)', () => {
  test.skip(!process.env.TEST_EMAIL, 'TEST_EMAIL not set')

  test('profile detail page has Statistiques tab', async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!)
    await page.goto('/dashboard/profiles')

    const profileLink = page.locator('a[href*="/dashboard/profiles/"]').first()
    const count = await profileLink.count()
    if (count === 0) {
      // No profiles exist — skip the rest gracefully
      return
    }

    await profileLink.click()
    await expect(page).toHaveURL(/\/dashboard\/profiles\//)

    // Stats tab button should be present
    await expect(
      page.locator('button:has-text("Statistiques")')
    ).toBeVisible({ timeout: 8_000 })
  })

  test('Statistiques tab shows today/week/month cards', async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!)
    await page.goto('/dashboard/profiles')

    const profileLink = page.locator('a[href*="/dashboard/profiles/"]').first()
    if (await profileLink.count() === 0) return

    await profileLink.click()
    await page.locator('button:has-text("Statistiques")').click()

    await expect(page.locator('text=Aujourd\'hui')).toBeVisible({ timeout: 8_000 })
    await expect(page.locator('text=Cette semaine')).toBeVisible()
    await expect(page.locator('text=Ce mois')).toBeVisible()
  })

  test('Statistiques tab shows 7-day bar chart section', async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!)
    await page.goto('/dashboard/profiles')

    const profileLink = page.locator('a[href*="/dashboard/profiles/"]').first()
    if (await profileLink.count() === 0) return

    await profileLink.click()
    await page.locator('button:has-text("Statistiques")').click()

    // Feature A: daily chart heading
    await expect(
      page.locator('text=Visionnage par jour')
    ).toBeVisible({ timeout: 8_000 })
  })

  test('Statistiques tab shows top videos section', async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!)
    await page.goto('/dashboard/profiles')

    const profileLink = page.locator('a[href*="/dashboard/profiles/"]').first()
    if (await profileLink.count() === 0) return

    await profileLink.click()
    await page.locator('button:has-text("Statistiques")').click()

    await expect(
      page.locator('text=Vidéos les plus regardées')
    ).toBeVisible({ timeout: 8_000 })
  })
})
