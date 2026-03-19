# AMC Playwright Testing

Playwright automation for ERPNext/AMC doctypes, smoke coverage, cross-module checks, and CSV-driven data-driven testing.

This repository now supports two kinds of automated coverage:

- scenario-based doctype tests in `tests/doctypes`
- row-driven DDT suites in `tests/data-driven`

## Safety Model

This suite can create or modify ERPNext business data such as:

- Customers
- Vendors
- Contracts
- Attendance
- Leave Applications
- Expense Claims
- Service Calls

Because of that:

- `tests/smoke` is the safest path for read-only checks
- mutation suites should run only against UAT, staging, or another non-production site
- the repo includes production safety toggles in `.env`

## Current Repo Layout

- `api/`
  Shared API helpers for Frappe and ERPNext request calls.

- `data/`
  Loaders and factories used by scenario suites and DDT flows.

- `fixtures/testData/`
  Business input files and case workbooks.

- `pages/`
  Shared page objects such as login and app switcher helpers.

- `scripts/`
  Suite runner entrypoints, including the Playwright runner wrapper.

- `tests/smoke/`
  Read-only smoke coverage.

- `tests/doctypes/`
  Scenario-based doctype tests.

- `tests/data-driven/`
  Data-driven specs. Some are CSV-row-based, some currently wrap existing scenario suites.

- `tests/cross_module/`
  Cross-module behavior and permission checks.

- `utils/`
  Shared helpers, environment resolution, browser config, auth setup, and data loading.

- `workflows/`
  Reusable authentication/session workflows.

- `AMC_Master_Tracker.xlsx`
  Tracker workbook updated by DDT sheets and the run-tracker script.

- `update_tracker.py`
  Updates the `Run Tracker` sheet from Playwright JSON results.

## Test Data Files

The current row-input CSV files in `fixtures/testData/` are:

- `customers.csv`
- `attendance.csv`
- `expense_claim.csv`
- `leave_application.csv`
- `vendor.csv`

The current case workbooks in `fixtures/testData/cases_doctype/` are:

- `attendance_cases.xlsx`
- `contract_cases.xlsx`
- `customers_cases.xlsx`
- `expenses_cases.xlsx`
- `leaves_cases.xlsx`
- `service_call_cases.xlsx`
- `vendor_cases.xlsx`

## Test Suites

### Smoke

- `tests/smoke/smoke.spec.js`

Use this for route and form availability checks.

### Doctype Scenario Suites

- `tests/doctypes/attendance.test.js`
- `tests/doctypes/contract.test.js`
- `tests/doctypes/customers.test.js`
- `tests/doctypes/expenses.test.js`
- `tests/doctypes/leaves.test.js`
- `tests/doctypes/service_calls.test.js`
- `tests/doctypes/vendor.test.js`

These are scenario-based mutation suites.

### Data-Driven Suites

- `tests/data-driven/customers_ddt.spec.js`
- `tests/data-driven/attendance_ddt.spec.js`
- `tests/data-driven/expenses_ddt.spec.js`
- `tests/data-driven/leaves_ddt.spec.js`
- `tests/data-driven/vendor_ddt.spec.js`

These files use CSV rows as test input.

The following files still expose existing doctype scenario coverage from the data-driven folder:

- `tests/data-driven/contract_ddt.spec.js`
- `tests/data-driven/service_calls_ddt.spec.js`

Shared DDT utilities live in:

- `tests/data-driven/_shared.js`

## Tracker Updates

There are currently two tracker update paths:

### Data-Driven Sheet Updates

The CSV-driven DDT specs write results into `AMC_Master_Tracker.xlsx`:

- `customers_ddt.spec.js` writes `Data-Driven Results`
- `attendance_ddt.spec.js` writes `DDT Attendance`
- `expenses_ddt.spec.js` writes `DDT Expense Claim`
- `leaves_ddt.spec.js` writes `DDT Leave Application`
- `vendor_ddt.spec.js` writes `DDT Vendor`

### Run Tracker Updates

`update_tracker.py` reads Playwright JSON results and updates the `Run Tracker` sheet in `AMC_Master_Tracker.xlsx`.

## Environment Setup

1. Install dependencies:

```bash
npm ci
```

2. Copy the sample environment:

```bash
cp .env.example .env
```

3. Fill the minimum values:

```env
BASE_URL=https://your-uat-site.example.com
ERPNEXT_USER=automation@example.com
ERPNEXT_PASS=change-me
ALLOW_PROD_SMOKE=false
ALLOW_MUTATION_TESTS=false
```

Optional values in `.env.example` include:

- cross-module users and approvers
- attendance seed values
- expense claim seed values
- technician credentials

## Commands

Run smoke:

```bash
npm run test:smoke
```

Run doctype mutation coverage:

```bash
npm run test:doctypes
```

Run the broader mutation suite:

```bash
npm run test:mutation
```

Run CSV/data-driven suites:

```bash
npm run test:data-driven
```

Run cross-module tests:

```bash
npm run test:cross-module
```

Generate Allure report:

```bash
npm run report:allure
```

Open Playwright HTML report:

```bash
npm run report:html
```

## Current Execution Notes

- If `BASE_URL` is missing, local helpers may fall back to `http://127.0.0.1:8004`
- DDT date normalization is handled in `tests/data-driven/_shared.js`
- leave dates are converted to `DD-MM-YYYY` before entry
- attendance and expense dates stay in `YYYY-MM-DD`
- some DDT rows are intentionally invalid and should be rejected by ERPNext
- `reply.md` and `prompt.md` are not part of the framework runtime

## Recommended Workflow

1. Update `.env` for the target non-production ERPNext site.
2. Add or edit CSV rows in `fixtures/testData/`.
3. Run `npm run test:data-driven` for row-driven validation.
4. Run `python update_tracker.py --results test-results/results.json --excel AMC_Master_Tracker.xlsx` if you want to refresh the run tracker from Playwright results.
5. Review `AMC_Master_Tracker.xlsx`, `reports/html`, and `allure-results`.
