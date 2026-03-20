'use strict';

const { test, expect } = require('@playwright/test');
const { customers, serviceCalls } = require('../../utils/helpers');
const { captureBrowserError, formatDateForERP, loadRows, normalizeBoolean, writeTrackerSheet } = require('./_shared');

const rows = loadRows('service_calls.csv');
const runResults = [];

const {
  goToNew: goToCustomerNew,
  loginIfNeeded: loginCustomerIfNeeded,
  fillCustomerName,
  addCustomerBranch,
  addContactRow,
  saveForm: saveCustomerForm,
} = customers;

const {
  goToNew,
  goToTab,
  loginIfNeeded,
  getFieldControl,
  addTechnicianRow,
  saveDraft,
} = serviceCalls;

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (String(value || '').trim()) return String(value).trim();
  }
  return '';
}

function seededMobile(row) {
  return `9${String(100000000 + row._row_number).padStart(9, '0')}`;
}

async function searchLink(page, doctype, txt = '') {
  const url = `/api/method/frappe.desk.search.search_link?doctype=${encodeURIComponent(doctype)}&txt=${encodeURIComponent(txt)}&page_length=10`;
  const response = await page.request.get(url);
  if (!response.ok()) return [];

  const payload = await response.json().catch(() => ({}));
  return Array.isArray(payload.message) ? payload.message : [];
}

async function getResourceList(page, doctype, fields, filters = []) {
  const url = `/api/resource/${encodeURIComponent(doctype)}?fields=${encodeURIComponent(JSON.stringify(fields))}&filters=${encodeURIComponent(JSON.stringify(filters))}&limit_page_length=20`;
  const response = await page.request.get(url);
  if (!response.ok()) return [];

  const payload = await response.json().catch(() => ({}));
  return Array.isArray(payload.data) ? payload.data : [];
}

async function resolveLinkCandidate(page, doctype, preferredValue) {
  const preferred = String(preferredValue || '').trim();
  if (preferred) {
    const preferredResults = await searchLink(page, doctype, preferred);
    const matched = preferredResults.find((item) => {
      const label = String(item.label || '').trim().toLowerCase();
      const value = String(item.value || '').trim().toLowerCase();
      return label === preferred.toLowerCase() || value === preferred.toLowerCase();
    });
    if (matched) {
      return { ...matched, usedFallback: false };
    }
  }

  const fallbackResults = await searchLink(page, doctype, '');
  if (!fallbackResults.length) return null;
  return { ...fallbackResults[0], usedFallback: !!preferred };
}

function pickPreferred(items, preferredValue, keys) {
  const preferred = String(preferredValue || '').trim().toLowerCase();
  if (!items.length) return null;
  if (!preferred) return items[0];

  return items.find((item) =>
    keys.some((key) => String(item[key] || '').trim().toLowerCase() === preferred)
  ) || items[0];
}

async function resolveServiceHierarchy(page, row) {
  async function hydrateHierarchy(customerCandidate, note = '') {
    if (!customerCandidate?.value) return null;

    const branchRows = await getResourceList(page, 'Customer Branch', ['name', 'branch', 'customer'], [['customer', '=', customerCandidate.value]]);
    const branch = pickPreferred(branchRows, row.branch, ['branch', 'name']);

    let contactRows = [];
    if (branch?.name) {
      contactRows = await getResourceList(
        page,
        'Customer Contact',
        ['name', 'customer', 'branch'],
        [['customer', '=', customerCandidate.value], ['branch', '=', branch.name]]
      );
    }

    if (!contactRows.length) {
      contactRows = await getResourceList(page, 'Customer Contact', ['name', 'customer', 'branch'], [['customer', '=', customerCandidate.value]]);
    }

    const contact = pickPreferred(contactRows, row.contacted_person, ['name']);
    if (!branch || !contact) return null;

    return {
      customer: {
        value: customerCandidate.value,
        label: firstNonEmpty(customerCandidate.label, customerCandidate.value),
        usedFallback: !!customerCandidate.usedFallback,
      },
      branch: {
        value: branch.name,
        label: firstNonEmpty(branch.branch, branch.name),
        usedFallback: String(row.branch || '').trim().toLowerCase() !== String(firstNonEmpty(branch.branch, branch.name)).trim().toLowerCase(),
      },
      contact: {
        value: contact.name,
        label: contact.name,
        usedFallback: String(row.contacted_person || '').trim().toLowerCase() !== String(contact.name || '').trim().toLowerCase(),
      },
      note,
    };
  }

  const preferredCustomer = await resolveLinkCandidate(page, 'AMC Customers', row.customer);
  const preferredHierarchy = await hydrateHierarchy(preferredCustomer);
  if (preferredHierarchy) {
    return preferredHierarchy;
  }

  const fallbackCustomers = await searchLink(page, 'AMC Customers', '');
  for (const candidate of fallbackCustomers.slice(0, 10)) {
    const hierarchy = await hydrateHierarchy({ ...candidate, usedFallback: true }, 'Using first complete customer hierarchy available in ERPNext');
    if (hierarchy) {
      return hierarchy;
    }
  }

  return { customer: null, branch: null, contact: null, note: 'No complete customer/branch/contact hierarchy found' };
}

