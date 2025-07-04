// Test the exact web interface flow for universal parser
const fs = require('fs');

// Simulate the web interface processing logic
function simulateWebInterfaceProcessing(apiResponse) {
  console.log('=== Simulating Web Interface Processing ===\n');
  
  console.log('🔍 API Response structure:');
  console.log(`  - success: ${apiResponse.success}`);
  console.log(`  - members array: ${Array.isArray(apiResponse.members)} (${apiResponse.members?.length} items)`);
  console.log(`  - statistics: ${!!apiResponse.statistics}`);
  
  if (apiResponse.statistics) {
    console.log('\n📊 Statistics:');
    console.log(`  - Total members: ${apiResponse.statistics.totalMembers}`);
    console.log(`  - Members with loans: ${apiResponse.statistics.membersWithLoans}`);
    console.log(`  - Total loan amount: ₹${apiResponse.statistics.totalLoanAmount.toLocaleString()}`);
  }
  
  // Simulate the exact component processing logic
  if (apiResponse.members && Array.isArray(apiResponse.members)) {
    console.log('\n🔍 Processing members using component logic...');
    
    const processedMembers = apiResponse.members.map((member, index) => {
      const name = member.name || '';
      const rawLoanAmount = member['loan amount']; // Note: space in key name
      const parsedLoanAmount = parseInt(rawLoanAmount || '0');
      const email = member.email || '';
      const phone = member.phone || '';
      
      if (index < 5) {
        console.log(`  Member ${index + 1}: "${name}" - Raw: "${rawLoanAmount}" -> Parsed: ${parsedLoanAmount}`);
      }
      
      return {
        name: name,
        loanAmount: parsedLoanAmount,
        email: email,
        phone: phone,
        memberNumber: '',
        accountNumber: '',
        personalContribution: 0,
        monthlyContribution: 0,
        joinedAt: new Date(),
      };
    });
    
    console.log('\n📊 Final processed results:');
    console.log(`  - Total members processed: ${processedMembers.length}`);
    
    const membersWithLoans = processedMembers.filter(m => m.loanAmount > 0).length;
    const totalLoanAmount = processedMembers.reduce((sum, m) => sum + m.loanAmount, 0);
    
    console.log(`  - Members with loans: ${membersWithLoans}`);
    console.log(`  - Total loan amount: ₹${totalLoanAmount.toLocaleString()}`);
    
    console.log('\n👥 Sample processed members:');
    processedMembers.slice(0, 5).forEach((member, i) => {
      console.log(`  ${i + 1}. ${member.name} - ₹${member.loanAmount.toLocaleString()}`);
    });
    
    // Validation
    console.log('\n🎯 Validation:');
    console.log(`  Expected: 51 members, 31 with loans, ₹6,993,284 total`);
    console.log(`  Actual: ${processedMembers.length} members, ${membersWithLoans} with loans, ₹${totalLoanAmount.toLocaleString()} total`);
    console.log(`  Match: ${processedMembers.length === 51 && membersWithLoans === 31 && totalLoanAmount === 6993284 ? '✅ PERFECT' : '❌ MISMATCH'}`);
    
    return processedMembers;
  } else {
    console.log('❌ No members array found in API response');
    return [];
  }
}

// Test with actual API call
async function testWithRealAPI() {
  console.log('=== Testing with Real API Call ===\n');
  
  try {
    const FormData = await import('form-data');
    const fetch = await import('node-fetch');
    
    const testFile = '/home/pixel/Downloads/SWAWLAMBAN till may 2025.pdf';
    
    if (!fs.existsSync(testFile)) {
      console.log('❌ Test file not found');
      return;
    }
    
    const formData = new FormData.default();
    formData.append('file', fs.createReadStream(testFile));
    
    console.log('🚀 Making API call to universal parser...');
    const response = await fetch.default('http://localhost:3003/api/pdf-parse-universal', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ API Error (${response.status}): ${errorText.substring(0, 200)}`);
      return;
    }
    
    const apiResponse = await response.json();
    console.log('✅ API call successful');
    
    // Process the response exactly like the web interface
    const processedMembers = simulateWebInterfaceProcessing(apiResponse);
    
    console.log(`\n🎯 Final Result: ${processedMembers.length} members processed`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testWithRealAPI();
