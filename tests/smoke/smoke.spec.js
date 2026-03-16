const { test } = require('../../fixtures/playwright/erpnext.fixture');

test.describe('Smoke Suite - All Doctypes', () => {
  test('TC-SMOKE-001 | Attendance form loads', async ({ doctypeSmokePage }) => {
    await doctypeSmokePage.open('attendance');
  });

  test('TC-SMOKE-002 | Leave Application form loads', async ({ doctypeSmokePage }) => {
    await doctypeSmokePage.open('leaveApplication');
  });

  test('TC-SMOKE-003 | Expense Claim form loads', async ({ doctypeSmokePage }) => {
    await doctypeSmokePage.open('expenseClaim');
  });

  test('TC-SMOKE-004 | AMC Customer form loads', async ({ doctypeSmokePage }) => {
    await doctypeSmokePage.open('customer');
  });

  test('TC-SMOKE-005 | AMC Contract form loads', async ({ doctypeSmokePage }) => {
    await doctypeSmokePage.open('contract');
  });

  test('TC-SMOKE-006 | Service Call form loads', async ({ doctypeSmokePage }) => {
    await doctypeSmokePage.open('serviceCall');
  });

  test('TC-SMOKE-007 | Vendor form loads', async ({ doctypeSmokePage }) => {
    await doctypeSmokePage.open('vendor');
  });
});
