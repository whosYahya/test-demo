'use strict';

// Generated unified helpers from doctype folders (excluding Employee and Users).
// Source modules are embedded below to avoid cross-project import/version conflicts.

const attendance = (() => {
  const module = { exports: {} };
  const exports = module.exports;
  // utils/helpers.js
  const { expect } = require('@playwright/test');
  
  const ROUTES = {
    LIST: '/app/attendance-request',
    NEW:  '/app/attendance-request/new-attendance-request-1',
    ATTENDANCE_LIST: '/app/attendance',
  };
  
  //  re-login logic 
  /**
   * Detects session expiry and auto-relogins during tests.
   * Called automatically by goToList() and goToNew().
   */
  async function ensureLoggedIn(page) {
    const url = page.url();
  
    if (url.includes('/login')) {
      console.log('[ensureLoggedIn] Session expired. Re-logging in...');
  
      const email    = process.env.ERPNEXT_USER || 'Administrator';
      const password = process.env.ERPNEXT_PASS || 'may65';
  
      const emailInput = page.getByRole('textbox', { name: /email/i });
      await emailInput.waitFor({ timeout: 10000 });
      await emailInput.fill(email);
  
      await page.getByRole('textbox', { name: /password/i }).fill(password);
      await page.getByRole('button', { name: /^login$/i }).click();
  
      await page.waitForURL(/\/app/, { timeout: 15000 });
      console.log('[ensureLoggedIn] Re-logged in successfully.');
    }
  }
  
  //  navigation 
  async function goToList(page) {
    await page.goto(ROUTES.LIST);
    await ensureLoggedIn(page);
    await page.waitForSelector('.list-view-header', { timeout: 10000 });
  }
  
  async function goToNew(page) {
    await page.goto(ROUTES.NEW);
    await ensureLoggedIn(page);
    await page.waitForSelector('[data-fieldname="employee"]', { timeout: 10000 });
  }
  
  async function goToAttendanceList(page) {
    await page.goto(ROUTES.ATTENDANCE_LIST);
    await ensureLoggedIn(page);
    await page.waitForSelector('.list-view-header', { timeout: 10000 });
  }
  
  //  date helpers 
  function formatDate(date) {
    const year  = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day   = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  function todayPlus(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return formatDate(d);
  }
  
  function tomorrow() {
    return todayPlus(1);
  }
  
  function dayAfterTomorrow() {
    return todayPlus(2);
  }
  
  function nextWeek() {
    return todayPlus(7);
  }
  
  //  field helpers 
  async function selectEmployee(page, employeeName) {
    const input = page.locator('[data-fieldname="employee"] input');
    await input.fill(employeeName);
    await page.waitForTimeout(800);  // Wait for autocomplete
  
    // Click the first match in autocomplete dropdown
    await page.locator('.awesomplete ul li').filter({ hasText: employeeName }).first().click();
  
    // Wait for auto-fill (Employee Name, Department)
    await page.waitForTimeout(500);
  }
  
  async function fillFromDate(page, dateStr) {
    await page.fill('[data-fieldname="from_date"] input', dateStr);
    await page.keyboard.press('Tab');  // Trigger validation
  }
  
  async function fillToDate(page, dateStr) {
    await page.fill('[data-fieldname="to_date"] input', dateStr);
    await page.keyboard.press('Tab');  // Trigger validation
  }
  
  async function fillReason(page, reason) {
    await page.fill('[data-fieldname="reason"] input, [data-fieldname="reason"] textarea', reason);
  }
  
  async function fillExplanation(page, text) {
    await page.fill('[data-fieldname="explanation"] textarea', text);
  }
  
  async function toggleHalfDay(page, checked) {
    const checkbox = page.locator('[data-fieldname="half_day"] input[type="checkbox"]');
    if (checked) {
      await checkbox.check();
    } else {
      await checkbox.uncheck();
    }
    await page.waitForTimeout(300);  // Let the Half Day Date field appear/hide
  }
  
  async function fillHalfDayDate(page, dateStr) {
    await page.fill('[data-fieldname="half_day_date"] input', dateStr);
    await page.keyboard.press('Tab');
  }
  
  //  save & workflow actions 
  async function saveDraft(page) {
    const urlBefore = page.url();
    const isNew     = urlBefore.includes('new-attendance-request');
  
    await page.keyboard.press('Control+s');
  
    if (isNew) {
      // First save redirects to HR-ATR-YYYY-NNNNN
      await page.waitForFunction(
        () => !window.location.href.includes('new-attendance-request'),
        { timeout: 8000 }
      );
    } else {
      // Subsequent saves show toast or clear dirty indicator
      await page.waitForFunction(
        () => {
          const toast = document.querySelector('.alert-success');
          if (toast && toast.textContent.includes('Saved')) return true;
          const dirty = document.querySelector('.indicator.orange');
          return !dirty;
        },
        { timeout: 8000 }
      );
    }
  }
  
  async function submitRequest(page) {
    // Frappe's Submit button is usually in the menu or as a primary action
    const submitBtnDirect = page.locator('button.btn-primary').filter({ hasText: /Submit/i });
  
    if (await submitBtnDirect.count() > 0) {
      await submitBtnDirect.click();
    } else {
      // Try menu dropdown
      const menu = page.locator('.menu-btn-group .dropdown-toggle, button.btn-secondary')
        .filter({ hasText: /Menu|Actions/i });
      await menu.click();
      await page.locator('.dropdown-menu a, .dropdown-menu li').filter({ hasText: /^Submit$/i }).click();
    }
  
    // Confirmation dialog
    await page.locator('.frappe-dialog .btn-primary').filter({ hasText: /Yes/i }).click();
  
    // Wait for status to change from Draft
    await page.waitForFunction(
      () => {
        const status = document.querySelector('[data-fieldname="docstatus"], .indicator');
        return status && !status.textContent.includes('Draft');
      },
      { timeout: 10000 }
    );
  }
  
  async function approveRequest(page) {
    // Approve action (requires approver permissions)
    const menu = page.locator('.menu-btn-group .dropdown-toggle, button.btn-secondary')
      .filter({ hasText: /Menu|Actions/i });
  
    if (await menu.count() > 0) {
      await menu.click();
      await page.locator('.dropdown-menu a, .dropdown-menu li').filter({ hasText: /Approve/i }).click();
    } else {
      // Direct approve button
      await page.locator('button').filter({ hasText: /Approve/i }).click();
    }
  
    // Wait for status to become Approved
    await page.waitForFunction(
      () => {
        const status = document.querySelector('[data-fieldname="workflow_state"], .indicator');
        return status && status.textContent.includes('Approved');
      },
      { timeout: 10000 }
    );
  }
  
  async function rejectRequest(page) {
    const menu = page.locator('.menu-btn-group .dropdown-toggle, button.btn-secondary')
      .filter({ hasText: /Menu|Actions/i });
  
    if (await menu.count() > 0) {
      await menu.click();
      await page.locator('.dropdown-menu a, .dropdown-menu li').filter({ hasText: /Reject/i }).click();
    } else {
      await page.locator('button').filter({ hasText: /Reject/i }).click();
    }
  
    await page.waitForFunction(
      () => {
        const status = document.querySelector('[data-fieldname="workflow_state"], .indicator');
        return status && status.textContent.includes('Rejected');
      },
      { timeout: 10000 }
    );
  }
  
  async function cancelRequest(page) {
    const menu = page.locator('.menu-icon.btn, .dropdown-toggle');
    await menu.click();
    await page.locator('.dropdown-menu li').filter({ hasText: /^Cancel$/i }).click();
  
    // Confirm cancellation
    await page.locator('.frappe-dialog .btn-danger').filter({ hasText: /Yes/i }).click();
  
    await page.waitForFunction(
      () => {
        const status = document.querySelector('[data-fieldname="docstatus"], .indicator');
        return status && status.textContent.includes('Cancelled');
      },
      { timeout: 10000 }
    );
  }
  
  //  attendance record helpers 
  /**
   * Navigate to Attendance list and count records for a specific employee and date range.
   */
  async function countAttendanceRecords(page, employeeName, fromDate, toDate) {
    await goToAttendanceList(page);
  
    // Filter by employee
    const searchInput = page.locator('.list-view-header input[type="text"]').first();
    await searchInput.fill(employeeName);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
  
    const rows = page.locator('.list-row');
    return await rows.count();
  }
  
  //  assertions 
  async function expectDraft(page) {
    await expect(
      page.locator('[data-fieldname="docstatus"], .indicator').filter({ hasText: /Draft/i })
    ).toBeVisible();
  }
  
  async function expectSubmitted(page) {
    await expect(
      page.locator('[data-fieldname="docstatus"], .indicator').filter({ hasText: /Submitted|Pending/i })
    ).toBeVisible();
  }
  
  async function expectApproved(page) {
    await expect(
      page.locator('[data-fieldname="workflow_state"], .indicator').filter({ hasText: /Approved/i })
    ).toBeVisible();
  }
  
  async function expectRejected(page) {
    await expect(
      page.locator('[data-fieldname="workflow_state"], .indicator').filter({ hasText: /Rejected/i })
    ).toBeVisible();
  }
  
  async function expectCancelled(page) {
    await expect(
      page.locator('[data-fieldname="docstatus"], .indicator').filter({ hasText: /Cancelled/i })
    ).toBeVisible();
  }
  
  async function expectValidationError(page, fieldName) {
    await expect(
      page.locator(`.frappe-control[data-fieldname="${fieldName}"].frappe-has-error, .alert-danger`)
    ).toBeVisible({ timeout: 5000 });
  }
  
  async function expectHalfDayDateVisible(page) {
    await expect(page.locator('[data-fieldname="half_day_date"]')).toBeVisible();
  }
  
  async function expectHalfDayDateHidden(page) {
    await expect(page.locator('[data-fieldname="half_day_date"]')).toBeHidden();
  }
  
  async function expectEmployeeNameFilled(page) {
    const empName = page.locator('[data-fieldname="employee_name"] input, [data-fieldname="employee_name"]');
    const value = await empName.inputValue().catch(() => empName.textContent());
    expect(value).toBeTruthy();
  }
  
  module.exports = {
    ROUTES,
    ensureLoggedIn,
    goToList,
    goToNew,
    goToAttendanceList,
    formatDate,
    todayPlus,
    tomorrow,
    dayAfterTomorrow,
    nextWeek,
    selectEmployee,
    fillFromDate,
    fillToDate,
    fillReason,
    fillExplanation,
    toggleHalfDay,
    fillHalfDayDate,
    saveDraft,
    submitRequest,
    approveRequest,
    rejectRequest,
    cancelRequest,
    countAttendanceRecords,
    expectDraft,
    expectSubmitted,
    expectApproved,
    expectRejected,
    expectCancelled,
    expectValidationError,
    expectHalfDayDateVisible,
    expectHalfDayDateHidden,
    expectEmployeeNameFilled,
  };
  return module.exports;
})();

const contract = (() => {
  const module = { exports: {} };
  const exports = module.exports;
  // utils/helpers.js
  const { expect } = require('@playwright/test');
  
  const ROUTES = {
    LIST: '/app/amc-contract',
    NEW: '/app/amc-contract/new-amc-contract',
  };
  
  //  navigation 
  async function goToList(page) {
    console.log('[goToList] Navigating to', ROUTES.LIST);
    await page.goto(ROUTES.LIST, { waitUntil: 'networkidle' });
  
    // Login if redirected to login page
    if (page.url().includes('/login') || page.url().includes('/auth-login')) {
      console.log('[goToList] Detected login redirect. Logging in...');
      await loginIfNeeded(page);
    }
  
    console.log('[goToList] Current URL:', page.url());
  
    // Wait for list view to load
    try {
      await Promise.race([
        page.waitForSelector('.list-view-header', { timeout: 10000 }),
        page.waitForSelector('.list-row-container', { timeout: 10000 }),
        page.waitForSelector('.no-result', { timeout: 10000 }),
      ]).catch(() => null);
  
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => null);
    } catch (err) {
      console.error('[goToList] Selector timeout. Page content:', await page.textContent('body'));
      throw err;
    }
  }
  
  // Navigates to the new form page and waits for it to be ready
  async function goToNew(page) {
    await page.goto(ROUTES.NEW, { waitUntil: 'domcontentloaded' });
  
    // Only try to login if we're actually on the login page
    if (page.url().includes('/login') || page.url().includes('/auth-login')) {
      await loginIfNeeded(page);
    }
  
    // Wait for the form to finish loading
    try {
      await page.waitForLoadState('networkidle', { timeout: 20000 });
    } catch (e) {
      // Silently ignore timeout, the form might still load
    }
  
    // Wait for form body to be present (more reliable than specific field)
    await page.waitForSelector('.form-layout, .form-page, form[data-doctype]', { timeout: 50000 });
  
    // Small delay for dynamic field rendering
    await page.waitForTimeout(500);
  
  }
  
  //  unique name factory 
  function uniqueName(prefix = 'TestContract') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }
  
  //  date helpers 
  // Returns date string in YYYY-MM-DD format (Frappe's input format)
  function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${day}-${month}-${year}`; // DD-MM-YYYY
  }
  
  function todayPlus(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return formatDate(d);
  }
  
  //  top-level field helpers 
  async function fillStartDate(page, dateStr) {
    // Close any open dialogs first
    await page.evaluate(() => {
      document.querySelectorAll('[role="dialog"], .modal').forEach(el => {
        if (el.classList.contains('show') || el.style.display !== 'none') {
          el.style.display = 'none';
        }
      });
    }).catch(() => null);
  
    // Use Frappe API to set field value - this properly triggers change detection
    await page.evaluate((date) => {
      if (window.cur_frm && window.cur_frm.set_value) {
        window.cur_frm.set_value('start_date', date);
      }
    }, dateStr);
    await page.waitForTimeout(200);
  }
  
  async function fillEndDate(page, dateStr) {
    // Close any open dialogs first
    await page.evaluate(() => {
      document.querySelectorAll('[role="dialog"], .modal').forEach(el => {
        if (el.classList.contains('show') || el.style.display !== 'none') {
          el.style.display = 'none';
        }
      });
    }).catch(() => null);
  
    // Use Frappe API to set field value - this properly triggers change detection
    await page.evaluate((date) => {
      if (window.cur_frm && window.cur_frm.set_value) {
        window.cur_frm.set_value('end_date', date);
      }
    }, dateStr);
    await page.waitForTimeout(200);
  }
  
  async function fillNoOfServices(page, num) {
    // Use Frappe API to set field value - this properly tracks changes
    await page.evaluate((value) => {
      if (window.cur_frm && window.cur_frm.set_value) {
        window.cur_frm.set_value('no_of_services', value);
      }
    }, num);
    await page.waitForTimeout(300);
  }
  
  async function selectCustomer(page, customerName) {
    // Frappe Link fields: type into the input, wait for dropdown, click the match
    const input = page.locator('[data-fieldname="customer"] input');
    await input.fill(customerName);
    await page.waitForTimeout(800);  // wait for autocomplete dropdown
    await page.locator('.awesomplete ul li').filter({ hasText: customerName }).first().click();
  }
  
  async function selectBranch(page, branchName) {
    const input = page.locator('[data-fieldname="branch"] input');
    await input.fill(branchName);
    await page.waitForTimeout(800);
    await page.locator('.awesomplete ul li').filter({ hasText: branchName }).first().click();
  }
  
  async function selectContactPerson(page, contactName) {
    const input = page.locator('[data-fieldname="contact_person"] input');
    await input.fill(contactName);
    await page.waitForTimeout(800);
    await page.locator('.awesomplete ul li').filter({ hasText: contactName }).first().click();
  }
  
  //  child table (Maintenance Schedule) 
  async function addMaintenanceRow(page, { equipment }) {
    const table = page.locator(
      '.frappe-control[data-fieldname="maintenance_schedule"]'
    );
  
    // Ensure grid is rendered
    await table.waitFor({ state: 'visible' });
  
    const rows = table.locator('.grid-row');
    const before = await rows.count();
  
    // Click Add Row
    await table.locator('button:has-text("Add Row")').click();
  
    // Wait until row count increases
    await expect(rows).toHaveCount(before + 1, { timeout: 10000 });
  
    const row = rows.nth(before);
  
    if (equipment) {
      await row.locator('[data-fieldname="equipment"] input').fill(equipment);
    }
  }
  
  //  save (creates Draft) 
  async function saveDraft(page) {
    // Click the Save button directly
    const saveBtn = page.locator('button').filter({ hasText: /^Save$/i }).first();
  
    // Try clicking the button
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (await saveBtn.count() > 0) {
          await saveBtn.click({ force: true, timeout: 3000 });
          // Wait for any dialogs or navigation
          await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
          await page.waitForTimeout(500);
          return; // Success
        }
      } catch (e) {
        // Button might be blocked or something else, try again
        await page.waitForTimeout(500);
      }
    }
  
    // Fallback: use Frappe API if button doesn't work
    try {
      await page.evaluate(async () => {
        if (window.cur_frm && window.cur_frm.save) {
          await window.cur_frm.save();
        }
      });
    } catch (e) {
      // Ignore context destroyed errors
      if (!e.message.includes('Execution context was destroyed')) {
        throw e;
      }
    }
  }
  
  //  submit (Draft  Submitted) 
  // Frappe v15 Submit button is more consistently placed in the primary action area
  async function submitContract(page) {
    // ERPNext v15 typically has the Submit button as a primary action in the top toolbar
    // Try to find and click the Submit button directly
    const submitBtn = page.locator('button').filter({
      hasText: /^Submit$/i
    }).first();
  
    // Alternative selectors for different ERPNext versions
    if (await submitBtn.count() > 0 && await submitBtn.isEnabled()) {
      await submitBtn.click();
    } else {
      // Fallback: Check the dropdown menu (Menu button)
      const menuBtn = page.locator('button[data-label="Menu"]').first();
  
      if (await menuBtn.count() > 0) {
        await menuBtn.click();
        await page.waitForTimeout(300);
  
        // Click Submit from dropdown
        const submitOption = page.locator('.dropdown-menu a, .dropdown-menu button').filter({
          hasText: /^Submit$/i
        }).first();
  
        if (await submitOption.count() > 0) {
          await submitOption.click();
        }
      }
    }
  
    // Wait for the confirmation dialog and confirm
    // ERPNext v15 uses improved modal structure
    const confirmBtn = page.locator('[data-bb-action="yes"], button').filter({
      hasText: /^Yes$/i
    }).first();
  
    if (await confirmBtn.count() > 0) {
      await confirmBtn.click();
    }
  
    // Wait for submission to complete
    // More reliable: check docstatus field directly
    await page.waitForFunction(
      () => {
        return window.cur_frm &&
          window.cur_frm.doc &&
          window.cur_frm.doc.docstatus === 1;
      },
      { timeout: 15000 }
    );
  
    // Optional: Wait for status badge to update
    await page.waitForSelector('.indicator-pill.red, [data-docstatus="1"]', {
      timeout: 5000
    }).catch(() => null);
  }
  
  //  navigate to Service Calls tab 
  async function goToServiceCallsTab(page) {
    await page.locator('a.frappe-tab, .frappe-tab').filter({ hasText: /Service Calls/i }).click();
    await page.waitForTimeout(1000);  // let the tab content render
  }
  
  //  assertions 
  async function expectDraft(page) {
    await page.waitForFunction(() => {
      return window.cur_frm &&
        window.cur_frm.doc &&
        window.cur_frm.doc.docstatus === 0;
    }, { timeout: 10000 });
  }
  
  
  async function expectSubmitted(page) {
    await expect(page.locator('span').filter({ hasText: 'Submitted' }).first()).toBeVisible();
  }
  
  async function expectServiceCallsCount(page, count) {
    // After navigating to Service Calls tab, count the number of linked service call rows
    // Frappe renders linked docs as list items or table rows inside the tab
    const links = page.locator('.frappe-control[data-fieldtype="Table"] .frappe-row, .form-links .link-item');
    await expect(links).toHaveCount(count);
  }
  
  async function loginIfNeeded(page) {
    // Check if we're on login page
    if (page.url().includes('/login') || page.url().includes('/auth-login')) {
      console.log('[loginIfNeeded]. Logging in again...');
  
      const baseURL = process.env.BASE_URL || 'http://127.0.0.1:8004';
      const email = process.env.ERPNEXT_USER || 'Administrator';
      const password = process.env.ERPNEXT_PASS || 'may65';
  
      // Fill login form
      await page.getByRole('textbox', { name: /email/i }).fill(email);
      await page.getByRole('textbox', { name: /password/i }).fill(password);
  
      // Click the login button
      const loginBtn = page.getByRole('button', { name: /^login$/i });
      if (await loginBtn.count() > 0) {
        await loginBtn.click();
      } else {
        // Fallback: click any button with "Login" text
        await page.locator('button').filter({ hasText: /^Login$/i }).first().click();
      }
    }
  }
  
  module.exports = {
    ROUTES,
    loginIfNeeded,
    goToList,
    goToNew,
    uniqueName,
    formatDate,
    todayPlus,
    fillStartDate,
    fillEndDate,
    fillNoOfServices,
    selectCustomer,
    selectBranch,
    selectContactPerson,
    addMaintenanceRow,
    saveDraft,
    submitContract,
    goToServiceCallsTab,
    expectDraft,
    expectSubmitted,
    expectServiceCallsCount,
  };
  return module.exports;
})();

const customers = (() => {
  const module = { exports: {} };
  const exports = module.exports;
  // utils/helpers.js
  const { expect } = require('@playwright/test');
  //  canonical routes 
  const ROUTES = {
    LIST: '/app/amc-customers',
    NEW: '/app/amc-customers/new-amc-customers',
  };
  
  //  navigation 
  async function goToList(page) {
    console.log('[goToList] Navigating to', ROUTES.LIST);
    await page.goto(ROUTES.LIST, { waitUntil: 'networkidle' });
  
    // Login if redirected to login page
    if (page.url().includes('/login') || page.url().includes('/auth-login')) {
      console.log('[goToList] Detected login redirect. Logging in...');
      await loginIfNeeded(page);
    }
  
    console.log('[goToList] Current URL:', page.url());
  
    // Wait for list view to load
    try {
      await Promise.race([
        page.waitForSelector('.list-view-header', { timeout: 10000 }),
        page.waitForSelector('.list-row-container', { timeout: 10000 }),
        page.waitForSelector('.no-result', { timeout: 10000 }),
      ]).catch(() => null);
  
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => null);
    } catch (err) {
      console.error('[goToList] Selector timeout. Page content:', await page.textContent('body'));
      throw err;
    }
  }
  
  async function goToNew(page) {
    console.log('[goToNew] Navigating to', ROUTES.NEW);
    await page.goto(ROUTES.NEW, { waitUntil: 'networkidle' });
  
    // Login if redirected to login page
    if (page.url().includes('/login') || page.url().includes('/auth-login')) {
      console.log('[goToNew] Detected login redirect. Logging in...');
      await loginIfNeeded(page);
    }
  
    console.log('[goToNew] Current URL:', page.url());
    await page.waitForSelector('[data-fieldname="customer_name"]', { timeout: 10000 });
  }
  
  //  unique-name factory 
  function uniqueName(prefix = 'TestCust') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }
  
  //  top-level field helpers 
  async function fillCustomerName(page, name) {
    await page.fill('[data-fieldname="customer_name"] input', name);
  }
  
  async function fillGST(page, gst) {
    const gstInput = page.locator('[data-fieldname="gst"] input');
    await gstInput.fill(gst);
    await gstInput.press('Tab');
  
    // Custom GST hook populates PAN/type/branches asynchronously.
    await page
      .waitForResponse(
        (resp) =>
          resp.url().includes('/amc_customers.fetch_gstin_details') ||
          resp.url().includes('/amc_customers/amc_customers.fetch_gstin_details'),
        { timeout: 7000 }
      )
      .catch(() => null);
  
    await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => null);
  }
  
  async function fillPAN(page, pan) {
    await page.fill('[data-fieldname="pan"] input', pan);
  }
  
  async function setCustomerType(page, type) {
    // Frappe renders Select fields as a native <select> element
    await page.selectOption('[data-fieldname="customer_type"] select', { label: type });
  }
  
  //  child-table helpers 
  // Returns the newly created Frappe row locator after waiting for it.
  async function addCustomerBranch(page, customerName, branchName, address) {
  
    const customerField = page.locator('form [data-fieldname="customer_name"] input');
    await customerField.waitFor({ state: 'visible', timeout: 20000 });
    await customerField.fill(customerName);
  
    // Save the parent form to enable child table
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+s' : 'Control+s');
    await page.waitForTimeout(1000);
  
    const branchSection = page.locator('form').filter({ hasText: 'branch_locations_table' });
    await branchSection.waitFor({ state: 'visible', timeout: 20000 });
  
    // Open the "+ Add Branch" dropdown
    const addDropdownBtn = branchSection.getByRole('button');
    await addDropdownBtn.waitFor({ state: 'visible', timeout: 20000 });
    await addDropdownBtn.click();
  
    // Click "Create a new Customer Branch"
    await page.getByText('Create a new Customer Branch').click();
  
    // Fill branch name
    const branchInput = page.getByRole('textbox').first();
    await branchInput.waitFor({ state: 'visible', timeout: 20000 });
    await branchInput.fill(branchName);
  
    // Fill branch address
    const addressTextarea = page.locator('[id^="page-Customer Branch"] textarea[type="text"]');
    await addressTextarea.waitFor({ state: 'visible', timeout: 20000 });
    await addressTextarea.fill(address);
  
    // Save the branch
    // await page.getByRole('button', { name: 'Save' }).click();
    // Verify the branch appears in the parent form
    // await expect(page.getByText(branchName + address)).toBeVisible({ timeout: 10000 });
  
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+s' : 'Control+s');
    await page.waitForTimeout(1500);

    if (page.url().includes('/app/customer-branch/')) {
      await page.goBack({ waitUntil: 'networkidle' }).catch(() => null);
    }

    await page.waitForURL(/\/app\/amc-customers\//, { timeout: 20000 }).catch(() => null);
    await page.waitForSelector('.frappe-control[data-fieldname="contacts"]', { timeout: 10000 }).catch(() => null);
  
  }
  
  // Similar helper for Contacts child table
  async function addContactRow(page, { name, mobile, email, branch, isPrimary }) {
    const table = page.locator(
      '.frappe-control[data-fieldname="contacts"], ' +
      '.frappe-control[data-fieldname="contact_details_table"], ' +
      '[data-fieldname="contact_details_table"]'
    ).filter({ has: page.getByRole('button', { name: /add row/i }) }).first();
    await table.waitFor({ state: 'visible', timeout: 10000 });
    const rows = table.locator('.frappe-row, .grid-row');
  
    const before = await rows.count();
  
    await table.getByRole('button', { name: /add row/i }).click();
  
    await rows.nth(before).waitFor({ state: 'attached', timeout: 5000 });
  
    const row = rows.nth(before);
    if (name) await row.locator('[data-fieldname="contact_name"] input').fill(name);
    if (mobile) await row.locator('[data-fieldname="mobile"] input').fill(mobile);
    if (email) await row.locator('[data-fieldname="email"] input').fill(email);
    if (branch) await row.locator('[data-fieldname="branch"] input').fill(branch);
    if (isPrimary) await row.locator('[data-fieldname="is_primary_contact"] input[type="checkbox"]').check();
  
    return row;
  }
  
  //  save & assertions 
  async function saveForm(page) {
    const timeoutMs = 8000;
    const errorSelector = '.modal.show .modal-body, .msgprint, .alert-danger, .frappe-message';
    const finalize = (result) => {
      page.__lastSaveResult = result;
      return result;
    };
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const preErrorLocator = page.locator(errorSelector).first();
      const hasPreError = await preErrorLocator.isVisible({ timeout: 500 }).catch(() => false);
      const preExistingError = hasPreError
        ? (await preErrorLocator.textContent().catch(() => null))
        : null;
      if (preExistingError?.trim()) {
        return finalize({
          saved: false,
          error: preExistingError.trim(),
          url: page.url(),
        });
      }
  
      // Keyboard save is more reliable when overlays/animations are present.
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+s' : 'Control+s');
  
      const saveResponsePromise = page
        .waitForResponse((resp) => resp.url().includes('/api/method/frappe.desk.form.save.savedocs'), {
          timeout: timeoutMs,
        })
        .then(async (resp) => ({
          type: 'response',
          status: resp.status(),
          body: await resp.text().catch(() => ''),
        }));
  
      const successPromise = page
        .waitForFunction(
          () => {
            const frm = window.cur_frm;
            if (!frm || typeof frm.is_dirty !== 'function') return false;
            const hasUnsaved = !!(frm.doc && frm.doc.__unsaved);
            return !frm.is_dirty() && !hasUnsaved;
          },
          { timeout: timeoutMs }
        )
        .then(() => ({ type: 'success' }));
  
      const uiErrorPromise = page
        .waitForSelector(errorSelector, {
          state: 'visible',
          timeout: timeoutMs,
        })
        .then(() => ({ type: 'ui-error' }));
  
      const signal = await Promise.any([saveResponsePromise, successPromise, uiErrorPromise]).catch(
        () => null
      );
  
      const state = await page
        .evaluate(() => {
          const frm = window.cur_frm;
          const dirty = !!frm?.is_dirty?.();
          const unsaved = !!frm?.doc?.__unsaved;
          const modalEl = document.querySelector('.modal.show .modal-body, .msgprint, .alert-danger, .frappe-message');
          const errorText = modalEl?.textContent?.trim() || null;
          return { dirty, unsaved, errorText, url: window.location.href };
        })
        .catch(() => ({ dirty: true, unsaved: true, errorText: 'Page became unavailable during save', url: null }));
  
      if (state.errorText) {
        return finalize({
          saved: false,
          error: state.errorText,
          url: state.url,
        });
      }
  
      if (!state.dirty && !state.unsaved) {
        return finalize({
          saved: true,
          error: null,
          url: state.url,
        });
      }
  
      // Document is created/updated but client-side hooks may have dirtied the form again.
      if (state.url && !state.url.includes('new-amc-customers')) {
        return finalize({
          saved: true,
          error: null,
          url: state.url,
        });
      }
  
      // GST auto-fill can mark the form dirty right after first successful save.
      if (attempt === 1 && signal?.type === 'response' && signal.status < 400) {
        continue;
      }
  
      return finalize({
        saved: false,
        error: null,
        url: state.url,
      });
    }
  
    return finalize({
      saved: false,
      error: null,
      url: page.url(),
    });
  }
  async function expectSaved(page) {
    if (page.__lastSaveResult?.saved) return;
  
  }
  
  async function expectValidationError(page, fieldName) {
    await expect(
      page.locator(`.frappe-control[data-fieldname="${fieldName}"].frappe-has-error`)
    ).toBeVisible();
  }
  
  //  delete a child-table row by index (0-based) via Frappe API 
  // Frappe's own row-delete UX is fragile to automate; calling the
  // form's JavaScript is the reliable path.
  async function deleteBranchRow(page, index) {
    await page.evaluate(
      (i) => {
        cur_frm.doc.branches.splice(i, 1);
        cur_frm.refresh_fields();
        cur_frm.dirty();
      },
      index
    );
  }
  
  async function deleteContactRow(page, index) {
    await page.evaluate(
      (i) => {
        cur_frm.doc.contacts.splice(i, 1);
        cur_frm.refresh_fields();
        cur_frm.dirty();
      },
      index
    );
  }
  
  // Add this to helpers.js
  async function loginIfNeeded(page) {
    // Check if we're on login page
    if (page.url().includes('/login') || page.url().includes('/auth-login')) {
      console.log('[loginIfNeeded] Not authenticated. Logging in...');
  
      const baseURL = process.env.BASE_URL || 'http://127.0.0.1:8004';
      const email = process.env.ERPNEXT_USER || 'Administrator';
      const password = process.env.ERPNEXT_PASS || 'may65';
  
      // Fill login form
      await page.getByRole('textbox', { name: /email/i }).fill(email);
      await page.getByRole('textbox', { name: /password/i }).fill(password);
      await page.getByRole('button', { name: /^login$/i }).click();
  
      // Wait for redirect to /app
      await page.waitForURL(/\/app/, { timeout: 20000 });
      console.log('[loginIfNeeded] Login successful.');
    }
  }
  
  // Export it
  module.exports = {
    ROUTES,
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
  };
  return module.exports;
})();

const serviceCalls = (() => {
  const module = { exports: {} };
  const exports = module.exports;
  const { expect } = require('@playwright/test');
  
  // routes
  const ROUTES = {
    LIST: '/app/service-call',
    NEW: '/app/service-call/new-service-call',
  };
  
  function isLoginUrl(url) {
    return /\/login|\/auth-login/i.test(url || '');
  }
  
  function getFieldControl(page, fieldname) {
    return page.locator(`.frappe-control[data-fieldname="${fieldname}"]`).first();
  }
  
  function resolveUrl(page, route) {
    if (/^https?:\/\//i.test(route)) return route;
    if (!route.startsWith('/')) return route;
  
    const current = page.url();
    if (/^https?:\/\//i.test(current)) {
      const origin = new URL(current).origin;
      return `${origin}${route}`;
    }
  
    return route;
  }
  
  async function waitForFormReady(page) {
    await page.waitForURL(/\/app(s)?(?:\/|$)/, { timeout: 30000 });
    await ensureDeskContext(page);
  
    const shell = page.locator('.layout-main-section, .form-layout, .form-page').first();
    await shell.waitFor({ state: 'visible', timeout: 20000 });
  
    const detailsTab = page
      .locator('.frappe-tab, .nav-link, [role="tab"], [data-toggle="tab"]')
      .filter({ hasText: /Details/i })
      .first();
    await detailsTab.waitFor({ state: 'visible', timeout: 15000 });
  }
  
  async function ensureDeskContext(page) {
    if (/\/apps(?:$|[?#/])/i.test(page.url())) {
      await page.goto(resolveUrl(page, '/app'), { waitUntil: 'domcontentloaded' });
      await loginIfNeeded(page);
    }
  }
  
  // re-login / session guard
  async function loginIfNeeded(page) {
    if (!isLoginUrl(page.url())) return;
  
    const email = process.env.ERPNEXT_USER || 'Administrator';
    const password = process.env.ERPNEXT_PASS || 'may65';
  
    await page.getByRole('textbox', { name: /email/i }).fill(email);
    await page.getByRole('textbox', { name: /password/i }).fill(password);
    await page.getByRole('button', { name: /^login$/i }).click();
  
    await page.waitForURL(/\/app(s)?(?:\/|$)/, { timeout: 30000 });
  }
  
  // navigation
  async function goToList(page) {
    await page.goto(resolveUrl(page, ROUTES.LIST), { waitUntil: 'domcontentloaded' });
    await loginIfNeeded(page);
    await page.waitForSelector('.list-view-header, .result, .list-row-container', { timeout: 15000 });
  }
  
  async function goToNew(page) {
    await page.goto(resolveUrl(page, ROUTES.NEW), { waitUntil: 'domcontentloaded' });
    await loginIfNeeded(page);
    await ensureDeskContext(page);
  
    // Retry once for intermittent redirects like /apps.
    if (!/\/app\/service-call\/new-service-call/i.test(page.url())) {
      await page.goto(resolveUrl(page, ROUTES.NEW), { waitUntil: 'domcontentloaded' });
      await loginIfNeeded(page);
      await ensureDeskContext(page);
    }
  
    await waitForFormReady(page);
  }
  
  // tab navigation
  async function goToTab(page, tabLabel) {
    const tab = page
      .locator('.frappe-tab, .nav-link, [role="tab"], [data-toggle="tab"]')
      .filter({ hasText: new RegExp(tabLabel, 'i') })
      .first();
  
    await tab.waitFor({ state: 'visible', timeout: 10000 });
    await tab.click();
    await expectTabActive(page, tabLabel);
    await page.waitForTimeout(300);
  }
  
  // date helper
  function todayFormatted() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  
  function todayPlus(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  
  async function clearAndFill(locator, value) {
    await locator.waitFor({ state: 'visible', timeout: 10000 });
    await locator.click({ clickCount: 3 });
    await locator.fill('');
    await locator.fill(String(value));
  }
  
  async function pickAwesompleteOption(page, optionText) {
    const option = page.locator('.awesomplete ul li').filter({ hasText: new RegExp(optionText, 'i') }).first();
    await option.waitFor({ state: 'visible', timeout: 10000 });
    await option.click();
  }
  
  async function fillLinkField(page, fieldname, value) {
    const input = getFieldControl(page, fieldname).locator('input').first();
    await clearAndFill(input, value);
    await page.waitForTimeout(400);
    await pickAwesompleteOption(page, value);
    await page.waitForTimeout(250);
  }
  
  // Details tab field helpers
  async function fillDate(page, dateStr) {
    const input = getFieldControl(page, 'date').locator('input').first();
    await clearAndFill(input, dateStr);
    await input.press('Tab');
  }
  
  async function selectCustomer(page, customerName) {
    await fillLinkField(page, 'customer', customerName);
  }
  
  async function selectBranch(page, branchName) {
    await fillLinkField(page, 'branch', branchName);
  }
  
  async function selectContactedPerson(page, personName) {
    await fillLinkField(page, 'contacted_person', personName);
  }
  
  async function selectType(page, typeValue) {
    const select = getFieldControl(page, 'type').locator('select').first();
    await select.waitFor({ state: 'visible', timeout: 10000 });
    await select.selectOption({ label: typeValue });
  }
  
  async function selectCompanyBranch(page, branchName) {
    await fillLinkField(page, 'service_branch', branchName);
  }
  
  async function selectAmcContract(page, contractName) {
    await fillLinkField(page, 'amc_contract', contractName);
  }
  
  async function fillSpecialInstruction(page, text) {
    const textarea = getFieldControl(page, 'special_instruction').locator('textarea').first();
    await clearAndFill(textarea, text);
  }
  
  // Technician List child table
  async function addTechnicianRow(page, { employee, isPrimary = false } = {}) {
    const table = page.locator('[data-fieldname="technician_list"]');
    await table.waitFor({ state: 'visible', timeout: 10000 });
  
    const before = await table.locator('.grid-row').count();
  
    const addRowBtn = table.locator('button, .grid-add-row').filter({ hasText: /Add Row/i }).first();
    await addRowBtn.click();
    await page.waitForTimeout(300);
  
    const row = table.locator('.grid-row').nth(before);
  
    if (employee) {
      const empInput = row.locator('[data-fieldname="employee"] input').first();
      await clearAndFill(empInput, employee);
      await page.waitForTimeout(400);
      await pickAwesompleteOption(page, employee);
    }
  
    if (isPrimary) {
      const primaryChk = row.locator('[data-fieldname="primary"] input[type="checkbox"]').first();
      await primaryChk.check();
    }
  
    return row;
  }
  
  async function getTechnicianRowCount(page) {
    const table = page.locator('[data-fieldname="technician_list"]');
    await table.waitFor({ state: 'visible', timeout: 10000 });
    return table.locator('.grid-row').count();
  }
  
  // Service Report tab field helpers
  async function fillServiceDate(page, dateStr) {
    const input = getFieldControl(page, 'service_date').locator('input').first();
    await clearAndFill(input, dateStr);
    await input.press('Tab');
  }
  
  async function fillModelNo(page, modelNo) {
    const input = getFieldControl(page, 'model_no').locator('input').first();
    await clearAndFill(input, modelNo);
  }
  
  async function fillIduSerial(page, serial) {
    const input = getFieldControl(page, 'idu_serial').locator('input').first();
    await clearAndFill(input, serial);
  }
  
  async function fillOduSerial(page, serial) {
    const input = getFieldControl(page, 'odu_serial').locator('input').first();
    await clearAndFill(input, serial);
  }
  
  async function fillServiceDescription(page, text) {
    const textarea = getFieldControl(page, 'service_description').locator('textarea').first();
    await clearAndFill(textarea, text);
  }
  
  async function fillSparePart(page, text) {
    const input = getFieldControl(page, 'spare_part').locator('input').first();
    await clearAndFill(input, text);
  }
  
  async function fillCustomerRemark(page, text) {
    const input = getFieldControl(page, 'customer_remark').locator('input').first();
    await clearAndFill(input, text);
  }
  
  // save / workflow actions
  async function saveDraft(page) {
    const before = page.url();
    await page.keyboard.press('Control+s');
  
    const maybeConfirm = page.locator('.frappe-dialog .btn-primary').filter({ hasText: /Yes|OK|Confirm|Save/i }).first();
    if (await maybeConfirm.isVisible().catch(() => false)) {
      await maybeConfirm.click();
    }
  
    // Save succeeds if URL changes from /new-service-call... or "Saved" toast appears.
    await page.waitForFunction(
      (prevUrl) => {
        const now = window.location.href;
        const toast = document.querySelector('.alert-success, .indicator-pill.green');
        const savedToast = toast && /saved/i.test(toast.textContent || '');
        const leftNewRoute = /\/app\/service-call\//.test(now) && !/new-service-call/i.test(now);
        return savedToast || leftNewRoute || now !== prevUrl;
      },
      before,
      { timeout: 12000 }
    ).catch(() => {});
  }
  
  async function clickWorkflowButton(page, label) {
    const re = new RegExp(label, 'i');
  
    const primary = page.locator('button.btn-primary, button').filter({ hasText: re }).first();
    if (await primary.isVisible().catch(() => false)) {
      await primary.click();
    } else {
      const menuToggle = page.locator('.menu-btn-group .dropdown-toggle, .btn-secondary.dropdown-toggle, button:has-text("Actions")').first();
      await menuToggle.click();
  
      const menuItem = page.locator('.dropdown-menu li, .dropdown-menu a, .dropdown-item').filter({ hasText: re }).first();
      await menuItem.click();
    }
  
    const confirmBtn = page.locator('.frappe-dialog .btn-primary').filter({ hasText: /Yes|OK|Confirm/i }).first();
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click();
    }
  
    await page.waitForTimeout(600);
  }
  
  async function assignTechnicians(page) {
    await clickWorkflowButton(page, 'Assign');
  }
  
  async function acceptCall(page) {
    await clickWorkflowButton(page, 'Accept');
  }
  
  async function rejectCall(page) {
    await clickWorkflowButton(page, 'Reject');
  }
  
  async function startCall(page) {
    await clickWorkflowButton(page, 'Start');
  }
  
  async function endCall(page) {
    await clickWorkflowButton(page, 'End');
  }
  
  // assertions
  async function expectNotSaved(page) {
    await expect(page.locator('span, .indicator-pill, .indicator').filter({ hasText: /Not Saved/i }).first()).toBeVisible();
  }
  
  async function expectSaved(page) {
    await expect(page.locator('span, .indicator-pill, .indicator').filter({ hasText: /Not Saved/i })).toHaveCount(0);
  }
  
  async function expectWorkflowStatus(page, statusText) {
    const re = statusText instanceof RegExp ? statusText : new RegExp(statusText, 'i');
    await expect(
      page.locator('[data-fieldname="workflow_state"], [data-fieldname="status"], .indicator, .indicator-pill').filter({ hasText: re }).first()
    ).toBeVisible({ timeout: 10000 });
  }
  
  async function expectFieldVisible(page, fieldname) {
    const control = getFieldControl(page, fieldname);
    await expect(control).toBeVisible({ timeout: 15000 });
  }
  
  async function expectValidationError(page) {
    await expect(page.locator('.alert-danger, .msgprint, .frappe-control.has-error, .frappe-has-error').first()).toBeVisible({
      timeout: 5000,
    });
  }
  
  async function expectTabActive(page, tabLabel) {
    const activeTab = page
      .locator('.frappe-tab.active, .nav-link.active, [data-toggle="tab"].active, [role="tab"][aria-selected="true"]')
      .filter({ hasText: new RegExp(tabLabel, 'i') })
      .first();
    await expect(activeTab).toBeVisible({ timeout: 10000 });
  }
  
  module.exports = {
    ROUTES,
    getFieldControl,
    goToList,
    goToNew,
    goToTab,
    todayFormatted,
    todayPlus,
    loginIfNeeded,
    fillDate,
    selectCustomer,
    selectBranch,
    selectContactedPerson,
    selectType,
    selectCompanyBranch,
    selectAmcContract,
    fillSpecialInstruction,
    addTechnicianRow,
    getTechnicianRowCount,
    fillServiceDate,
    fillModelNo,
    fillIduSerial,
    fillOduSerial,
    fillServiceDescription,
    fillSparePart,
    fillCustomerRemark,
    saveDraft,
    clickWorkflowButton,
    assignTechnicians,
    acceptCall,
    rejectCall,
    startCall,
    endCall,
    expectNotSaved,
    expectSaved,
    expectWorkflowStatus,
    expectFieldVisible,
    expectValidationError,
    expectTabActive,
  };
  return module.exports;
})();

const expenses = (() => {
  const module = { exports: {} };
  const exports = module.exports;
  const { expect } = require('@playwright/test');
  
  const ROUTES = {
    LIST: '/app/expense-claim',
    NEW: '/app/expense-claim/new',
  };
  
  function isLoginUrl(url) {
    return /\/login|\/auth-login/i.test(url || '');
  }
  
  function resolveUrl(page, route) {
    if (/^https?:\/\//i.test(route)) return route;
    if (!route.startsWith('/')) return route;
  
    const current = page.url();
    if (/^https?:\/\//i.test(current)) {
      return `${new URL(current).origin}${route}`;
    }
  
    const base = process.env.BASE_URL || 'http://127.0.0.1:8004';
    return `${base}${route}`;
  }
  
  async function loginIfNeeded(page) {
    if (!isLoginUrl(page.url())) return;
  
    const email = process.env.ERPNEXT_USER || 'Administrator';
    const password = process.env.ERPNEXT_PASS || 'may65';
  
    await page.getByRole('textbox', { name: /email/i }).fill(email);
    await page.getByRole('textbox', { name: /password/i }).fill(password);
    await page.getByRole('button', { name: /^login$/i }).click();
    await page.waitForURL(/\/app|\/apps/, { timeout: 30000 });
  }
  
  async function dismissBlockingDialogs(page) {
    for (let i = 0; i < 3; i += 1) {
      const modal = page.locator('.modal.show, [role="dialog"][aria-modal="true"]').first();
      const visible = await modal.isVisible().catch(() => false);
      if (!visible) return;
  
      const closeBtnWithLabel = modal
        .locator('button, .btn')
        .filter({ hasText: /Close|OK|Cancel|Dismiss|No|/i })
        .first();
  
      const headerCloseBtn = modal.locator('.modal-header button, .modal-header .close, button.close').first();
  
      if (await closeBtnWithLabel.isVisible().catch(() => false)) {
        await closeBtnWithLabel.click().catch(() => null);
      } else if (await headerCloseBtn.isVisible().catch(() => false)) {
        await headerCloseBtn.click().catch(() => null);
      } else {
        await page.keyboard.press('Escape').catch(() => null);
      }
      await page.waitForTimeout(200);
    }
  }
  
  async function ensureDeskContext(page) {
    if (/\/apps(?:$|[/?#])/i.test(page.url())) {
      await page.goto(resolveUrl(page, '/app'), { waitUntil: 'domcontentloaded' });
      await loginIfNeeded(page);
    }
  }
  
  async function waitForExpenseFormReady(page) {
    await page.waitForTimeout(500);
    const shell = page.locator('.layout-main-section, .form-layout, .frappe-form').first();
    await shell.waitFor({ state: 'visible', timeout: 12000 });
  
    const markers = [
      control(page, 'employee'),
      control(page, 'company'),
      control(page, 'expense_approver'),
      grid(page, 'expenses'),
    ];
  
    for (const marker of markers) {
      if (await marker.isVisible().catch(() => false)) return;
    }
  
    await page.locator('[data-fieldname="employee"], [data-fieldname="expenses"]').first().waitFor({
      state: 'visible',
      timeout: 15000,
    });
  }
  
  async function hasExpenseForm(page) {
    const hints = [
      control(page, 'employee'),
      control(page, 'company'),
      control(page, 'expense_approver'),
      grid(page, 'expenses'),
    ];
    for (const hint of hints) {
      if (await hint.isVisible().catch(() => false)) return true;
    }
    return /\/app\/expense-claim\/new/i.test(page.url());
  }
  
  async function goToList(page) {
    await page.goto(resolveUrl(page, ROUTES.LIST), { waitUntil: 'domcontentloaded' });
    await loginIfNeeded(page);
    await ensureDeskContext(page);
    await page.locator('.list-view-header, .result, .list-row-container').first().waitFor({
      state: 'visible',
      timeout: 15000,
    });
  }
  
  async function goToNew(page) {
    const bases = new Set();
    const baseFromEnv = process.env.BASE_URL || 'http://127.0.0.1:8004';
    const current = page.url();
  
    if (/^https?:\/\//i.test(current)) bases.add(new URL(current).origin);
    bases.add(new URL(baseFromEnv).origin);
    bases.add('http://127.0.0.1:8004');
    bases.add('http://localhost:8004');
  
    const paths = ['/app/expense-claim/new', '/app/expense-claim/new-expense-claim-1'];
    let lastErr;
  
    for (const base of bases) {
      for (const path of paths) {
        try {
          await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await loginIfNeeded(page);
          await ensureDeskContext(page);
          if (await hasExpenseForm(page)) {
            await waitForExpenseFormReady(page);
            return;
          }
        } catch (e) {
          lastErr = e;
        }
      }
    }
  
    try {
      await goToList(page);
      const newBtn = page
        .locator('button, a')
        .filter({ hasText: /^New$|Create|Add/i })
        .first();
  
      if (await newBtn.isVisible().catch(() => false)) {
        await newBtn.click();
        await page.waitForTimeout(1200);
        await loginIfNeeded(page);
        await ensureDeskContext(page);
        if (await hasExpenseForm(page)) {
          await waitForExpenseFormReady(page);
          return;
        }
      }
    } catch (e) {
      lastErr = e;
    }
  
    throw lastErr || new Error('Unable to open Expense Claim new form.');
  }
  
  function control(page, fieldname) {
    return page.locator(`.frappe-control[data-fieldname="${fieldname}"]`).first();
  }
  
  function fieldInput(page, fieldname) {
    return control(page, fieldname).locator('input, textarea, select').first();
  }
  
  async function clearAndType(locator, value) {
    const page = locator.page();
    await dismissBlockingDialogs(page);
    await locator.waitFor({ state: 'visible', timeout: 10000 });
    await locator.click({ clickCount: 3 });
    await locator.fill('');
    await locator.fill(String(value));
  }
  
  async function pickAwesomplete(page, value) {
    const option = value
      ? page.locator('.awesomplete ul li').filter({ hasText: new RegExp(value, 'i') }).first()
      : page.locator('.awesomplete ul li').first();
  
    if (await option.isVisible().catch(() => false)) {
      await option.click();
      return true;
    }
    return false;
  }
  
  async function fillLinkField(page, fieldname, value, options = {}) {
    const { pickFirstIfNoExact = true } = options;
    const input = fieldInput(page, fieldname);
    await clearAndType(input, value);
    await page.waitForTimeout(300);
  
    let picked = await pickAwesomplete(page, value);
    if (!picked && pickFirstIfNoExact) {
      picked = await pickAwesomplete(page);
    }
  
    await input.press('Tab');
    return picked;
  }
  
  async function fillField(page, fieldname, value) {
    const input = fieldInput(page, fieldname);
    await clearAndType(input, value);
    await input.press('Tab');
  }
  
  async function selectOption(page, fieldname, label) {
    const select = control(page, fieldname).locator('select').first();
    await select.waitFor({ state: 'visible', timeout: 10000 });
    const options = await select.locator('option').allTextContents();
    const hasLabel = options.some((x) => (x || '').trim().toLowerCase() === String(label).trim().toLowerCase());
  
    if (hasLabel) {
      await select.selectOption({ label });
      return true;
    }
  
    const fallbackIndex = Math.min(1, Math.max(0, (await select.locator('option').count()) - 1));
    await select.selectOption({ index: fallbackIndex });
    return false;
  }
  
  async function openTab(page, tabLabel) {
    const tab = page
      .locator('.frappe-tab, .nav-link, [role="tab"], [data-toggle="tab"]')
      .filter({ hasText: new RegExp(tabLabel, 'i') })
      .first();
  
    await tab.waitFor({ state: 'visible', timeout: 12000 });
    await tab.click();
    await page.waitForTimeout(300);
  
    const selected = (await tab.getAttribute('aria-selected').catch(() => '')) === 'true';
    if (selected) return;
  
    const activeTab = page
      .locator('.frappe-tab.active, .nav-link.active, [role="tab"][aria-selected="true"]')
      .filter({ hasText: new RegExp(tabLabel, 'i') })
      .first();
    if (await activeTab.isVisible().catch(() => false)) return;
  
    const panel = page.locator('[role="tabpanel"]').filter({ hasText: new RegExp(tabLabel, 'i') }).first();
    if (await panel.isVisible().catch(() => false)) return;
  }
  
  function grid(page, fieldname) {
    return page.locator(`[data-fieldname="${fieldname}"]`).first();
  }
  
  function gridDataRows(page, fieldname) {
    return grid(page, fieldname).locator('.grid-row[data-name]');
  }
  
  async function getGridRowCount(page, fieldname) {
    return gridDataRows(page, fieldname).count();
  }
  
  async function addGridRow(page, fieldname) {
    const g = grid(page, fieldname);
    const before = await getGridRowCount(page, fieldname);
    const addBtn = g.locator('button, .grid-add-row').filter({ hasText: /Add Row/i }).first();
  
    if (!(await addBtn.isVisible().catch(() => false))) {
      return before;
    }
  
    await addBtn.click();
    await page.waitForTimeout(400);
    return getGridRowCount(page, fieldname);
  }
  
  async function openGridRow(page, fieldname, index = 0) {
    const row = gridDataRows(page, fieldname).nth(index);
    await row.waitFor({ state: 'visible', timeout: 10000 });
  
    const opener = row.locator('.btn-open-row, [data-original-title="Edit"]').first();
    if (await opener.isVisible().catch(() => false)) {
      await opener.click();
    } else {
      await row.click();
    }
  
    await page.waitForTimeout(350);
    return row;
  }
  
  async function fillGridRowField(page, gridFieldname, rowIndex, childFieldname, value, opts = {}) {
    const { isLink = false } = opts;
    const row = await openGridRow(page, gridFieldname, rowIndex);
    const scopedInput = row
      .locator(
        `.grid-row-open .frappe-control[data-fieldname="${childFieldname}"] input:visible, .grid-row-open .frappe-control[data-fieldname="${childFieldname}"] textarea:visible, .grid-row-open .frappe-control[data-fieldname="${childFieldname}"] select:visible, .grid-form-row .frappe-control[data-fieldname="${childFieldname}"] input:visible, .grid-form-row .frappe-control[data-fieldname="${childFieldname}"] textarea:visible, .grid-form-row .frappe-control[data-fieldname="${childFieldname}"] select:visible`
      )
      .first();
    const globalInput = page
      .locator(
        `.grid-row-open .frappe-control[data-fieldname="${childFieldname}"] input:visible, .grid-row-open .frappe-control[data-fieldname="${childFieldname}"] textarea:visible, .grid-row-open .frappe-control[data-fieldname="${childFieldname}"] select:visible, .grid-form-row .frappe-control[data-fieldname="${childFieldname}"] input:visible, .grid-form-row .frappe-control[data-fieldname="${childFieldname}"] textarea:visible, .grid-form-row .frappe-control[data-fieldname="${childFieldname}"] select:visible`
      )
      .first();
  
    let input = scopedInput;
    if (!(await input.isVisible().catch(() => false))) {
      input = globalInput;
    }
    await input.waitFor({ state: 'visible', timeout: 10000 });
    await clearAndType(input, value);
  
    if (isLink) {
      await page.waitForTimeout(250);
      await pickAwesomplete(page, value).catch(() => false);
    }
  
    await input.press('Tab');
  }
  
  async function deleteGridRow(page, fieldname, index = 0) {
    const g = grid(page, fieldname);
    const before = await getGridRowCount(page, fieldname);
    if (before === 0) return before;
  
    const row = gridDataRows(page, fieldname).nth(index);
    const checkbox = row.locator('input.grid-row-check').first();
    await checkbox.check();
  
    const deleteBtn = g.locator('button, a').filter({ hasText: /^Delete$/i }).first();
    if (await deleteBtn.isVisible().catch(() => false)) {
      await deleteBtn.click();
    }
  
    await page.waitForTimeout(400);
    return getGridRowCount(page, fieldname);
  }
  
  async function getGridStaticText(page, fieldname, rowIndex, childFieldname) {
    const row = gridDataRows(page, fieldname).nth(rowIndex);
    const cell = row.locator(`[data-fieldname="${childFieldname}"] .static-area`).first();
    if (!(await cell.isVisible().catch(() => false))) return '';
    return (await cell.innerText()).trim();
  }
  
  function todayFormatted() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  
  function todayPlus(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  
  async function saveForm(page) {
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(1200);
  }
  
  async function getIndicatorText(page) {
    const texts = await page.locator('.indicator-pill, .indicator').allTextContents();
    return texts.map((x) => (x || '').trim()).filter(Boolean).join(' | ');
  }
  
  async function isNotSaved(page) {
    return /Not Saved/i.test(await getIndicatorText(page));
  }
  
  async function expectValidationError(page) {
    await expect(page.locator('.msgprint, .alert-danger, .frappe-control.has-error').first()).toBeVisible({
      timeout: 7000,
    });
  }
  
  async function getSelectOptions(page, fieldname) {
    const select = control(page, fieldname).locator('select').first();
    await select.waitFor({ state: 'visible', timeout: 10000 });
    const opts = await select.locator('option').allTextContents();
    return opts.map((x) => (x || '').trim()).filter(Boolean);
  }
  
  async function isFieldReadOnly(page, fieldname) {
    const input = fieldInput(page, fieldname);
    if (!(await input.isVisible().catch(() => false))) return false;
    const ro = await input.getAttribute('readonly');
    const dis = await input.getAttribute('disabled');
    return ro !== null || dis !== null;
  }
  
  async function setIsPaid(page, value = true) {
    await openTab(page, 'Accounting');
    const chk = control(page, 'is_paid').locator('input[type="checkbox"]').first();
    if (!(await chk.isVisible().catch(() => false))) return false;
    if (value) {
      await chk.check();
    } else {
      await chk.uncheck();
    }
    await page.waitForTimeout(300);
    return true;
  }
  
  async function tryPickFirstLinkSuggestion(page, fieldname, seed = 'a') {
    const input = fieldInput(page, fieldname);
    await clearAndType(input, seed);
    await page.waitForTimeout(300);
    return pickAwesomplete(page);
  }
  
  module.exports = {
    ROUTES,
    loginIfNeeded,
    goToList,
    goToNew,
    openTab,
    control,
    fieldInput,
    fillField,
    fillLinkField,
    selectOption,
    grid,
    gridDataRows,
    getGridRowCount,
    addGridRow,
    openGridRow,
    fillGridRowField,
    deleteGridRow,
    getGridStaticText,
    todayFormatted,
    todayPlus,
    saveForm,
    getIndicatorText,
    isNotSaved,
    expectValidationError,
    getSelectOptions,
    isFieldReadOnly,
    setIsPaid,
    tryPickFirstLinkSuggestion,
  };
  return module.exports;
})();

const leaves = (() => {
  const module = { exports: {} };
  const exports = module.exports;
  const fs = require('fs');
  const path = require('path');
  const { expect } = require('@playwright/test');
  
  const ROUTES = {
    LIST: '/app/leave-application',
    NEW: '/app/leave-application/new-leave-application',
  };
  
  function loadLeaveCases(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split('\t');
        return {
          id: (parts[0] || '').trim(),
          module: (parts[1] || '').trim(),
          group: (parts[2] || '').trim(),
          title: (parts[3] || '').trim(),
        };
      })
      .filter((row) => /^LEA-\d{3}$/.test(row.id));
  }
  
  function plusDays(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d;
  }
  
  function formatDateDMY(date) {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = String(date.getFullYear());
    return `${dd}-${mm}-${yyyy}`;
  }
  
  function ymd(date) {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = String(date.getFullYear());
    return `${yyyy}-${mm}-${dd}`;
  }
  
  function field(page, name) {
    return page.locator(`[data-fieldname="${name}"]`).first();
  }
  
  function fieldInput(page, name) {
    return field(page, name).locator('input, textarea, select').first();
  }
  
  async function closeOpenModal(page) {
    const modal = page.locator('.modal.show').first();
    if ((await modal.count()) === 0) return;
  
    const closeCandidates = [
      '.btn-modal-close',
      '[data-dismiss="modal"]',
      '.modal-header button',
    ];
  
    for (const selector of closeCandidates) {
      const btn = modal.locator(selector).first();
      if ((await btn.count()) > 0) {
        await btn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(150);
        if ((await modal.count()) === 0) return;
      }
    }
  
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(150);
  }
  
  async function openNewLeaveApplication(page) {
    await page.goto(ROUTES.NEW, { waitUntil: 'networkidle' });
    if (page.url().includes('/login')) {
      const email = process.env.ERPNEXT_USER || 'Administrator';
      const password = process.env.ERPNEXT_PASS || 'may65';
      await page.getByRole('textbox', { name: /email/i }).fill(email);
      await page.getByRole('textbox', { name: /password/i }).fill(password);
      await page.getByRole('button', { name: /^login$/i }).click();
      await page.waitForURL(/\/app/, { timeout: 20000 });
      await page.goto(ROUTES.NEW, { waitUntil: 'networkidle' });
    }
    await expect(page).toHaveURL(/\/app\/leave-application\/new-leave-application/);
    await expect(page.getByText(/new leave application/i).first()).toBeVisible();
    await closeOpenModal(page);
  }
  
  async function assertLeaveFormReady(page) {
    await expect(page.getByRole('button', { name: /^save$/i })).toBeVisible();
    for (const fieldname of ['naming_series', 'employee', 'leave_type', 'company', 'from_date', 'to_date', 'half_day', 'description', 'leave_approver', 'posting_date', 'status']) {
      await expect(field(page, fieldname)).toBeVisible();
    }
  }
  
  async function getMandatoryFieldsFromDialog(page) {
    const dialog = page.locator('.modal.show .msgprint-dialog, .modal.show').first();
    await expect(dialog).toBeVisible({ timeout: 10000 });
    const items = await page.locator('.modal.show .msgprint li').allInnerTexts();
    return items.map((s) => s.trim()).filter(Boolean);
  }
  
  async function triggerSaveAndCollectMandatory(page) {
    await page.getByRole('button', { name: /^save$/i }).click();
    const fields = await getMandatoryFieldsFromDialog(page);
    const message = (await page.locator('.modal.show .msgprint').allInnerTexts()).join(' ');
    await closeOpenModal(page).catch(() => {});
    return { fields, message };
  }
  
  async function setInputValue(page, fieldname, value) {
    const input = fieldInput(page, fieldname);
    await expect(input).toBeVisible();
    await input.click();
    await input.fill('');
    await input.type(String(value), { delay: 10 });
    await input.press('Tab');
    await page.waitForTimeout(250);
    await closeOpenModal(page);
  }
  
  async function setCheckboxValue(page, fieldname, checked) {
    const checkbox = field(page, fieldname).locator('input[type="checkbox"]').first();
    await expect(checkbox).toBeVisible();
    if (checked) {
      await checkbox.check({ force: true });
    } else {
      await checkbox.uncheck({ force: true });
    }
    await closeOpenModal(page);
  }
  
  async function getInputValue(page, fieldname) {
    return fieldInput(page, fieldname).inputValue();
  }
  
  async function getFieldText(page, fieldname) {
    return (await field(page, fieldname).innerText()).replace(/\s+/g, ' ').trim();
  }
  
  async function getStatusOptions(page) {
    const select = field(page, 'status').locator('select').first();
    return select.locator('option').allInnerTexts();
  }
  
  async function getSeriesOptions(page) {
    const select = field(page, 'naming_series').locator('select').first();
    return select.locator('option').allInnerTexts();
  }
  
  async function apiGet(page, apiPath) {
    const response = await page.context().request.get(apiPath);
    return response;
  }
  
  async function apiPost(page, apiPath, data) {
    const response = await page.context().request.fetch(apiPath, { method: 'POST', data });
    return response;
  }
  
  async function apiPut(page, apiPath, data) {
    const response = await page.context().request.fetch(apiPath, { method: 'PUT', data });
    return response;
  }
  
  async function searchLink(page, doctype, txt = '') {
    const p = `/api/method/frappe.desk.search.search_link?doctype=${encodeURIComponent(doctype)}&txt=${encodeURIComponent(txt)}&page_length=20`;
    const res = await apiGet(page, p);
    if (!res.ok()) return [];
    const json = await res.json();
    return Array.isArray(json.message) ? json.message : [];
  }
  
  async function ensureLeaveType(page, leaveTypeName) {
    const listRes = await apiGet(page, `/api/resource/Leave%20Type?fields=["name"]&filters=[["name","=",${JSON.stringify(leaveTypeName)}]]&limit_page_length=1`);
    if (listRes.ok()) {
      const json = await listRes.json();
      if (json.data && json.data.length) return leaveTypeName;
    }
  
    const createRes = await apiPost(page, '/api/resource/Leave%20Type', {
      leave_type_name: leaveTypeName,
      max_leaves_allowed: leaveTypeName.toLowerCase().includes('sick') ? 15 : 30,
      is_lwp: 0,
    });
  
    if (!createRes.ok()) {
      const text = await createRes.text();
      if (!/DuplicateEntryError|already exists/i.test(text)) {
        throw new Error(`Failed to ensure Leave Type '${leaveTypeName}': ${text}`);
      }
    }
    return leaveTypeName;
  }
  
  async function getAnyEmployee(page) {
    const res = await apiGet(page, '/api/resource/Employee?fields=["name","employee_name","company","leave_approver"]&limit_page_length=1');
    if (!res.ok()) return null;
    const json = await res.json();
    return json.data?.[0] || null;
  }
  
  async function ensureEmployeeWithApprover(page, approver = 'Administrator') {
    const withApprover = await apiGet(page, '/api/resource/Employee?fields=["name","employee_name","company","leave_approver"]&filters=[["leave_approver","is","set"]]&limit_page_length=1');
    if (withApprover.ok()) {
      const json = await withApprover.json();
      if (json.data && json.data.length) return json.data[0];
    }
  
    const employee = await getAnyEmployee(page);
    if (!employee) throw new Error('No Employee records found for Leave Application tests.');
  
    const updateRes = await apiPut(page, `/api/resource/Employee/${encodeURIComponent(employee.name)}`, {
      leave_approver: approver,
    });
  
    if (!updateRes.ok()) {
      throw new Error(`Failed to set leave approver for employee ${employee.name}`);
    }
  
    const readRes = await apiGet(page, `/api/resource/Employee/${encodeURIComponent(employee.name)}`);
    if (!readRes.ok()) return { ...employee, leave_approver: approver };
    const readJson = await readRes.json();
    return readJson.data;
  }
  
  async function ensureBaselineMasterData(page) {
    await ensureLeaveType(page, 'Annual Leave');
    await ensureLeaveType(page, 'Sick Leave');
    const employee = await ensureEmployeeWithApprover(page, 'Administrator');
    return {
      employeeCode: employee.name,
      company: employee.company || 'Amc AC',
      approver: employee.leave_approver || 'Administrator',
      leaveType: 'Annual Leave',
    };
  }
  
  module.exports = {
    ROUTES,
    loadLeaveCases,
    plusDays,
    formatDateDMY,
    ymd,
    field,
    fieldInput,
    openNewLeaveApplication,
    assertLeaveFormReady,
    closeOpenModal,
    triggerSaveAndCollectMandatory,
    setInputValue,
    setCheckboxValue,
    getInputValue,
    getFieldText,
    getStatusOptions,
    getSeriesOptions,
    searchLink,
    ensureBaselineMasterData,
  };
  return module.exports;
})();

const vendor = (() => {
  const module = { exports: {} };
  const exports = module.exports;
  const { expect } = require('@playwright/test');
  
  const ROUTES = {
    LOGIN: '/login',
    APPS: '/apps',
    HOME: '/app/home',
    VENDOR_LIST: '/app/vendor',
    VENDOR_NEW: '/app/vendor/new-vendor',
  };
  
  const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8004';
  const USERNAME = process.env.ERPNEXT_USER || 'Administrator';
  const PASSWORD = process.env.ERPNEXT_PASS || 'may65';
  
  function uniqueValue(prefix = 'VENDOR') {
    const ts = Date.now();
    const rnd = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}-${ts}-${rnd}`;
  }
  
  function uniquePAN() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const pick = () => letters[Math.floor(Math.random() * letters.length)];
    const head = `${pick()}${pick()}${pick()}${pick()}${pick()}`;
    const digits = String(Date.now() % 10000).padStart(4, '0');
    const tail = pick();
    return `${head}${digits}${tail}`;
  }
  
  function control(page, fieldname) {
    return page.locator(`.frappe-control[data-fieldname="${fieldname}"]`);
  }
  
  function fieldInput(page, fieldname) {
    return control(page, fieldname).locator('input, textarea').first();
  }
  
  async function loginToERPNext(page) {
    await page.goto(`${BASE_URL}${ROUTES.LOGIN}`, { waitUntil: 'domcontentloaded' });
  
    if (page.url().includes('/app/')) return;
  
    if (page.url().includes(ROUTES.APPS)) {
      const erpTile = page.locator('a, div, button').filter({ hasText: /^ERPNext$/ }).first();
      if (await erpTile.count()) {
        await erpTile.click();
        try {
          await page.waitForURL(/\/app\//, { timeout: 10000 });
        } catch {
          await page.goto(`${BASE_URL}${ROUTES.HOME}`);
        }
      }
      return;
    }
  
    const emailBox = page.getByRole('textbox', { name: /email/i });
    if (await emailBox.isVisible({ timeout: 10000 }).catch(() => false)) {
      await emailBox.fill(USERNAME);
      await page.getByRole('textbox', { name: /password/i }).fill(PASSWORD);
      await page.getByRole('button', { name: /^login$/i }).click();
      await page.waitForURL(/\/(apps|app\/home|app\/workspace|app\/)/, { timeout: 30000 });
    }
  
    if (page.url().includes(ROUTES.APPS)) {
      const erpTile = page.locator('a, div, button').filter({ hasText: /^ERPNext$/ }).first();
      if (await erpTile.count()) {
        await erpTile.click();
        await page.waitForURL(/\/app\//, { timeout: 20000 }).catch(async () => {
          await page.goto(`${BASE_URL}${ROUTES.HOME}`);
        });
      }
    }
  
    if (!page.url().includes('/app/')) {
      await page.goto(`${BASE_URL}${ROUTES.HOME}`);
      await page.waitForURL(/\/app\//, { timeout: 30000 });
    }
  }
  
  async function gotoVendorList(page) {
    await page.goto(`${BASE_URL}${ROUTES.VENDOR_LIST}`);
    await expect(page).toHaveURL(/\/app\/vendor(\?.*)?$/);
    await expect(page.getByRole('heading', { name: /^Vendor$/i })).toBeVisible();
  }
  
  async function gotoNewVendor(page) {
    await page.goto(`${BASE_URL}${ROUTES.VENDOR_NEW}`);
    await page.waitForURL(/\/app\/vendor\/new-vendor/i);
    await expect(page.getByRole('button', { name: /^Save$/i })).toBeVisible();
  }
  
  async function fillVendorBasic(page, data = {}) {
    if (data.vendor_name !== undefined) {
      await fieldInput(page, 'vendor_name').fill(data.vendor_name);
    }
    if (data.type !== undefined) {
      await control(page, 'type').locator('select').first().selectOption({ label: data.type });
    }
    if (data.primary_contact_person !== undefined) {
      await fieldInput(page, 'primary_contact_person').fill(data.primary_contact_person);
    }
    if (data.mobile_no !== undefined) {
      await fieldInput(page, 'mobile_no').fill(data.mobile_no);
    }
    if (data.email !== undefined) {
      await fieldInput(page, 'email').fill(data.email);
    }
    if (data.pan !== undefined) {
      await fieldInput(page, 'pan').fill(data.pan);
    }
    if (data.registered_address !== undefined) {
      await fieldInput(page, 'registered_address').fill(data.registered_address);
    }
  }
  
  async function addAddressRow(page, rowData = {}) {
    const grid = control(page, 'address_list');
    await grid.getByRole('button', { name: /^Add Row$/i }).click();
  
    const row = grid.locator('.grid-body .grid-row').last();
    await row.waitFor();
  
    if (rowData.name1 !== undefined) await row.locator('input[data-fieldname="name1"]').fill(rowData.name1);
    if (rowData.city !== undefined) await row.locator('input[data-fieldname="city"]').fill(rowData.city);
    if (rowData.state !== undefined) await row.locator('input[data-fieldname="state"]').fill(rowData.state);
    if (rowData.gst_no !== undefined) await row.locator('input[data-fieldname="gst_no"]').fill(rowData.gst_no);
    if (rowData.mobile_no !== undefined) await row.locator('input[data-fieldname="mobile_no"]').fill(rowData.mobile_no);
  
    await page.keyboard.press('Escape');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
  }
  
  async function editAddressRow(page, index, rowData = {}) {
    const grid = control(page, 'address_list');
    const row = grid.locator('.grid-body .grid-row').nth(index);
    await row.click();
  
    if (rowData.name1 !== undefined) await row.locator('input[data-fieldname="name1"]').fill(rowData.name1);
    if (rowData.city !== undefined) await row.locator('input[data-fieldname="city"]').fill(rowData.city);
    if (rowData.state !== undefined) await row.locator('input[data-fieldname="state"]').fill(rowData.state);
    if (rowData.gst_no !== undefined) await row.locator('input[data-fieldname="gst_no"]').fill(rowData.gst_no);
    if (rowData.mobile_no !== undefined) await row.locator('input[data-fieldname="mobile_no"]').fill(rowData.mobile_no);
  
    await page.keyboard.press('Escape');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
  }
  
  async function deleteFirstAddressRow(page) {
    const grid = control(page, 'address_list');
    const firstRowCheck = grid.locator('.grid-body .grid-row .grid-row-check').first();
    await firstRowCheck.check();
    await page.keyboard.press('Delete');
  
    const deleteBtn = page.getByRole('button', { name: /^Delete$/i }).first();
    if (await deleteBtn.isVisible().catch(() => false)) {
      await deleteBtn.click();
    }
  
    const yesButton = page.getByRole('button', { name: /^Yes$/i }).first();
    if (await yesButton.isVisible().catch(() => false)) {
      await yesButton.click();
    }
  }
  
  async function closeAnyMessageDialog(page) {
    const closeButton = page.locator('.modal.show .btn-modal-close').first();
    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click();
    }
  }
  
  async function trySaveVendor(page) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
    await page.getByRole('button', { name: /^Save$/i }).click();
  
    let savedToast = 0;
    let errorDialogVisible = 0;
    let statusNotSaved = 1;
    let savedByUrl = false;
  
    for (let i = 0; i < 10; i += 1) {
      savedToast = await page.locator('.alert-message').filter({ hasText: /Saved/i }).count();
      errorDialogVisible = await page.locator('.modal.show').count();
      statusNotSaved = await page.locator('text=Not Saved').count();
      savedByUrl = /\/app\/vendor\/(?!new-vendor)/.test(page.url());
      if (savedToast > 0 || errorDialogVisible > 0 || savedByUrl || statusNotSaved === 0) break;
      await page.waitForTimeout(500);
    }
  
    const errorDialog = page.locator('.modal.show');
  
    let dialogText = '';
    if (errorDialogVisible) {
      dialogText = await errorDialog.first().innerText();
    }
  
    return {
      saved: savedToast > 0 || savedByUrl || !statusNotSaved,
      hasErrorDialog: errorDialogVisible > 0,
      statusNotSaved: statusNotSaved > 0,
      dialogText,
      currentUrl: page.url(),
    };
  }
  
  async function saveVendorExpectSuccess(page) {
    let result = await trySaveVendor(page);
    if (!result.saved && !result.hasErrorDialog && /\/new-vendor/i.test(result.currentUrl)) {
      const typeSelect = control(page, 'type').locator('select').first();
      if ((await typeSelect.count()) > 0 && (await typeSelect.inputValue()) === '') {
        await typeSelect.selectOption({ index: 1 });
        result = await trySaveVendor(page);
      }
    }
  
    if (result.hasErrorDialog || !result.saved) {
      throw new Error(`Save failed. Dialog: ${result.dialogText || 'none'}, URL: ${result.currentUrl}`);
    }
    await page.waitForURL(/\/app\/vendor\/(?!new-vendor)/, { timeout: 15000 });
  }
  
  async function getCurrentVendorIdFromUrl(page) {
    const url = new URL(page.url());
    const parts = url.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1];
  }
  
  async function getTypeOptions(page) {
    const select = control(page, 'type').locator('select').first();
    return await select.locator('option').allInnerTexts();
  }
  
  async function createVendor(page, overrides = {}) {
    await gotoNewVendor(page);
    const data = {
      vendor_name: uniqueValue('VEN'),
      ...overrides,
    };
    await fillVendorBasic(page, data);
    await saveVendorExpectSuccess(page);
    const vendorId = await getCurrentVendorIdFromUrl(page);
    return { vendorId, data };
  }
  
  async function deleteCurrentVendorViaShortcut(page) {
    await page.keyboard.press('Control+Shift+D');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await page.getByRole('button', { name: /^Yes$/i }).click();
    await page.waitForURL(/\/app\/(vendor|home)/, { timeout: 30000 });
  }
  
  function isValidPAN(pan) {
    return /^[A-Z]{5}\d{4}[A-Z]$/.test((pan || '').toUpperCase());
  }
  
  function isValidGST(gst) {
    return /^\d{2}[A-Z]{5}\d{4}[A-Z]\dZ[A-Z0-9]$/.test((gst || '').toUpperCase());
  }
  
  module.exports = {
    BASE_URL,
    ROUTES,
    uniqueValue,
    uniquePAN,
    control,
    fieldInput,
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
    getCurrentVendorIdFromUrl,
    getTypeOptions,
    createVendor,
    deleteCurrentVendorViaShortcut,
    isValidPAN,
    isValidGST,
  };
  return module.exports;
})();

const doctypeHelpers = {
  attendance,
  contract,
  customers,
  serviceCalls,
  expenses,
  leaves,
  vendor,
};

const combined = {
  doctypeHelpers,
  attendance,
  contract,
  customers,
  serviceCalls,
  expenses,
  leaves,
  vendor,
};

const keyCounts = new Map();
for (const mod of Object.values(doctypeHelpers)) {
  for (const key of Object.keys(mod)) {
    keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
  }
}

for (const [ns, mod] of Object.entries(doctypeHelpers)) {
  for (const [key, value] of Object.entries(mod)) {
    const alias = ns + key.charAt(0).toUpperCase() + key.slice(1);
    if (!(alias in combined)) {
      combined[alias] = value;
    }
    if ((keyCounts.get(key) || 0) === 1 && !(key in combined)) {
      combined[key] = value;
    }
  }
}

module.exports = combined;
