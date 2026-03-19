'use strict';

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

function normalizeRow(row) {
  return {
    id: String(row['Test ID'] || row.id || '').trim(),
    module: String(row.Module || row.module || '').trim(),
    group: String(row['Test Group'] || row.Group || row.group || row.Module || '').trim(),
    title: String(row['Test Case Title'] || row.title || '').trim(),
  };
}

function loadDoctypeCases(filePath, idPattern) {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Case workbook not found: ${resolvedPath}`);
  }

  const workbook = XLSX.readFile(resolvedPath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    return [];
  }

  return XLSX.utils.sheet_to_json(sheet, { defval: '' })
    .map(normalizeRow)
    .filter((row) => row.id && row.title)
    .filter((row) => (idPattern ? idPattern.test(row.id) : true));
}

module.exports = {
  loadDoctypeCases,
};
