// Test the updated SWAWLAMBAN pattern
const testText = `
NAMELOAN
SANTOSH MISHRA178604
ASHOK KUMAR KESHRI0
ANUP KUMAR KESHRI2470000
PRAMOD KUMAR KESHRI0
MANOJ MISHRA184168
VIKKI THAKUR30624
SUNIL KUMAR MAHTO0
PAWAN KUMAR0
SUDAMA PRASAD45210
VIJAY KESHRI117984
UDAY PRASAD KESHRI350108
`;

console.log("Testing SWAWLAMBAN pattern extraction...");

const swawlambanPattern = /([A-Z][A-Z\s\.\-\']+?)(\d+)/g;
const members = [];
let match;

while ((match = swawlambanPattern.exec(testText)) !== null) {
  let name = match[1].trim();
  name = name.replace(/^NAME\s+LOAN\s+/i, ''); // Remove "NAME LOAN" prefix if present
  
  const amountStr = match[2]; // Amount is already clean digits
  
  // Basic validation to prevent false positives
  if (name && name.length > 3 && amountStr && amountStr.length >= 1) {
    // Filter out "NAMELOAN" header that might get picked up
    if (!name.includes('NAMELOAN') && !name.includes('NAME LOAN')) {
      console.log(`Found: "${name}" with amount "${amountStr}"`);
      members.push({ 
        name: name, 
        'loan amount': amountStr 
      });
    }
  }
}

console.log(`\nTotal members found: ${members.length}`);
console.log("Members:", members);
