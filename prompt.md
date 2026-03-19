You are a Senior QA Automation Engineer specialising in Playwright and ERPNext.

I have an existing Playwright test repository for an ERPNext custom app (AMC module).
You are working inside this repo right now.

═══════════════════════════════════════════════════════════════
CURRENT REPO STRUCTURE (do not break any of it)
═══════════════════════════════════════════════════════════════

tests/
  customers_test.js         
utils/
  helpers.js                ← exports { customers } namespace
  environment.js            ← exports resolveBaseUrl()
  globalSetup.js
  globalTeardown.js
  authState.json            ← gitignored
fixtures/
  testData/                 ← empty, data files go here
playwright.config.js
package.json                ← scripts: test:smoke, test:doctypes, test:mutation,
                               test:cross-module, test:permissions, report:allure, report:html
.github/workflows/playwright.yml
update_tracker.py
AMC_Master_Tracker.xlsx
allure-results/
reports/html/

HELPERS in utils/helpers.js under the customers namespace:
  goToList(page), goToNew(page), loginIfNeeded(page)
  fillCustomerName(page, name), fillGST(page, gst)
  fillPAN(page, pan), setCustomerType(page, type)
  addCustomerBranch(page, custName, branchName, address)
  addContactRow(page, { name, mobile, isPrimary })
  saveForm(page)              ← returns { saved: true/false }
  expectSaved(page)
  expectValidationError(page, fieldName)

═══════════════════════════════════════════════════════════════
CORE CONCEPT — read this carefully before writing any code
═══════════════════════════════════════════════════════════════

The business user (boss) sends a plain Excel or CSV file containing
real customer data. He does NOT add any QA columns like exp_result
or exp_error_field. He just sends what he has from his CRM:

  customer_name, gst, pan, customer_type,
  branch_name, branch_address, contact_name, contact_mobile

Your test suite must:
1. Validate each row's data format BEFORE the browser runs
   (pre-flight validation using regex rules)
2. Submit every row to ERPNext via Playwright regardless of
   pre-flight result
3. Capture what ERPNext actually does — created or rejected and why
4. Report the BUSINESS OUTCOME per row in plain language —
   not pass/fail in QA terms, but CREATED / REJECTED / SKIPPED
   with a human-readable reason
5. Write results back to the Excel tracker so the boss can read
   exactly which customers need fixing and what to fix

A Playwright test should only FAIL (red) if something unexpected
happens — like the app crashing, or a valid row being rejected with
no error message. Rows correctly rejected by ERPNext due to bad data
should show as PASSED in Playwright (the app behaved correctly)
but REJECTED in the business outcome column of the tracker.

═══════════════════════════════════════════════════════════════
STEP 1 — Install dependencies
═══════════════════════════════════════════════════════════════

Run: npm install --save-dev xlsx

Verify xlsx was added to devDependencies in package.json.

═══════════════════════════════════════════════════════════════
STEP 2 — Create utils/dataLoader.js
═══════════════════════════════════════════════════════════════

Create utils/dataLoader.js with the following:

SECTION A — File reading functions

  loadCSV(filename)
  - Reads from fixtures/testData/{filename}
  - Parses headers from row 1, values from rows 2+
  - Trims all whitespace from headers and values
  - Skips blank rows
  - Returns array of plain objects keyed by header names
  - Throws Error with full file path if file not found

  loadExcel(filename, sheetName)
  - Reads from fixtures/testData/{filename}
  - Uses XLSX.readFile and XLSX.utils.sheet_to_json with defval: ''
  - Uses first sheet if sheetName not provided
  - Trims all string values
  - Returns array of plain objects
  - Throws Error with full file path if file not found

  loadTestData(filename, sheetName)
  - Auto-detects .csv vs .xlsx/.xls by extension
  - Throws clear Error for unsupported extensions
  - After loading, calls validateAndAnnotateRows() on the result
  - Returns the annotated array

