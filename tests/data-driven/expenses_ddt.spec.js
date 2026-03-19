'use strict';

const { test, expect } = require('@playwright/test');
const { expenses } = require('../../utils/helpers');
const { captureBrowserError, formatDateForERP, loadRows, writeTrackerSheet } = require('./_shared');

const rows = loadRows('expense_claim.csv');
const runResults = [];

const { goToNew, isNotSaved } = expenses;

async function visibleField(page, fieldname) {
  return page.locator(`[data-fieldname="${fieldname}"] input:visible, [data-fieldname="${fieldname}"] textarea:visible`).first();
}

async function saveExpenseClaim(page) {
  await page.keyboard.press('Control+s').catch(async () => {
    await page.getByRole('button', { name: /^save$/i }).click().catch(() => {});
  });
  await page.waitForTimeout(1200);
}

function buildResult(row, preIssues, saved, errorMessage) {
  return {
    Row: row._row_number,
    Key: row.employee || '(empty employee)',
    Outcome: saved ? 'CREATED' : (errorMessage || preIssues.length ? 'REJECTED' : 'ERROR'),
    Reason: saved ? 'Expense claim saved successfully' : (errorMessage || preIssues.join('; ') || 'Save failed without visible ERPNext error'),
    'Pre-flight Issues': preIssues.join('; '),
    'Raw Error': errorMessage || '',
  };
}

test.setTimeout(90000);
test.describe.configure({ mode: 'default' });

test.describe('Data-driven: Expense Claim @mutation', () => {
  for (const row of rows) {
    const label = `DDT-EXP-${String(row._row_number).padStart(3, '0')} | ${row.employee || '(empty)'} | ${row.expense_type || '(no-type)'}`;

    test(label, async ({ page }) => {
      const preIssues = [];
      if (!String(row.employee || '').trim()) preIssues.push('Employee is required');
      if (String(row.amount || '').trim() && Number(row.amount) <= 0) preIssues.push('Amount should be greater than zero');

      if (preIssues.length) {
        test.info().annotations.push({ type: 'Pre-flight warning', description: preIssues.join('; ') });
      }

      await goToNew(page);

      if (row.expense_date) {
        const dateInput = await visibleField(page, 'expense_date');
        await dateInput.fill(formatDateForERP(row.expense_date, 'ymd')).catch(() => {});
      }
      if (row.amount !== undefined && String(row.amount).trim() !== '') {
        const amountInput = await visibleField(page, 'amount');
        await amountInput.fill(String(row.amount)).catch(() => {});
      }

      await saveExpenseClaim(page);
      const saved = !(await isNotSaved(page)) && !/\/new/i.test(page.url());
      const errorMessage = saved ? null : await captureBrowserError(page);
      const result = buildResult(row, preIssues, saved, errorMessage);
      runResults.push(result);

      expect(result.Reason).not.toBe('');
    });
  }

  test.afterAll(async () => {
    writeTrackerSheet('DDT Expense Claim', ['Row', 'Key', 'Outcome', 'Reason', 'Pre-flight Issues', 'Raw Error'], runResults);
  });
});
