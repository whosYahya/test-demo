function uniqueValue(prefix = 'AUTO') {
  const ts = Date.now();
  const rnd = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${ts}-${rnd}`;
}

function uniquePAN() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const pick = () => letters[Math.floor(Math.random() * letters.length)];
  const head = `${pick()}${pick()}${pick()}${pick()}${pick()}`;
  const digits = String(Date.now() % 10000).padStart(4, '0');
  return `${head}${digits}${pick()}`;
}

module.exports = {
  uniquePAN,
  uniqueValue,
};
