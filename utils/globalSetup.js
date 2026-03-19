const { chromium } = require('@playwright/test');
const path = require('path');
const { resolveBaseUrl } = require('./environment');
const { resolveLaunchOptions } = require('./browser');

module.exports = async function () {
  const headless = (process.env.PW_HEADLESS || process.env.HEADLESS || 'true').toLowerCase() !== 'false';
  const browser = await chromium.launch({ headless, ...resolveLaunchOptions() });
  const context = await browser.newContext();
  const page = await context.newPage();

  const baseURL = resolveBaseUrl();
  const email = process.env.ERPNEXT_USER || 'Administrator';
  const password = process.env.ERPNEXT_PASS || 'may65';

  console.log(`[globalSetup] Navigating to ${baseURL}/login ...`);
  await page.goto(`${baseURL}/login`);

  if (page.url().includes('/app')) {
    console.log('[globalSetup] Already authenticated, skipping login.');
  } else {
    console.log('[globalSetup] Waiting for Email input ...');
    const emailInput = page.getByRole('textbox', { name: /email/i });
    await emailInput.waitFor({ timeout: 20000 });

    console.log(`[globalSetup] Filling email: ${email}`);
    await emailInput.fill(email);

    console.log('[globalSetup] Filling password ...');
    await page.getByRole('textbox', { name: /password/i }).fill(password);

    console.log('[globalSetup] Clicking Login button ...');
    await page.getByRole('button', { name: /^login$/i }).click();

    console.log('[globalSetup] Waiting for redirect to /app ...');
    await page.waitForURL(/\/app/, { timeout: 20000 });

    if (!page.url().includes('/app')) {
      throw new Error(
        `[globalSetup] Login did not redirect to /app. ` +
        `Current URL: ${page.url()} - ` +
        'check your ERPNEXT_USER / ERPNEXT_PASS env vars.'
      );
    }

    console.log('[globalSetup] Logged in successfully.');
  }

  const statePath = path.resolve(__dirname, 'authState.json');
  console.log(`[globalSetup] Writing auth state to ${statePath}`);
  await context.storageState({ path: statePath });

  await browser.close();
  console.log('[globalSetup] Done.');
};
