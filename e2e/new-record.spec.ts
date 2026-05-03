import path from 'path'
import { expect, test } from '@playwright/test'
import { login, requireEnv } from './helpers'

test('full flow: capture -> analyze -> save -> appears in list', async ({ page }) => {
  const missing = requireEnv('E2E_USER_EMAIL', 'E2E_USER_PASSWORD', 'E2E_IMAGE_PATH')
  test.skip(!!missing, missing ?? '')

  await login(page, process.env.E2E_USER_EMAIL!, process.env.E2E_USER_PASSWORD!)
  await page.goto('/new')

  const imagePath = path.resolve(process.cwd(), process.env.E2E_IMAGE_PATH!)
  await page.locator('input[type="file"]').nth(1).setInputFiles(imagePath)

  await expect(page.getByRole('heading', { name: 'Revisar datos' })).toBeVisible({ timeout: 45_000 })
  const createDuplicateButton = page.getByRole('button', { name: /crear igual/i })
  if (await createDuplicateButton.isVisible().catch(() => false)) {
    await createDuplicateButton.click()
    await expect(page.getByRole('heading', { name: 'Revisar datos' })).toBeVisible({ timeout: 45_000 })
  }
  await page.getByRole('button', { name: /guardar registro/i }).click()

  await expect(page).toHaveURL(/\/records$/)
})
