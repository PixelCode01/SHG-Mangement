// Test script to debug first person import issue
const testPdfText = `
SANTOSH MISHRA 178604
ASHOK KUMAR KESHRI 0
ANUP KUMAR KESHRI 2470000
PRAMOD KUMAR KESHRI 0
MANOJ MISHRA 184168
VIKKI THAKUR 30624
`;

console.log('🔍 Testing name-number pattern extraction...');
console.log('=====================================\n');

// Current pattern from the API
const nameNumberPattern = /([A-Z][A-Z\s]{4,40}?)\s+(\d+)/g;

const matches = Array.from(testPdfText.matchAll(nameNumberPattern));
console.log(`📊 Found ${matches.length} name-number patterns\n`);

const members = [];

for (const match of matches) {
  if (!match[1] || !match[2]) continue;
  
  const rawName = match[1].trim();
  const amount = parseInt(match[2]);
  
  console.log(`🔍 Processing: "${rawName}" with amount ${amount}`);
  
  // Skip headers and invalid entries (current logic)
  if (rawName.includes('NAME') || rawName.includes('LOAN') || 
      rawName.includes('EMAIL') || rawName.includes('PHONE') ||
      rawName.includes('TOTAL') || rawName.includes('SUM') ||
      rawName.length < 5) {
    console.log(`⏭️ SKIPPED (header/invalid): ${rawName}`);
    continue;
  }
  
  // Convert to proper case
  const properName = rawName.toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  // Validate as reasonable member data
  const nameWords = properName.split(' ');
  if (nameWords.length >= 2 && nameWords.length <= 4 && 
      properName.length >= 5 && properName.length <= 50) {
    
    members.push({
      name: properName,
      loanAmount: amount
    });
    
    console.log(`✅ ACCEPTED: ${properName} - Loan: ₹${amount.toLocaleString()}`);
  } else {
    console.log(`⏭️ SKIPPED (invalid format): ${properName}`);
  }
}

console.log('\n📊 FINAL RESULTS:');
console.log('=================');
members.forEach((member, i) => {
  console.log(`${i + 1}. ${member.name} - ₹${member.loanAmount.toLocaleString()}`);
});

console.log(`\n🔍 ANALYSIS:`);
console.log(`- Total members extracted: ${members.length}`);
console.log(`- First member: ${members[0]?.name || 'NONE'}`);
console.log(`- Is SANTOSH MISHRA included? ${members.some(m => m.name.includes('SANTOSH')) ? 'YES' : 'NO'}`);
console.log(`- Is ASHOK KUMAR included? ${members.some(m => m.name.includes('ASHOK')) ? 'YES' : 'NO'}`);

// Test potential name length issues
console.log('\n🔍 NAME LENGTH CHECK:');
console.log('=====================');
const testNames = ['SANTOSH MISHRA', 'ASHOK KUMAR KESHRI', 'ANUP KUMAR KESHRI'];
testNames.forEach(name => {
  console.log(`"${name}" - Length: ${name.length} - Valid: ${name.length >= 5 ? 'YES' : 'NO'}`);
});