async function setFormValue(page, fieldname, value) {
  await page.evaluate(async ({ name, fieldValue }) => {
    const frm = window.cur_frm;
    if (frm?.set_value) {
      await frm.set_value(name, fieldValue);
    }
  }, { name: fieldname, fieldValue: value });
  await page.waitForFunction(
    ({ name, fieldValue }) => window.cur_frm?.doc?.[name] === fieldValue,
    { name: fieldname, fieldValue: value },
    { timeout: 5000 }
  ).catch(() => null);
  await page.waitForTimeout(200);
}

async function clearAndFill(locator, value) {
  await locator.waitFor({ state: 'visible', timeout: 15000 });
  await locator.click({ clickCount: 3, force: true });
  await locator.fill('');
  await locator.type(String(value), { delay: 25 });
}

async function fillField(page, fieldname, value, kind = 'input') {
  if (!String(value || '').trim()) return;

  const selector = kind === 'textarea' ? 'textarea' : 'input';
  const input = getFieldControl(page, fieldname).locator(selector).first();
  await clearAndFill(input, value);
  if (selector === 'input') {
    await input.press('Tab').catch(() => {});
  }
}

async function selectLinkValue(page, fieldname, requestedValue, options = {}) {
  const { allowFallback = false, fallbackQueries = ['a', 'e', 'i', 'o', 'u', '1'] } = options;
  const input = getFieldControl(page, fieldname).locator('input').first();
  const requested = String(requestedValue || '').trim();
  const queries = [];

  if (requested) queries.push(requested);
  if (allowFallback) {
    for (const probe of fallbackQueries) {
      if (!queries.includes(probe)) queries.push(probe);
    }
  }

  for (const query of queries) {
    await clearAndFill(input, query);
    await page.waitForTimeout(700);

    const optionsList = page.locator('.awesomplete ul li');
    const count = await optionsList.count();
    if (!count) continue;

    let choice = null;
    if (requested) {
      const exact = optionsList.filter({ hasText: new RegExp(escapeRegExp(requested), 'i') }).first();
      if (await exact.count()) {
        choice = exact;
      }
    }

    if (!choice) {
      choice = optionsList.first();
    }

    await choice.click({ force: true });
    await page.waitForTimeout(300);

    const selected = (await input.inputValue().catch(() => '')).trim();
    if (selected) {
      return {
        selected,
        usedFallback: !!requested && !new RegExp(`^${escapeRegExp(requested)}$`, 'i').test(selected),
      };
    }
  }

  return { selected: '', usedFallback: false };
}

async function selectTypeValue(page, requestedValue, allowFallback) {
  const select = getFieldControl(page, 'type').locator('select').first();
  await select.waitFor({ state: 'visible', timeout: 15000 });

  const options = await select.locator('option').evaluateAll((nodes) =>
    nodes.map((node) => ({
      value: node.value,
      label: (node.textContent || '').trim(),
    }))
  );

  const requested = String(requestedValue || '').trim();
  let chosen = null;

  if (requested) {
    chosen = options.find((option) => option.label.toLowerCase() === requested.toLowerCase());
  }

  if (!chosen && allowFallback) {
    chosen = options.find((option) => option.value && !/select|choose/i.test(option.label));
  }

  if (!chosen) {
    return { selected: '', usedFallback: false };
  }

  await select.selectOption(chosen.value);
  return {
    selected: chosen.label || chosen.value,
    usedFallback: !!requested && chosen.label.toLowerCase() !== requested.toLowerCase(),
  };
}

