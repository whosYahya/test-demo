const fs = require('fs');

function loadLeaveCases(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t');
      return {
        id: (parts[0] || '').trim(),
        module: (parts[1] || '').trim(),
        group: (parts[2] || '').trim(),
        title: (parts[3] || '').trim(),
      };
    })
    .filter((row) => /^LEA-\d{3}$/.test(row.id));
}

module.exports = {
  loadLeaveCases,
};
