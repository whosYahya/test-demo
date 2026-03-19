const DEFAULT_LOCAL_BASE_URL = 'http://127.0.0.1:8004';

function resolveBaseUrl() {
  const raw = String(process.env.BASE_URL || '').trim();
  return raw || DEFAULT_LOCAL_BASE_URL;
}

module.exports = {
  DEFAULT_LOCAL_BASE_URL,
  resolveBaseUrl,
};
