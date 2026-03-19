'use strict';

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { loadCSV, loadExcel } = require('../../utils/dataLoader');

function loadRows(filename, sheetName) {
  const ext = path.extname(filename).toLowerCase();
  const rawRows =
    ext === '.csv' ? loadCSV(filename) :
    ext === '.xlsx' || ext === '.xls' ? loadExcel(filename, sheetName) :
    [];

  return rawRows.map((row, index) => ({
    ...row,
    _row_number: index + 1,
  }));
}

function parseDateParts(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/);
  if (isoMatch) {
    return { year: isoMatch[1], month: isoMatch[2], day: isoMatch[3] };
  }

  const dmyMatch = raw.match(/^(\d{2})-(\d{2})-(\d{4})(?:[ T].*)?$/);
  if (dmyMatch) {
    return { year: dmyMatch[3], month: dmyMatch[2], day: dmyMatch[1] };
  }

  return null;
}

function formatDateForERP(value, target = 'ymd') {
  const parts = parseDateParts(value);
  if (!parts) {
    return String(value || '').trim();
  }

  if (target === 'dmy') {
    return `${parts.day}-${parts.month}-${parts.year}`;
  }

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function normalizeBoolean(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'y';
}

async function captureBrowserError(page) {
  const locator = page.locator(
    '.msgprint:visible, .frappe-toast-message:visible, .alert-danger:visible, .modal.show .modal-body:visible, .modal.show .msgprint:visible'
  ).first();
  const message = await locator.textContent({ timeout: 4000 }).catch(() => null);
  return message ? message.trim().replace(/\s+/g, ' ').slice(0, 300) : null;
}

function toTrackerRows(results, keys) {
  return results.map((result) => keys.map((key) => result[key] ?? ''));
}

function writeTrackerSheet(sheetName, headers, results) {
  if (!results.length) {
    return;
  }

  const trackerPath = path.join(__dirname, '../../AMC_Master_Tracker.xlsx');
  if (!fs.existsSync(trackerPath)) {
    return;
  }

  try {
    const workbook = XLSX.readFile(trackerPath);
    const rows = [headers, ...toTrackerRows(results, headers)];

    if (workbook.SheetNames.includes(sheetName)) {
      delete workbook.Sheets[sheetName];
      workbook.SheetNames.splice(workbook.SheetNames.indexOf(sheetName), 1);
    }

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, trackerPath);
  } catch (error) {
    console.warn(`[ddt tracker] Could not update ${sheetName}: ${error.message}`);
  }
}

module.exports = {
  loadRows,
  formatDateForERP,
  normalizeBoolean,
  captureBrowserError,
  writeTrackerSheet,
};
