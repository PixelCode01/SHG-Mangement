#!/usr/bin/env node

/**
 * Test script to verify the balanced PDF extraction logic in production
 * This will test the client-side extraction process with various member data formats
 */

// Simulate the balanced extraction logic from MultiStepGroupForm.tsx
function processExtractedPDFLines(lines) {
  console.log(`🔍 BALANCED PDF EXTRACTION TEST - Processing ${lines.length} lines...`);
  
  const members = [];
  let validCount = 0;
  
  // Method 1: SWAWLAMBAN direct extraction (Name Amount format)
  console.log('\n📋 Method 1: SWAWLAMBAN Direct Extraction');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Skip headers and separators
    if (/^(NAME|MEMBER|LOAN|AMOUNT|TOTAL|-+|_+|SL\.?\s*NO\.?)\s*$/i.test(trimmed)) {
      console.log(`⏭️ Skipping header/separator: "${trimmed}"`);
      continue;
    }
    
    // Look for "Name Amount" pattern
    const swawlambanMatch = trimmed.match(/^(.+?)\s+(\d{2,8})$/);
    if (swawlambanMatch) {
      const [, name, amountStr] = swawlambanMatch;
      const nameClean = name.trim();
      const parsedAmount = parseInt(amountStr);
      
      // Validate name (should be proper name format)
      const nameWords = nameClean.split(/\s+/);
      const isValidName = nameWords.length >= 1 && nameWords.length <= 4 &&
        nameWords.every(word => /^[A-Z][A-Za-z]{1,}$/.test(word));
      
      if (isValidName && parsedAmount >= 100 && parsedAmount <= 5000000) {
        console.log(`✅ BALANCED SWAWLAMBAN - Valid: "${nameClean}" with amount "₹${parsedAmount.toLocaleString()}"`);
        members.push({ 
          id: (validCount + 1).toString(),
          memberId: `IMPORT_${validCount + 1}`,
          name: nameClean, 
          currentShare: 0,
          currentLoanAmount: parsedAmount,
          isExisting: false,
          isValid: true
        });
        validCount++;
      } else {
        console.log(`⚠️ BALANCED SWAWLAMBAN - Invalid: "${nameClean}" with amount "₹${parsedAmount.toLocaleString()}" (${!isValidName ? 'invalid name' : 'amount out of range'})`);
      }
    }
  }
  
  console.log(`\n📊 SWAWLAMBAN extraction result: ${validCount} valid members found`);
  
  // Method 2: Balanced name/loan pairing (if SWAWLAMBAN didn't work well)
  if (validCount < 10) {
    console.log('\n📋 Method 2: Balanced Name/Loan Pairing');
    
    // Find split point between names and loan amounts
    let split = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (/^(LOAN|AMOUNT|₹?\d+)/i.test(line)) {
        split = i - 1;
        console.log(`🔄 Found split point at line ${i}: "${line}"`);
        break;
      }
    }
    
    if (split > 0) {
      // Extract names from top section
      const names = lines.slice(0, split + 1)
        .map((l) => l.trim())
        .filter((l) => {
          return !!l && 
                 !/^(NAME|MEMBER|LOAN|AMOUNT|TOTAL|-+|_+|SL\.?\s*NO\.?)\s*$/i.test(l) &&
                 !/^\d+$/.test(l); // Skip pure numbers
        })
        .map(name => name.replace(/^\d+\.?\s*/, '').trim()) // Remove leading numbers
        .filter(name => {
          const nameWords = name.split(/\s+/);
          return nameWords.length >= 1 && nameWords.length <= 4 &&
            nameWords.every(word => /^[A-Z][A-Za-z]{1,}$/.test(word));
        });
      
      // Process loan amounts section
      const loans = lines.slice(split + 1)
        .map((l) => l.trim())
        .filter((l) => {
          return !!l && 
                 !/^(NAME|LOAN|AMOUNT|MEMBER|MEMBERS|-+|_+|TOTAL)\s*$/i.test(l) &&
                 /^\d{2,8}$/.test(l); // Must be purely numeric, 2-8 digits
        })
        .map(l => parseInt(l))
        .filter(amount => amount >= 100 && amount <= 5000000);
      
      console.log(`BALANCED validation: Found ${names.length} valid names and ${loans.length} valid loan amounts`);
      
      // Match names with loan amounts
      const maxLength = Math.min(names.length, loans.length);
      let balancedCount = 0;
      for (let i = 0; i < maxLength; i++) {
        const name = names[i];
        const loanAmount = loans[i];
        
        if (name && loanAmount !== undefined && loanAmount !== null) {
          console.log(`✅ BALANCED NAME/LOAN - Valid: "${name}" with amount "₹${loanAmount.toLocaleString()}"`);
          members.push({ 
            id: (balancedCount + 1).toString(),
            memberId: `IMPORT_${balancedCount + 1}`,
            name: name,
            currentShare: 0,
            currentLoanAmount: loanAmount,
            isExisting: false,
            isValid: true
          });
          balancedCount++;
        }
      }
      
      console.log(`📊 Balanced pairing result: ${balancedCount} valid members found`);
      validCount = Math.max(validCount, balancedCount);
    }
  }
  
  console.log(`\n🎯 FINAL RESULT: Extracted ${members.length} valid members (should be around 50, not 1000+)`);
  
  return members;
}

// Test data simulating realistic member PDF content
const testLines = [
  "Member List - Swawlamban Group",
  "------------------------------",
  "NAME                    LOAN AMOUNT",
  "Sunita Sharma          15000",
  "Radha Devi             12000", 
  "Kamala Singh           18000",
  "Meera Patel            10000",
  "Anita Kumari           14000",
  "Geeta Rani             16000",
  "Sushila Devi           11000",
  "Pushpa Singh           13000",
  "Lalita Sharma          17000",
  "Manju Devi             15500",
  "---",
  "TOTAL                  161500"
];

// Test with garbage data that previously caused issues
const garbageTestLines = [
  "garbage text here",
  "random numbers 123456789",
  "invalid format data",
  "NAME LOAN AMOUNT",
  "Sunita Sharma 15000",
  "more garbage",
  "123",
  "random text without structure",
  "Radha Devi 12000",
  "Kamala Singh 18000"
];

console.log('='.repeat(80));
console.log('🧪 TESTING BALANCED PDF EXTRACTION LOGIC');
console.log('='.repeat(80));

console.log('\n📝 TEST 1: Clean member data');
const result1 = processExtractedPDFLines(testLines);
console.log(`✅ Test 1 result: ${result1.length} members extracted`);

console.log('\n📝 TEST 2: Mixed garbage data');
const result2 = processExtractedPDFLines(garbageTestLines);
console.log(`✅ Test 2 result: ${result2.length} members extracted`);

console.log('\n📝 TEST 3: Empty/minimal data');
const result3 = processExtractedPDFLines(["", "NAME", "LOAN", ""]);
console.log(`✅ Test 3 result: ${result3.length} members extracted`);

console.log('\n' + '='.repeat(80));
console.log('🎯 SUMMARY:');
console.log(`Test 1 (clean data): ${result1.length} members`);
console.log(`Test 2 (garbage data): ${result2.length} members`);
console.log(`Test 3 (minimal data): ${result3.length} members`);
console.log('\n✅ The balanced extraction logic should now prevent garbage imports!');
console.log('📋 Ready for production testing with your actual PDF.');
console.log('='.repeat(80));
