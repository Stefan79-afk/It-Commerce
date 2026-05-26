import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  globalTimeout: 300_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://localhost',
    headless: true,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
