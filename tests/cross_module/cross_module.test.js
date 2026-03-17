const { test, expect } = require('@playwright/test');
const { apiGet, apiPost, apiPut, getLoggedUser } = require('../../api/frappe.client');
const { createAuthenticatedSession } = require('../../workflows/auth/session.workflow');
const { resolveBaseUrl } = require('../../utils/environment');

const BASE_URL = resolveBaseUrl();

const CONFIG = {
  admin: {
    email: process.env.XMOD_ADMIN_USER || process.env.ERPNEXT_USER || 'Administrator',
    password: process.env.XMOD_ADMIN_PASS || process.env.ERPNEXT_PASS || 'may65',
  },
  userA: {
    email: requiredEnv('XMOD_USER_A_EMAIL'),
    password: requiredEnv('XMOD_USER_A_PASSWORD'),
    employeeId: requiredEnv('XMOD_USER_A_EMPLOYEE'),
  },
  userB: {
    email: requiredEnv('XMOD_USER_B_EMAIL'),
    password: requiredEnv('XMOD_USER_B_PASSWORD'),
    employeeId: requiredEnv('XMOD_USER_B_EMPLOYEE'),
  },
  leaveType: process.env.XMOD_LEAVE_TYPE || 'Annual Leave',
  expenseType: process.env.XMOD_EXPENSE_TYPE || '',
};

const RECORDS = {
  leaveApplicationId: '',
  attendanceId: '',
  expenseClaimId: '',
};

test.describe.configure({ mode: 'serial' });
test.setTimeout(120000);

test.describe('Cross Module Access Control', () => {
  test.beforeAll(async ({ browser }) => {
    assertRequiredConfig();

    const admin = await createSession(browser, CONFIG.admin);
    try {
      const userBEmployee = await getEmployee(admin.page, CONFIG.userB.employeeId);
      expect(userBEmployee, `Employee ${CONFIG.userB.employeeId} must exist for cross-module tests.`).toBeTruthy();

      RECORDS.leaveApplicationId = await ensureLeaveApplication(admin.page, userBEmployee);
      RECORDS.attendanceId = await ensureAttendance(admin.page, userBEmployee);
      RECORDS.expenseClaimId = await ensureExpenseClaim(admin.page, userBEmployee);
    } finally {
      await admin.context.close();
    }
  });

  test('TC-XMOD-001 | UserA cannot list UserB leave applications', async ({ browser }) => {
    const userA = await createSession(browser, CONFIG.userA);
    try {
      const response = await apiGet(
        userA.page,
        `/api/resource/Leave%20Application?fields=["name","employee"]&filters=${encodeURIComponent(JSON.stringify([["employee", "=", CONFIG.userB.employeeId]]))}`
      );
      await expectZeroOrForbidden(response, 'Leave Application list');
    } finally {
      await userA.context.close();
    }
  });

  test('TC-XMOD-002 | UserA cannot open UserB leave application directly', async ({ browser }) => {
    const userA = await createSession(browser, CONFIG.userA);
    try {
      await openDoc(userA.page, 'leave-application', RECORDS.leaveApplicationId);
      await expectPermissionDenied(userA.page, RECORDS.leaveApplicationId);
    } finally {
      await userA.context.close();
    }
  });

  test('TC-XMOD-003 | UserA cannot update UserB leave application via API', async ({ browser }) => {
    const userA = await createSession(browser, CONFIG.userA);
    try {
      const response = await apiPut(
        userA.page,
        `/api/resource/Leave%20Application/${encodeURIComponent(RECORDS.leaveApplicationId)}`,
        { description: `unauthorized-${Date.now()}` }
      );
      expect([403, 417]).toContain(response.status());
    } finally {
      await userA.context.close();
    }
  });

  test('TC-XMOD-004 | UserA cannot list UserB attendance records', async ({ browser }) => {
    const userA = await createSession(browser, CONFIG.userA);
    try {
      const response = await apiGet(
        userA.page,
        `/api/resource/Attendance?fields=["name","employee"]&filters=${encodeURIComponent(JSON.stringify([["employee", "=", CONFIG.userB.employeeId]]))}`
      );
      await expectZeroOrForbidden(response, 'Attendance list');
    } finally {
      await userA.context.close();
    }
  });

  test('TC-XMOD-005 | UserA cannot open UserB attendance directly', async ({ browser }) => {
    const userA = await createSession(browser, CONFIG.userA);
    try {
      await openDoc(userA.page, 'attendance', RECORDS.attendanceId);
      await expectPermissionDenied(userA.page, RECORDS.attendanceId);
    } finally {
      await userA.context.close();
    }
  });

  test('TC-XMOD-006 | UserA cannot update UserB attendance via API', async ({ browser }) => {
    const userA = await createSession(browser, CONFIG.userA);
    try {
      const response = await apiPut(
        userA.page,
        `/api/resource/Attendance/${encodeURIComponent(RECORDS.attendanceId)}`,
        { status: 'Absent' }
      );
      expect([403, 417]).toContain(response.status());
    } finally {
      await userA.context.close();
    }
  });

  test('TC-XMOD-007 | UserA cannot list UserB expense claims', async ({ browser }) => {
    const userA = await createSession(browser, CONFIG.userA);
    try {
      const response = await apiGet(
        userA.page,
        `/api/resource/Expense%20Claim?fields=["name","employee"]&filters=${encodeURIComponent(JSON.stringify([["employee", "=", CONFIG.userB.employeeId]]))}`
      );
      await expectZeroOrForbidden(response, 'Expense Claim list');
    } finally {
      await userA.context.close();
    }
  });

  test('TC-XMOD-008 | UserA cannot open UserB expense claim directly', async ({ browser }) => {
    const userA = await createSession(browser, CONFIG.userA);
    try {
      await openDoc(userA.page, 'expense-claim', RECORDS.expenseClaimId);
      await expectPermissionDenied(userA.page, RECORDS.expenseClaimId);
    } finally {
      await userA.context.close();
    }
  });

  test('TC-XMOD-009 | UserA cannot update UserB expense claim via API', async ({ browser }) => {
    const userA = await createSession(browser, CONFIG.userA);
    try {
      const response = await apiPut(
        userA.page,
        `/api/resource/Expense%20Claim/${encodeURIComponent(RECORDS.expenseClaimId)}`,
        { remark: `unauthorized-${Date.now()}` }
      );
      expect([403, 417]).toContain(response.status());
    } finally {
      await userA.context.close();
    }
  });
});

