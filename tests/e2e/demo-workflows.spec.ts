import { expect, test } from '@playwright/test'

import { expectNoPageOverflow, openDemo } from './helpers'

test.describe('Hop demo workspace', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Desktop workflow coverage')
    await openDemo(page)
  })

  test('starts in an explicit Demo workspace and exposes all six routes', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible()
    await expect(page.getByRole('button', { name: /Demo data.*Synthetic workspace/i })).toBeVisible()
    await expect(page.getByText(/Demo workspace.*synthetic examples/i)).toBeVisible()

    const navigation = page.getByRole('complementary', { name: 'Primary navigation' })
    const routes = [
      ['Overview', '/'],
      ['Assets', '/assets'],
      ['Credentials', '/credentials'],
      ['Access', '/access'],
      ['Sessions', '/sessions'],
      ['Configuration', '/configuration'],
    ] as const

    for (const [label, path] of routes) {
      await navigation.getByRole('link', { name: label, exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`${path === '/' ? '/$' : `${path}$`}`))
      await expect(page.getByRole('heading', { name: label, level: 1 }).first()).toBeVisible()
    }

    await expectNoPageOverflow(page)
  })

  test('filters assets and opens a deep-linked master-detail inspector', async ({ page }) => {
    await page.goto('/assets')

    const inventory = page.getByRole('table', { name: 'Catalog assets' })
    const search = page.getByRole('searchbox', { name: 'Search assets' })
    await expect(inventory).toBeVisible()
    await search.fill('router-ui')

    const assetRow = page.getByRole('button', { name: /router-ui.*192\.168\.50\.1:443/i })
    await expect(assetRow).toBeVisible()
    await expect(page.getByRole('button', { name: /prod-gateway/i })).toHaveCount(0)
    await assetRow.click()

    await expect(page).toHaveURL(/\/assets\?.*asset=asset-router-ui/)
    const inspector = page.getByRole('complementary', { name: 'Selected asset' })
    await expect(inspector.getByRole('heading', { name: 'router-ui' })).toBeVisible()
    await expect(inspector).toContainText('192.168.50.1:443')
    await expect(inspector).toContainText('Local')
  })

  test('creates a local TCP asset without a real backend', async ({ page }) => {
    await page.goto('/assets')
    await page.getByRole('button', { name: 'New asset', exact: true }).click()

    const editor = page.getByRole('dialog')
    await expect(editor.getByRole('heading', { name: 'New asset' })).toBeVisible()
    await editor.getByLabel('Name', { exact: true }).fill('e2e-metrics')
    await editor.getByRole('combobox', { name: 'Protocol', exact: true }).selectOption('tcp')
    await editor.getByLabel('Hostname or IP').fill('10.77.0.9')
    await editor.getByLabel('Port', { exact: true }).fill('9100')
    await editor.getByRole('textbox', { name: /^Tags/ }).fill('e2e, metrics')
    await editor.getByRole('button', { name: 'Create asset', exact: true }).click()

    await expect(editor).not.toBeVisible()
    await expect(page).toHaveURL(/asset=asset-demo-/)
    const inspector = page.getByRole('complementary', { name: 'Selected asset' })
    await expect(inspector.getByRole('heading', { name: 'e2e-metrics' })).toBeVisible()
    await expect(inspector).toContainText('10.77.0.9:9100')
  })

  test('keeps credential secrets write-only and access keys public-only', async ({ page }) => {
    await page.goto('/credentials')
    const credentials = page.getByRole('list', { name: 'Credentials' })
    await expect(credentials).toBeVisible()
    await expect(credentials.getByRole('button', { name: /homelab-root/i })).toBeVisible()

    const credentialDetail = page.getByRole('complementary', { name: 'Credential details' })
    await expect(credentialDetail.getByRole('heading', { name: 'Secret status' })).toBeVisible()
    await expect(credentialDetail).toContainText('Values are intentionally unavailable after write.')
    await page.getByRole('button', { name: 'New credential', exact: true }).click()
    await expect(credentialDetail.getByRole('heading', { name: 'New credential' })).toBeVisible()
    await expect(credentialDetail).toContainText('are never displayed again')

    await page.goto('/access')
    const accessKeys = page.getByRole('list', { name: 'Access keys' })
    await expect(accessKeys).toBeVisible()
    await expect(accessKeys.getByRole('button', { name: /oslo-laptop/i })).toBeVisible()

    const accessDetail = page.getByRole('complementary', { name: 'Access key details' })
    await expect(accessDetail.getByRole('heading', { name: 'Public-key fingerprint' })).toBeVisible()
    await expect(accessDetail).toContainText('Hop does not store or return its private key.')
    await page.getByRole('button', { name: 'Add public key', exact: true }).click()
    await expect(accessDetail.getByRole('heading', { name: 'Add access key' })).toBeVisible()
    await expect(accessDetail).toContainText('It does not generate or return a private key.')
  })

  test('terminates an active Demo session through an explicit confirmation', async ({ page }) => {
    await page.goto('/sessions')
    await page.getByRole('button', { name: /Active 1/ }).click()

    const activeRow = page.getByRole('row', { name: /homelab-nas.*oslo-laptop.*Active/i })
    await expect(activeRow).toBeVisible()
    await activeRow.click()
    await expect(page).toHaveURL(/session=session-active-shell/)

    const detail = page.getByRole('complementary', { name: 'Session details' })
    await detail.getByRole('button', { name: 'Terminate session', exact: true }).click()
    const confirmation = page.getByRole('dialog')
    await expect(confirmation.getByRole('heading', { name: 'Terminate this session?' })).toBeVisible()
    await expect(confirmation).toContainText('The recent session record will remain available.')
    await confirmation.getByRole('button', { name: 'Terminate session', exact: true }).click()

    await expect(page.getByText('Termination signal sent')).toBeVisible()
    await expect(page.getByText(/was marked terminated/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Active 0/ })).toBeVisible()
  })

  test('validates, previews, and applies a Demo manifest in order', async ({ page }) => {
    await page.goto('/configuration')
    const workspace = page.getByRole('main')
    const manifest = workspace.getByRole('textbox', { name: /manifest (content|document)/i })
    const source = workspace.getByRole('textbox', { name: /source id/i })

    await source.fill('e2e-panel')
    await manifest.fill('api_version: hop/v1alpha1\nassets: {}\n')
    await workspace.getByRole('button', { name: /validate manifest/i }).click()
    await expect(workspace.getByText(/manifest (is valid|validated)|validation passed/i).first()).toBeVisible()

    await workspace.getByRole('button', { name: /(preview|show) diff|diff manifest/i }).click()
    await expect(workspace.getByText(/diff (is ready|preview)|changes? to apply/i).first()).toBeVisible()

    await workspace.getByRole('button', { name: /apply manifest/i }).click()
    const confirmation = page.getByRole('dialog')
    if (await confirmation.isVisible()) {
      await confirmation.getByRole('button', { name: /apply manifest/i }).click()
    }
    await expect(workspace.getByText(/manifest applied|catalog updated|apply completed/i).first()).toBeVisible()
  })
})
