import { defineConfig, devices } from '@playwright/test';
const webkit = process.env.PLAYWRIGHT_BROWSER === 'webkit';
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4179',
    actionTimeout: 15_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: webkit
      ? {}
      : {
          channel: process.env.PLAYWRIGHT_CHANNEL,
          args: [
            '--enable-webgl',
            '--use-gl=angle',
            '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader',
          ],
        },
  },
  projects: [
    {
      name: webkit ? 'webkit' : 'chromium',
      use: { ...devices[webkit ? 'Desktop Safari' : 'Desktop Chrome'] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run preview -- --port 4179',
        url: 'http://localhost:4179',
        reuseExistingServer: !process.env.CI,
      },
});
