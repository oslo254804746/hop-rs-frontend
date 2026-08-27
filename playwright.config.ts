import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { defineConfig, devices } from '@playwright/test'

const artifactDirectory = process.env.PLAYWRIGHT_ARTIFACT_DIR ?? join(tmpdir(), 'hop-rs-frontend-playwright')
const outputDirectory = process.env.PLAYWRIGHT_OUTPUT_DIR ?? join(artifactDirectory, 'test-results')
const reportDirectory = process.env.PLAYWRIGHT_REPORT_DIR ?? join(artifactDirectory, 'playwright-report')

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: outputDirectory,
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never', outputFolder: reportDirectory }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
  ],
})
