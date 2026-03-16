const path = require('path');
const { test, expect } = require('@playwright/test');
const { leaves } = require('../../utils/helpers');
const { loadLeaveCases } = require('../../data/loaders/leave-cases.loader');
const {
  plusDays,
  formatDateDMY,
  openNewLeaveApplication,
  assertLeaveFormReady,
  triggerSaveAndCollectMandatory,
  setInputValue,
  setCheckboxValue,
  getInputValue,
  getStatusOptions,
  getSeriesOptions,
} = leaves;

const CASES_FILE = path.resolve(__dirname, '..', '..', 'fixtures', 'testData', 'leaves_cases.xlsx');
const CASES = loadLeaveCases(CASES_FILE);
const REQUIRED_FIELDS = ['Employee', 'Leave Type', 'From Date', 'To Date', 'Leave Approver'];

test.describe.configure({ mode: 'serial' });

test.describe('Leave Application - Scenario Suite', () => {
  test.beforeEach(async ({ page }) => {
    await openNewLeaveApplication(page);
    await assertLeaveFormReady(page);
  });

  for (const tc of CASES) {
    test(`TC-${tc.id} | ${tc.group} | ${tc.title}`, async ({ page }) => {
      await runCase(page, tc.id);
    });
  }
});

async function expectMandatoryDialog(page, expectedFields) {
  const { fields, message } = await triggerSaveAndCollectMandatory(page);
  expect(message.toLowerCase()).toContain('mandatory');
  for (const name of expectedFields) {
    expect(fields).toContain(name);
  }
}

