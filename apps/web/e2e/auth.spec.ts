import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('login page renders with form', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.locator('input[type=email]')).toBeVisible()
    await expect(page.locator('input[type=password]')).toBeVisible()
    await expect(page.locator('button[type=submit]')).toBeVisible()
  })

  test('login shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type=email]', 'nonexistent@nourplay.test')
    await page.fill('input[type=password]', 'wrongpassword123')
    await page.click('button[type=submit]')
    // API returns 401; the form should show an error message
    await expect(page.locator('[role=alert], .text-red-600, .text-red-700')).toBeVisible({ timeout: 8_000 })
  })

  test('register page renders', async ({ page }) => {
    await page.goto('/register')
    await expect(page.locator('input[type=email]')).toBeVisible()
    await expect(page.locator('input[type=password]')).toBeVisible()
    await expect(page.locator('button[type=submit]')).toBeVisible()
  })

  test('dashboard redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 })
  })
})
