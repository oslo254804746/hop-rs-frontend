import { expect, type Page } from '@playwright/test'

export async function openDemo(page: Page, path = '/') {
  await page.addInitScript(() => {
    window.sessionStorage.clear()
    window.localStorage.setItem('hop.panel-locale', 'en')
  })
  await page.goto(path)
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Use demo data' }).click()
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