function requiredEnv(name) {
  return process.env[name] || '';
}

function assertRequiredConfig() {
  const missing = [
    ['XMOD_USER_A_EMAIL', CONFIG.userA.email],
    ['XMOD_USER_A_PASSWORD', CONFIG.userA.password],
    ['XMOD_USER_A_EMPLOYEE', CONFIG.userA.employeeId],
    ['XMOD_USER_B_EMAIL', CONFIG.userB.email],
    ['XMOD_USER_B_PASSWORD', CONFIG.userB.password],
    ['XMOD_USER_B_EMPLOYEE', CONFIG.userB.employeeId],
  ].filter(([, value]) => !value).map(([name]) => name);

  expect(missing, `Missing required cross-module env vars: ${missing.join(', ')}`).toEqual([]);
}

async function createSession(browser, credentials) {
  const session = await createAuthenticatedSession(browser, credentials);
  await ensureLoggedInUser(session.page, credentials.email);
  return session;
}

async function ensureLoggedInUser(page, expectedUser) {
  const actualUser = await getLoggedUser(page);
  expect(String(actualUser).toLowerCase()).toContain(String(expectedUser).toLowerCase());
}

async function getEmployee(page, employeeId) {
  const response = await apiGet(page, `/api/resource/Employee/${encodeURIComponent(employeeId)}`);
  if (!response.ok()) return null;
  const body = await response.json();
  return body.data || null;
}

async function ensureLeaveApplication(page, employee) {
  const existingId = await findExistingDocId(
    page,
    'Leave Application',
    [[ 'employee', '=', employee.name ]]
  );
  if (existingId) return existingId;

  await ensureLeaveApprover(page, employee.name, CONFIG.admin.email);
  await ensureLeaveType(page, CONFIG.leaveType);

  const fromDate = futureDate(7);
  const toDate = futureDate(9);
  const response = await apiPost(page, '/api/resource/Leave%20Application', {
    employee: employee.name,
    leave_type: CONFIG.leaveType,
    from_date: fromDate,
    to_date: toDate,
    posting_date: today(),
    company: employee.company,
    leave_approver: CONFIG.admin.email,
    description: `Cross module auth seed ${Date.now()}`,
    status: 'Open',
  });

  if (response.ok()) {
    const body = await response.json();
    return body.data.name;
  }

  const fallbackId = await findExistingDocId(
    page,
    'Leave Application',
    [[ 'employee', '=', employee.name ]]
  );
  if (fallbackId) return fallbackId;

  throw new Error(`Unable to prepare Leave Application for ${employee.name}: ${await safeBody(response)}`);
}

async function ensureAttendance(page, employee) {
  const existingId = await findExistingDocId(
    page,
    'Attendance',
    [[ 'employee', '=', employee.name ], ['docstatus', '=', 0 ]]
  );
  if (existingId) return existingId;

  const response = await apiPost(page, '/api/resource/Attendance', {
    employee: employee.name,
    attendance_date: pastDate(15),
    status: 'Present',
    company: employee.company,
  });

  if (response.ok()) {
    const body = await response.json();
    return body.data.name;
  }

  const fallbackId = await findExistingDocId(
    page,
    'Attendance',
    [[ 'employee', '=', employee.name ]]
  );
  if (fallbackId) return fallbackId;

  throw new Error(`Unable to prepare Attendance for ${employee.name}: ${await safeBody(response)}`);
}

