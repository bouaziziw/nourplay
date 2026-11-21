import { test, type Page } from '@playwright/test'

export async function loginAs(page: Page, email: string, password: string) {
  test.setTimeout(75_000)
  // Keep repeated login and parent-password checks below the API rate limits.
  await page.waitForTimeout(15_500)
  await page.goto('/auth/login')
  await page.fill('input[type=email]', email)
  await page.fill('input[type=password]', password)
  await page.click('button[type=submit]')
  await page.waitForURL(/\/child$/, { timeout: 10_000 })
}

export async function loginAsParent(page: Page, email: string, password: string) {
  await loginAs(page, email, password)
  await page.getByRole('button', { name: 'Mode Parent' }).click()
  await page.getByLabel('Mot de passe du compte').fill(password)
  await page.getByRole('button', { name: 'Déverrouiller' }).click()
  await page.waitForURL(/\/dashboard/, { timeout: 10_000 })
}
