// Simple test to verify the Group Details section rendering logic
function testGroupDetailsRendering() {
  // Test case 1: Group with both bank details
  const groupWithFullBankDetails = {
    groupInfo: {
      bankAccountNumber: '1234567890123456',
      bankName: 'State Bank of India'
    }
  };
  
  // Test case 2: Group with only bank account number
  const groupWithAccountOnly = {
    groupInfo: {
      bankAccountNumber: '1234567890123456',
      bankName: null
    }
  };
  
  // Test case 3: Group with only bank name
  const groupWithNameOnly = {
    groupInfo: {
      bankAccountNumber: null,
      bankName: 'State Bank of India'
    }
  };
  
  // Test case 4: Group with no bank details
  const groupWithNoDetails = {
    groupInfo: {
      bankAccountNumber: null,
      bankName: null
    }
  };
  
  console.log('Test Results:');
  console.log('1. Full bank details - Show section:', !!(groupWithFullBankDetails.groupInfo.bankAccountNumber || groupWithFullBankDetails.groupInfo.bankName));
  console.log('2. Account only - Show section:', !!(groupWithAccountOnly.groupInfo.bankAccountNumber || groupWithAccountOnly.groupInfo.bankName));
  console.log('3. Name only - Show section:', !!(groupWithNameOnly.groupInfo.bankAccountNumber || groupWithNameOnly.groupInfo.bankName));
  console.log('4. No details - Show section:', !!(groupWithNoDetails.groupInfo.bankAccountNumber || groupWithNoDetails.groupInfo.bankName));
  
  console.log('\nUI Rendering Logic Test:');
  [groupWithFullBankDetails, groupWithAccountOnly, groupWithNameOnly, groupWithNoDetails].forEach((group, index) => {
    const showSection = !!(group.groupInfo.bankAccountNumber || group.groupInfo.bankName);
    const showAccountNumber = !!group.groupInfo.bankAccountNumber;
    const showBankName = !!group.groupInfo.bankName;
    
    console.log(`\nTest case ${index + 1}:`);
    console.log(`  Show Group Details section: ${showSection}`);
    if (showSection) {
      console.log(`  Show Bank Account Number: ${showAccountNumber} (${group.groupInfo.bankAccountNumber || 'N/A'})`);
      console.log(`  Show Bank Name: ${showBankName} (${group.groupInfo.bankName || 'N/A'})`);
    }
  });
}

testGroupDetailsRendering();
