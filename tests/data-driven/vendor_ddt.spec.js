'use strict';

const { test, expect } = require('@playwright/test');
const { vendor } = require('../../utils/helpers');
const { captureBrowserError, loadRows, writeTrackerSheet } = require('./_shared');

const rows = loadRows('vendor.csv');
const runResults = [];

const {
  loginToERPNext,
  gotoNewVendor,
  fillVendorBasic,
  addAddressRow,
  trySaveVendor,
  isValidGST,
  isValidPAN,
} = vendor;

function mapSupplierType(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return undefined;
  if (raw === 'individual') return 'Contractor';
  return 'Supplier';
}

function buildResult(row, preIssues, saved, errorMessage) {
  return {
    Row: row._row_number,
    Key: row.supplier_name || '(empty supplier)',
    Outcome: saved ? 'CREATED' : (errorMessage || preIssues.length ? 'REJECTED' : 'ERROR'),
    Reason: saved ? 'Vendor saved successfully' : (errorMessage || preIssues.join('; ') || 'Save failed without visible ERPNext error'),
    'Pre-flight Issues': preIssues.join('; '),
    'Raw Error': errorMessage || '',
  };
}

test.setTimeout(45000);
test.describe.configure({ mode: 'default' });

test.describe('Data-driven: Vendor @mutation', () => {
  test.beforeEach(async ({ page }) => {
    await loginToERPNext(page);
  });

  for (const row of rows) {
    const label = `DDT-VEN-${String(row._row_number).padStart(3, '0')} | ${row.supplier_name || '(empty)'} | ${row.supplier_type || '(no-type)'}`;

    test(label, async ({ page }) => {
      const preIssues = [];
      if (!String(row.supplier_name || '').trim()) preIssues.push('Supplier Name is required');
      if (row.pan && !isValidPAN(row.pan)) preIssues.push('PAN format is invalid');
      if (row.tax_id && !isValidGST(row.tax_id)) preIssues.push('GST format is invalid');

      if (preIssues.length) {
        test.info().annotations.push({ type: 'Pre-flight warning', description: preIssues.join('; ') });
      }

      await gotoNewVendor(page);
      await fillVendorBasic(page, {
        vendor_name: row.supplier_name,
        type: mapSupplierType(row.supplier_type),
        mobile_no: row.mobile_no || undefined,
        email: row.email_id || undefined,
        pan: row.pan || undefined,
      });

      if (row.tax_id || row.mobile_no) {
        await addAddressRow(page, {
          name1: row.supplier_name || 'Primary Address',
          gst_no: row.tax_id || undefined,
          mobile_no: row.mobile_no || undefined,
        }).catch(() => {});
      }

      const saveResult = await trySaveVendor(page);
      const saved = Boolean(saveResult.saved && !saveResult.hasErrorDialog);
      const errorMessage = saved ? null : (saveResult.dialogText || await captureBrowserError(page));
      const result = buildResult(row, preIssues, saved, errorMessage);
      runResults.push(result);

      expect(result.Reason).not.toBe('');
    });
  }

  test.afterAll(async () => {
    writeTrackerSheet('DDT Vendor', ['Row', 'Key', 'Outcome', 'Reason', 'Pre-flight Issues', 'Raw Error'], runResults);
  });
});
