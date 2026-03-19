'use strict';

const { test, expect } = require('@playwright/test');
const { customers } = require('../../utils/helpers');
const { loadTestData, buildRowResult } = require('../../utils/dataLoader');

const {
  goToNew,
  loginIfNeeded,
  fillCustomerName,
  fillGST,
  fillPAN,
  setCustomerType,
  addCustomerBranch,
  addContactRow,
  saveForm,
} = customers;

const rows = loadTestData('customers.csv');
if (!rows || rows.length === 0) {
  throw new Error('No data found in customers.csv - check fixtures/testData/');
}

const runResults = [];

async function freshForm(page) {
  await goToNew(page);
  await loginIfNeeded(page);
  if (!page.url().includes('amc-customers')) {
    await goToNew(page);
  }
}

async function dismissBlockingModal(page) {
  const modal = page.locator('.modal.show').first();
  if (!(await modal.isVisible().catch(() => false))) {
    return;
  }

  const closeButton = modal.locator('.btn-modal-close, [data-dismiss="modal"], .modal-header button').first();
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click({ force: true }).catch(() => {});
  } else {
    await page.keyboard.press('Escape').catch(() => {});
  }

  await page.waitForTimeout(300);
}

async function captureBrowserError(page) {
  let errorMessage = await page.locator(
    '.msgprint, .frappe-toast-message, .alert-danger, .modal-body'
  ).first().textContent({ timeout: 5000 }).catch(() => null);

  if (errorMessage) {
    errorMessage = errorMessage.trim().slice(0, 300);
  }

  const hasError = async (fieldName) => {
    return page.locator(
      `[data-fieldname="${fieldName}"] .frappe-has-error, ` +
      `[data-fieldname="${fieldName}"].has-error`
    ).isVisible({ timeout: 2000 }).catch(() => false);
  };

  let errorField = null;
  if (await hasError('gst')) {
    errorField = 'gst';
  } else if (await hasError('pan')) {
    errorField = 'pan';
  } else if (await hasError('customer_name')) {
    errorField = 'customer_name';
  }

  return { errorMessage, errorField };
}

function shouldAttemptContactRow(row) {
  if (!row.contact_name) {
    return false;
  }

  return !row._pre_issues.some((issue) => issue.includes('Contact Mobile must be exactly 10 digits'));
}

test.setTimeout(90000);

test.describe.configure({ mode: 'serial' });

test.describe('Data-driven: AMC Customers @mutation', () => {
  for (const row of rows) {
    const rowNum = String(row._row_number).padStart(3, '0');
    const label = `DDT-CUST-${rowNum} | ${row.customer_name || '(empty)'} | ${row.customer_type || 'no-type'}`;

    test(label, async ({ page }) => {
      if (!row._pre_valid) {
        test.info().annotations.push({
          type: 'Pre-flight warning',
          description: row._pre_issues.join('; '),
        });
      }

      await freshForm(page);
      await fillCustomerName(page, row.customer_name);

      if (row.gst) {
        await fillGST(page, row.gst);
      }
      if (row.pan) {
        await fillPAN(page, row.pan);
      }
      if (row.customer_type && ['Company', 'Individual', 'Partnership'].includes(row.customer_type)) {
        await setCustomerType(page, row.customer_type);
      }

      const needsChildRows = Boolean(row.branch_name || row.contact_name);
      let saveResult;

      if (needsChildRows) {
        await dismissBlockingModal(page);
        saveResult = await saveForm(page);

        if (saveResult.saved) {
          await dismissBlockingModal(page);

          if (row.branch_name) {
            await addCustomerBranch(page, row.customer_name, row.branch_name, row.branch_address || '');
            await dismissBlockingModal(page);
          }

          if (shouldAttemptContactRow(row)) {
            await addContactRow(page, {
              name: row.contact_name,
              mobile: row.contact_mobile || '',
              isPrimary: true,
            });
          }

          saveResult = await saveForm(page);
        }
      } else {
        saveResult = await saveForm(page);
      }

      let errorMessage = null;
      let errorField = null;

      if (!saveResult.saved) {
        ({ errorMessage, errorField } = await captureBrowserError(page));
      }

      const result = buildRowResult(row, {
        saved: saveResult.saved,
        errorMessage,
        errorField,
      });
      runResults.push(result);

      if (saveResult.saved) {
        expect(
          page.url(),
          `Row ${row._row_number} (${row.customer_name}): Expected record to be saved and URL to change`
        ).not.toContain('new-amc-customers');
      } else {
        expect(
          errorMessage,
          `Row ${row._row_number} (${row.customer_name}): Save failed but ERPNext showed no error message - unexpected behavior`
        ).not.toBeNull();
      }
    });
  }

  test.afterAll(async () => {
    if (runResults.length === 0) {
      return;
    }

    const fs = require('fs');
    const path = require('path');
    const XLSX = require('xlsx');
    const trackerPath = path.join(__dirname, '../../AMC_Master_Tracker.xlsx');

    if (!fs.existsSync(trackerPath)) {
      return;
    }

    try {
      const workbook = XLSX.readFile(trackerPath);
      const sheetName = 'Data-Driven Results';
      const headers = [
        'Row',
        'Customer Name',
        'Outcome',
        'Reason',
        'Action Needed',
        'Pre-flight Issues',
        'Error Field',
        'Raw Error',
      ];
      const sheetData = [
        headers,
        ...runResults.map((result) => [
          result.row_number,
          result.customer_name,
          result.outcome,
          result.reason,
          result.action_needed,
          result.pre_issues,
          result.error_field,
          result.raw_error,
        ]),
      ];

      if (workbook.SheetNames.includes(sheetName)) {
        delete workbook.Sheets[sheetName];
        workbook.SheetNames.splice(workbook.SheetNames.indexOf(sheetName), 1);
      }

      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      XLSX.writeFile(workbook, trackerPath);
    } catch (error) {
      console.warn(`[customers_ddt] Could not update tracker: ${error.message}`);
    }
  });
});
