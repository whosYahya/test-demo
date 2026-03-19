# Customer Data File Guide

Send your customer list using these columns only:

- `customer_name`: Customer name. This is required.
- `gst`: GST number. Optional.
- `pan`: PAN number. Optional.
- `customer_type`: Use `Company`, `Individual`, or `Partnership`. Optional.
- `branch_name`: Branch name. Optional.
- `branch_address`: Branch address. Optional.
- `contact_name`: Contact person name. Optional.
- `contact_mobile`: Contact mobile number. Optional.

Required vs optional:

- Required: `customer_name`
- Optional: all other columns

What happens if a row has bad data:

- The system will still try that row in ERPNext.
- If ERPNext accepts it, the outcome will show as `CREATED`.
- If ERPNext rejects it, the outcome will show as `REJECTED` with the reason.
- If the customer name is missing, the row will show as `SKIPPED`.

How to read the `Data-Driven Results` sheet in the tracker:

- `Outcome` tells you whether ERPNext created the record, rejected it, skipped it, or hit an unexpected error.
- `Reason` explains what happened in plain language.
- `Action Needed` tells you what to fix before resending the row.
- `Pre-flight Issues` shows format problems found before the browser run started.

You do not need to add any extra columns - just send your customer list.
