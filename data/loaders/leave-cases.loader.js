const { loadDoctypeCases } = require('./doctype-cases.loader');

function loadLeaveCases(filePath) {
  return loadDoctypeCases(filePath, /^LEA-\d{3}$/);
}

module.exports = {
  loadLeaveCases,
};
