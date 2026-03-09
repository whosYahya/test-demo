// utils/globalSetup.js
const { chromium } = require('@playwright/test');
const path = require('path');

module.exports = async function () {
  const headless = (process.env.PW_HEADLESS || process.env.HEADLESS || 'true').toLowerCase() !== 'false';
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page    = await context.newPage();

  const baseURL  = process.env.BASE_URL     || 'http://127.0.0.1:8004';
  const email    = process.env.ERPNEXT_USER || 'Administrator';
  const password = process.env.ERPNEXT_PASS || 'may65';

  console.log(`[globalSetup] Navigating to ${baseURL}/login …`);
  await page.goto(`${baseURL}/login`);

  // ── already logged in? Frappe redirects straight to /app ──────
  if (page.url().includes('/app')) {
    console.log('[globalSetup] Already authenticated — skipping login.');
  } else {
    // ── wait for the Email input using its accessible name ───────
    // This is the only selector confirmed present in the actual
    // login-page snapshot.  No class or id assumptions.
    console.log('[globalSetup] Waiting for Email input …');
    const emailInput = page.getByRole('textbox', { name: /email/i });
    await emailInput.waitFor({ timeout: 10000 });

    console.log(`[globalSetup] Filling email: ${email}`);
    await emailInput.fill(email);

    console.log('[globalSetup] Filling password …');
    await page.getByRole('textbox', { name: /password/i }).fill(password);

    console.log('[globalSetup] Clicking Login button …');
    await page.getByRole('button', { name: /^login$/i }).click();

    // ── wait for Frappe to navigate to /app ───────────────────
    console.log('[globalSetup] Waiting for redirect to /app …');
    await page.waitForURL(/\/app/, { timeout: 15000 });

    // ── hard check: if we are NOT on /app something went wrong ─
    if (!page.url().includes('/app')) {
      throw new Error(
        `[globalSetup] Login did not redirect to /app.  ` +
        `Current URL: ${page.url()}  — ` +
        `check your ERPNEXT_USER / ERPNEXT_PASS env vars.`
      );
    }

    console.log('[globalSetup] Logged in successfully.');
  }

  // ── persist the session so every test reuses it ──────────────
  const statePath = path.resolve(__dirname, 'authState.json');
  console.log(`[globalSetup] Writing auth state to ${statePath}`);
  await context.storageState({ path: statePath });

  await browser.close();
  console.log('[globalSetup] Done.');
};
