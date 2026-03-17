const { loginToERPNext } = require('./login.workflow');
const { resolveBaseUrl } = require('../../utils/environment');

async function createAuthenticatedSession(browser, credentials) {
  const context = await browser.newContext({
    baseURL: resolveBaseUrl(),
  });
  const page = await context.newPage();
  await loginToERPNext(page, credentials);
  return { context, page };
}

module.exports = {
  createAuthenticatedSession,
};
