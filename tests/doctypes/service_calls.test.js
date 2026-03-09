const { test, expect } = require('@playwright/test');
const { serviceCalls } = require('../../utils/helpers');
const {
  goToList,
  goToNew,
  goToTab,
  loginIfNeeded,
  getFieldControl,
  fillDate,
  fillServiceDate,
  fillModelNo,
  fillIduSerial,
  fillOduSerial,
  fillServiceDescription,
  fillSparePart,
  fillCustomerRemark,
  fillSpecialInstruction,
  saveDraft,
  addTechnicianRow,
  getTechnicianRowCount,
  todayFormatted,
  todayPlus,
} = serviceCalls;

function uniqueText(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function extractDocName(url) {
  const match = (url || '').match(/\/app\/service-call\/([^/?#]+)/i);
  return match ? decodeURIComponent(match[1]) : '';
}

async function selectFirstLinkOption(page, fieldname, preferred) {
  const input = getFieldControl(page, fieldname).locator('input').first();
  await expect(input).toBeVisible({ timeout: 15000 });

  const probes = [];
  if (preferred) probes.push(preferred);
  probes.push('a', 'e', 'i', 'o', 'u', '1');

  for (const probe of probes) {
    await input.click({ clickCount: 3 });
    await input.fill('');
    await input.type(probe, { delay: 30 });
    await page.waitForTimeout(500);

    const options = page.locator('.awesomplete ul li');
    const count = await options.count();
    if (count > 0) {
      await options.first().click();
      await page.waitForTimeout(250);
      const value = (await input.inputValue()).trim();
      if (value) return value;
    }
  }

  throw new Error(`No selectable value found for field "${fieldname}".`);
}

async function selectTypeOption(page, preferred) {
  const select = getFieldControl(page, 'type').locator('select').first();
  await expect(select).toBeVisible({ timeout: 15000 });

  const options = await select.locator('option').evaluateAll((nodes) =>
    nodes.map((n) => ({ value: n.value, label: (n.textContent || '').trim() }))
  );

  let chosen = null;
  if (preferred) {
    chosen = options.find(
      (o) => o.value === preferred || o.label.toLowerCase() === String(preferred).toLowerCase()
    );
  }

  if (!chosen) {
    chosen = options.find((o) => o.value && !/select|choose/i.test(o.label));
  }

  expect(chosen, 'No usable option found in Service Type dropdown.').toBeTruthy();
  await select.selectOption(chosen.value);
  return chosen.label || chosen.value;
}

async function fillMandatoryFields(page) {
  const customer = await selectFirstLinkOption(page, 'customer', process.env.SC_CUSTOMER);
  const branch = await selectFirstLinkOption(page, 'branch', process.env.SC_BRANCH);
  const contact = await selectFirstLinkOption(page, 'contacted_person', process.env.SC_CONTACT);
  const type = await selectTypeOption(page, process.env.SC_TYPE);

  return { customer, branch, contact, type };
}

async function createDraftServiceCall(page, options = {}) {
  const note = options.note || uniqueText('AUTO-NOTE');

  await goToNew(page);
  const seed = await fillMandatoryFields(page);
  await fillSpecialInstruction(page, note);

  await saveDraft(page);
  await expect(page).toHaveURL(/\/app\/service-call\/(?!new-service-call)/i);

  const url = page.url();
  const docName = extractDocName(url);
  expect(docName, 'Could not extract saved Service Call name from URL.').toBeTruthy();

  return { ...seed, note, docName, url };
}

async function deleteCurrentServiceCall(page) {
  const actionToggle = page
    .locator(
      '.menu-btn-group .dropdown-toggle, .actions-btn-group .dropdown-toggle, .menu-icon.btn, button:has-text("Actions")'
    )
    .first();

  if (await actionToggle.isVisible().catch(() => false)) {
    await actionToggle.click();
  } else {
    const fallbackToggle = page.locator('button:has-text("Menu"), button:has-text("Actions")').first();
    await fallbackToggle.click();
  }

  const deleteAction = page
    .locator('.dropdown-menu a, .dropdown-menu .dropdown-item, .dropdown-menu li')
    .filter({ hasText: /^Delete$/i })
    .first();

  await expect(deleteAction).toBeVisible({ timeout: 10000 });
  await deleteAction.click();

  const confirm = page
    .locator('.frappe-dialog .btn-danger, .frappe-dialog .btn-primary')
    .filter({ hasText: /Yes|Delete|Confirm/i })
    .first();
  await expect(confirm).toBeVisible({ timeout: 10000 });
  await confirm.click();

  await page.waitForURL(/\/app\/service-call(?:\/?$|\?)/i, { timeout: 15000 });
}

async function setFirstTechnicianInLastRow(page) {
  const table = page.locator('[data-fieldname="technician_list"]');
  await expect(table).toBeVisible({ timeout: 10000 });

  const row = table.locator('.grid-row').last();
  const input = row.locator('[data-fieldname="employee"] input').first();
  await expect(input).toBeVisible({ timeout: 10000 });

  const probes = [process.env.SC_TECHNICIAN, 'a', 'e', 'i', 'o', 'u'].filter(Boolean);
  for (const probe of probes) {
    await input.click({ clickCount: 3 });
    await input.fill('');
    await input.type(String(probe), { delay: 30 });
    await page.waitForTimeout(500);
    const options = page.locator('.awesomplete ul li');
    if (await options.count()) {
      await options.first().click();
      await page.waitForTimeout(250);
      const selected = (await input.inputValue()).trim();
      if (selected) return selected;
    }
  }

  throw new Error('No technician could be selected from technician_list.');
}

test.describe('Service Call Testing', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await loginIfNeeded(page);
  });

  test('TC-SVC-001 | Open New Service Call Form', async ({ page }) => {
    await goToNew(page);
    await expect(page).toHaveURL(/\/app\/service-call\/new-service-call/i);
    await expect(getFieldControl(page, 'customer')).toBeVisible();
  });

  test('TC-SVC-002 | Details Tab Controls Are Visible', async ({ page }) => {
    await goToNew(page);
    await expect(getFieldControl(page, 'customer')).toBeVisible();
    await expect(getFieldControl(page, 'branch')).toBeVisible();
    await expect(getFieldControl(page, 'contacted_person')).toBeVisible();
    await expect(getFieldControl(page, 'type')).toBeVisible();
  });

  test('TC-SVC-003 | Form Tabs Render Correctly', async ({ page }) => {
    await goToNew(page);
    for (const label of ['Details', 'Service Report', 'Cash memo', 'Reopen Log']) {
      const tab = page
        .locator('.frappe-tab, .nav-link, [role="tab"], [data-toggle="tab"]')
        .filter({ hasText: new RegExp(label, 'i') })
        .first();
      await expect(tab).toBeVisible();
    }
  });

  test('TC-SVC-004 | Save Draft With Mandatory Fields', async ({ page }) => {
    await goToNew(page);
    await fillMandatoryFields(page);
    await saveDraft(page);
    await expect(page).toHaveURL(/\/app\/service-call\/(?!new-service-call)/i);
  });

  test('TC-SVC-005 | Save Special Instruction Successfully', async ({ page }) => {
    const note = uniqueText('SC-005');
    const created = await createDraftServiceCall(page, { note });
    await expect(getFieldControl(page, 'special_instruction').locator('textarea').first()).toHaveValue(created.note);
  });

  test('TC-SVC-006 | Date Field Accepts Current Date', async ({ page }) => {
    await goToNew(page);
    await fillDate(page, todayFormatted());
    const value = await getFieldControl(page, 'date').locator('input').first().inputValue();
    expect(value).toBe(todayFormatted());
  });

  test('TC-SVC-007 | Service Date Accepts Future Date', async ({ page }) => {
    await goToNew(page);
    await goToTab(page, 'Service Report');
    const targetDate = todayPlus(1);
    await fillServiceDate(page, targetDate);
    const value = await getFieldControl(page, 'service_date').locator('input').first().inputValue();
    expect(value).toBe(targetDate);
  });

  test('TC-SVC-008 | Service Report Text Fields Accept Input', async ({ page }) => {
    await goToNew(page);
    await goToTab(page, 'Service Report');

    await fillModelNo(page, uniqueText('MDL'));
    await fillIduSerial(page, uniqueText('IDU'));
    await fillOduSerial(page, uniqueText('ODU'));
    await fillSparePart(page, uniqueText('PART'));
    await fillServiceDescription(page, 'Inspection completed. Cooling performance validated.');

    await expect(getFieldControl(page, 'model_no').locator('input').first()).not.toHaveValue('');
    await expect(getFieldControl(page, 'idu_serial').locator('input').first()).not.toHaveValue('');
    await expect(getFieldControl(page, 'odu_serial').locator('input').first()).not.toHaveValue('');
    await expect(getFieldControl(page, 'spare_part').locator('input').first()).not.toHaveValue('');
    await expect(getFieldControl(page, 'service_description').locator('textarea').first()).toHaveValue(
      /Inspection completed/i
    );
  });

  test('TC-SVC-009 | Customer Remark Field Accepts Input', async ({ page }) => {
    await goToNew(page);
    await goToTab(page, 'Service Report');
    const remark = uniqueText('SC-009-REMARK');
    await fillCustomerRemark(page, remark);
    await expect(getFieldControl(page, 'customer_remark').locator('input').first()).toHaveValue(remark);
  });

  test('TC-SVC-010 | Add Technician Row In Grid', async ({ page }) => {
    await goToNew(page);
    const before = await getTechnicianRowCount(page);
    await addTechnicianRow(page);
    const after = await getTechnicianRowCount(page);
    expect(after).toBe(before + 1);
  });

  test('TC-SVC-011 | Select Technician In Grid Row', async ({ page }) => {
    await goToNew(page);
    await addTechnicianRow(page);
    const techName = await setFirstTechnicianInLastRow(page);
    expect(techName.length).toBeGreaterThan(0);
  });

  test('TC-SVC-012 | Save Draft After Adding Technician', async ({ page }) => {
    await goToNew(page);
    await fillMandatoryFields(page);
    await addTechnicianRow(page);
    await setFirstTechnicianInLastRow(page);
    await saveDraft(page);
    await expect(page).toHaveURL(/\/app\/service-call\/(?!new-service-call)/i);
  });

  test('TC-SVC-013 | Saved Document Has Stable Name Pattern', async ({ page }) => {
    const created = await createDraftServiceCall(page);
    expect(created.docName.length).toBeGreaterThan(4);
    expect(created.docName.toLowerCase()).not.toContain('new-service-call');
  });

  test('TC-SVC-014 | Reopen Saved Document By URL', async ({ page }) => {
    const created = await createDraftServiceCall(page);
    await page.goto(created.url);
    await loginIfNeeded(page);
    await expect(page).toHaveURL(new RegExp(`/app/service-call/${created.docName}`, 'i'));
    await expect(getFieldControl(page, 'customer')).toBeVisible();
  });

  test('TC-SVC-015 | Edit Existing Service Call And Save', async ({ page }) => {
    const created = await createDraftServiceCall(page);
    const editText = uniqueText('SC-015-EDIT');

    await fillSpecialInstruction(page, editText);
    await saveDraft(page);
    await expect(getFieldControl(page, 'special_instruction').locator('textarea').first()).toHaveValue(editText);
    await expect(page).toHaveURL(new RegExp(`/app/service-call/${created.docName}`, 'i'));
  });

  test('TC-SVC-016 | Keyboard Save Works From Service Report Tab', async ({ page }) => {
    await goToNew(page);
    await fillMandatoryFields(page);
    await goToTab(page, 'Service Report');
    await fillCustomerRemark(page, uniqueText('SC-016'));
    await page.keyboard.press('Control+s');
    await expect(page).toHaveURL(/\/app\/service-call\/(?!new-service-call)/i);
  });

  test('TC-SVC-017 | Tab Navigation Preserves Unsaved Field Data', async ({ page }) => {
    await goToNew(page);
    await goToTab(page, 'Service Report');
    const note = uniqueText('SC-017');
    await fillServiceDescription(page, note);
    await goToTab(page, 'Details');
    await goToTab(page, 'Service Report');
    await expect(getFieldControl(page, 'service_description').locator('textarea').first()).toHaveValue(note);
  });

  test('TC-SVC-018 | Attachment Control Is Visible On Service Report', async ({ page }) => {
    await goToNew(page);
    await goToTab(page, 'Service Report');
    const attachBtn = getFieldControl(page, 'site_photo').locator('button, .btn').filter({ hasText: /Attach/i }).first();
    await expect(attachBtn).toBeVisible();
  });

  test('TC-SVC-019 | Service Call List View Loads', async ({ page }) => {
    await goToList(page);
    await expect(page).toHaveURL(/\/app\/service-call/i);
    await expect(page.locator('.list-view-header, .result, .list-row-container').first()).toBeVisible();
  });

  test('TC-SVC-020 | Newly Created Document Is Searchable In List', async ({ page }) => {
    const created = await createDraftServiceCall(page);
    await goToList(page);

    const search = page.locator('.list-view-filters input[type="text"], .list-view-header input[type="text"]').first();
    await expect(search).toBeVisible();
    await search.fill(created.docName);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    const row = page.locator('.list-row').filter({ hasText: created.docName }).first();
    await expect(row).toBeVisible({ timeout: 10000 });
  });

  test('TC-SVC-021 | Open Document From List Row', async ({ page }) => {
    const created = await createDraftServiceCall(page);
    await goToList(page);

    const search = page.locator('.list-view-filters input[type="text"], .list-view-header input[type="text"]').first();
    await search.fill(created.docName);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    const row = page.locator('.list-row').filter({ hasText: created.docName }).first();
    await expect(row).toBeVisible();
    await row.click();

    await expect(page).toHaveURL(new RegExp(`/app/service-call/${created.docName}`, 'i'));
  });

  test('TC-SVC-022 | Workflow/Status Indicator Renders After Save', async ({ page }) => {
    await createDraftServiceCall(page);
    const indicator = page.locator('[data-fieldname="workflow_state"], [data-fieldname="status"], .indicator, .indicator-pill').first();
    await expect(indicator).toBeVisible();
  });

  test('TC-SVC-023 | Delete Draft Service Call From Form Actions', async ({ page }) => {
    await createDraftServiceCall(page);
    await deleteCurrentServiceCall(page);
    await expect(page).toHaveURL(/\/app\/service-call(?:\/?$|\?)/i);
  });

  test('TC-SVC-024 | Reopen Log Tab Is Accessible', async ({ page }) => {
    await goToNew(page);
    await goToTab(page, 'Reopen Log');
    const active = page
      .locator('.frappe-tab.active, .nav-link.active, [role="tab"][aria-selected="true"]')
      .filter({ hasText: /Reopen Log/i })
      .first();
    await expect(active).toBeVisible();
  });

  test('TC-SVC-025 | Cash Memo Tab Is Accessible', async ({ page }) => {
    await goToNew(page);
    await goToTab(page, 'Cash memo');
    const active = page
      .locator('.frappe-tab.active, .nav-link.active, [role="tab"][aria-selected="true"]')
      .filter({ hasText: /Cash memo/i })
      .first();
    await expect(active).toBeVisible();
  });
});
