//
// COMPREHENSIVE PDF MEMBER IMPORT TEST
// Tests all PDF formats and edge cases for the SHG Management app
//

console.log('🧪 COMPREHENSIVE PDF MEMBER IMPORT TEST');
console.log('=======================================');

// Mock the different PDF formats we need to handle
const testCases = [
  {
    name: "NAMELOAN concatenated format",
    content: 
`NAMELOAN
SANTOSH MISHRA178604
ASHOK KUMAR KESHRI0
ANUP KUMAR KESHRI2470000
PRAMOD KUMAR KESHRI0
MANOJ MISHRA184168`,
    expectedMembers: 5
  },
  {
    name: "NAME and LOAN separated sections",
    content:
`NAME
SANTOSH MISHRA
ASHOK KUMAR KESHRI
ANUP KUMAR KESHRI
PRAMOD KUMAR KESHRI
MANOJ MISHRA
LOAN
178604
0
2470000
0
184168`,
    expectedMembers: 5
  },
  {
    name: "PDF with metadata that needs filtering",
    content:
`/Count
/Subtype /Type
NAME
SANTOSH MISHRA
ASHOK KUMAR
LOAN
178604
45000`,
    expectedMembers: 2
  },
  {
    name: "Tabular format with rows",
    content:
`SL  NAME                AMOUNT      EMAIL         PHONE
1   SANTOSH MISHRA      178604      -             -
2   ASHOK KUMAR         45000       -             -`,
    expectedMembers: 2
  }
];

