const fs = require('fs');

// Read the actual PDF content
const content = fs.readFileSync('/home/pixel/aichat/SHG-Mangement-main/tmp/last-parsed-pdf.txt', 'utf8');
console.log('Testing line-by-line approach...\n');

// Process line by line for SWAWLAMBAN format
const lines = content.split('\n')
  .map(line => line.trim())
  .filter(line => line && line !== 'NAMELOAN' && line !== 'AI' && line !== 'NAME LOAN');

console.log(`Processing ${lines.length} lines for SWAWLAMBAN format`);

const members = [];
for (const line of lines) {
  // Try to match: letters/spaces followed by digits at the end
  const match = line.match(/^(.+?)(\d+)$/);
  
  if (match) {
    const name = match[1].trim();
    const amount = match[2];
    
    // Skip if name is too short or contains header text
    if (name.length >= 3 && !name.includes('NAMELOAN') && !name.includes('NAME LOAN')) {
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

// Show first 10 members
console.log('\nFirst 10 members:');
members.slice(0, 10).forEach((member, index) => {
  console.log(`${index + 1}. ${member.name} - ${member['loan amount']}`);
});
