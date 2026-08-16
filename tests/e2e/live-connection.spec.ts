import { expect, test } from '@playwright/test'

const liveResponses: Record<string, unknown> = {
  '/status': { status: 'ok', version: '0.2.3', catalog_revision: 13 },
  '/assets': [
    {
      id: 'asset-live-ssh',
      name: 'live-ssh',
      protocol: 'ssh',
      hostname: '192.0.2.10',
      port: 22,
      description: null,
      tags: ['live'],
      credential_id: 'credential-live',
      created_at: null,
      updated_at: null,
      ownership: 'local',
    },
  ],
  '/credentials': [
    {
      id: 'credential-live',
      name: 'live-credential',
      username: 'deploy',
      auth_type: 'password',
      password: 'configured',
      private_key: 'missing',
      passphrase: 'missing',
      ownership: 'local',
    },
  ],
  '/access-keys': [
    {
      id: 'key-live',
      name: 'live-key',
      fingerprint: 'SHA256:live',
      enabled: true,
      access_mode: 'all',
      assets: null,
      ownership: 'local',
    },
  ],
  '/sessions': [],
}

test.describe('Hop live connection', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Desktop connection workflow coverage')
    await page.addInitScript(() => {
      window.sessionStorage.clear()
      window.localStorage.setItem('hop.panel-locale', 'en')
    })
    await page.route('**/api/v1/**', async (route) => {
      const endpoint = new URL(route.request().url()).pathname.replace('/api/v1', '')
      const response = liveResponses[endpoint]
      if (response === undefined) {
        await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      })
    })
  })

  test('refreshes the current route immediately after the first authentication', async ({ page }) => {
    await page.goto('/')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByLabel('Webpage management Token').fill('management-token')
    await dialog.getByRole('button', { name: 'Connect', exact: true }).click()

    await expect(dialog).not.toBeVisible()
    await expect(page.getByRole('heading', { name: 'API connected' })).toBeVisible()
    const overview = page.getByRole('region', { name: 'API connected' })
    await expect(overview.getByText('0.2.3', { exact: true })).toBeVisible()
    await expect(overview.getByText('r13', { exact: true })).toBeVisible()
    const resources = overview.getByRole('navigation', { name: 'Catalog resources' })
    await expect(resources.getByRole('link', { name: 'SSH assets 1' })).toBeVisible()
    await expect(resources.getByRole('link', { name: 'Credentials 1' })).toBeVisible()
    await expect(resources.getByRole('link', { name: 'Access keys 1' })).toBeVisible()
    await expect(page).toHaveURL(/\/$/)
  })
})
