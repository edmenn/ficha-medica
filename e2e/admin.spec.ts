import { expect, test } from '@playwright/test'
import { login, requireEnv } from './helpers'

test('admin cannot access /new', async ({ page }) => {
  const missing = requireEnv('E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD')
  test.skip(!!missing, missing ?? '')

  await login(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!)
  await page.goto('/new')
  await expect(page.getByText('Admins no pueden operar registros')).toBeVisible()
})

test('regular user cannot access /settings/users', async ({ page }) => {
  const missing = requireEnv('E2E_USER_EMAIL', 'E2E_USER_PASSWORD')
  test.skip(!!missing, missing ?? '')

  await login(page, process.env.E2E_USER_EMAIL!, process.env.E2E_USER_PASSWORD!)
  await page.goto('/settings/users')
  await expect(page).toHaveURL(/\/settings$/)
})

test('admin sees records and user management entrypoint', async ({ page }) => {
  const missing = requireEnv('E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD')
  test.skip(!!missing, missing ?? '')

  await login(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!)
  await page.goto('/settings/users')
  await expect(page.getByText('Administración')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Activos' })).toBeVisible()
})
