const { expect } = require('@playwright/test');

const DOCTYPES = {
  attendance: {
    route: '/app/attendance/new-attendance-1',
    readySelector: '[data-fieldname="employee"]',
  },
  leaveApplication: {
    route: '/app/leave-application/new-leave-application',
    readySelector: '[data-fieldname="employee"]',
  },
  expenseClaim: {
    route: '/app/expense-claim/new',
    readySelector: '[data-fieldname="employee"]',
  },
  customer: {
    route: '/app/amc-customers/new-amc-customers',
    readySelector: '[data-fieldname="customer_name"]',
  },
  contract: {
    route: '/app/amc-contract/new-amc-contract',
    readySelector: '[data-fieldname="start_date"]',
  },
  serviceCall: {
    route: '/app/service-call/new-service-call',
    readySelector: '[data-fieldname="customer"]',
  },
  vendor: {
    route: '/app/vendor/new-vendor',
    readySelector: '[data-fieldname="vendor_name"]',
  },
};

class DoctypeSmokePage {
  constructor(page) {
    this.page = page;
  }

  async open(doctypeKey) {
    const config = DOCTYPES[doctypeKey];
    if (!config) {
      throw new Error(`Unknown doctype smoke key "${doctypeKey}".`);
    }

    await this.page.goto(config.route, { waitUntil: 'domcontentloaded' });
    if (this.page.url().includes('/app/home')) {
      await this.page.goto(config.route, { waitUntil: 'domcontentloaded' });
    }

    await expect(this.page.locator(config.readySelector).first()).toBeVisible({ timeout: 20000 });
  }
}

module.exports = {
  DOCTYPES,
  DoctypeSmokePage,
};
