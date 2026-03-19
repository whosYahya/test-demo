'use strict';

const fs = require('fs');

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

const EDGE_PATHS = [
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];

function firstExisting(paths) {
  for (const candidate of paths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function resolveBrowserExecutable() {
  return (
    process.env.PW_BROWSER_PATH ||
    firstExisting(CHROME_PATHS) ||
    firstExisting(EDGE_PATHS) ||
    null
  );
}

function resolveLaunchOptions() {
  const executablePath = resolveBrowserExecutable();
  return executablePath ? { executablePath } : {};
}

function resolveProjectUse() {
  const executablePath = resolveBrowserExecutable();
  return executablePath ? { launchOptions: { executablePath } } : {};
}

module.exports = {
  resolveBrowserExecutable,
  resolveLaunchOptions,
  resolveProjectUse,
};
