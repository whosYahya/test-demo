# AMC Playwright Test Suite

Playwright automation for ERPNext / Frappe AMC workflows.

This repo includes:

- smoke checks
- business Requirement Cases
- doctype mutation tests
- cross-module tests
- data-driven tests from CSV files

## What This Repo Is For

Use this project when you want to:

- validate that key ERPNext forms open correctly
- run end-to-end tests for AMC doctypes
- test business input files row by row
- generate tracker-ready pass/fail output in `AMC_Master_Tracker.xlsx`

## Before You Run Anything

Some suites create or edit real ERPNext data.

- `tests/smoke` is the safest option
- `tests/doctypes`, `tests/cross_module`, and most `tests/data-driven` specs are mutation tests
- if you are testing against production, start with smoke only

Important:

- keep `AMC_Master_Tracker.xlsx` closed while DDT specs are running
- if Excel has the file open, tracker sheet updates can fail with `EBUSY`

## Quick Start

### 1. Install dependencies

```bash
npm ci
```

### 2. Create your environment file

Create a `.env` file from `.env.example`.

Minimum values:

```env
BASE_URL=https://your-site.example.com
ERPNEXT_USER=your-user@example.com
ERPNEXT_PASS=your-password
```

Notes:

- if `BASE_URL` is blank, the suite falls back to `<LOCAL_HOST LINK>`
- this works for local ERPNext as well as UAT / production URLs

### 3. Run smoke first

```bash
npm run test:smoke
```

If smoke passes, then move to the heavier suites.

## Local vs Hosted / Prod

### Local ERPNext

Use:

```env
BASE_URL=<LOCAL_HOST LINK>
```

or leave `BASE_URL` empty and let the repo use the local default.

### UAT / Staging / Production

Set:

```env
BASE_URL=https://your-site.example.com
ERPNEXT_USER=...
ERPNEXT_PASS=...
```

Recommended order:

1. run smoke
2. run only the suites you actually need
3. run mutation suites only with approval

## Test Commands

### Safe starting point

```bash
npm run test:smoke
```

### Scenario-based doctype suite

```bash
npm run test:doctypes
```

### Full mutation suite

```bash
npm run test:mutation
```

This runs:

- `tests/doctypes`
- `tests/cross_module`

### Cross-module only

```bash
npm run test:cross-module
```

### Standard CSV-driven DDT suite

```bash
npm run test:data-driven
```

This currently runs:

- `customers_ddt.spec.js`
- `attendance_ddt.spec.js`
- `expenses_ddt.spec.js`
- `leaves_ddt.spec.js`
- `vendor_ddt.spec.js`

### Service Call DDT

```bash
npx playwright test tests/data-driven/service_calls_ddt.spec.js
```

### AMC Contract DDT

```bash
npx playwright test tests/data-driven/contract_ddt.spec.js
```

## Recommended Workflows

### If someone pulls this repo and wants to start testing their own app

1. Clone the repo
2. Run `npm ci`
3. Create `.env`
4. Set `BASE_URL`, `ERPNEXT_USER`, and `ERPNEXT_PASS`
5. Run `npm run test:smoke`
6. If smoke is good, run the suite you need
7. Review the HTML report and tracker workbook

### If the target is production

1. Run only `npm run test:smoke` first
2. Confirm the forms and routes are reachable
3. Run mutation tests only if your team explicitly wants live data changes

### If the goal is data validation from spreadsheets

1. Update the CSV file in `fixtures/testData/`
2. Run the matching DDT spec
3. Review `AMC_Master_Tracker.xlsx`

## Data Files

Current row-input files:

- [customers.csv](c:/Users/dell/Desktop/Work/AMC%20TEST/fixtures/testData/customers.csv)
- [attendance.csv](c:/Users/dell/Desktop/Work/AMC%20TEST/fixtures/testData/attendance.csv)
- [expense_claim.csv](c:/Users/dell/Desktop/Work/AMC%20TEST/fixtures/testData/expense_claim.csv)
- [leave_application.csv](c:/Users/dell/Desktop/Work/AMC%20TEST/fixtures/testData/leave_application.csv)
- [vendor.csv](c:/Users/dell/Desktop/Work/AMC%20TEST/fixtures/testData/vendor.csv)
- [service_calls.csv](c:/Users/dell/Desktop/Work/AMC%20TEST/fixtures/testData/service_calls.csv)
- [amc_contracts.csv](c:/Users/dell/Desktop/Work/AMC%20TEST/fixtures/testData/amc_contracts.csv)

Case workbooks:

- `fixtures/testData/cases_doctype/attendance_cases.xlsx`
- `fixtures/testData/cases_doctype/contract_cases.xlsx`
- `fixtures/testData/cases_doctype/customers_cases.xlsx`
- `fixtures/testData/cases_doctype/expenses_cases.xlsx`
- `fixtures/testData/cases_doctype/leaves_cases.xlsx`
- `fixtures/testData/cases_doctype/service_call_cases.xlsx`
- `fixtures/testData/cases_doctype/vendor_cases.xlsx`

## Reports and Tracker

### Playwright HTML report

```bash
npm run report:html
```

Output:

- `reports/html`

### Allure report

```bash
npm run report:allure
```

Output:

- `reports/allure`

### Tracker workbook

DDT specs write row-wise results into:

- [AMC_Master_Tracker.xlsx](c:/Users/dell/Desktop/Work/AMC%20TEST/AMC_Master_Tracker.xlsx)

Current DDT sheets include:

- `Data-Driven Results`
- `DDT Attendance`
- `DDT Leave Application`
- `DDT Vendor`
- `DDT Service Call`
- `DDT AMC Contract`

If you want to update the run tracker from Playwright JSON results:

```bash
python update_tracker.py --results test-results/results.json --excel AMC_Master_Tracker.xlsx
```

## Important Repo Files

- [playwright.config.js](c:/Users/dell/Desktop/Work/AMC%20TEST/playwright.config.js): Playwright config, reporters, global setup
- [scripts/run-playwright.js](c:/Users/dell/Desktop/Work/AMC%20TEST/scripts/run-playwright.js): npm suite runner
- [utils/globalSetup.js](c:/Users/dell/Desktop/Work/AMC%20TEST/utils/globalSetup.js): logs in once and saves auth state
- [utils/helpers.js](c:/Users/dell/Desktop/Work/AMC%20TEST/utils/helpers.js): shared ERPNext helper library
- [tests/doctypes](c:/Users/dell/Desktop/Work/AMC%20TEST/tests/doctypes): scenario-based tests
- [tests/data-driven](c:/Users/dell/Desktop/Work/AMC%20TEST/tests/data-driven): DDT specs
- [tests/smoke](c:/Users/dell/Desktop/Work/AMC%20TEST/tests/smoke): safest form-load checks

## Practical Notes

- the suite uses your local Chrome / Edge executable when available
- login is handled in global setup, so each run starts with an authenticated state
- many DDT rows are intentionally invalid; those tests still pass when ERPNext rejects the row as expected
- if a DDT sheet does not update, check whether `AMC_Master_Tracker.xlsx` is open in Excel

## Good First Run

If you are new to this repo, use this exact order:

```bash
npm ci
npm run test:smoke
npx playwright test tests/data-driven/service_calls_ddt.spec.js
npx playwright test tests/data-driven/contract_ddt.spec.js
```

Then open:

- `reports/html`
- `AMC_Master_Tracker.xlsx`
