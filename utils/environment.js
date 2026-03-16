const DEFAULT_LOCAL_BASE_URL = 'http://127.0.0.1:8004';
const DEFAULT_PROD_HOSTS = ['zl-atspire.m.frappe.cloud'];

function resolveBaseUrl() {
  const raw = String(process.env.BASE_URL || '').trim();
  return raw || DEFAULT_LOCAL_BASE_URL;
}

function parseUrl(baseUrl = resolveBaseUrl()) {
  try {
    return new URL(baseUrl);
  } catch (error) {
    throw new Error(`BASE_URL is invalid: "${baseUrl}".`);
  }
}

function normalizedHost(host) {
  return String(host || '').trim().toLowerCase();
}

function configuredProductionHosts() {
  const extra = String(process.env.PROD_BASE_URLS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      try {
        return new URL(value).host.toLowerCase();
      } catch {
        return value.toLowerCase();
      }
    });

  return new Set([...DEFAULT_PROD_HOSTS, ...extra].map(normalizedHost));
}

function isProductionLikeUrl(baseUrl = resolveBaseUrl()) {
  const host = normalizedHost(parseUrl(baseUrl).host);
  return configuredProductionHosts().has(host);
}

function isTruthy(value) {
  return /^(1|true|yes|y)$/i.test(String(value || '').trim());
}

function ensureEnvironmentIsSafeToRun({ suite = process.env.PW_SUITE || 'mutation' } = {}) {
  const baseUrl = resolveBaseUrl();
  const isProd = isProductionLikeUrl(baseUrl);

  if (process.env.CI && !String(process.env.BASE_URL || '').trim()) {
    throw new Error('BASE_URL must be provided in CI.');
  }

  if (process.env.CI) {
    const missing = ['ERPNEXT_USER', 'ERPNEXT_PASS'].filter((name) => !String(process.env[name] || '').trim());
    if (missing.length) {
      throw new Error(`Missing required CI secrets: ${missing.join(', ')}.`);
    }
  }

  if (suite === 'smoke') {
    if (isProd && !isTruthy(process.env.ALLOW_PROD_SMOKE)) {
      throw new Error(
        `Smoke suite targets production host "${parseUrl(baseUrl).host}". ` +
        'Set ALLOW_PROD_SMOKE=true only if you intentionally want read-only checks against production.'
      );
    }
    return;
  }

  if (suite === 'mutation' || suite === 'e2e') {
    if (!isTruthy(process.env.ALLOW_MUTATION_TESTS)) {
      throw new Error(
        'Mutation suite is blocked by default. Set ALLOW_MUTATION_TESTS=true only for a dedicated non-production ERPNext environment.'
      );
    }

    if (isProd) {
      throw new Error(
        `Mutation suite cannot run against production host "${parseUrl(baseUrl).host}". ` +
        'Point BASE_URL to a staging/UAT site instead.'
      );
    }
  }
}

module.exports = {
  DEFAULT_LOCAL_BASE_URL,
  DEFAULT_PROD_HOSTS,
  ensureEnvironmentIsSafeToRun,
  isProductionLikeUrl,
  parseUrl,
  resolveBaseUrl,
};
