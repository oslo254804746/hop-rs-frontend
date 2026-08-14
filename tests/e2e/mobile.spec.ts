import { expect, test } from '@playwright/test'

import { expectNoPageOverflow, openDemo } from './helpers'

test.describe('390px mobile workspace', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'Mobile workflow coverage')
    await page.setViewportSize({ width: 390, height: 844 })
    await openDemo(page)
  })

  test('uses the mobile dock and opens asset details as a focused layer', async ({ page }) => {
    const dock = page.getByRole('navigation', { name: 'Mobile navigation' })
    await expect(dock).toBeVisible()
    await dock.getByRole('link', { name: 'Assets', exact: true }).click()
    await expect(page).toHaveURL(/\/assets$/)

    const search = page.getByRole('searchbox', { name: 'Search assets' })
    await search.fill('router-ui')
    await page.getByRole('button', { name: /router-ui.*192\.168\.50\.1:443/i }).click()

    const inspector = page.getByRole('complementary', { name: 'Selected asset' })
    await expect(inspector.getByRole('heading', { name: 'router-ui' })).toBeVisible()
    await expect(page).toHaveURL(/asset=asset-router-ui/)
    await expect(inspector).toContainText('Demo-only · synthetic')
    await expectNoPageOverflow(page)

    await page.goBack()
    await expect(page).toHaveURL(/\/assets\?q=router-ui$/)
    await expect(inspector).toHaveCount(0)

    await page.goForward()
    await expect(inspector.getByRole('heading', { name: 'router-ui' })).toBeVisible()
    await inspector.getByRole('button', { name: 'Close asset details' }).click()
    await expect(page).toHaveURL(/\/assets\?q=router-ui$/)
    await expect(inspector).toHaveCount(0)
  })

  test('keeps secondary routes in More without hiding them', async ({ page }) => {
    const dock = page.getByRole('navigation', { name: 'Mobile navigation' })
    await dock.getByRole('button', { name: 'More', exact: true }).click()

    const more = page.getByRole('region', { name: 'More navigation' })
    await expect(more).toBeVisible()
    await more.getByRole('link', { name: 'Credentials', exact: true }).click()
    await expect(page).toHaveURL(/\/credentials$/)
    await expect(page.getByRole('heading', { name: 'Credentials', level: 1 }).first()).toBeVisible()
    await expectNoPageOverflow(page)
  })
})