SECTION B — Pre-flight validation function

  validateAndAnnotateRows(rows)
  - Takes the raw array of row objects
  - For each row, adds these internal fields (prefixed with underscore
    so they are clearly not from the boss's data):
      _row_number          → 1-based index
      _pre_issues          → array of issue strings found in this row
      _pre_valid           → boolean, true if _pre_issues is empty

  Rules to check per row (add to _pre_issues if violated):
    customer_name:
      - If empty or whitespace only → "Customer Name is required"
    gst:
      - If provided AND length !== 15 →
        "GST must be exactly 15 characters (got N)"
      - If provided AND does not match
        /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/ →
        "GST format is invalid (expected: 2-digit state + PAN + 1 digit + Z + checksum)"
    pan:
      - If provided AND length !== 10 →
        "PAN must be exactly 10 characters (got N)"
      - If provided AND does not match /^[A-Z]{5}\d{4}[A-Z]{1}$/ →
        "PAN format is invalid (expected: 5 letters + 4 digits + 1 letter)"
    customer_type:
      - If provided AND not one of ['Company','Individual','Partnership'] →
        "Customer Type must be Company, Individual, or Partnership (got: X)"
    contact_mobile:
      - If provided AND does not match /^\d{10}$/ →
        "Contact Mobile must be exactly 10 digits"

  - Returns the annotated rows array

SECTION C — Result capture helper

  buildRowResult(row, browserOutcome)
  - Takes a row object (with _pre fields) and a browserOutcome object
  - browserOutcome shape:
      {
        saved: true/false,
        errorMessage: string or null,   ← captured from ERPNext UI
        errorField: string or null      ← field name if identifiable
      }
  - Returns a result object:
      {
        row_number:     row._row_number,
        customer_name:  row.customer_name || '(empty)',
        outcome:        'CREATED' | 'REJECTED' | 'SKIPPED' | 'ERROR',
        reason:         human-readable string explaining outcome,
        action_needed:  plain-language instruction for the boss,
        pre_issues:     row._pre_issues joined as semicolon-separated string,
        error_field:    browserOutcome.errorField || '',
        raw_error:      browserOutcome.errorMessage || ''
      }

  Outcome logic:
    - If row._pre_valid is false AND customer_name is empty →
      outcome: 'SKIPPED', reason: first pre-issue, action_needed: 'Add the customer name'
    - If saved is true →
      outcome: 'CREATED', reason: 'Record created in ERPNext successfully',
      action_needed: 'None'
    - If saved is false AND errorMessage contains text →
      outcome: 'REJECTED', reason: errorMessage (first 200 chars),
      action_needed: derive from errorField:
        gst → 'Correct the GST number for this customer'
        pan → 'Correct the PAN number for this customer'
        customer_name → 'Add or fix the customer name'
        (anything else) → 'Review the highlighted field and correct the value'
    - If saved is false AND no errorMessage →
      outcome: 'ERROR', reason: 'Save failed but no error message was captured',
      action_needed: 'Check the ERPNext error log — unexpected failure'

Export: { loadCSV, loadExcel, loadTestData, buildRowResult }

═══════════════════════════════════════════════════════════════
STEP 3 — Create sample data files
═══════════════════════════════════════════════════════════════

3a. Create fixtures/testData/customers.csv

Headers (no exp_result, no exp_error_field — boss does not fill these):
  customer_name,gst,pan,customer_type,branch_name,branch_address,contact_name,contact_mobile

10 rows covering:
  Row 1:  Valid Company — all fields filled, realistic fake data
  Row 2:  Valid Company — GST + PAN, no branch, no contact
  Row 3:  Valid Individual — no GST, has PAN, has contact
  Row 4:  Valid Partnership — GST + PAN + branch
  Row 5:  Invalid GST format (wrong length or wrong pattern)
  Row 6:  Invalid PAN format (wrong pattern)
  Row 7:  Missing customer_name (empty string)
  Row 8:  Valid Company — no GST, no PAN (should be accepted)
  Row 9:  Invalid customer_type (e.g. "LLC" instead of Company)
  Row 10: Invalid contact_mobile (letters in it or wrong length)

Use realistic-looking fake Indian data. Real format but not real numbers.

3b. Create fixtures/testData/README.md

Document in plain non-technical language:
- What the boss needs to fill in each column
- Which columns are required vs optional
- What happens if a row has bad data (it gets REJECTED with a reason)
- How to read the Data-Driven Results tab in the tracker
- "You do not need to add any extra columns — just send your customer list"

═══════════════════════════════════════════════════════════════
STEP 4 — Create tests/data-driven/customers_ddt.spec.js
═══════════════════════════════════════════════════════════════

Create tests/data-driven/customers_ddt.spec.js

IMPORTS:
  const { test, expect }   = require('@playwright/test')
  const { customers }      = require('../../utils/helpers')
  const { loadTestData, buildRowResult } = require('../../utils/dataLoader')

Destructure from customers:
  goToNew, loginIfNeeded, fillCustomerName, fillGST, fillPAN,
  setCustomerType, addCustomerBranch, addContactRow, saveForm

DATA LOADING at module level:
  const rows = loadTestData('customers.csv')
  // Change to 'customers.xlsx' if boss sends Excel
  if (!rows || rows.length === 0) {
    throw new Error('No data found in customers.csv — check fixtures/testData/')
  }

RESULTS ARRAY at module level:
  const runResults = []
  // Collects one result object per row, written to tracker after all tests

FRESH FORM helper:
  Same pattern as customers_test.js

TEST TIMEOUT: test.setTimeout(90000)

TEST STRUCTURE:
  test.describe('Data-driven: AMC Customers @mutation', () => {

    for (const row of rows) {
      const rowNum = String(row._row_number).padStart(3, '0')
      const label  = `DDT-CUST-${rowNum} | ${row.customer_name || '(empty)'} | ${row.customer_type || 'no-type'}`

      test(label, async ({ page }) => {

        // STEP 1 — Skip empty-name rows without touching the browser
        if (!row.customer_name || row.customer_name.trim() === '') {
          const result = buildRowResult(row, { saved: false, errorMessage: 'Customer Name is required', errorField: 'customer_name' })
          runResults.push(result)
          test.skip(true, `Skipping row ${row._row_number}: customer_name is empty`)
          return
        }

        // STEP 2 — Log pre-flight issues as annotations (visible in report)
        if (!row._pre_valid) {
          test.info().annotations.push({
            type: 'Pre-flight warning',
            description: row._pre_issues.join('; ')
          })
        }

        // STEP 3 — Fill the form
        await freshForm(page)
        await fillCustomerName(page, row.customer_name)
        if (row.gst)            await fillGST(page, row.gst)
        if (row.pan)            await fillPAN(page, row.pan)
        if (row.customer_type && ['Company','Individual','Partnership'].includes(row.customer_type)) {
          await setCustomerType(page, row.customer_type)
        }
        if (row.branch_name)    await addCustomerBranch(page, row.customer_name, row.branch_name, row.branch_address || '')
        if (row.contact_name)   await addContactRow(page, { name: row.contact_name, mobile: row.contact_mobile || '', isPrimary: true })

        // STEP 4 — Attempt save
        const saveResult = await saveForm(page)

        // STEP 5 — Capture ERPNext's actual error message from the UI
        let errorMessage = null
        let errorField   = null
        if (!saveResult.saved) {
          errorMessage = await page.locator(
            '.msgprint, .frappe-toast-message, .alert-danger, .modal-body'
          ).first().textContent({ timeout: 5000 }).catch(() => null)

          if (errorMessage) errorMessage = errorMessage.trim().slice(0, 300)

          // Try to identify which field caused the error
          const hasError = async (fieldName) => {
            return await page.locator(
              `[data-fieldname="${fieldName}"] .frappe-has-error, ` +
              `[data-fieldname="${fieldName}"].has-error`
            ).isVisible({ timeout: 2000 }).catch(() => false)
          }
          if (await hasError('gst'))           errorField = 'gst'
          else if (await hasError('pan'))      errorField = 'pan'
          else if (await hasError('customer_name')) errorField = 'customer_name'
        }

        // STEP 6 — Build and store result
        const result = buildRowResult(row, {
          saved: saveResult.saved,
          errorMessage,
          errorField
        })
        runResults.push(result)

        // STEP 7 — Playwright assertion
        // Test passes in ALL cases where the app behaved correctly:
        //   - Valid row → saved successfully (CREATED)
        //   - Invalid row → rejected with an error message (REJECTED)
        // Test fails ONLY if something unexpected happened:
        //   - Valid row rejected with no error → unexpected
        //   - App crashed or showed no response → unexpected

        if (saveResult.saved) {
          // App created the record — confirm redirect away from new form
          expect(
            page.url(),
            `Row ${row._row_number} (${row.customer_name}): Expected record to be saved and URL to change`
          ).not.toContain('new-amc-customers')

        } else {
          // App rejected the record — confirm an error message was shown
          // (regardless of whether the data was pre-flight valid or not)
          expect(
            errorMessage,
            `Row ${row._row_number} (${row.customer_name}): Save failed but ERPNext showed no error message — unexpected behavior`
          ).not.toBeNull()
        }
      })
    }

    // After all row tests — write results to tracker
    test.afterAll(async () => {
      if (runResults.length > 0) {
        const fs      = require('fs')
        const path    = require('path')
        const XLSX    = require('xlsx')
        const trackerPath = path.join(__dirname, '../../AMC_Master_Tracker.xlsx')

        if (!fs.existsSync(trackerPath)) return

        const wb    = XLSX.readFile(trackerPath)
        const sheetName = 'Data-Driven Results'

        // Build sheet data
        const headers = [
          'Row', 'Customer Name', 'Outcome', 'Reason', 'Action Needed',
          'Pre-flight Issues', 'Error Field', 'Raw Error'
        ]
        const sheetData = [
          headers,
          ...runResults.map(r => [
            r.row_number, r.customer_name, r.outcome, r.reason,
            r.action_needed, r.pre_issues, r.error_field, r.raw_error
          ])
        ]

        // Replace or create the sheet
        if (wb.SheetNames.includes(sheetName)) {
          delete wb.Sheets[sheetName]
          wb.SheetNames.splice(wb.SheetNames.indexOf(sheetName), 1)
        }
        const ws = XLSX.utils.aoa_to_sheet(sheetData)
        XLSX.utils.book_append_sheet(wb, ws, sheetName)
        XLSX.writeFile(wb, trackerPath)
      }
    })
  })

═══════════════════════════════════════════════════════════════
STEP 5 — Update package.json scripts
═══════════════════════════════════════════════════════════════

Add to scripts (keep all existing scripts unchanged):
  "test:data-driven": "npx playwright test tests/data-driven/"

═══════════════════════════════════════════════════════════════
STEP 6 — Update .github/workflows/playwright.yml
═══════════════════════════════════════════════════════════════

In the mutation job, add after "Run Full Mutation Suite" step
and before "Update AMC Master Tracker":

  - name: Run Data-Driven Suite
    run: npm run test:data-driven -- --reporter=list,junit
    continue-on-error: true
    env:
      BASE_URL: ${{ secrets.NONPROD_BASE_URL }}
      ERPNEXT_USER: ${{ secrets.NONPROD_ERPNEXT_USER }}
      ERPNEXT_PASS: ${{ secrets.NONPROD_ERPNEXT_PASS }}
      ALLOW_MUTATION_TESTS: 'true'
      CI: true

Add artifact upload at end of mutation job:
  - name: Upload data-driven results
    uses: actions/upload-artifact@v4
    if: always()
    with:
      name: data-driven-results
      path: test-results/
      retention-days: 14

Show the full updated playwright.yml.

═══════════════════════════════════════════════════════════════
STEP 7 — Create tests/data-driven/README.md
═══════════════════════════════════════════════════════════════

Document in plain language:
1. What data-driven testing means in one paragraph
2. Boss workflow: "Edit customers.csv → commit → run pipeline → check tracker"
3. How to switch CSV to Excel (one word change in spec file)
4. How to run locally: npm run test:data-driven
5. How to read the Playwright report — what DDT-CUST-001 means
6. How to read the Data-Driven Results sheet — CREATED / REJECTED / SKIPPED / ERROR
7. What "Action Needed" column means — boss reads this to know what to fix
8. Why some Playwright tests show PASSED even when a customer was REJECTED
   (explain in plain English: the app correctly rejected bad data, that is expected behavior)

═══════════════════════════════════════════════════════════════
CONSTRAINTS
═══════════════════════════════════════════════════════════════

1. Do NOT modify tests/customers_test.js
2. Do NOT modify utils/helpers.js, globalSetup.js, globalTeardown.js
3. Do NOT modify playwright.config.js
4. Do NOT remove any existing npm scripts
5. customers.csv must have NO exp_result or exp_error_field columns
6. All file paths must be relative — no absolute paths anywhere
7. Every new file shown in full — no truncation, no "rest unchanged" shortcuts
8. The Data-Driven Results sheet must be human-readable to a non-technical person —
   no QA jargon, no test IDs in the reason or action_needed columns
9. After all steps, output a summary table:
   File path | Created/Modified/Unchanged | What changed
10. If you need to see the current content of playwright.yml or
    update_tracker.py before modifying, say so and ask me to paste it