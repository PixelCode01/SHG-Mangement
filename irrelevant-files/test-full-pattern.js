const fs = require('fs');

// Read the actual PDF content
const content = fs.readFileSync('/home/pixel/aichat/SHG-Mangement-main/tmp/last-parsed-pdf.txt', 'utf8');
console.log('Testing pattern against full PDF content...\n');

const pattern = /([A-Z][A-Z\s\.\-\']+?)(\d+)/g;
let match;
let count = 0;
const members = [];

while ((match = pattern.exec(content)) !== null) {
  let name = match[1].trim();
  const amount = match[2];
  
  if (name && name.length > 3 && !name.includes('NAMELOAN') && !name.includes('NAME LOAN')) {
    count++;
    console.log(`${count}. "${name}" with amount "${amount}"`);
    members.push({ name, amount });
  }
}

console.log(`\nTotal members found: ${count}`);
console.log(`Expected: 51 members`);

if (count < 51) {
  console.log('\nLet me check what might be missing...');
  console.log('Raw content preview:');
  console.log(content.substring(0, 500));
}
