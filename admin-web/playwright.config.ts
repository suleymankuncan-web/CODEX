import { defineConfig, devices } from '@playwright/test'

const useSystemChrome = process.env.PLAYWRIGHT_USE_SYSTEM_CHROME === '1'
const ciWorkerCount = process.env.CI ? 2 : 1
const previewPort = Number(process.env.PLAYWRIGHT_PREVIEW_PORT ?? 4174)
const previewUrl = `http://127.0.0.1:${previewPort}`

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  workers: ciWorkerCount,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: previewUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(useSystemChrome ? { channel: 'chrome' } : {}),
      },
    },
  ],
  webServer: {
    command: `npm run preview -- --host 127.0.0.1 --port ${previewPort}`,
    url: previewUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
