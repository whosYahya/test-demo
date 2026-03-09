// utils/globalTeardown.js
const fs = require('fs');
const path = require('path');

module.exports = async function () {
  const statePath = path.resolve(__dirname, 'authState.json');
  if (fs.existsSync(statePath)) {
    fs.unlinkSync(statePath);
    console.log('[globalTeardown] Auth state cleaned up.');
  }
};