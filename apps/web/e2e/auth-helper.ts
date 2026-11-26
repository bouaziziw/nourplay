import { test, type Page } from '@playwright/test'

export async function loginAs(page: Page, email: string, password: string) {
  test.setTimeout(75_000)
  await page.goto('/auth/login')
  await page.fill('input[type=email]', email)
  await page.fill('input[type=password]', password)
  await page.click('button[type=submit]')
  await page.waitForURL(/\/(child|dashboard)/, { timeout: 15_000 })
}

export async function loginAsParent(page: Page, email: string, password: string) {
  await loginAs(page, email, password)
  if (!page.url().includes('/dashboard')) {
    const modeParentBtn = page.getByRole('button', { name: 'Mode Parent' })
    if (await modeParentBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await modeParentBtn.click()
      await page.getByLabel('Mot de passe du compte').fill(password)
      await page.getByRole('button', { name: 'Déverrouiller' }).click()
    }
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 })
  }
}

