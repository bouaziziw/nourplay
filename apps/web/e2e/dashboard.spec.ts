import { test, expect } from '@playwright/test'

// Helper: log in and return a page with an active session
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

test.describe('Dashboard (requires valid test account)', () => {
  // These tests are skipped unless TEST_EMAIL and TEST_PASSWORD env vars are set.
  // Run with: TEST_EMAIL=... TEST_PASSWORD=... pnpm e2e
  test.skip(!process.env.TEST_EMAIL, 'TEST_EMAIL not set')

  test('dashboard home renders after login', async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!)
    await expect(page.locator('text=NourPlay')).toBeVisible()
    await expect(page.locator('text=Playlists')).toBeVisible()
  })

  test('notification bell is visible in nav', async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!)
    await expect(page.locator('button[aria-label="Notifications"]')).toBeVisible()
  })

  test('account page renders', async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!)
    await page.goto('/dashboard/account')
    await expect(page.locator('text=Mon compte')).toBeVisible()
    await expect(page.locator('text=RGPD')).toBeVisible()
  })

  test('playlists page renders', async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!)
    await page.goto('/dashboard/playlists')
    await expect(page).toHaveURL(/\/dashboard\/playlists/)
  })

  test('logout navigates to login', async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!)
    // find and click the logout button or link
    const logoutBtn = page.locator('button:has-text("Déconnexion"), a:has-text("Déconnexion")')
    if (await logoutBtn.count() > 0) {
      await logoutBtn.first().click()
      await expect(page).toHaveURL(/\/login/, { timeout: 8_000 })
    }
  })
})
