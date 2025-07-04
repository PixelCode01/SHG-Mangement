// Production simulation test - what happens when pdf-parse fails
const fs = require('fs');

async function simulateProductionIssue() {
  console.log('🔍 SIMULATING PRODUCTION PDF EXTRACTION ISSUE');
  console.log('=' * 60);
  
  const buffer = fs.readFileSync('/home/pixel/Downloads/members.pdf');
  console.log('📄 PDF Buffer size:', buffer.length, 'bytes');
  
  // Simulate what happens in production when pdf-parse fails
  console.log('\n⚠️ SIMULATING PRODUCTION FALLBACK SCENARIO:');
  console.log('(When pdf-parse fails, code falls back to buffer methods)');
  
  // This is what production sees when pdf-parse fails:
  const fallbackText = buffer.toString('utf8');
  console.log('\n📋 Fallback text length:', fallbackText.length);
  console.log('📋 Starts with PDF binary:', fallbackText.startsWith('%PDF'));
  
  // Test our current extraction logic on this fallback data
  console.log('\n🧪 TESTING CURRENT V32 LOGIC ON FALLBACK DATA:');
  
  // Check if it goes to PDF binary extraction
  if (fallbackText.startsWith('%PDF')) {
    console.log('✅ Will use extractFromPDFBinary()');
    
    // Test PDF binary extraction patterns
    const textStringPattern = /\((.*?)\)/g;
    let matches = [];
    let match;
    
    while ((match = textStringPattern.exec(fallbackText)) !== null && matches.length < 20) {
      if (match[1] && match[1].length > 3) {
        matches.push(match[1]);
      }
    }
    
    console.log('📝 Text strings found in PDF binary:');
    matches.forEach((text, i) => {
      console.log(`  ${i + 1}: "${text}"`);
    });
    
    // Check for member name patterns
    const memberPatterns = [];
    for (const text of matches) {
      const nameAmountPattern = /^([A-Z][A-Z\s]+?)(\d+)$/;
      const nameMatch = text.match(nameAmountPattern);
      
      if (nameMatch && nameMatch[1] && nameMatch[2]) {
        memberPatterns.push({
          name: nameMatch[1].trim(),
          amount: nameMatch[2]
        });
      }
    }
    
    console.log('\n📊 Member patterns found:', memberPatterns.length);
    memberPatterns.slice(0, 10).forEach((member, i) => {
      console.log(`  ${i + 1}: ${member.name} - ₹${member.amount}`);
    });
    
    if (memberPatterns.length === 0) {
      console.log('\n❌ PROBLEM: No member patterns found in binary extraction!');
      console.log('🔧 This explains why production returns wrong data');
      
      // Let's see what's actually in the PDF binary that contains the member data
      console.log('\n🔍 SEARCHING FOR MEMBER DATA IN BINARY:');
      
      // Look for known member names in the binary
      const knownNames = ['SANTOSH MISHRA', 'ASHOK KUMAR', 'ANUP KUMAR'];
      for (const name of knownNames) {
        if (fallbackText.includes(name)) {
          console.log(`✅ Found "${name}" in binary data`);
          
          // Find the context around this name
          const index = fallbackText.indexOf(name);
          const context = fallbackText.substring(Math.max(0, index - 50), index + 100);
          console.log(`   Context: "${context.replace(/[^\x20-\x7E]/g, '·')}"`);
        } else {
          console.log(`❌ "${name}" NOT found in binary data`);
        }
      }
    }
    
  } else {
    console.log('❌ Does not start with %PDF - unexpected');
  }
}

simulateProductionIssue().catch(console.error);
