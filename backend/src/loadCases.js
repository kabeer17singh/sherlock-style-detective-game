const fs = require('fs');
const path = require('path');

function loadCases() {
  const casesDir = path.join(__dirname, 'cases');
  const files = fs.readdirSync(casesDir).filter((f) => f.endsWith('.json'));
  const cases = {};

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(casesDir, file), 'utf-8'));
    cases[data.id] = data;
  }

  return cases;
}

module.exports = { loadCases };
