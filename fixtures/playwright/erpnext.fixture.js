const base = require('@playwright/test');
const { DoctypeSmokePage } = require('../../pages/doctype-smoke.page');
const { LoginPage } = require('../../pages/login.page');
const { loginToERPNext } = require('../../workflows/auth/login.workflow');

const test = base.test.extend({
  authenticatedPage: async ({ page }, use) => {
    await loginToERPNext(page);
    await use(page);
  },

  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  doctypeSmokePage: async ({ authenticatedPage }, use) => {
    await use(new DoctypeSmokePage(authenticatedPage));
  },
});

module.exports = {
  test,
  expect: base.expect,
};