async function selectTechnicianIfRequested(page) {
  await addTechnicianRow(page);

  const row = page.locator('[data-fieldname="technician_list"] .grid-row').last();
  const input = row.locator('[data-fieldname="employee"] input').first();
  const probes = ['a', 'e', 'i', 'o', 'u', '1'];

  for (const probe of probes) {
    await clearAndFill(input, probe);
    await page.waitForTimeout(700);

    const options = page.locator('.awesomplete ul li');
    if (await options.count()) {
      await options.first().click({ force: true });
      await page.waitForTimeout(300);
      const selected = (await input.inputValue().catch(() => '')).trim();
      if (selected) return selected;
    }
  }

  return '';
}

async function freshCustomerForm(page) {
  await goToCustomerNew(page);
  await loginCustomerIfNeeded(page);
  if (!page.url().includes('amc-customers')) {
    await goToCustomerNew(page);
  }
}

async function ensureCustomerHierarchy(page, row) {
  const customerName = String(row.customer || '').trim();
  const branchName = String(row.branch || '').trim();
  const contactName = String(row.contacted_person || '').trim();

  if (!customerName || !branchName || !contactName) {
    return { ensured: false, reason: 'Customer hierarchy seed skipped because customer, branch, or contact is blank' };
  }

  await freshCustomerForm(page);
  await fillCustomerName(page, customerName);

  const initialSave = await saveCustomerForm(page);
  const duplicateError = /duplicate|already exists/i.test(String(initialSave.error || ''));

  if (!initialSave.saved && !duplicateError) {
    return { ensured: false, reason: firstNonEmpty(initialSave.error, 'Customer seed save failed') };
  }

  if (!duplicateError) {
    await addCustomerBranch(page, customerName, branchName, firstNonEmpty(row.branch_address, `${branchName} Address`));
    await addContactRow(page, {
      name: contactName,
      mobile: firstNonEmpty(row.contact_mobile, seededMobile(row)),
      branch: branchName,
      isPrimary: true,
    });

    const finalSave = await saveCustomerForm(page);
    if (!finalSave.saved && !/duplicate|already exists/i.test(String(finalSave.error || ''))) {
      return { ensured: false, reason: firstNonEmpty(finalSave.error, 'Customer branch/contact seed save failed') };
    }
  }

  return { ensured: true, reason: duplicateError ? 'Existing customer hierarchy reused' : 'Customer hierarchy seeded' };
}

async function isSaved(page) {
  const currentUrl = page.url();
  const landedOnDoc = /\/app\/service-call\/(?!new-service-call)/i.test(currentUrl);
  const notSavedVisible = await page
    .locator('span, .indicator-pill, .indicator')
    .filter({ hasText: /Not Saved/i })
    .first()
    .isVisible()
    .catch(() => false);

  return landedOnDoc && !notSavedVisible;
}

function buildResult(row, expectedOutcome, actualOutcome, reason, details = {}) {
  return {
    Row: row._row_number,
    'Test ID': firstNonEmpty(row.test_id, `SC-DDT-${String(row._row_number).padStart(3, '0')}`),
    Key: firstNonEmpty(row.customer, row.branch, row.contacted_person, '(service call row)'),
    'Expected Outcome': expectedOutcome,
    'Actual Outcome': actualOutcome,
    Status: expectedOutcome === actualOutcome ? 'PASS' : 'FAIL',
    Reason: reason,
    'Selected Customer': details.customer || '',
    'Selected Branch': details.branch || '',
    'Selected Contact': details.contact || '',
    'Selected Type': details.type || '',
    'Fallback Used': details.fallbackUsed ? 'Yes' : 'No',
    'Raw Error': details.rawError || '',
  };
}

test.setTimeout(90000);
test.describe.configure({ mode: 'default' });