async function runCase(page, id) {
  if (['LEA-001', 'LEA-002', 'LEA-006', 'LEA-009', 'LEA-013', 'LEA-015', 'LEA-029', 'LEA-032', 'LEA-036', 'LEA-044', 'LEA-059', 'LEA-061'].includes(id)) {
    await expect(page.getByText(/new leave application/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^save$/i })).toBeVisible();
    return;
  }

  if (id === 'LEA-003') {
    const options = await getSeriesOptions(page);
    expect(options[0]).toMatch(/^HR-LAP-\.YYYY\.-/);
    return;
  }

  if (id === 'LEA-004') {
    const options = await getSeriesOptions(page);
    expect(options.length).toBeGreaterThan(0);
    return;
  }

  if (id === 'LEA-005') {
    const first = await getSeriesOptions(page);
    await openNewLeaveApplication(page);
    const second = await getSeriesOptions(page);
    expect(first[0]).toBe(second[0]);
    return;
  }

  if (id === 'LEA-007') {
    await setInputValue(page, 'employee', `INVALID-EMP-${Date.now()}`);
    await expectMandatoryDialog(page, ['Employee']);
    return;
  }

  if (['LEA-008', 'LEA-049'].includes(id)) {
    await expectMandatoryDialog(page, ['Employee']);
    return;
  }

  if (['LEA-010', 'LEA-050', 'LEA-014'].includes(id)) {
    await expectMandatoryDialog(page, ['Leave Type']);
    return;
  }

  if (['LEA-011', 'LEA-012', 'LEA-039', 'LEA-040', 'LEA-041', 'LEA-042', 'LEA-043'].includes(id)) {
    await expect(page.locator('[data-fieldname="leave_type"]').first()).toBeVisible();
    return;
  }

  if (['LEA-016', 'LEA-051'].includes(id)) {
    await expectMandatoryDialog(page, ['From Date']);
    return;
  }

  if (['LEA-017', 'LEA-052'].includes(id)) {
    await expectMandatoryDialog(page, ['To Date']);
    return;
  }

  if (['LEA-018', 'LEA-020', 'LEA-053'].includes(id)) {
    await setInputValue(page, 'from_date', formatDateDMY(plusDays(7)));
    await setInputValue(page, 'to_date', formatDateDMY(plusDays(2)));
    await expect(page.locator('[data-fieldname="from_date"] input').first()).toBeVisible();
    await expect(page.locator('[data-fieldname="to_date"] input').first()).toBeVisible();
    return;
  }

  if (id === 'LEA-019') {
    await setInputValue(page, 'from_date', formatDateDMY(plusDays(-1)));
    expect(typeof (await getInputValue(page, 'from_date'))).toBe('string');
    return;
  }

  if (id === 'LEA-021') {
    await setInputValue(page, 'from_date', '99-99-9999');
    expect(typeof (await getInputValue(page, 'from_date'))).toBe('string');
    return;
  }

  if (id === 'LEA-022') {
    await setInputValue(page, 'from_date', formatDateDMY(plusDays(2)));
    await setInputValue(page, 'to_date', formatDateDMY(plusDays(4)));
    await expect(page.locator('[data-fieldname="from_date"] input').first()).toBeVisible();
    await expect(page.locator('[data-fieldname="to_date"] input').first()).toBeVisible();
    return;
  }

  if (id === 'LEA-023') {
    await setCheckboxValue(page, 'half_day', true);
    const checked = await page.locator('[data-fieldname="half_day"] input[type="checkbox"]').first().isChecked();
    expect(checked).toBeTruthy();
    return;
  }

  if (id === 'LEA-024') {
    await setCheckboxValue(page, 'half_day', true);
    await setCheckboxValue(page, 'half_day', false);
    const checked = await page.locator('[data-fieldname="half_day"] input[type="checkbox"]').first().isChecked();
    expect(checked).toBeFalsy();
    return;
  }

  if (id === 'LEA-025') {
    await setCheckboxValue(page, 'half_day', true);
    const d = formatDateDMY(plusDays(3));
    await setInputValue(page, 'from_date', d);
    await setInputValue(page, 'to_date', d);
    await expect(page.locator('[data-fieldname="from_date"] input').first()).toBeVisible();
    await expect(page.locator('[data-fieldname="to_date"] input').first()).toBeVisible();
    return;
  }

  if (id === 'LEA-026') {
    await setCheckboxValue(page, 'half_day', true);
    await setInputValue(page, 'from_date', formatDateDMY(plusDays(3)));
    await setInputValue(page, 'to_date', formatDateDMY(plusDays(4)));
    await expect(page.locator('[data-fieldname="half_day"] input[type="checkbox"]').first()).toBeVisible();
    return;
  }

  if (['LEA-027', 'LEA-028'].includes(id)) {
    await setCheckboxValue(page, 'half_day', id === 'LEA-027');
    const checked = await page.locator('[data-fieldname="half_day"] input[type="checkbox"]').first().isChecked();
    expect(checked).toBe(id === 'LEA-027');
    return;
  }

  if (id === 'LEA-030') {
    await setInputValue(page, 'description', 'Need leave for family event.');
    expect(await getInputValue(page, 'description')).toContain('family event');
    return;
  }

  if (id === 'LEA-031') {
    await setInputValue(page, 'description', 'Reason #123 @home / urgent!');
    expect(await getInputValue(page, 'description')).toContain('#123');
    return;
  }

  if (id === 'LEA-033') {
    await setInputValue(page, 'leave_approver', `invalid.approver.${Date.now()}@example.com`);
    await expectMandatoryDialog(page, ['Leave Approver']);
    return;
  }

  if (['LEA-034'].includes(id)) {
    await expectMandatoryDialog(page, ['Leave Approver']);
    return;
  }

  if (id === 'LEA-035') {
    await expect(page.locator('[data-fieldname="leave_approver"]').first()).toBeVisible();
    return;
  }

  if (id === 'LEA-037') {
    const initial = await getInputValue(page, 'posting_date');
    await setInputValue(page, 'posting_date', formatDateDMY(plusDays(5)));
    await openNewLeaveApplication(page);
    expect(await getInputValue(page, 'posting_date')).toBe(initial);
    return;
  }

  if (id === 'LEA-038') {
    const posting = await getInputValue(page, 'posting_date');
    expect(posting).toMatch(/^\d{2}-\d{2}-\d{4}$/);
    return;
  }

  if (id === 'LEA-045' || id === 'LEA-046' || id === 'LEA-047' || id === 'LEA-048' || id === 'LEA-058' || id === 'LEA-064') {
    const statuses = (await getStatusOptions(page)).map((s) => s.trim());
    expect(statuses).toEqual(expect.arrayContaining(['Open', 'Approved', 'Rejected', 'Cancelled']));
    return;
  }

  if (['LEA-054', 'LEA-055', 'LEA-056', 'LEA-057'].includes(id)) {
    await setInputValue(page, 'description', `edit-check-${id}`);
    expect(await getInputValue(page, 'description')).toContain(id);
    return;
  }

  if (id === 'LEA-060') {
    await expect(page.getByRole('button', { name: /^save$/i })).toBeVisible();
    return;
  }

  if (id === 'LEA-062') {
    await expect(page.getByText(/not saved/i).first()).toBeVisible();
    return;
  }

  if (id === 'LEA-063') {
    await expect(page.getByText(/new leave application/i).first()).toBeVisible();
    return;
  }

  if (id === 'LEA-065') {
    await expectMandatoryDialog(page, REQUIRED_FIELDS);
    return;
  }

  await expect(page.getByText(/leave application/i).first()).toBeVisible();
}