// Mock the processExtractedPDFLines function based on our enhanced implementation
function processExtractedPDFLines(lines) {
  console.log(`Processing ${lines.length} lines of text`);
  
  const members = [];
  const fullText = lines.join('\n');
  
  // --- METHOD 1: NAMELOAN format ---
  const isSwawlambanPDF = /NAMELOAN/i.test(fullText);
  if (isSwawlambanPDF) {
    console.log("✓ NAMELOAN header detected - using Method 1");
    
    // Clean and filter the lines
    const contentLines = lines
      .map(line => line.trim())
      .filter(line => line && line !== 'NAMELOAN' && line !== 'AI');
    
    for (const line of contentLines) {
      // Pattern for concatenated name+amount
      const match = line.match(/^([A-Z][A-Z\s\.\-\'\&]*[A-Z])\s*(\d+)$/);
      
      if (match) {
        const name = match[1].trim();
        const amount = match[2];
        
        // Basic validation
        if (name.length >= 3 && 
            !name.includes('NAMELOAN') && 
            !/\d/.test(name) && // No digits in name
            !name.includes('/') && // No PDF metadata
            amount.length >= 1 && amount.length <= 8) {
          
          const parsedAmount = parseInt(amount);
          console.log(`  ✓ Method 1: "${name}" with amount "₹${parsedAmount.toLocaleString()}"`);
          
          members.push({ 
            name: name, 
            'loan amount': amount,
            loanAmount: parsedAmount
          });
        }
      }
    }
    
    if (members.length > 0) {
      return members;
    }
  }
  
  // --- METHOD 2: NAME and LOAN separate sections ---
  // Find headers with flexible patterns
  const nameHeaderPatterns = [/^NAME\s*$/i, /^MEMBER\s*NAME\s*$/i, /^MEMBERS\s*$/i];
  const loanHeaderPatterns = [/^LOAN\s*$/i, /^AMOUNT\s*$/i, /^LOAN\s*AMOUNT\s*$/i];
  
  let nameHeaderIndex = -1;
  let loanHeaderIndex = -1;
  
  // Find name header
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (nameHeaderPatterns.some(pattern => pattern.test(line))) {
      nameHeaderIndex = i;
      break;
    }
  }
  
  // Find loan header after name header
  if (nameHeaderIndex >= 0) {
    for (let i = nameHeaderIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (loanHeaderPatterns.some(pattern => pattern.test(line))) {
        loanHeaderIndex = i;
        break;
      }
    }
  }
  
  if (nameHeaderIndex >= 0 && loanHeaderIndex > nameHeaderIndex) {
    console.log("✓ NAME/LOAN sections detected - using Method 2");
    
    // Extract names section
    const names = lines.slice(nameHeaderIndex + 1, loanHeaderIndex)
      .map(l => l.trim())
      .filter(l => l && 
             !/^(NAME|LOAN|AMOUNT|MEMBER|MEMBERS)\s*$/i.test(l) &&
             l.length > 2 &&
             !l.includes('/'));
    
    // Extract amounts section
    const amounts = lines.slice(loanHeaderIndex + 1)
      .map(l => l.trim())
      .filter(l => l && 
             !/^(NAME|LOAN|AMOUNT|MEMBER|MEMBERS)\s*$/i.test(l) &&
             /\d/.test(l));
    
    // Match names with loan amounts
    const maxLength = Math.min(names.length, amounts.length);
    for (let i = 0; i < maxLength; i++) {
      const name = names[i];
      const amount = amounts[i];
      
      // Parse the amount and validate
      const parsedAmount = parseInt(amount.replace(/[^\d]/g, '')) || 0;
      
      console.log(`  ✓ Method 2: "${name}" with amount "₹${parsedAmount.toLocaleString()}"`);
      
      members.push({ 
        name, 
        'loan amount': amount,
        loanAmount: parsedAmount
      });
    }
    
    if (members.length > 0) {
      return members;
    }
  }
  
  // --- METHOD 3: Tabular format ---
  const tableRows = fullText.match(/\d+\s+([A-Z][A-Z\s\.\-\'\&]*[A-Z])\s+(\d[\d,\.]*)/g);
  if (tableRows && tableRows.length > 0) {
    console.log(`✓ Detected ${tableRows.length} table rows - using Method 3`);
    
    for (const row of tableRows) {
      // Extract name and amount from the row
      const match = row.match(/\d+\s+([A-Z][A-Z\s\.\-\'\&]*[A-Z])\s+(\d[\d,\.]*)/);
      
      if (match) {
        const name = match[1].trim();
        const amount = match[2].trim();
        
        if (name && amount && name.length > 2 && !name.includes('/')) {
          const parsedAmount = parseInt(amount.replace(/[^\d]/g, '')) || 0;
          
          console.log(`  ✓ Method 3: "${name}" with amount "₹${parsedAmount.toLocaleString()}"`);
          
          members.push({ 
            name, 
            'loan amount': amount,
            loanAmount: parsedAmount
          });
        }
      }
    }
    
    if (members.length > 0) {
      return members;
    }
  }
  
  console.log("⚠️ No standard format detected, returning empty results");
  return members;
}

// Run the tests
console.log('\n🧪 RUNNING TESTS\n');
let testsPassed = 0;

testCases.forEach((test, index) => {
  console.log(`\n[TEST CASE ${index + 1}]: ${test.name}`);
  console.log('-'.repeat(50));
  
  const lines = test.content.split('\n');
  const result = processExtractedPDFLines(lines);
  
  console.log(`\nRESULTS: Found ${result.length} members`);
  
  // Display found members
  result.forEach((member, i) => {
    console.log(`  ${i + 1}. ${member.name} - ${member.loanAmount}`);
  });
  
  // Validate test results
  if (result.length === test.expectedMembers) {
    console.log(`✅ TEST PASSED! Expected ${test.expectedMembers} members, found ${result.length}.`);
    testsPassed++;
  } else {
    console.log(`❌ TEST FAILED! Expected ${test.expectedMembers} members, found ${result.length}.`);
  }
  
  // Verify no metadata in results
  const hasMetadata = result.some(m => m.name.includes('/') || 
                                   m.name.includes('Type') || 
                                   m.name.includes('Subtype') || 
                                   m.name.includes('Count'));
  
  if (hasMetadata) {
    console.log('❌ TEST FAILED! Results still contain PDF metadata.');
  } else {
    console.log('✓ No metadata found in results.');
  }
});

// Final summary
console.log('\n=======================================');
console.log(`FINAL SUMMARY: ${testsPassed}/${testCases.length} tests passed`);

if (testsPassed === testCases.length) {
  console.log('🎉 ALL TESTS PASSED! PDF parsing is working correctly.');
} else {
  console.log('⚠️ Some tests failed. Please review the implementation.');
}
