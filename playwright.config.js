// @ts-check
const path = require('path');
const { defineConfig, devices } = require('@playwright/test');
const { resolveBaseUrl } = require('./utils/environment');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 3 : undefined,
  reporter: [
    ['junit', { outputFile: 'test-results/results.xml' }],
    ['allure-playwright', { outputFolder: 'allure-results' }],
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],
  use: {
    baseURL: resolveBaseUrl(),
    storageState: path.join(__dirname, 'utils', 'authState.json'),
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  globalSetup: require.resolve('./utils/globalSetup.js'),
  globalTeardown: require.resolve('./utils/globalTeardown.js'),

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
