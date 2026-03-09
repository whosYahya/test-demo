const { test, expect } = require('@playwright/test');

async function ensureLoggedIn(page) {
  if (!page.url().includes('/login')) return;

  const email = process.env.ERPNEXT_USER || 'Administrator';
  const password = process.env.ERPNEXT_PASS || 'may65';

  await page.getByRole('textbox', { name: /email/i }).fill(email);
  await page.getByRole('textbox', { name: /password/i }).fill(password);
  await page.getByRole('button', { name: /^login$/i }).click();
  await page.waitForURL(/\/app\//, { timeout: 20000 });
}

async function openAndAssert(page, route, readySelector) {
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  await ensureLoggedIn(page);
  if (page.url().includes('/app/home')) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
  }
  await expect(page.locator(readySelector).first()).toBeVisible({ timeout: 20000 });
}

test.describe('Smoke Suite - All Doctypes', () => {
  test('TC-SMOKE-001 | Attendance form loads', async ({ page }) => {
    await openAndAssert(page, '/app/attendance/new-attendance-1', '[data-fieldname="employee"]');
  });

  test('TC-SMOKE-002 | Leave Application form loads', async ({ page }) => {
    await openAndAssert(page, '/app/leave-application/new-leave-application', '[data-fieldname="employee"]');
  });

  test('TC-SMOKE-003 | Expense Claim form loads', async ({ page }) => {
    await openAndAssert(page, '/app/expense-claim/new', '[data-fieldname="employee"]');
  });

  test('TC-SMOKE-004 | AMC Customer form loads', async ({ page }) => {
    await openAndAssert(page, '/app/amc-customers/new-amc-customers', '[data-fieldname="customer_name"]');
  });

  test('TC-SMOKE-005 | AMC Contract form loads', async ({ page }) => {
    await openAndAssert(page, '/app/amc-contract/new-amc-contract', '[data-fieldname="start_date"]');
  });

  test('TC-SMOKE-006 | Service Call form loads', async ({ page }) => {
    await openAndAssert(page, '/app/service-call/new-service-call', '[data-fieldname="customer"]');
  });

  test('TC-SMOKE-007 | Vendor form loads', async ({ page }) => {
    await openAndAssert(page, '/app/vendor/new-vendor', '[data-fieldname="vendor_name"]');
  });
});
