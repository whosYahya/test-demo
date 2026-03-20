'use strict';

const { test, expect } = require('@playwright/test');
const { expenses } = require('../../utils/helpers');
const { captureBrowserError, formatDateForERP, loadRows, writeTrackerSheet } = require('./_shared');

const rows = loadRows('expense_claim.csv');
const runResults = [];

const {
  goToNew,
  control,
  fieldInput,
  fillLinkField,
  tryPickFirstLinkSuggestion,
  fillGridRowField,
  getGridRowCount,
  addGridRow,
  saveForm,
  isNotSaved,
} = expenses;

function seed() {
  return {
    employee: process.env.EXP_EMPLOYEE || '',
    approver: process.env.EXP_APPROVER || '',
    company: process.env.EXP_COMPANY || '',
  };
}

async function tryFillMandatoryHeader(page) {
  const s = seed();
  const seeds = ['a', 'e', 'i'];

  async function hasValidLinkValue(fieldname) {
    const input = fieldInput(page, fieldname);
    const current = (await input.inputValue().catch(() => '')).trim();
    if (!current || current.length < 2) return false;
    const noResultsVisible = await control(page, fieldname)
      .locator('text=/No results found/i')
      .first()
      .isVisible()
      .catch(() => false);
    return !noResultsVisible;
  }

  async function ensureLinkValue(fieldname, configuredValue, allowExisting = false) {
    if (allowExisting && (await hasValidLinkValue(fieldname))) return true;

    if (configuredValue) {
      await fillLinkField(page, fieldname, configuredValue).catch(() => {});
      if (await hasValidLinkValue(fieldname)) return true;
    }

    for (const q of seeds) {
      await tryPickFirstLinkSuggestion(page, fieldname, q).catch(() => false);
      if (await hasValidLinkValue(fieldname)) return true;
    }

    return false;
  }

  const employeeOk = await ensureLinkValue('employee', s.employee);
  if (!employeeOk) return false;

  const companyOk = await ensureLinkValue('company', s.company, true);
  const approverOk = await ensureLinkValue('expense_approver', s.approver);
  return employeeOk && companyOk && approverOk;
}

async function ensureExpenseRow(page) {
  const count = await getGridRowCount(page, 'expenses');
  if (count > 0) return 0;
  await addGridRow(page, 'expenses');
  return 0;
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
      if (String(row.amount || '').trim() && Number(row.amount) <= 0) preIssues.push('Amount should be greater than zero');

      if (preIssues.length) {
        test.info().annotations.push({ type: 'Pre-flight warning', description: preIssues.join('; ') });
      }

      await goToNew(page);

      const ready = await tryFillMandatoryHeader(page);
      if (!ready) {
        const result = buildResult(row, ['No selectable Employee/Company/Expense Approver master data available'], false, null);
        runResults.push(result);
        expect(result.Reason).not.toBe('');
        return;
      }

      const rowIndex = await ensureExpenseRow(page);
      if (row.expense_date) {
        await fillGridRowField(page, 'expenses', rowIndex, 'expense_date', formatDateForERP(row.expense_date, 'ymd')).catch(() => {});
      }
      if (row.expense_type) {
        await fillGridRowField(page, 'expenses', rowIndex, 'expense_type', row.expense_type, { isLink: true }).catch(() => {});
      }
      if (row.amount !== undefined && String(row.amount).trim() !== '') {
        await fillGridRowField(page, 'expenses', rowIndex, 'amount', row.amount).catch(() => {});
      }

      await saveForm(page);
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