async function ensureExpenseClaim(page, employee) {
  const existingId = await findExistingDocId(
    page,
    'Expense Claim',
    [[ 'employee', '=', employee.name ], ['docstatus', '=', 0 ]]
  );
  if (existingId) return existingId;

  const expenseType = await getExpenseType(page);
  const response = await apiPost(page, '/api/resource/Expense%20Claim', {
    employee: employee.name,
    company: employee.company,
    expense_approver: CONFIG.admin.email,
    posting_date: today(),
    expenses: [
      {
        expense_date: today(),
        expense_type: expenseType,
        amount: 100,
        description: `Cross module auth seed ${Date.now()}`,
      },
    ],
  });

  if (response.ok()) {
    const body = await response.json();
    return body.data.name;
  }

  const fallbackId = await findExistingDocId(
    page,
    'Expense Claim',
    [[ 'employee', '=', employee.name ]]
  );
  if (fallbackId) return fallbackId;

  throw new Error(`Unable to prepare Expense Claim for ${employee.name}: ${await safeBody(response)}`);
}

async function ensureLeaveType(page, leaveTypeName) {
  const existing = await findExistingDocId(page, 'Leave Type', [[ 'name', '=', leaveTypeName ]]);
  if (existing) return existing;

  const response = await apiPost(page, '/api/resource/Leave%20Type', {
    leave_type_name: leaveTypeName,
    max_leaves_allowed: 30,
    is_lwp: 0,
  });

  if (!response.ok()) {
    const text = await safeBody(response);
    if (!/duplicate|already exists/i.test(text)) {
      throw new Error(`Unable to prepare Leave Type ${leaveTypeName}: ${text}`);
    }
  }

  return leaveTypeName;
}

async function ensureLeaveApprover(page, employeeId, approverEmail) {
  const employee = await getEmployee(page, employeeId);
  if (employee && employee.leave_approver === approverEmail) return;

  const response = await apiPut(page, `/api/resource/Employee/${encodeURIComponent(employeeId)}`, {
    leave_approver: approverEmail,
  });

  expect(response.ok(), `Unable to set leave approver on ${employeeId}: ${await safeBody(response)}`).toBeTruthy();
}

async function getExpenseType(page) {
  if (CONFIG.expenseType) return CONFIG.expenseType;

  const response = await apiGet(page, '/api/resource/Expense%20Claim%20Type?fields=["name"]&limit_page_length=1');
  expect(response.ok(), 'Expense Claim Type lookup failed.').toBeTruthy();
  const body = await response.json();
  const name = body.data && body.data[0] && body.data[0].name;
  expect(name, 'No Expense Claim Type records available. Set XMOD_EXPENSE_TYPE or create one in ERPNext.').toBeTruthy();
  return name;
}

async function findExistingDocId(page, doctype, filters) {
  const response = await apiGet(
    page,
    `/api/resource/${encodeURIComponent(doctype)}?fields=["name"]&filters=${encodeURIComponent(JSON.stringify(filters))}&order_by=creation%20desc&limit_page_length=1`
  );
  if (!response.ok()) return '';
  const body = await response.json();
  return body.data && body.data[0] ? body.data[0].name : '';
}

async function expectZeroOrForbidden(response, label) {
  const status = response.status();
  if (status === 403) {
    expect(status, `${label} should be blocked.`).toBe(403);
    return;
  }

  expect(response.ok(), `${label} request failed with ${status}.`).toBeTruthy();
  const body = await response.json();
  expect(Array.isArray(body.data), `${label} should return an array.`).toBeTruthy();
  expect(body.data, `${label} should not expose records owned by UserB.`).toHaveLength(0);
}

async function openDoc(page, route, docId) {
  await page.goto(`${BASE_URL}/app/${route}/${encodeURIComponent(docId)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
}

async function expectPermissionDenied(page, docId) {
  const hasPermissionMessage = await page
    .locator('.msgprint, .permission-error, .modal-body, .indicator-pill')
    .filter({ hasText: /not permitted|permission|403|not allowed|insufficient/i })
    .first()
    .isVisible()
    .catch(() => false);

  const stillOnRequestedDoc = decodeURIComponent(page.url()).includes(`/${docId}`);
  expect(
    hasPermissionMessage || !stillOnRequestedDoc,
    `Expected permission denial while opening ${docId}, but URL was ${page.url()}.`
  ).toBe(true);
}

async function safeBody(response) {
  const text = await response.text().catch(() => '');
  return text || `[status ${response.status()}]`;
}

function today() {
  return isoDate(0);
}

function futureDate(days) {
  return isoDate(days);
}

function pastDate(days) {
  return isoDate(-Math.abs(days));
}

function isoDate(offsetDays) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}