test.describe('Data-driven: Service Call @mutation', () => {
  for (const row of rows) {
    const testId = firstNonEmpty(row.test_id, `SC-DDT-${String(row._row_number).padStart(3, '0')}`);
    const label = `${testId} | ${firstNonEmpty(row.customer, '(empty customer)')} | ${firstNonEmpty(row.type, '(empty type)')}`;

    test(label, async ({ page }) => {
      const expectedOutcome = String(row.expected_outcome || 'CREATED').trim().toUpperCase();
      const allowFallback = expectedOutcome === 'CREATED';
      let seedNote = '';

      await goToNew(page);
      await loginIfNeeded(page);

      let customerSelection = { selected: '', usedFallback: false };
      let branchSelection = { selected: '', usedFallback: false };
      let contactSelection = { selected: '', usedFallback: false };

      if (expectedOutcome === 'CREATED') {
        const hierarchy = await resolveServiceHierarchy(page, row);
        seedNote = hierarchy.note || '';

        if (hierarchy.customer?.value) {
          await setFormValue(page, 'customer', hierarchy.customer.value);
          customerSelection = {
            selected: hierarchy.customer.label,
            usedFallback: !!hierarchy.customer.usedFallback,
          };
        }
        if (hierarchy.branch?.value) {
          await setFormValue(page, 'branch', hierarchy.branch.value);
          branchSelection = {
            selected: hierarchy.branch.label,
            usedFallback: !!hierarchy.branch.usedFallback,
          };
        }
        if (hierarchy.contact?.value) {
          await setFormValue(page, 'contacted_person', hierarchy.contact.value);
          contactSelection = {
            selected: hierarchy.contact.label,
            usedFallback: !!hierarchy.contact.usedFallback,
          };
        }
      } else {
        customerSelection = String(row.customer || '').trim()
          ? await selectLinkValue(page, 'customer', row.customer, { allowFallback })
          : { selected: '', usedFallback: false };
        branchSelection = String(row.branch || '').trim() && customerSelection.selected
          ? await selectLinkValue(page, 'branch', row.branch, { allowFallback })
          : { selected: '', usedFallback: false };
        contactSelection = String(row.contacted_person || '').trim() && branchSelection.selected
          ? await selectLinkValue(page, 'contacted_person', row.contacted_person, { allowFallback })
          : { selected: '', usedFallback: false };
      }
      const typeSelection = await selectTypeValue(page, row.type, allowFallback);

      await fillField(page, 'special_instruction', row.special_instruction, 'textarea');

      if (
        String(row.service_date || '').trim() ||
        String(row.model_no || '').trim() ||
        String(row.idu_serial || '').trim() ||
        String(row.odu_serial || '').trim() ||
        String(row.service_description || '').trim() ||
        String(row.spare_part || '').trim() ||
        String(row.customer_remark || '').trim()
      ) {
        await goToTab(page, 'Service Report');
        await fillField(page, 'service_date', formatDateForERP(row.service_date, 'dmy'));
        await fillField(page, 'model_no', row.model_no);
        await fillField(page, 'idu_serial', row.idu_serial);
        await fillField(page, 'odu_serial', row.odu_serial);
        await fillField(page, 'service_description', row.service_description, 'textarea');
        await fillField(page, 'spare_part', row.spare_part);
        await fillField(page, 'customer_remark', row.customer_remark);
      }

      let technicianName = '';
      if (normalizeBoolean(row.add_technician)) {
        technicianName = await selectTechnicianIfRequested(page);
      }

      await saveDraft(page);

      const saved = await isSaved(page);
      const rawError = saved ? '' : (await captureBrowserError(page)) || '';
      const actualOutcome = saved ? 'CREATED' : 'REJECTED';

      const fallbackUsed = [
        customerSelection.usedFallback,
        branchSelection.usedFallback,
        contactSelection.usedFallback,
        typeSelection.usedFallback,
      ].some(Boolean);

      const reason = saved
        ? `Service Call saved successfully${fallbackUsed ? ' using available linked records' : ''}${technicianName ? ` with technician ${technicianName}` : ''}${seedNote ? ` (${seedNote})` : ''}`
        : firstNonEmpty(rawError, seedNote, 'Service Call remained unsaved on the new form');

      const result = buildResult(row, expectedOutcome, actualOutcome, reason, {
        customer: customerSelection.selected,
        branch: branchSelection.selected,
        contact: contactSelection.selected,
        type: typeSelection.selected,
        fallbackUsed,
        rawError,
      });

      runResults.push(result);
      expect(result.Status, result.Reason).toBe('PASS');
    });
  }

  test.afterAll(async () => {
    writeTrackerSheet(
      'DDT Service Call',
      ['Row', 'Test ID', 'Key', 'Expected Outcome', 'Actual Outcome', 'Status', 'Reason', 'Selected Customer', 'Selected Branch', 'Selected Contact', 'Selected Type', 'Fallback Used', 'Raw Error'],
      runResults
    );
  });
});
