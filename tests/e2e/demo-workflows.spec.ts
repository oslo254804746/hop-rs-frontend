import { expect, test } from '@playwright/test'

import { expectNoPageOverflow, openDemo } from './helpers'

test.describe('Hop demo workspace', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Desktop workflow coverage')
    await page.setViewportSize({ width: 1440, height: 900 })
  })

  test('starts in an explicit Demo workspace and exposes all seven routes', async ({ page }) => {
    await openDemo(page)
    await expect(page.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible()
    await expect(page.getByRole('button', { name: /Demo data.*Synthetic workspace/i })).toBeVisible()
    await expect(page.getByText(/synthetic examples, not live measurements/i)).toBeVisible()

    const navigation = page.getByRole('complementary', { name: 'Primary navigation' })
    const routes = [
      ['Overview', '/'],
      ['Assets', '/assets'],
      ['Credentials', '/credentials'],
      ['Access', '/access'],
      ['Sessions', '/sessions'],
      ['Host trust', '/known-hosts'],
      ['Settings', '/configuration'],
    ] as const

    for (const [label, path] of routes) {
      await navigation.getByRole('link', { name: label, exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`${path === '/' ? '/$' : `${path}$`}`))
      await expect(page.getByRole('heading', { name: label, level: 1 }).first()).toBeVisible()
    }

    await expectNoPageOverflow(page)
  })

  test('filters assets and opens a deep-linked master-detail inspector', async ({ page }) => {
    await openDemo(page, '/assets')

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
    await expect(inspector).toContainText('Panel / local ownership')
  })

  test('creates a local TCP asset without a real backend', async ({ page }) => {
    await openDemo(page, '/assets')
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
    await openDemo(page, '/credentials')
    const credentials = page.getByRole('list', { name: 'Credentials' })
    await expect(credentials).toBeVisible()
    await expect(credentials.getByRole('button', { name: /homelab-root/i })).toBeVisible()

    const credentialDetail = page.getByRole('complementary', { name: 'Credential details' })
    await expect(credentialDetail.getByRole('heading', { name: 'Secret status' })).toBeVisible()
    await expect(credentialDetail).toContainText('Values are intentionally unavailable after write.')
    await page.getByRole('button', { name: 'New credential', exact: true }).click()
    await expect(credentialDetail.getByRole('heading', { name: 'New credential' })).toBeVisible()
    await expect(credentialDetail).toContainText('are never displayed again')

    await openDemo(page, '/access')
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
    await openDemo(page, '/sessions')
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

  test('resets one verified target host trust record through explicit confirmation', async ({ page }) => {
    await openDemo(page, '/known-hosts')

    const ledger = page.getByRole('list', { name: 'Known Hosts' })
    await expect(ledger).toBeVisible()
    const row = ledger.getByRole('button', { name: /192\.168\.50\.15.*ssh-ed25519/i })
    await row.click()

    const details = page.getByRole('complementary', { name: 'Known Host details' })
    await expect(details).toContainText('homelab-nas')
    await expect(details).toContainText('SHA256:4fK8mQ1Vx7Cz3Ny9Lp2Ba6Hs0Td5Re8Ju1Wi4Go7SnA')
    await details.getByRole('button', { name: 'Reset trust', exact: true }).click()

    const confirmation = page.getByRole('dialog')
    await expect(confirmation.getByRole('heading', { name: 'Reset this host trust?' })).toBeVisible()
    await expect(confirmation).toContainText('next managed connection')
    await confirmation.getByRole('button', { name: 'Reset trust', exact: true }).click()

    await expect(page.getByText('Host trust reset')).toBeVisible()
    await expect(row).toHaveCount(0)
    await expect(page.getByText('2 trusted host keys')).toBeVisible()
  })

  test('explains same-origin authentication and switches between English and Chinese', async ({ page }) => {
    await openDemo(page, '/configuration')
    const main = page.getByRole('main')
    await expect(main.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible()
    await expect(page.getByText(/Compose uses the panel Origin by default/i)).toBeVisible()
    await expect(page.getByText(/Token.*localStorage/i)).toBeVisible()

    await page.getByRole('button', { name: '切换到中文' }).click()
    await expect(main.getByRole('heading', { name: '设置', level: 1 })).toBeVisible()
    await expect(page.getByText(/Compose 默认使用面板当前 Origin/)).toBeVisible()

    await page.getByRole('button', { name: 'Switch to English' }).click()
    await expect(main.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible()
  })

  test('marks configuration-managed resources read-only before showing actions', async ({ page }) => {
    await openDemo(page, '/assets?asset=asset-prod-gateway')
    const inspector = page.getByRole('complementary', { name: 'Selected asset' })
    await expect(inspector).toContainText('Managed by hop.yaml')
    await expect(inspector.getByRole('button', { name: 'Edit asset' })).toHaveCount(0)
    await expect(inspector.getByRole('button', { name: 'Remove asset' })).toHaveCount(0)
  })
})
