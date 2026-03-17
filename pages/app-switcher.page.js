class AppSwitcherPage {
  constructor(page) {
    this.page = page;
  }

  async openERPNextIfVisible() {
    if (!this.page.url().includes('/apps')) return;

    const erpTile = this.page.locator('a, div, button').filter({ hasText: /^ERPNext$/i }).first();
    if (await erpTile.isVisible().catch(() => false)) {
      await erpTile.click();
      await this.page.waitForURL(/\/app\//, { timeout: 15000 }).catch(async () => {
        await this.page.goto('/app', { waitUntil: 'domcontentloaded' });
      });
    }
  }
}

module.exports = {
  AppSwitcherPage,
};
