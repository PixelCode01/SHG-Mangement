const fs = require('fs');

// Read the actual PDF content
const content = fs.readFileSync('/home/pixel/aichat/SHG-Mangement-main/tmp/last-parsed-pdf.txt', 'utf8');
console.log('Testing improved filtering approach...\n');

// Process line by line for SWAWLAMBAN format
const lines = content.split('\n')
  .map(line => line.trim())
  .filter(line => line && line !== 'NAMELOAN' && line !== 'AI' && line !== 'NAME LOAN');

console.log(`Processing ${lines.length} lines for SWAWLAMBAN format`);

const members = [];
for (const line of lines) {
  // Try to match: letters/spaces followed by a reasonable loan amount (1-7 digits)
  const match = line.match(/^([A-Z][A-Z\s\.\-\']*[A-Z])(\d{1,7})$/);
  
  if (match) {
    const name = match[1].trim();
    const amount = match[2];
    
    // Skip if name is too short, contains numbers, or contains header text
    if (name.length >= 3 && 
        !name.includes('NAMELOAN') && 
        !name.includes('NAME LOAN') &&
        !/\d/.test(name) && // No digits in name
        !name.includes('MAY') &&
        !name.includes('MONTH') &&
        amount.length <= 7) { // Reasonable loan amount length
      console.log(`Found: "${name}" with amount "${amount}"`);
      members.push({ 
        name: name, 
        'loan amount': amount 
      });
    }
  }
}

console.log(`\nTotal members found: ${members.length}`);
console.log(`Expected: 51 members`);

// Show all members if count is reasonable
if (members.length <= 60) {
  console.log('\nAll members found:');
  members.forEach((member, index) => {
    console.log(`${index + 1}. ${member.name} - ${member['loan amount']}`);
  });
}
