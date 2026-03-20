'use strict';

const { test, expect } = require('@playwright/test');
const { customers, contract } = require('../../utils/helpers');
const { captureBrowserError, formatDateForERP, loadRows, writeTrackerSheet } = require('./_shared');

const rows = loadRows('amc_contracts.csv');
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
  loginIfNeeded,
  fillNoOfServices,
  saveDraft,
} = contract;

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
  return `8${String(200000000 + row._row_number).padStart(9, '0')}`;
}

async function searchLink(page, doctype, txt = '') {
  const url = `/api/method/frappe.desk.search.search_link?doctype=${encodeURIComponent(doctype)}&txt=${encodeURIComponent(txt)}&page_length=10`;
  const response = await page.request.get(url);
  if (!response.ok()) return [];

  const payload = await response.json().catch(() => ({}));
  return Array.isArray(payload.message) ? payload.message : [];
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

async function setFormValue(page, fieldname, value) {
  await page.evaluate(async ({ name, fieldValue }) => {
    const frm = window.cur_frm;
    if (frm?.set_value) {
      await frm.set_value(name, fieldValue);
    }
  }, { name: fieldname, fieldValue: value });
  await page.waitForTimeout(300);
}

function ymd(value) {
  return formatDateForERP(value, 'ymd');
}

function buildScheduleDates(startValue, endValue, count) {
  const total = Number(count);
  if (!startValue || !endValue || !total || total < 1) return [];

  const start = new Date(`${ymd(startValue)}T00:00:00`);
  const end = new Date(`${ymd(endValue)}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

  const span = Math.max(0, end.getTime() - start.getTime());
  if (total === 1) return [ymd(startValue)];

  return Array.from({ length: total }, (_, index) => {
    const point = new Date(start.getTime() + Math.round((span * index) / (total - 1)));
    const year = point.getFullYear();
    const month = String(point.getMonth() + 1).padStart(2, '0');
    const day = String(point.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
}

async function clearAndFill(locator, value) {
  await locator.waitFor({ state: 'visible', timeout: 15000 });
  await locator.click({ clickCount: 3, force: true });
  await locator.fill('');
  await locator.type(String(value), { delay: 25 });
}

async function selectLinkValue(page, fieldname, requestedValue, options = {}) {
  const { allowFallback = false, fallbackQueries = ['a', 'e', 'i', 'o', 'u', '1'] } = options;
  const requested = String(requestedValue || '').trim();
  if (!requested && !allowFallback) {
    return { selected: '', usedFallback: false };
  }

  const input = page.locator(`[data-fieldname="${fieldname}"] input`).first();
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

async function isLinkFieldVisible(page, fieldname) {
  return page.locator(`[data-fieldname="${fieldname}"] input`).first().isVisible().catch(() => false);
}

async function fillDateField(page, fieldname, value) {
  if (!String(value || '').trim()) return;
  await setFormValue(page, fieldname, ymd(value));
  await page.waitForFunction(
    ({ name, fieldValue }) => window.cur_frm?.doc?.[name] === fieldValue,
    { name: fieldname, fieldValue: ymd(value) },
    { timeout: 5000 }
  ).catch(() => null);
}

async function fillServiceScheduleDates(page, row) {
  const dates = buildScheduleDates(row.start_date, row.end_date, row.no_of_services);
  if (!dates.length) return;

  await page.waitForTimeout(500);
  await page.evaluate((scheduleDates) => {
    const frm = window.cur_frm;
    const rows = frm?.doc?.service_schedule || [];
    scheduleDates.forEach((dateValue, index) => {
      if (rows[index]) rows[index].date = dateValue;
    });
    frm?.refresh_field?.('service_schedule');
  }, dates);
  await page.waitForTimeout(300);
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
  const contactName = String(row.contact_person || '').trim();

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

async function setStatus(page, value) {
  const requested = String(value || '').trim();
  if (!requested) return '';

  const select = page.locator('[data-fieldname="status"] select').first();
  await select.waitFor({ state: 'visible', timeout: 15000 });

  const options = await select.locator('option').evaluateAll((nodes) =>
    nodes.map((node) => ({
      value: node.value,
      label: (node.textContent || '').trim(),
    }))
  );

  const matched = options.find((option) => option.label.toLowerCase() === requested.toLowerCase());
  if (!matched) return '';

  await select.selectOption(matched.value);
  return matched.label || matched.value;
}

async function isSaved(page) {
  const currentUrl = page.url();
  const landedOnDoc = /\/app\/amc-contract\/(?!new-amc-contract)/i.test(currentUrl);
  const docMeta = await page.evaluate(() => ({
    name: window.cur_frm?.doc?.name || '',
    docstatus: window.cur_frm?.doc?.docstatus,
    unsaved: !!window.cur_frm?.doc?.__unsaved,
    isLocal: !!window.cur_frm?.is_new?.(),
  })).catch(() => ({ name: '', docstatus: null, unsaved: true, isLocal: true }));
  const notSavedVisible = await page
    .locator('span, .indicator-pill, .indicator')
    .filter({ hasText: /Not Saved/i })
    .first()
    .isVisible()
    .catch(() => false);
  const hasPersistentName = !!docMeta.name && !/^new-amc-contract/i.test(docMeta.name);
  const draftVisible = await page.locator('span, .indicator-pill, .indicator').filter({ hasText: /Draft/i }).first().isVisible().catch(() => false);

  return (landedOnDoc || hasPersistentName || draftVisible || docMeta.docstatus === 0) && !notSavedVisible && !docMeta.unsaved;
}

function buildResult(row, expectedOutcome, actualOutcome, reason, details = {}) {
  return {
    Row: row._row_number,
    'Test ID': firstNonEmpty(row.test_id, `CON-DDT-${String(row._row_number).padStart(3, '0')}`),
    Key: firstNonEmpty(row.customer, row.start_date, '(contract row)'),
    'Expected Outcome': expectedOutcome,
    'Actual Outcome': actualOutcome,
    Status: expectedOutcome === actualOutcome ? 'PASS' : 'FAIL',
    Reason: reason,
    'Selected Customer': details.customer || '',
    'Selected Branch': details.branch || '',
    'Selected Contact': details.contact || '',
    'Applied Status': details.status || '',
    'Fallback Used': details.fallbackUsed ? 'Yes' : 'No',
    'Raw Error': details.rawError || '',
  };
}

test.setTimeout(90000);
test.describe.configure({ mode: 'default' });

test.describe('Data-driven: AMC Contract @mutation', () => {
  for (const row of rows) {
    const testId = firstNonEmpty(row.test_id, `CON-DDT-${String(row._row_number).padStart(3, '0')}`);
    const label = `${testId} | ${firstNonEmpty(row.customer, '(no customer)')} | ${firstNonEmpty(row.no_of_services, '(no services)')}`;

    test(label, async ({ page }) => {
      const expectedOutcome = String(row.expected_outcome || 'CREATED').trim().toUpperCase();
      const allowFallback = expectedOutcome === 'CREATED';

      let seedNote = '';

      await goToNew(page);
      await loginIfNeeded(page);

      await fillDateField(page, 'start_date', row.start_date);
      await fillDateField(page, 'end_date', row.end_date);
      if (String(row.no_of_services || '').trim()) {
        await fillNoOfServices(page, Number(row.no_of_services));
      }
      if (expectedOutcome === 'CREATED') {
        await fillServiceScheduleDates(page, row);
      }

      let customerSelection = { selected: '', usedFallback: false };
      let branchSelection = { selected: '', usedFallback: false };
      let contactSelection = { selected: '', usedFallback: false };
      let serviceBranchSelection = { selected: '', usedFallback: false };

      if (expectedOutcome === 'CREATED') {
        const customerCandidate = String(row.customer || '').trim()
          ? await resolveLinkCandidate(page, 'AMC Customers', row.customer)
          : null;
        const branchCandidate = String(row.branch || '').trim()
          ? await resolveLinkCandidate(page, 'Customer Branch', row.branch)
          : null;
        const contactCandidate = String(row.contact_person || '').trim()
          ? await resolveLinkCandidate(page, 'Customer Contact', row.contact_person)
          : null;
        const serviceBranchCandidate = String(row.service_branch || '').trim()
          ? await resolveLinkCandidate(page, 'Branch', row.service_branch)
          : null;

        if (customerCandidate?.value) {
          await setFormValue(page, 'customer', customerCandidate.value);
          customerSelection = {
            selected: firstNonEmpty(customerCandidate.label, customerCandidate.value),
            usedFallback: !!customerCandidate.usedFallback,
          };
        }
        if (branchCandidate?.value) {
          await setFormValue(page, 'branch', branchCandidate.value);
          branchSelection = {
            selected: firstNonEmpty(branchCandidate.label, branchCandidate.value),
            usedFallback: !!branchCandidate.usedFallback,
          };
        }
        if (contactCandidate?.value) {
          await setFormValue(page, 'contact_person', contactCandidate.value);
          contactSelection = {
            selected: firstNonEmpty(contactCandidate.label, contactCandidate.value),
            usedFallback: !!contactCandidate.usedFallback,
          };
        }
        if (serviceBranchCandidate?.value) {
          await setFormValue(page, 'service_branch', serviceBranchCandidate.value);
          serviceBranchSelection = {
            selected: firstNonEmpty(serviceBranchCandidate.label, serviceBranchCandidate.value),
            usedFallback: !!serviceBranchCandidate.usedFallback,
          };
        }
      }
      const appliedStatus = await setStatus(page, row.status);

      await saveDraft(page);

      const saved = await isSaved(page);
      const rawError = saved ? '' : (await captureBrowserError(page)) || '';
      const actualOutcome = saved ? 'CREATED' : 'REJECTED';

      const fallbackUsed = [
        customerSelection.usedFallback,
        branchSelection.usedFallback,
        contactSelection.usedFallback,
      ].some(Boolean);

      const reason = saved
        ? `AMC Contract saved successfully${appliedStatus ? ` with status ${appliedStatus}` : ''}${fallbackUsed ? ' using available linked records' : ''}${seedNote ? ` (${seedNote})` : ''}`
        : firstNonEmpty(rawError, seedNote, 'AMC Contract remained unsaved on the new form');

      const result = buildResult(row, expectedOutcome, actualOutcome, reason, {
        customer: customerSelection.selected,
        branch: firstNonEmpty(branchSelection.selected, serviceBranchSelection.selected),
        contact: contactSelection.selected,
        status: appliedStatus,
        fallbackUsed,
        rawError,
      });

      runResults.push(result);
      expect(result.Status, result.Reason).toBe('PASS');
    });
  }

  test.afterAll(async () => {
    writeTrackerSheet(
      'DDT AMC Contract',
      ['Row', 'Test ID', 'Key', 'Expected Outcome', 'Actual Outcome', 'Status', 'Reason', 'Selected Customer', 'Selected Branch', 'Selected Contact', 'Applied Status', 'Fallback Used', 'Raw Error'],
      runResults
    );
  });
});
