const { AppSwitcherPage } = require('../../pages/app-switcher.page');
const { LoginPage } = require('../../pages/login.page');
const { getLoggedUser } = require('../../api/frappe.client');
const { resolveBaseUrl } = require('../../utils/environment');

function resolveCredentials(overrides = {}) {
  return {
    email: overrides.email || process.env.ERPNEXT_USER || 'Administrator',
    password: overrides.password || process.env.ERPNEXT_PASS || 'may65',
  };
}

async function loginToERPNext(page, overrides = {}) {
  const credentials = resolveCredentials(overrides);
  const baseURL = resolveBaseUrl();

  await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });

  const loginPage = new LoginPage(page);
  if (await loginPage.isVisible()) {
    await loginPage.login(credentials.email, credentials.password);
    await page.waitForURL(/\/(app|apps)/, { timeout: 30000 });
  }

  const appSwitcherPage = new AppSwitcherPage(page);
  await appSwitcherPage.openERPNextIfVisible();

  if (!page.url().includes('/app/')) {
    await page.goto(`${baseURL}/app`, { waitUntil: 'domcontentloaded' });
  }

  const actualUser = (await getLoggedUser(page)).toLowerCase();
  if (!actualUser.includes(String(credentials.email).toLowerCase())) {
    throw new Error(`Expected logged-in user ${credentials.email}, but ERPNext returned ${actualUser}.`);
  }
}

module.exports = {
  loginToERPNext,
  resolveCredentials,
};
