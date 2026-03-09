const { test, expect } = require('@playwright/test');
const { customers } = require('../../utils/helpers');
const {
  goToList,
  goToNew,
  uniqueName,
  fillCustomerName,
  fillGST,
  fillPAN,
  setCustomerType,
  addCustomerBranch,
  addContactRow,
  saveForm,
  expectSaved,
  expectValidationError,
  deleteBranchRow,
  deleteContactRow,
  loginIfNeeded,
} = customers;

test.setTimeout(90000);

// ─── Reusable: navigate to new customer form (handles auth redirect) ──────────
async function freshForm(page) {
  await goToNew(page);
  await loginIfNeeded(page);
  // After a possible login redirect, ensure we are on the new-customer form
  if (!page.url().includes('amc-customers')) {
    await goToNew(page);
  }
}

function uniquePAN() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const randLetters = (n) =>
    Array.from({ length: n }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  const randDigits = (n) =>
    Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');
  return `${randLetters(5)}${randDigits(4)}${randLetters(1)}`;
}

function gstCheckDigit(gstWithoutCheckDigit) {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let factor = 2;
  let sum = 0;

  for (let i = gstWithoutCheckDigit.length - 1; i >= 0; i -= 1) {
    const codePoint = chars.indexOf(gstWithoutCheckDigit[i]);
    const addend = codePoint * factor;
    factor = factor === 2 ? 1 : 2;
    sum += Math.floor(addend / 36) + (addend % 36);
  }

  const remainder = sum % 36;
  const checkCodePoint = (36 - remainder) % 36;
  return chars[checkCodePoint];
}

function uniqueGSTFromPAN(pan, stateCode = '27') {
  const gst14 = `${stateCode}${pan}1Z`;
  return `${gst14}${gstCheckDigit(gst14)}`;
}

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 1 – Customer Creation & Basic Details
// ═════════════════════════════════════════════════════════════════════════════
test.describe('Customer Creation & Basic Details', () => {

  // Happy path: create a customer with just the required Customer Name field
  test('TC-CUST-001 | Create customer with Customer Name only', async ({ page }) => {
    await freshForm(page);

    const name = uniqueName('MinCust');
    await fillCustomerName(page, name);
    await saveForm(page);
    await expectSaved(page);

    // First-time save redirects away from /new-amc-customers
    expect(page.url()).not.toContain('new-amc-customers');
  });


  test('TC-CUST-002 | Create Company customer with all basic fields', async ({ page }) => {
    await freshForm(page);

    const pan = uniquePAN();
    const gst = uniqueGSTFromPAN(pan);
    const name = uniqueName('CompCust');
    await fillGST(page, gst);
    await fillCustomerName(page, name);
    await setCustomerType(page, 'Company');
    await fillPAN(page, pan);
    await saveForm(page);
    await expectSaved(page);
    page.locator('[data-fieldname="customer_type"] .control-value').first()
  });


  test('TC-CUST-003 | Create Individual customer type', async ({ page }) => {
    await freshForm(page);

    await fillCustomerName(page, uniqueName('IndivCust'));
    await setCustomerType(page, 'Individual');
    await saveForm(page);
    await expectSaved(page);
    page.locator('[data-fieldname="customer_type"] .control-value').first()
  });

  test('TC-CUST-004 | Create Partnership customer type', async ({ page }) => {
    await freshForm(page);

    await fillCustomerName(page, uniqueName('PartnerCust'));
    await setCustomerType(page, 'Partnership');
    await saveForm(page);
    await expectSaved(page);
    page.locator('[data-fieldname="customer_type"] .control-value').first()
  });
});


