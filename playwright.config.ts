import { defineConfig, devices } from '@playwright/test';

const authSecret = 'hum-vicio-e2e-isolated-secret-2026-000000000000';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-results/artifacts',
  snapshotDir: './tests/e2e/__screenshots__',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3100',
    storageState: 'test-results/.auth/admin.json',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    colorScheme: 'dark',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },
  globalSetup: './tests/e2e/global-setup.ts',
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100/login',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { ...process.env, AUTH_SECRET: authSecret },
  },
});

export { authSecret };
