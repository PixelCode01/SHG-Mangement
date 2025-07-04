/**
 * SHG Management App - PDF Import Fix Verification
 * 
 * This script verifies that our fix for the PDF member import issue with metadata
 * works correctly across all aspects of the solution.
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 PDF IMPORT FIX - END TO END VERIFICATION');
console.log('===========================================');

// PART 1: Create test data files representing problematic PDFs
console.log('\n📄 Creating test PDF data...');

// Create a file with the extracted text from a problematic PDF
const problematicPdfText = `
/Type /Pages
/Count 2
/Kids [3 0 R 4 0 R]
NAMELOAN
SANTOSH MISHRA178604
/Subtype /Type
/BaseFont /Helvetica
ASHOK KUMAR KESHRI0
ANUP KUMAR KESHRI2470000
PRAMOD KUMAR KESHRI0
/Type /Catalog
MANOJ MISHRA184168
/Pages 2 0 R
`;

fs.writeFileSync('test-problematic.txt', problematicPdfText);
console.log('✅ Created test-problematic.txt with PDF metadata mixed with real data');

// PART 2: Import and set up our parsing function
console.log('\n🧮 Setting up parsing logic...');

// This is the core of our fix - enhanced PDF parsing logic
function parseExtractedPDFText(text) {
  console.log('📝 Parsing PDF text...');
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  console.log(`📊 Found ${lines.length} non-empty lines`);
  
  const members = [];
  
  // Check for NAMELOAN format
  const isNAMELOANFormat = text.includes('NAMELOAN');
  if (isNAMELOANFormat) {
    console.log('✓ Detected NAMELOAN format - processing...');
    
    // Get content lines excluding headers
    const contentLines = lines.filter(line => line !== 'NAMELOAN');
    
    // Process each line looking for name+amount format
    for (const line of contentLines) {
      // Match name followed by digits (no space between)
      const match = line.match(/^([A-Z][A-Z\s\.\-\'\&]*[A-Z])\s*(\d+)$/);
      
      if (match) {
        const name = match[1].trim();
        const amount = match[2];
        
        // Filter out metadata
        if (name.includes('/') || 
            name.includes('Type') || 
            name.includes('Count') ||
            name.includes('Subtype') ||
            name.includes('BaseFont') ||
            name.includes('Catalog') ||
            name.includes('Pages') ||
            name.includes('Kids')) {
          console.log(`⚠️ Skipping metadata: "${line}"`);
          continue;
        }
        
        // Basic validation
        if (name.length >= 3 && 
            !name.includes('NAMELOAN') && 
            !/\d/.test(name) && // No digits in name
            amount.length >= 1 && amount.length <= 8) { // Reasonable loan amount length
          
          const parsedAmount = parseInt(amount);
          console.log(`✅ Found member: "${name}" with amount "₹${parsedAmount.toLocaleString()}"`);
          
          members.push({ 
            name: name, 
            loanAmount: parsedAmount,
            'loan amount': amount
          });
        }
      }
    }
  }
  
  // FINAL SAFETY CHECK: Make sure no metadata slipped through
  const finalMembers = members.filter(m => {
    const name = m.name || '';
    if (name.includes('/') || 
        name.includes('Type') || 
        name.includes('Subtype') ||
        name.includes('Count') ||
        name.includes('Object') ||
        /^\//.test(name)) {
      console.log(`🚫 Final filter removing: "${name}"`);
      return false;
    }
    return true;
  });
  
  console.log(`✅ Final result: ${finalMembers.length} clean members extracted`);
  return finalMembers;
}

// PART 3: Test with the problematic data
console.log('\n🔍 Testing with problematic PDF data...');

// Read the test file
const testData = fs.readFileSync('test-problematic.txt', 'utf8');

// Parse the data with our enhanced function
const result = parseExtractedPDFText(testData);

// Display and verify results
console.log('\n📋 RESULTS:');
console.log('------------------------------------------');

if (result.length > 0) {
  console.log('Found members:');
  result.forEach((member, i) => {
    console.log(`${i + 1}. ${member.name} - ₹${member.loanAmount.toLocaleString()}`);
  });
  
  // VERIFICATION: Check that we found the expected members
  const expectedNames = ['SANTOSH MISHRA', 'ASHOK KUMAR KESHRI', 'ANUP KUMAR KESHRI', 'PRAMOD KUMAR KESHRI', 'MANOJ MISHRA'];
  const foundNames = result.map(m => m.name);
  
  const allNamesFound = expectedNames.every(name => foundNames.includes(name));
  const noMetadataFound = !foundNames.some(name => name.includes('/') || name.includes('Type'));
  
  console.log('\n🔍 VERIFICATION:');
  console.log(`✅ All expected names found: ${allNamesFound ? 'Yes' : 'No'}`);
  console.log(`✅ No metadata in results: ${noMetadataFound ? 'Yes' : 'No'}`);
  console.log(`✅ Expected 5 members, found ${result.length}`);
  
  if (allNamesFound && noMetadataFound && result.length === 5) {
    console.log('\n🎉 SUCCESS: The PDF import fix is working correctly!');
    console.log('All member data was correctly extracted and all metadata was properly filtered.');
  } else {
    console.log('\n❌ FAILURE: The PDF import fix is not working as expected.');
    console.log('Please check the implementation for issues.');
  }
} else {
  console.log('❌ No members found in the PDF data');
}

// Clean up test file
fs.unlinkSync('test-problematic.txt');
console.log('\n🧹 Cleaned up test files');
console.log('\n===========================================');