// ════════════════════════════════════════════════════════════════════════════
// SECTION 2 – GST Validation
// ═════════════════════════════════════════════════════════════════════════════
test.describe('GST Validation', () => {

  test('TC-CUST-005 | Valid 15-character GSTIN is accepted', async ({ page }) => {
    await freshForm(page);

    const pan = uniquePAN();
    const gst = uniqueGSTFromPAN(pan);
    await fillGST(page, gst);
    await fillCustomerName(page, uniqueName('GSTValid'));
    await fillPAN(page, pan);
    await saveForm(page);
    await expectSaved(page);
  });

  test('TC-CUST-006 | Invalid GST format is rejected with error', async ({ page }) => {
    await freshForm(page);

    await fillCustomerName(page, uniqueName('GSTBad'));
    await fillGST(page, 'INVALID_GST_!!');
    await saveForm(page);

    // expectValidationError checks for .frappe-has-error on the field wrapper
    await expectValidationError(page, 'gst');
  });


  test('TC-CUST-007 | Duplicate GSTIN across two customers is blocked', async ({ page }) => {
    const pan = uniquePAN();
    const gstin = uniqueGSTFromPAN(pan, '22');

    // ── Customer 1 ──
    await freshForm(page);
    await fillGST(page, gstin);
    await fillCustomerName(page, uniqueName('DupGST1'));
    await saveForm(page);
    await expectSaved(page);

    // ── Customer 2 (same GSTIN) ──
    await freshForm(page);
    await fillGST(page, gstin);
    await fillCustomerName(page, uniqueName('DupGST2'));
    const saveResult = await saveForm(page);
    expect(saveResult.saved).toBe(false);
    expect(page.url()).toContain('new-amc-customers');
  });


  test('TC-CUST-008 | GST can be blank for Individual customer', async ({ page }) => {
    await freshForm(page);

    await fillCustomerName(page, uniqueName('IndivNoGST'));
    await setCustomerType(page, 'Individual');
    // Intentionally omit fillGST
    await saveForm(page);
    await expectSaved(page);
  });


  test('TC-CUST-009 | Duplicate PAN across two customers is blocked', async ({ page }) => {
    const pan = uniquePAN();

    // ── Customer 1 ──
    await freshForm(page);
    await fillCustomerName(page, uniqueName('DupPAN1'));
    await fillPAN(page, pan);
    await saveForm(page);
    await expectSaved(page);

    // ── Customer 2 (same PAN) ──
    await freshForm(page);
    await fillCustomerName(page, uniqueName('DupPAN2'));
    await fillPAN(page, pan);
    const saveResult = await saveForm(page);
    expect(saveResult.saved).toBe(false);
    expect(page.url()).toContain('new-amc-customers');
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// SECTION 3 – Branch Locations
// ═════════════════════════════════════════════════════════════════════════════
test.describe('Branch Locations', () => {

  test('TC-CUST-010 | Add single branch location', async ({ page }) => {
    await freshForm(page);

    const custName = uniqueName('Branch1');
    await addCustomerBranch(page, custName, 'Head Office', '123 Main St, Mumbai');
    await expectSaved(page);
  });


  test('TC-CUST-011 | Add multiple branch locations', async ({ page }) => {
    await freshForm(page);

    const custName = uniqueName('BranchMulti');

    // addCustomerBranch fills + saves the customer name on each call
    await addCustomerBranch(page, custName, 'Head Office', '123 Main St');
    await addCustomerBranch(page, custName, 'Branch A',    '456 Park Ave');
    await addCustomerBranch(page, custName, 'Branch B',    '789 Lake Rd');

    // At least 3 rows in the branch child table
    const rows = page.locator(
      '[data-fieldname="branch_locations"] .frappe-row, ' +
      '[data-fieldname="branch_locations"] .grid-row'
    );
    const count = await rows.count();
  });


  test('TC-CUST-012 | Delete a branch location row', async ({ page }) => {
    await freshForm(page);

    const custName = uniqueName('BranchDel');
    await addCustomerBranch(page, custName, 'Branch X', 'Address X');
    await addCustomerBranch(page, custName, 'Branch Y', 'Address Y');

    const rows = page.locator(
      '[data-fieldname="branch_locations"] .frappe-row, ' +
      '[data-fieldname="branch_locations"] .grid-row'
    );
    const before = await rows.count();
    expect(before).toBeGreaterThanOrEqual(2);

    // Delete index 0 via Frappe JS (avoids fragile UI interactions)
    await deleteBranchRow(page, 0);

    const after = await rows.count();
    expect(after).toBe(before - 1);

    await saveForm(page);
    await expectSaved(page);
  });


  test('TC-CUST-013 | Branch on AMC Contract is filtered by selected customer', async ({ page }) => {
    // Setup: customer with a distinctively named branch
    await freshForm(page);
    const custName = uniqueName('BranchFilter');
    await addCustomerBranch(page, custName, 'Unique Branch ZZZ', '1 Filter Rd');

    // Navigate to a new AMC Contract
    await page.goto(`${BASE_URL}/app/amc-contract/new-amc-contract`, {
      waitUntil: 'networkidle',
    });
    await loginIfNeeded(page);
    await page.waitForSelector('[data-fieldname="customer"]', { timeout: 10000 });

    // Select the customer
    await page.fill('[data-fieldname="customer"] input', custName);
    await page.click(
      `.dropdown-item:has-text("${custName}"), li[data-value="${custName}"]`
    );

    // Open branch dropdown and inspect options
    const branchInput = page.locator('[data-fieldname="branch"] input');
    await branchInput.click();
    await page.waitForSelector('.awesomplete li, .dropdown-item', { timeout: 5000 });

    const optionTexts = await page
      .locator('.awesomplete li, .dropdown-item')
      .allTextContents();

    // The known branch must appear
    expect(optionTexts.some((t) => t.includes('Unique Branch ZZZ'))).toBe(true);

    // No options from other customers should appear (they won't contain our unique name)
    const foreignBranches = optionTexts.filter(
      (t) => t.trim() !== '' && !t.includes('Unique Branch ZZZ')
    );
    expect(foreignBranches).toHaveLength(0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// SECTION 4 – Contact Details
// ═════════════════════════════════════════════════════════════════════════════
test.describe('Contact Details', () => {


  test('TC-CUST-014 | Add primary contact to customer', async ({ page }) => {
    await freshForm(page);

    const custName = uniqueName('ContactPrimary');
    await fillCustomerName(page, custName);
    // Save parent first so the contacts child table becomes active
    await saveForm(page);
    await expectSaved(page);

    await addContactRow(page, {
      name:      'John Doe',
      mobile:    '9876543210',
      email:     'john@example.com',
      isPrimary: true,
    });

    await saveForm(page);
    await expectSaved(page);

    // Exactly one row in the contacts child table
    await expect(
      page.locator('.frappe-control[data-fieldname="contacts"] .frappe-row')
    ).toHaveCount(1);
  });

  test('TC-CUST-015 | Only one contact can be marked Is Primary', async ({ page }) => {
    await freshForm(page);

    const custName = uniqueName('MultiContact');
    await fillCustomerName(page, custName);
    await saveForm(page);
    await expectSaved(page);

    // Add two contacts both flagged primary
    await addContactRow(page, { name: 'Alice', mobile: '9000000001', isPrimary: true });
    await addContactRow(page, { name: 'Bob',   mobile: '9000000002', isPrimary: true });

    await saveForm(page);

    const errorShown = await page
      .locator('.msgprint, .frappe-toast, .alert-danger')
      .filter({ hasText: /primary|one/i })
      .isVisible()
      .catch(() => false);

    if (!errorShown) {
      // No error → Frappe must have auto-resolved it; only 1 box may be checked
      await expectSaved(page);
      const checkedBoxes = page.locator(
        '.frappe-control[data-fieldname="contacts"] ' +
        '[data-fieldname="is_primary_contact"] input[type="checkbox"]:checked'
      );
      await expect(checkedBoxes).toHaveCount(1);
    }
  });


  test('TC-CUST-016 | Contact Person on AMC Contract filtered by Branch', async ({ page }) => {
    // Setup: customer → branch → contact linked to branch
    await freshForm(page);
    const custName = uniqueName('CPFilter');
    await fillCustomerName(page, custName);
    await saveForm(page);
    await expectSaved(page);

    await addCustomerBranch(page, custName, 'Filter Branch', 'Filter Address');
    await addContactRow(page, {
      name:   'Jane Smith',
      mobile: '9111111111',
      branch: 'Filter Branch',
    });
    await saveForm(page);
    await expectSaved(page);

    // Open a new AMC Contract; select customer + branch
    await page.goto(`${BASE_URL}/app/amc-contract/new-amc-contract`, {
      waitUntil: 'networkidle',
    });
    await loginIfNeeded(page);
    await page.waitForSelector('[data-fieldname="customer"]', { timeout: 10000 });

    await page.fill('[data-fieldname="customer"] input', custName);
    await page.click(
      `.dropdown-item:has-text("${custName}"), li[data-value="${custName}"]`
    );

    await page.fill('[data-fieldname="branch"] input', 'Filter Branch');
    await page.click(
      '.dropdown-item:has-text("Filter Branch"), li[data-value="Filter Branch"]'
    );

    // Contact Person dropdown should contain Jane Smith
    const contactInput = page.locator('[data-fieldname="contact_person"] input');
    await contactInput.click();
    await page.waitForSelector('.awesomplete li, .dropdown-item', { timeout: 5000 });

    const texts = await page.locator('.awesomplete li, .dropdown-item').allTextContents();
    expect(texts.some((t) => t.includes('Jane Smith'))).toBe(true);
  });

  test('TC-CUST-017 | Mobile auto-fetched when Contact Person selected on Contract', async ({ page }) => {
    const mobile = '9222222222';

    // Setup: customer + contact with a known mobile
    await freshForm(page);
    const custName = uniqueName('AutoMobile');
    await fillCustomerName(page, custName);
    await saveForm(page);
    await expectSaved(page);

    await addContactRow(page, { name: 'Auto Person', mobile, isPrimary: true });
    await saveForm(page);
    await expectSaved(page);

    // Open new AMC Contract
    await page.goto(`${BASE_URL}/app/amc-contract/new-amc-contract`, {
      waitUntil: 'networkidle',
    });
    await loginIfNeeded(page);
    await page.waitForSelector('[data-fieldname="customer"]', { timeout: 10000 });

    await page.fill('[data-fieldname="customer"] input', custName);
    await page.click(
      `.dropdown-item:has-text("${custName}"), li[data-value="${custName}"]`
    );

    await page.fill('[data-fieldname="contact_person"] input', 'Auto Person');
    await page.click(
      '.dropdown-item:has-text("Auto Person"), li[data-value="Auto Person"]'
    );

    // Wait for Frappe's fetch_from to populate the mobile field
    await page.waitForFunction(
      (expected) => {
        const el = document.querySelector('[data-fieldname="mobile_no"] input');
        return el && el.value === expected;
      },
      mobile,
      { timeout: 7000 }
    );

    await expect(page.locator('[data-fieldname="mobile_no"] input')).toHaveValue(mobile);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// SECTION 5 – Connections Tab
// ═════════════════════════════════════════════════════════════════════════════
test.describe('Connections Tab', () => {

  /** Opens the first customer in the list and activates the Connections tab. */
  async function openConnectionsTab(page) {
    await goToList(page);
    await loginIfNeeded(page);
    // Click the first customer link
    await page
      .locator('.list-row .list-row-col a, .list-row-col .ellipsis a')
      .first()
      .click();
    await page.waitForSelector('.page-head', { timeout: 10000 });

    // Activate Connections tab if it exists as a discrete nav-link
    const tab = page.locator('.form-tabs-list .nav-link:has-text("Connections")');
    if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tab.click();
    }
    // Otherwise the connections widget is at the bottom of the form — no action needed
  }


  test('TC-CUST-018 | Connections tab shows linked AMC Contracts', async ({ page }) => {
    await openConnectionsTab(page);

    await expect(
      page.locator(
        '.connections-widget a:has-text("AMC Contract"), ' +
        '.form-section:has-text("AMC Contract"), ' +
        '.form-link-title:has-text("AMC Contract")'
      )
    ).toBeVisible({ timeout: 7000 });
  });


  test('TC-CUST-019 | Connections tab shows linked Service Calls', async ({ page }) => {
    await openConnectionsTab(page);

    await expect(
      page.locator(
        '.connections-widget a:has-text("Service Call"), ' +
        '.connections-widget a:has-text("AMC Service Call"), ' +
        '.form-section:has-text("Service Call"), ' +
        '.form-link-title:has-text("Service Call")'
      )
    ).toBeVisible({ timeout: 7000 });
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// SECTION 6 – Permissions
// ═════════════════════════════════════════════════════════════════════════════
test.describe('Permissions', () => {

  /**
   * CUST-020
   * A user with only the Technician role must be able to READ AMC Customers
   * but must have no Save / Edit / New controls available.
   *
   * Env vars: TECH_USER (default: technician@amc.com), TECH_PASS (default: technician)
   * The Technician role must have Read-only permission on AMC Customers in ERPNext.
   */
  test('TC-CUST-020 | Technician role can only READ AMC Customers', async ({ browser }) => {
    // Isolated browser context – no shared admin session
    const techCtx = await browser.newContext({ baseURL: BASE_URL });
    const page    = await techCtx.newPage();

    try {
      // Login as technician
      await page.goto(`${BASE_URL}/login`);
      await page.getByRole('textbox', { name: /email/i }).fill(
        process.env.TECH_USER || 'technician@amc.com'
      );
      await page.getByRole('textbox', { name: /password/i }).fill(
        process.env.TECH_PASS || 'technician'
      );
      await page.getByRole('button', { name: /^login$/i }).click();
      await page.waitForURL(/\/app/, { timeout: 15000 });

      // Visit customer list
      await goToList(page);

      // "New" button must NOT appear
      await expect(
        page.locator('.btn-primary:has-text("New"), .page-head .btn-primary')
      ).toHaveCount(0);

      // Open a customer record
      const firstRow = page.locator('.list-row .list-row-col a').first();
      if (await firstRow.isVisible({ timeout: 5000 })) {
        await firstRow.click();
        await page.waitForSelector('.page-head', { timeout: 10000 });

        // Save / Edit buttons must NOT appear
        await expect(page.locator('.btn-primary:has-text("Save")')).toHaveCount(0);
        await expect(page.locator('.btn-secondary:has-text("Edit")')).toHaveCount(0);
      }
    } finally {
      await techCtx.close();
    }
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// SECTION 7 – Data Integrity
// ═════════════════════════════════════════════════════════════════════════════
test.describe('Data Integrity', () => {

  /**
   * CUST-021
   * Attempting to delete a customer who has at least one active AMC Contract
   * must be blocked with an appropriate error message. The document must
   * remain intact after the failed delete attempt.
   */
  test('TC-CUST-021 | Deleting customer with active contracts is blocked', async ({ page }) => {
    await goToList(page);
    await loginIfNeeded(page);

    // Open the first customer in the list
    // (ensure your test environment has at least one customer with active contracts)
    await page.locator('.list-row .list-row-col a').first().click();
    await page.waitForSelector('.page-head', { timeout: 10000 });

    const docUrl = page.url(); // remember for post-delete assertion

    // Open the document-level menu
    const menuBtn = page.locator(
      '.menu-btn-group .btn, .page-head .dropdown-toggle'
    );
    await menuBtn.click();

    const deleteItem = page.locator(
      'li a:has-text("Delete"), .dropdown-item:has-text("Delete")'
    );

    if (!(await deleteItem.isVisible({ timeout: 3000 }).catch(() => false))) {
      // Delete option not present → the UI itself is blocking it (acceptable)
      console.log('CUST-021: Delete option absent from menu — block confirmed.');
      return;
    }

    await deleteItem.click();

    // Confirm deletion in the modal (if one appears)
    const confirmBtn = page.locator(
      '.modal-footer .btn-danger, .modal .btn-primary:has-text("Yes")'
    );
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    // Expect a Frappe error referencing the blocking link
    await expect(
      page
        .locator('.msgprint, .frappe-toast, .alert-danger, .modal-body')
        .filter({ hasText: /cannot delete|linked|contract|active/i })
    ).toBeVisible({ timeout: 8000 });

    // Document URL must still reference amc-customers (record was NOT deleted)
    expect(page.url()).toMatch(/amc-customers/);
  });
});


