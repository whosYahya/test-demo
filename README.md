# AMC Playwright Testing

This repository is structured for CI deployment while protecting the live ERPNext production site from value-creating test flows.

The operating rule is:

- `tests/smoke` is for read-only route and form availability checks.
- `tests/doctypes` and `tests/cross_module` are mutation suites and must run only on a non-production ERPNext site.

## Why this safety layer exists

These tests create or modify business data such as Customers, Vendors, Contracts, Attendance, Leave Applications, Expense Claims, and Service Calls. That is not safe for the production URL:

- `https://zl-atspire.m.frappe.cloud/`

This repo now blocks mutation runs against that host by default.

## Repo layout

- `pages` reusable ERPNext page objects
- `workflows` reusable login and session workflows
- `api` shared Frappe API helpers
- `data` loaders and unique data factories
- `fixtures/playwright` Playwright fixtures and test composition
- `tests/smoke` read-only smoke checks
- `tests/doctypes` business workflow and doctype mutation tests
- `tests/cross_module` permission and API-based cross-module tests
- `utils/environment.js` environment and production-safety guard
- `utils/globalSetup.js` login bootstrap plus preflight validation
- `.github/workflows/playwright.yml` CI workflow with safe execution defaults
- `.env.example` environment template

## Local setup

1. Install dependencies:

```bash
npm ci
```

2. Copy the sample environment and fill in a non-production ERPNext target:

```bash
cp .env.example .env
```

3. Set these minimum variables:

```env
BASE_URL=https://your-uat-site.example.com
ERPNEXT_USER=automation@example.com
ERPNEXT_PASS=change-me
ALLOW_MUTATION_TESTS=false
ALLOW_PROD_SMOKE=false
```

## Run commands

Read-only smoke:

```bash
npm run test:smoke
```

Full mutation suite against UAT or staging only:

```bash
npm run test:mutation
```

Cross-module suite only:

```bash
npm run test:cross-module
```

To run mutation tests intentionally, set:

```env
ALLOW_MUTATION_TESTS=true
```

## Production protection

The suite treats `zl-atspire.m.frappe.cloud` as production by default.

- Smoke checks against production require `ALLOW_PROD_SMOKE=true`.
- Mutation suites are hard-blocked against production.
- You can extend the production block list with `PROD_BASE_URLS`.

## GitHub Actions deployment model

The workflow is designed around two paths:

1. Push or pull request:
   Runs smoke only.

2. Manual dispatch:
   Runs the full mutation suite only when explicitly requested and only against non-production secrets.

### Recommended GitHub secrets

Smoke:

- `SMOKE_BASE_URL`
- `SMOKE_ERPNEXT_USER`
- `SMOKE_ERPNEXT_PASS`
- `ALLOW_PROD_SMOKE`

Mutation:

- `NONPROD_BASE_URL`
- `NONPROD_ERPNEXT_USER`
- `NONPROD_ERPNEXT_PASS`

Optional cross-module:

- `XMOD_USER_A_EMAIL`
- `XMOD_USER_A_PASSWORD`
- `XMOD_USER_A_EMPLOYEE`
- `XMOD_USER_B_EMAIL`
- `XMOD_USER_B_PASSWORD`
- `XMOD_USER_B_EMPLOYEE`
- `XMOD_ADMIN_USER`
- `XMOD_ADMIN_PASS`
- `XMOD_LEAVE_TYPE`
- `XMOD_EXPENSE_TYPE`

## Notes

- If `BASE_URL` is omitted locally, the suite falls back to `http://127.0.0.1:8004`.
- CI requires explicit secrets for URL and credentials.
- `reply.md` is not part of the framework and is left untouched.
