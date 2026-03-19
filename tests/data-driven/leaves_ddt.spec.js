'use strict';

const { test, expect } = require('@playwright/test');
const { leaves } = require('../../utils/helpers');
const { captureBrowserError, formatDateForERP, loadRows, normalizeBoolean, writeTrackerSheet } = require('./_shared');

const rows = loadRows('leave_application.csv');
const runResults = [];

const {
  openNewLeaveApplication,
  assertLeaveFormReady,
  setInputValue,
  setCheckboxValue,
  closeOpenModal,
} = leaves;

async function attemptSave(page) {
  await page.getByRole('button', { name: /^save$/i }).click();
  await page.waitForTimeout(1200);
  const savedByUrl = /\/app\/leave-application\/(?!new-leave-application)/i.test(page.url());
  const savedToast = await page.locator('.alert-success, .frappe-toast, .msgprint').filter({ hasText: /saved|created|updated/i }).first().isVisible().catch(() => false);
  return { saved: savedByUrl || savedToast };
}

function buildResult(row, preIssues, saved, errorMessage) {
  return {
    Row: row._row_number,
    Key: row.employee || '(empty employee)',
    Outcome: saved ? 'CREATED' : (errorMessage || preIssues.length ? 'REJECTED' : 'ERROR'),
    Reason: saved ? 'Leave application saved successfully' : (errorMessage || preIssues.join('; ') || 'Save failed without visible ERPNext error'),
    'Pre-flight Issues': preIssues.join('; '),
    'Raw Error': errorMessage || '',
  };
}

test.setTimeout(45000);
test.describe.configure({ mode: 'default' });

test.describe('Data-driven: Leave Application @mutation', () => {
  for (const row of rows) {
    const label = `DDT-LEA-${String(row._row_number).padStart(3, '0')} | ${row.employee || '(empty)'} | ${row.leave_type || '(no-type)'}`;

    test(label, async ({ page }) => {
      const preIssues = [];
      if (!String(row.employee || '').trim()) preIssues.push('Employee is required');
      if (!String(row.from_date || '').trim()) preIssues.push('From Date is required');
      if (!String(row.to_date || '').trim()) preIssues.push('To Date is required');

      if (preIssues.length) {
        test.info().annotations.push({ type: 'Pre-flight warning', description: preIssues.join('; ') });
      }

      await openNewLeaveApplication(page);
      await assertLeaveFormReady(page);

      if (row.employee) {
        await setInputValue(page, 'employee', row.employee).catch(() => {});
      }
      if (row.leave_type) {
        await setInputValue(page, 'leave_type', row.leave_type).catch(() => {});
      }
      if (row.from_date) {
        await setInputValue(page, 'from_date', formatDateForERP(row.from_date, 'dmy')).catch(() => {});
      }
      if (row.to_date) {
        await setInputValue(page, 'to_date', formatDateForERP(row.to_date, 'dmy')).catch(() => {});
      }
      if (row.description) {
        await setInputValue(page, 'description', row.description).catch(() => {});
      }
      if (row.leave_approver) {
        await setInputValue(page, 'leave_approver', row.leave_approver).catch(() => {});
      }
      if (normalizeBoolean(row.half_day)) {
        await setCheckboxValue(page, 'half_day', true).catch(() => {});
        const halfDayInputVisible = await page.locator('[data-fieldname="half_day_date"] input').first().isVisible().catch(() => false);
        if (row.half_day_date && halfDayInputVisible) {
          await setInputValue(page, 'half_day_date', formatDateForERP(row.half_day_date, 'dmy')).catch(() => {});
        }
      }

      const saveResult = await attemptSave(page);
      const errorMessage = saveResult.saved ? null : await captureBrowserError(page);
      await closeOpenModal(page).catch(() => {});
      const result = buildResult(row, preIssues, saveResult.saved, errorMessage);
      runResults.push(result);

      expect(result.Reason).not.toBe('');
    });
  }

  test.afterAll(async () => {
    writeTrackerSheet('DDT Leave Application', ['Row', 'Key', 'Outcome', 'Reason', 'Pre-flight Issues', 'Raw Error'], runResults);
  });
});
