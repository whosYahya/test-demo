class LoginPage {
  constructor(page) {
    this.page = page;
    this.emailInput = page.getByRole('textbox', { name: /email/i });
    this.passwordInput = page.getByRole('textbox', { name: /password/i });
    this.loginButton = page.getByRole('button', { name: /^login$/i });
  }

  async isVisible() {
    return this.emailInput.isVisible({ timeout: 5000 }).catch(() => false);
  }

  async login(email, password) {
    await this.emailInput.waitFor({ timeout: 15000 });
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }
}

module.exports = {
  LoginPage,
};
