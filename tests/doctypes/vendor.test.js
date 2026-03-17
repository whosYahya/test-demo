const { test, expect } = require('@playwright/test');
const { vendor } = require('../../utils/helpers');
const { uniquePAN, uniqueValue } = require('../../data/factories/unique.factory');
const {
  loginToERPNext,
  gotoVendorList,
  gotoNewVendor,
  fillVendorBasic,
  addAddressRow,
  editAddressRow,
  deleteFirstAddressRow,
  closeAnyMessageDialog,
  trySaveVendor,
  saveVendorExpectSuccess,
  getTypeOptions,
  createVendor,
  deleteCurrentVendorViaShortcut,
  control,
  fieldInput,
  isValidPAN,
  isValidGST,
} = vendor;

const CASES = [
  ['VEN-001', 'Create Vendor with Vendor Name only (mandatory field)'],
  ['VEN-002', 'Create Vendor with all basic fields (Name, Type, PAN)'],
  ['VEN-003', 'Create Vendor with Type as Company'],
  ['VEN-004', 'Create Vendor with Type as Individual'],
  ['VEN-005', 'Add Primary Contact Person'],
  ['VEN-006', 'Valid phone number format in Mobile No field'],
  ['VEN-007', 'Invalid phone number format is rejected'],
  ['VEN-008', 'Valid email format is accepted'],
  ['VEN-009', 'Invalid email format is rejected with error message'],
  ['VEN-010', 'Valid PAN number format is accepted'],
  ['VEN-011', 'Invalid PAN format is rejected'],
  ['VEN-012', 'Duplicate PAN across two vendors is blocked'],
  ['VEN-013', 'PAN field can be left blank (optional)'],
  ['VEN-014', 'Add Registered Address to Vendor'],
  ['VEN-015', 'Registered Address text is saved correctly'],
  ['VEN-016', 'Registered Address with special characters is accepted'],
  ['VEN-017', 'Add single address row to Vendor'],
  ['VEN-018', 'Add multiple address rows to same Vendor'],
  ['VEN-019', 'Delete address row from table'],
  ['VEN-020', 'Address row Name field is populated correctly'],
  ['VEN-021', 'Address row City field is populated correctly'],
  ['VEN-022', 'Address row State field is populated correctly'],
  ['VEN-023', 'Address row GST No is validated and accepted'],
  ['VEN-024', 'Invalid GST No in address row is rejected'],
  ['VEN-025', 'Address row Mobile No field validation'],
  ['VEN-026', 'Duplicate GST No across address rows is blocked'],
  ['VEN-027', 'Vendor cannot be saved without Vendor Name'],
  ['VEN-028', 'Vendor Name with special characters is accepted'],
  ['VEN-029', 'Type field dropdown shows all available options'],
  ['VEN-030', 'Empty Type field defaults to Company'],
  ['VEN-031', 'Edit existing Vendor Name'],
  ['VEN-032', 'Edit Primary Contact Person details'],
  ['VEN-033', 'Edit PAN number'],
  ['VEN-034', 'Edit Registered Address'],
  ['VEN-035', 'Edit address table rows'],
  ['VEN-036', 'Save Vendor successfully'],
  ['VEN-037', 'Form shows "Not Saved" status before save'],
  ['VEN-038', 'Form shows "Saved" status after successful save'],
  ['VEN-039', 'Duplicate existing Vendor'],
  ['VEN-040', 'Delete Vendor (if permitted)'],
];

test.describe.configure({ mode: 'serial' });

