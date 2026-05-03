import { expect, test } from '@playwright/test'
import { login, requireEnv } from './helpers'

test('admin is redirected away from /new into admin workspace', async ({ page }) => {
  const missing = requireEnv('E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD')
  test.skip(!!missing, missing ?? '')

  await login(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!)
  await page.goto('/new')
  await expect(page).toHaveURL(/\/admin\/users$/)
})

test('regular user cannot access /admin/users', async ({ page }) => {
  const missing = requireEnv('E2E_USER_EMAIL', 'E2E_USER_PASSWORD')
  test.skip(!!missing, missing ?? '')

  await login(page, process.env.E2E_USER_EMAIL!, process.env.E2E_USER_PASSWORD!)
  await page.goto('/admin/users')
  await expect(page).toHaveURL(/\/records$/)
})

test('admin sees exclusive user management workspace', async ({ page }) => {
  const missing = requireEnv('E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD')
  test.skip(!!missing, missing ?? '')

  await login(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!)
  await page.goto('/admin/users')
  await expect(page.getByText('Administración')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Activos' })).toBeVisible()
  await expect(page.getByRole('link', { name: /ver usuario/i }).first()).toBeVisible()
})
