const testData = [
  // Test case 1: Member with exact payment (should be PAID)
  {
    name: "Alice",
    totalExpected: 1000,
    paidAmount: 1000,
    expectedStatus: 'PAID'
  },
  // Test case 2: Member with small rounding difference (should be PAID)
  {
    name: "Bob", 
    totalExpected: 1000,
    paidAmount: 999.99,
    expectedStatus: 'PAID'
  },
  // Test case 3: Member with partial payment (should be PARTIAL)
  {
    name: "Charlie",
    totalExpected: 1000,
    paidAmount: 500,
    expectedStatus: 'PARTIAL'
  },
  // Test case 4: Member with no payment (should be PENDING)
  {
    name: "David",
    totalExpected: 1000,
    paidAmount: 0,
    expectedStatus: 'PENDING'
  },
  // Test case 5: Member with overpayment (should be PAID)
  {
    name: "Eve",
    totalExpected: 1000,
    paidAmount: 1000.50,
    expectedStatus: 'PAID'
  }
];

function testStatusCalculation() {
  console.log('Testing status calculation logic...\n');
  
  testData.forEach(test => {
    const remainingAmountRaw = test.totalExpected - test.paidAmount;
    let status = 'PENDING';
    
    // Apply the fixed logic
    if (remainingAmountRaw <= 0.01) {
      status = 'PAID';
    } else if (test.paidAmount > 0) {
      status = 'PARTIAL';
    }
    
    const remainingAmount = Math.max(0, test.totalExpected - test.paidAmount);
    
    // Final status check
    if (remainingAmount <= 0.01 && test.paidAmount > 0) {
      status = 'PAID';
    }
    
    const passed = status === test.expectedStatus;
    console.log(`${test.name}: Expected ${test.expectedStatus}, Got ${status} - ${passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Total Expected: ₹${test.totalExpected}, Paid: ₹${test.paidAmount}, Remaining: ₹${remainingAmount}`);
    console.log(`  Raw remaining: ${remainingAmountRaw}\n`);
  });
}

testStatusCalculation();
