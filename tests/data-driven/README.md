# Data-Driven Testing

This folder now has two kinds of data-driven coverage:

- `customers_ddt.spec.js` uses business input rows from `fixtures/testData/customers.csv` or `.xlsx`.
- `attendance_ddt.spec.js`, `contract_ddt.spec.js`, `expenses_ddt.spec.js`, `leaves_ddt.spec.js`, `service_calls_ddt.spec.js`, and `vendor_ddt.spec.js` reuse the doctype scenario suites through the existing case workbooks in `fixtures/testData/cases_doctype/`.

For customers, data-driven testing means the same Playwright flow is reused for many customer rows from a file instead of hard-coding each customer inside the test. This lets the team take a boss-provided customer list, run it through ERPNext, and get a business-friendly result for every row.

Customer workflow:

1. Edit `customers.csv`
2. Commit the file
3. Run the pipeline
4. Check the tracker

To switch the customer suite from CSV to Excel, change one word in the spec file:

- In `tests/data-driven/customers_ddt.spec.js`, replace `customers.csv` with `customers.xlsx`

To run locally:

```bash
npm run test:data-driven
```

Do we need a new CSV/XLSX for the doctype suites?

- No new file is required just to run those suites from `tests/data-driven`.
- Those modules already have case workbooks:
- `fixtures/testData/cases_doctype/attendance_cases.xlsx`
- `fixtures/testData/cases_doctype/contract_cases.xlsx`
- `fixtures/testData/cases_doctype/expenses_cases.xlsx`
- `fixtures/testData/cases_doctype/leaves_cases.xlsx`
- `fixtures/testData/cases_doctype/service_call_cases.xlsx`
- `fixtures/testData/cases_doctype/vendor_cases.xlsx`
- You only need a new CSV/XLSX if you want row-level business input like the customer import flow, where each spreadsheet row becomes test data.

How to read the customer Playwright report:

- `DDT-CUST-001` means customer data row 1
- `DDT-CUST-002` means customer data row 2
- The rest of the test title shows the customer name and customer type for quick identification

How to read the `Data-Driven Results` sheet:

- `CREATED`: ERPNext created the customer successfully
- `REJECTED`: ERPNext refused the row and gave a reason
- `SKIPPED`: the row was not sent because the customer name was missing
- `ERROR`: the save failed in an unexpected way and no usable ERPNext message was captured

What the `Action Needed` column means:

- This tells the boss what to fix in the source row before sending it again
- It is written in plain language so it can be read without technical knowledge

Why some Playwright tests show `PASSED` even when a customer was `REJECTED`:

- A rejected customer can still be a correct test result
- If the row had bad data and ERPNext correctly blocked it with an error message, the automation did its job and the test is considered passed
- The tracker still shows `REJECTED` so the business team knows that row needs correction
