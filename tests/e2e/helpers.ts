import { expect, type Page } from '@playwright/test'

export async function openDemo(page: Page, path = '/') {
  await page.addInitScript(() => window.sessionStorage.clear())
  await page.goto(path)
  await expect(page.getByText('Demo workspace', { exact: true }).first()).toBeVisible()
}

export async function expectNoPageOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true)
}
