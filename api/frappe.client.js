function resolveRequestClient(source) {
  if (!source) {
    throw new Error('A Playwright page or browser context is required.');
  }

  if (typeof source.get === 'function' && typeof source.fetch === 'function') {
    return source;
  }

  if (typeof source.request === 'object' && source.request) {
    return source.request;
  }

  if (typeof source.context === 'function') {
    return source.context().request;
  }

  throw new Error('Unable to resolve a Playwright API request client.');
}

async function apiGet(source, apiPath) {
  return resolveRequestClient(source).get(apiPath);
}

async function apiPost(source, apiPath, data) {
  return resolveRequestClient(source).fetch(apiPath, { method: 'POST', data });
}

async function apiPut(source, apiPath, data) {
  return resolveRequestClient(source).fetch(apiPath, { method: 'PUT', data });
}

async function getLoggedUser(source) {
  const response = await apiGet(source, '/api/method/frappe.auth.get_logged_user');
  if (!response.ok()) {
    throw new Error(`Login verification API failed with status ${response.status()}.`);
  }

  const body = await response.json();
  return String(body.message || '');
}

module.exports = {
  apiGet,
  apiPost,
  apiPut,
  getLoggedUser,
};