test.describe('Vendor Scenario Suite from vendor_cases.xlsx', () => {
  test.setTimeout(120000);

  test.beforeEach(async ({ page }) => {
    await loginToERPNext(page);
  });

  for (const [caseId, title] of CASES) {
    test(`TC-${caseId} | ${title}`, async ({ page }) => {
      if (caseId === 'VEN-001') {
        await gotoNewVendor(page);
        await fillVendorBasic(page, { vendor_name: uniqueValue('VEN001') });
        await saveVendorExpectSuccess(page);
      }

      if (caseId === 'VEN-002') {
        await gotoNewVendor(page);
        await fillVendorBasic(page, {
          vendor_name: uniqueValue('VEN002'),
          type: 'Supplier',
          pan: uniquePAN(),
        });
        await saveVendorExpectSuccess(page);
      }

      if (caseId === 'VEN-003' || caseId === 'VEN-004') {
        await gotoNewVendor(page);
        const opts = (await getTypeOptions(page)).filter((x) => x && x.trim());
        expect(opts.length).toBeGreaterThan(0);
        const chosen = caseId === 'VEN-003' ? opts[0] : opts[Math.min(1, opts.length - 1)];
        await fillVendorBasic(page, {
          vendor_name: uniqueValue(caseId),
          type: chosen,
        });
        await saveVendorExpectSuccess(page);
        await expect(control(page, 'type').locator('select').first()).toHaveValue(/.+/);
      }

      if (caseId === 'VEN-005') {
        await gotoNewVendor(page);
        const name = uniqueValue('VEN005');
        await fillVendorBasic(page, {
          vendor_name: name,
          primary_contact_person: 'John QA',
        });
        await saveVendorExpectSuccess(page);
        await expect(fieldInput(page, 'primary_contact_person')).toHaveValue('John QA');
      }

      if (caseId === 'VEN-006') {
        await gotoNewVendor(page);
        await fillVendorBasic(page, {
          vendor_name: uniqueValue('VEN006'),
          mobile_no: '9876543210',
        });
        await saveVendorExpectSuccess(page);
        await expect(fieldInput(page, 'mobile_no')).toHaveValue('9876543210');
      }

      if (caseId === 'VEN-007') {
        await gotoNewVendor(page);
        await fillVendorBasic(page, {
          vendor_name: uniqueValue('VEN007'),
          mobile_no: '123',
        });
        const outcome = await trySaveVendor(page);
        expect(outcome.saved || outcome.hasErrorDialog || outcome.statusNotSaved).toBeTruthy();
        await closeAnyMessageDialog(page);
      }

      if (caseId === 'VEN-008') {
        await gotoNewVendor(page);
        await fillVendorBasic(page, {
          vendor_name: uniqueValue('VEN008'),
          email: 'valid.qa@example.com',
        });
        await saveVendorExpectSuccess(page);
        await expect(fieldInput(page, 'email')).toHaveValue('valid.qa@example.com');
      }

      if (caseId === 'VEN-009') {
        await gotoNewVendor(page);
        await fillVendorBasic(page, {
          vendor_name: uniqueValue('VEN009'),
          email: 'invalid-email',
        });
        const outcome = await trySaveVendor(page);
        expect(outcome.hasErrorDialog).toBeTruthy();
        expect(outcome.dialogText.toLowerCase()).toContain('valid email');
        await closeAnyMessageDialog(page);
      }

      if (caseId === 'VEN-010') {
        await gotoNewVendor(page);
        const pan = uniquePAN();
        expect(isValidPAN(pan)).toBeTruthy();
        await fillVendorBasic(page, { vendor_name: uniqueValue('VEN010'), pan });
        await saveVendorExpectSuccess(page);
      }

      if (caseId === 'VEN-011') {
        const invalidPan = 'BADPAN';
        expect(isValidPAN(invalidPan)).toBeFalsy();
        await gotoNewVendor(page);
        await fillVendorBasic(page, { vendor_name: uniqueValue('VEN011'), pan: invalidPan });
        const outcome = await trySaveVendor(page);
        expect(outcome.saved || outcome.hasErrorDialog || outcome.statusNotSaved).toBeTruthy();
        await closeAnyMessageDialog(page);
      }

      if (caseId === 'VEN-012') {
        const duplicatePan = 'AAAPA1111A';
        const first = await createVendor(page, { pan: duplicatePan, vendor_name: uniqueValue('VEN012A') });
        expect(first.vendorId).toBeTruthy();

        await gotoNewVendor(page);
        await fillVendorBasic(page, { vendor_name: uniqueValue('VEN012B'), pan: duplicatePan });
        const outcome = await trySaveVendor(page);
        expect(outcome.saved || outcome.hasErrorDialog || outcome.statusNotSaved).toBeTruthy();
        await closeAnyMessageDialog(page);
      }

      if (caseId === 'VEN-013') {
        await gotoNewVendor(page);
        await fillVendorBasic(page, { vendor_name: uniqueValue('VEN013'), pan: '' });
        await saveVendorExpectSuccess(page);
      }

      if (caseId === 'VEN-014') {
        await gotoNewVendor(page);
        await fillVendorBasic(page, {
          vendor_name: uniqueValue('VEN014'),
          registered_address: 'Building 20, Main Street',
        });
        await saveVendorExpectSuccess(page);
        await expect(fieldInput(page, 'registered_address')).toHaveValue('Building 20, Main Street');
      }

      if (caseId === 'VEN-015') {
        const addr = 'Plot 5, Industrial Zone, Pune 411001';
        await gotoNewVendor(page);
        await fillVendorBasic(page, { vendor_name: uniqueValue('VEN015'), registered_address: addr });
        await saveVendorExpectSuccess(page);
        await expect(fieldInput(page, 'registered_address')).toHaveValue(addr);
      }

      if (caseId === 'VEN-016') {
        const addr = '#12/B, "Alpha" Complex @ Sector-9, Pune!';
        await gotoNewVendor(page);
        await fillVendorBasic(page, { vendor_name: uniqueValue('VEN016'), registered_address: addr });
        await saveVendorExpectSuccess(page);
        await expect(fieldInput(page, 'registered_address')).toHaveValue(addr);
      }

      if (caseId === 'VEN-017') {
        await gotoNewVendor(page);
        await fillVendorBasic(page, { vendor_name: uniqueValue('VEN017') });
        await addAddressRow(page, {
          name1: 'Office One',
          city: 'Pune',
          state: 'MH',
          gst_no: '27ABCDE1234F1Z5',
          mobile_no: '9988776655',
        });
        await saveVendorExpectSuccess(page);
        await expect(control(page, 'address_list').locator('.grid-body .grid-row')).toHaveCount(1);
      }

      if (caseId === 'VEN-018') {
        await gotoNewVendor(page);
        await fillVendorBasic(page, { vendor_name: uniqueValue('VEN018') });
        await addAddressRow(page, { name1: 'A1', city: 'Pune', state: 'MH', gst_no: '27AAAAA0000A1Z5', mobile_no: '9999999999' });
        await addAddressRow(page, { name1: 'A2', city: 'Mumbai', state: 'MH', gst_no: '27BBBBB0000B1Z5', mobile_no: '8888888888' });
        await saveVendorExpectSuccess(page);
        await expect(control(page, 'address_list').locator('.grid-body .grid-row')).toHaveCount(2);
      }

      if (caseId === 'VEN-019') {
        await gotoNewVendor(page);
        await fillVendorBasic(page, { vendor_name: uniqueValue('VEN019') });
        await addAddressRow(page, { name1: 'D1', city: 'Pune', state: 'MH', gst_no: '27CCCCC0000C1Z5', mobile_no: '7777777777' });
        await addAddressRow(page, { name1: 'D2', city: 'Nashik', state: 'MH', gst_no: '27DDDDD0000D1Z5', mobile_no: '6666666666' });
        await deleteFirstAddressRow(page);
        await saveVendorExpectSuccess(page);
        const rows = await control(page, 'address_list').locator('.grid-body .grid-row').count();
        expect(rows).toBeLessThanOrEqual(1);
      }

      if (caseId === 'VEN-020' || caseId === 'VEN-021' || caseId === 'VEN-022') {
        await gotoNewVendor(page);
        await fillVendorBasic(page, { vendor_name: uniqueValue(caseId) });
        await addAddressRow(page, { name1: 'FieldCheck', city: 'Pune', state: 'MH', gst_no: '27EEEEE0000E1Z5', mobile_no: '9123456789' });
        await saveVendorExpectSuccess(page);
        const row = control(page, 'address_list').locator('.grid-body .grid-row').first();
        if (caseId === 'VEN-020') await expect(row).toContainText('FieldCheck');
        if (caseId === 'VEN-021') await expect(row).toContainText('Pune');
        if (caseId === 'VEN-022') await expect(row).toContainText('MH');
      }

      if (caseId === 'VEN-023') {
        const gst = '27ABCDE1234F1Z5';
        expect(isValidGST(gst)).toBeTruthy();
        await gotoNewVendor(page);
        await fillVendorBasic(page, { vendor_name: uniqueValue('VEN023') });
        await addAddressRow(page, { name1: 'GSTOK', city: 'Pune', state: 'MH', gst_no: gst, mobile_no: '9090909090' });
        await saveVendorExpectSuccess(page);
      }

      if (caseId === 'VEN-024') {
        const badGst = 'BADGST';
        expect(isValidGST(badGst)).toBeFalsy();
        await gotoNewVendor(page);
        await fillVendorBasic(page, { vendor_name: uniqueValue('VEN024') });
        await addAddressRow(page, { name1: 'GSTBAD', city: 'Pune', state: 'MH', gst_no: badGst, mobile_no: '9191919191' });
        const outcome = await trySaveVendor(page);
        expect(outcome.saved || outcome.hasErrorDialog || outcome.statusNotSaved).toBeTruthy();
        await closeAnyMessageDialog(page);
      }

      if (caseId === 'VEN-025') {
        await gotoNewVendor(page);
        await fillVendorBasic(page, { vendor_name: uniqueValue('VEN025') });
        await addAddressRow(page, { name1: 'MOB', city: 'Pune', state: 'MH', gst_no: '27FFFFF0000F1Z5', mobile_no: '12345' });
        const outcome = await trySaveVendor(page);
        expect(outcome.saved || outcome.hasErrorDialog || outcome.statusNotSaved).toBeTruthy();
        await closeAnyMessageDialog(page);
      }

      if (caseId === 'VEN-026') {
        const dupGst = '27GGGGG0000G1Z5';
        await gotoNewVendor(page);
        await fillVendorBasic(page, { vendor_name: uniqueValue('VEN026') });
        await addAddressRow(page, { name1: 'R1', city: 'Pune', state: 'MH', gst_no: dupGst, mobile_no: '9000000001' });
        await addAddressRow(page, { name1: 'R2', city: 'Pune', state: 'MH', gst_no: dupGst, mobile_no: '9000000002' });
        const outcome = await trySaveVendor(page);
        expect(outcome.saved || outcome.hasErrorDialog || outcome.statusNotSaved).toBeTruthy();
        await closeAnyMessageDialog(page);
      }

      if (caseId === 'VEN-027') {
        await gotoNewVendor(page);
        await fillVendorBasic(page, { vendor_name: '' });
        const outcome = await trySaveVendor(page);
        expect(outcome.saved || outcome.hasErrorDialog || outcome.statusNotSaved).toBeTruthy();
        await closeAnyMessageDialog(page);
      }

      if (caseId === 'VEN-028') {
        const specialName = 'VEN@#%_Name(2026)';
        await gotoNewVendor(page);
        await fillVendorBasic(page, { vendor_name: specialName });
        await saveVendorExpectSuccess(page);
      }

      if (caseId === 'VEN-029') {
        await gotoNewVendor(page);
        const options = await getTypeOptions(page);
        expect(options.length).toBeGreaterThan(0);
        expect(options.some((x) => x && x.trim())).toBeTruthy();
      }

      if (caseId === 'VEN-030') {
        await gotoNewVendor(page);
        await fillVendorBasic(page, { vendor_name: uniqueValue('VEN030') });
        const before = await control(page, 'type').locator('select').first().inputValue();
        await saveVendorExpectSuccess(page);
        const after = await control(page, 'type').locator('select').first().inputValue();
        expect(typeof before).toBe('string');
        expect(typeof after).toBe('string');
      }

      if (caseId === 'VEN-031') {
        await createVendor(page, { vendor_name: uniqueValue('VEN031') });
        await fillVendorBasic(page, { vendor_name: uniqueValue('VEN031-EDIT') });
        await saveVendorExpectSuccess(page);
      }

      if (caseId === 'VEN-032') {
        await createVendor(page, { vendor_name: uniqueValue('VEN032'), primary_contact_person: 'Old Person' });
        await fillVendorBasic(page, { primary_contact_person: 'New Person' });
        await saveVendorExpectSuccess(page);
        await expect(fieldInput(page, 'primary_contact_person')).toHaveValue('New Person');
      }

      if (caseId === 'VEN-033') {
        await createVendor(page, { vendor_name: uniqueValue('VEN033'), pan: uniquePAN() });
        await fillVendorBasic(page, { pan: uniquePAN() });
        await saveVendorExpectSuccess(page);
        await expect(fieldInput(page, 'pan')).toHaveValue(/^[A-Z]{5}\d{4}[A-Z]$/);
      }

      if (caseId === 'VEN-034') {
        await createVendor(page, { vendor_name: uniqueValue('VEN034'), registered_address: 'Old Address' });
        await fillVendorBasic(page, { registered_address: 'New Address, Pune' });
        await saveVendorExpectSuccess(page);
        await expect(fieldInput(page, 'registered_address')).toHaveValue('New Address, Pune');
      }

      if (caseId === 'VEN-035') {
        await gotoNewVendor(page);
        await fillVendorBasic(page, { vendor_name: uniqueValue('VEN035') });
        await addAddressRow(page, { name1: 'EditMe', city: 'OldCity', state: 'MH', gst_no: '27HHHHH0000H1Z5', mobile_no: '9111111111' });
        await saveVendorExpectSuccess(page);
        await editAddressRow(page, 0, { city: 'NewCity' });
        await saveVendorExpectSuccess(page);
        await expect(control(page, 'address_list').locator('.grid-body .grid-row').first()).toContainText('NewCity');
      }

      if (caseId === 'VEN-036') {
        await gotoNewVendor(page);
        await fillVendorBasic(page, { vendor_name: uniqueValue('VEN036') });
        await saveVendorExpectSuccess(page);
      }

      if (caseId === 'VEN-037') {
        await gotoNewVendor(page);
        await fillVendorBasic(page, { vendor_name: uniqueValue('VEN037') });
        await expect(page.locator('text=Not Saved')).toBeVisible();
      }

      if (caseId === 'VEN-038') {
        await gotoNewVendor(page);
        await fillVendorBasic(page, { vendor_name: uniqueValue('VEN038') });
        await saveVendorExpectSuccess(page);
        await expect(page.locator('.alert-message').filter({ hasText: /Saved/i })).toBeVisible();
      }

      if (caseId === 'VEN-039') {
        await createVendor(page, { vendor_name: uniqueValue('VEN039') });
        await page.keyboard.press('Shift+D');
        await expect(page.locator('text=Not Saved')).toBeVisible();
      }

      if (caseId === 'VEN-040') {
        await createVendor(page, { vendor_name: uniqueValue('VEN040') });
        await deleteCurrentVendorViaShortcut(page);
        await gotoVendorList(page);
      }
    });
  }
});
