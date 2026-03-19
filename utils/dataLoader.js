'use strict';

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const DATA_DIR = path.join(__dirname, '../fixtures/testData');
const GST_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/;
const PAN_REGEX = /^[A-Z]{5}\d{4}[A-Z]{1}$/;
const MOBILE_REGEX = /^\d{10}$/;
const VALID_CUSTOMER_TYPES = ['Company', 'Individual', 'Partnership'];

function resolveDataPath(filename) {
  return path.join(DATA_DIR, filename);
}

function parseCSVLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function loadCSV(filename) {
  const fullPath = resolveDataPath(filename);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`CSV file not found: ${fullPath}`);
  }

  const raw = fs.readFileSync(fullPath, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length === 0) {
    return [];
  }

  const headers = parseCSVLine(lines[0]).map((header) => header.trim());
  const rows = [];

  for (const line of lines.slice(1)) {
    const values = parseCSVLine(line).map((value) => value.trim());
    if (!values.some((value) => value !== '')) {
      continue;
    }

    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    rows.push(row);
  }

  return rows;
}

function loadExcel(filename, sheetName) {
  const fullPath = resolveDataPath(filename);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Excel file not found: ${fullPath}`);
  }

  const workbook = XLSX.readFile(fullPath);
  const targetSheet = sheetName || workbook.SheetNames[0];
  if (!targetSheet || !workbook.Sheets[targetSheet]) {
    throw new Error(`Sheet not found in ${fullPath}: ${sheetName}`);
  }

  return XLSX.utils.sheet_to_json(workbook.Sheets[targetSheet], { defval: '' }).map((row) => {
    const trimmed = {};
    for (const [key, value] of Object.entries(row)) {
      trimmed[typeof key === 'string' ? key.trim() : key] = typeof value === 'string' ? value.trim() : value;
    }
    return trimmed;
  });
}

function validateAndAnnotateRows(rows) {
  return rows.map((row, index) => {
    const annotated = { ...row };
    const issues = [];

    const customerName = String(annotated.customer_name || '').trim();
    const gst = String(annotated.gst || '').trim().toUpperCase();
    const pan = String(annotated.pan || '').trim().toUpperCase();
    const customerType = String(annotated.customer_type || '').trim();
    const branchName = String(annotated.branch_name || '').trim();
    const branchAddress = String(annotated.branch_address || '').trim();
    const contactName = String(annotated.contact_name || '').trim();
    const contactMobile = String(annotated.contact_mobile || '').trim();

    annotated.customer_name = customerName;
    annotated.gst = gst;
    annotated.pan = pan;
    annotated.customer_type = customerType;
    annotated.branch_name = branchName;
    annotated.branch_address = branchAddress;
    annotated.contact_name = contactName;
    annotated.contact_mobile = contactMobile;

    if (!customerName) {
      issues.push('Customer Name is required');
    }

    if (gst) {
      if (gst.length !== 15) {
        issues.push(`GST must be exactly 15 characters (got ${gst.length})`);
      }
      if (!GST_REGEX.test(gst)) {
        issues.push('GST format is invalid (expected: 2-digit state + PAN + 1 digit + Z + checksum)');
      }
    }

    if (pan) {
      if (pan.length !== 10) {
        issues.push(`PAN must be exactly 10 characters (got ${pan.length})`);
      }
      if (!PAN_REGEX.test(pan)) {
        issues.push('PAN format is invalid (expected: 5 letters + 4 digits + 1 letter)');
      }
    }

    if (customerType && !VALID_CUSTOMER_TYPES.includes(customerType)) {
      issues.push(`Customer Type must be Company, Individual, or Partnership (got: ${customerType})`);
    }

    if (contactMobile && !MOBILE_REGEX.test(contactMobile)) {
      issues.push('Contact Mobile must be exactly 10 digits');
    }

    annotated._row_number = index + 1;
    annotated._pre_issues = issues;
    annotated._pre_valid = issues.length === 0;

    return annotated;
  });
}

function loadTestData(filename, sheetName) {
  const extension = path.extname(filename).toLowerCase();
  let rows;

  if (extension === '.csv') {
    rows = loadCSV(filename);
  } else if (extension === '.xlsx' || extension === '.xls') {
    rows = loadExcel(filename, sheetName);
  } else {
    throw new Error(`Unsupported test data extension: ${extension || '(none)'}`);
  }

  return validateAndAnnotateRows(rows);
}

function deriveActionNeeded(errorField) {
  if (errorField === 'gst') {
    return 'Correct the GST number for this customer';
  }
  if (errorField === 'pan') {
    return 'Correct the PAN number for this customer';
  }
  if (errorField === 'customer_name') {
    return 'Add or fix the customer name';
  }
  return 'Review the highlighted field and correct the value';
}

function buildRowResult(row, browserOutcome) {
  const preIssues = Array.isArray(row._pre_issues) ? row._pre_issues : [];
  const errorMessage = browserOutcome.errorMessage || '';
  const errorField = browserOutcome.errorField || '';

  if (!row._pre_valid && !String(row.customer_name || '').trim()) {
    return {
      row_number: row._row_number,
      customer_name: row.customer_name || '(empty)',
      outcome: 'REJECTED',
      reason: preIssues[0] || 'Customer Name is required',
      action_needed: 'Add the customer name',
      pre_issues: preIssues.join('; '),
      error_field: errorField,
      raw_error: errorMessage,
    };
  }

  if (browserOutcome.saved) {
    return {
      row_number: row._row_number,
      customer_name: row.customer_name || '(empty)',
      outcome: 'CREATED',
      reason: 'Record created in ERPNext successfully',
      action_needed: 'None',
      pre_issues: preIssues.join('; '),
      error_field: errorField,
      raw_error: errorMessage,
    };
  }

  if (errorMessage) {
    return {
      row_number: row._row_number,
      customer_name: row.customer_name || '(empty)',
      outcome: 'REJECTED',
      reason: errorMessage.slice(0, 200),
      action_needed: deriveActionNeeded(errorField),
      pre_issues: preIssues.join('; '),
      error_field: errorField,
      raw_error: errorMessage,
    };
  }

  return {
    row_number: row._row_number,
    customer_name: row.customer_name || '(empty)',
    outcome: 'ERROR',
    reason: 'Save failed but no error message was captured',
    action_needed: 'Check the ERPNext error log - unexpected failure',
    pre_issues: preIssues.join('; '),
    error_field: errorField,
    raw_error: errorMessage,
  };
}

module.exports = {
  loadCSV,
  loadExcel,
  loadTestData,
  buildRowResult,
};
