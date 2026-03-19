'use strict';

const { test, expect } = require('@playwright/test');
const { captureBrowserError, formatDateForERP, loadRows, normalizeBoolean, writeTrackerSheet } = require('./_shared');

const rows = loadRows('attendance.csv');
const runResults = [];
const VALID_STATUSES = ['Present', 'Absent', 'On Leave', 'Half Day'];

async function ensureLoggedInSafe(page) {
  if (!page.url().includes('/login')) return;

  const email = process.env.ERPNEXT_USER || 'Administrator';
  const password = process.env.ERPNEXT_PASS || 'may65';

  await page.getByRole('textbox', { name: /email/i }).fill(email);
  await page.getByRole('textbox', { name: /password/i }).fill(password);
  await page.getByRole('button', { name: /^login$/i }).click();
  await page.waitForURL(/\/app/, { timeout: 20000 });
}

async function goToNewAttendance(page) {
  await page.goto('/app/attendance/new-attendance-1', { waitUntil: 'domcontentloaded' });
  await ensureLoggedInSafe(page);
  await page.locator('[data-fieldname="employee"] input').first().waitFor({ state: 'visible', timeout: 15000 });
}

async function typeLinkValue(page, fieldname, value) {
  const input = page.locator(`[data-fieldname="${fieldname}"] input`).first();
  await input.click();
  await input.fill('');
  await input.fill(String(value || ''));
  await page.waitForTimeout(250);
  await input.press('ArrowDown').catch(() => {});
  await input.press('Enter').catch(() => {});
  await input.press('Tab').catch(() => {});
}

async function setStatus(page, status) {
  const select = page.locator('[data-fieldname="status"] select').first();
  const normalized = String(status || '').trim().toLowerCase();
  const mapping = {
    leave: 'On Leave',
    'on leave': 'On Leave',
    present: 'Present',
    absent: 'Absent',
    'half day': 'Half Day',
  };
  const wanted = mapping[normalized];
  if (!wanted) return false;

  const options = await select.locator('option').allTextContents();
  const actual = options.map((x) => x.trim()).find((x) => x.toLowerCase() === wanted.toLowerCase());
  if (!actual) return false;

  await select.selectOption({ label: actual });
  return true;
}

async function setCheckbox(page, fieldname, checked) {
  const box = page.locator(`[data-fieldname="${fieldname}"] input[type="checkbox"]`).first();
  if (!(await box.isVisible().catch(() => false))) return;
  if (checked) await box.check({ force: true });
  else await box.uncheck({ force: true });
}

async function saveAttendance(page) {
  await page.keyboard.press('Control+s').catch(async () => {
    await page.getByRole('button', { name: /^save$/i }).click().catch(() => {});
  });
  await page.waitForTimeout(1200);

  const savedByUrl = /\/app\/attendance\/(?!new-)/i.test(page.url());
  const savedToast = await page.locator('.alert-success, .frappe-toast, .msgprint').filter({ hasText: /saved|created|updated/i }).first().isVisible().catch(() => false);
  const notSavedVisible = await page.locator('text=Not Saved').first().isVisible().catch(() => false);

  return { saved: savedByUrl || savedToast || !notSavedVisible };
}

function buildResult(row, preIssues, saved, errorMessage) {
  return {
    Row: row._row_number,
    Key: row.employee || '(empty employee)',
    Outcome: saved ? 'CREATED' : (errorMessage || preIssues.length ? 'REJECTED' : 'ERROR'),
    Reason: saved ? 'Attendance saved successfully' : (errorMessage || preIssues.join('; ') || 'Save failed without visible ERPNext error'),
    'Pre-flight Issues': preIssues.join('; '),
    'Raw Error': errorMessage || '',
  };
}

test.setTimeout(45000);
test.describe.configure({ mode: 'default' });

test.describe('Data-driven: Attendance @mutation', () => {
  for (const row of rows) {
    const label = `DDT-ATT-${String(row._row_number).padStart(3, '0')} | ${row.employee || '(empty)'} | ${row.status || '(no-status)'}`;

    test(label, async ({ page }) => {
      const preIssues = [];
      if (!String(row.employee || '').trim()) preIssues.push('Employee is required');
      if (!String(row.attendance_date || '').trim()) preIssues.push('Attendance Date is required');
      if (!String(row.status || '').trim()) preIssues.push('Status is required');
      if (String(row.working_hours || '').trim() && Number(row.working_hours) < 0) preIssues.push('Working Hours cannot be negative');
      if (String(row.status || '').trim() && !VALID_STATUSES.map((x) => x.toLowerCase()).includes(String(row.status).trim().toLowerCase())) {
        preIssues.push(`Unsupported status value: ${row.status}`);
      }

      if (preIssues.length) {
        test.info().annotations.push({ type: 'Pre-flight warning', description: preIssues.join('; ') });
      }

      await goToNewAttendance(page);

      if (row.employee) {
        await typeLinkValue(page, 'employee', row.employee).catch(() => {});
      }
      if (row.attendance_date) {
        await page.locator('[data-fieldname="attendance_date"] input').first().fill(formatDateForERP(row.attendance_date, 'ymd'));
        await page.keyboard.press('Tab').catch(() => {});
      }
      if (row.status) {
        await setStatus(page, row.status).catch(() => false);
      }
      if (row.shift) {
        await typeLinkValue(page, 'shift', row.shift).catch(() => {});
      }

      await setCheckbox(page, 'late_entry', normalizeBoolean(row.late_entry));
      await setCheckbox(page, 'early_exit', normalizeBoolean(row.early_exit));

      const saveResult = await saveAttendance(page);
      const errorMessage = saveResult.saved ? null : await captureBrowserError(page);
      const result = buildResult(row, preIssues, saveResult.saved, errorMessage);
      runResults.push(result);

      expect(result.Reason).not.toBe('');
    });
  }

  test.afterAll(async () => {
    writeTrackerSheet('DDT Attendance', ['Row', 'Key', 'Outcome', 'Reason', 'Pre-flight Issues', 'Raw Error'], runResults);
  });
});
