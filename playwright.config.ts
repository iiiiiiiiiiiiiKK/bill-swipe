import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8787';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    {
      name: 'iphone',
      use: {
        ...devices['iPhone 13'],
        // The deployment's certificate chain is not always accepted by WebKit's
        // stricter TLS validation in CI sandboxes; this only relaxes the test
        // browser, never the app.
        ignoreHTTPSErrors: true,
      },
    },
  ],
});
