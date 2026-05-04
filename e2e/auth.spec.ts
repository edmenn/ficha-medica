import { expect, test } from '@playwright/test'
import { login, requireEnv } from './helpers'

test('unauthenticated user redirects to /login', async ({ page }) => {
  await page.goto('/records')
  await expect(page).toHaveURL(/\/login$/)
})

test('authenticated user redirects from /login to /records', async ({ page }) => {
  test.skip(!!requireEnv('E2E_USER_EMAIL', 'E2E_USER_PASSWORD'), requireEnv('E2E_USER_EMAIL', 'E2E_USER_PASSWORD') ?? '')

  await login(page, process.env.E2E_USER_EMAIL!, process.env.E2E_USER_PASSWORD!)
  await page.goto('/login')
  await expect(page).toHaveURL(/\/records$/)
})
