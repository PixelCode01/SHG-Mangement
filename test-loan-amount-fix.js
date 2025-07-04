// Test the loan amount field mapping fix
const testAPIResponse = {
  success: true,
  members: [
    {
      name: "Ashok Kumar Keshri",
      currentLoanAmount: 0,
      loanAmount: 0
    },
    {
      name: "Anup Kumar Keshri", 
      currentLoanAmount: 2470000,
      loanAmount: 2470000
    },
    {
      name: "Manoj Mishra",
      currentLoanAmount: 184168,
      loanAmount: 184168
    }
  ]
};

console.log('🧪 Testing loan amount field mapping fix');
console.log('==========================================\n');

// Simulate the frontend transformation with the fix
const processedMembers = testAPIResponse.members.map(row => {
  let name = row.name;
  
  // The FIXED loan amount extraction
  console.log(`🔧 Processing row for ${name}:`, {
    currentLoanAmount: row.currentLoanAmount,
    loanAmount: row.loanAmount,
    'loan amount': row['loan amount'],
    'Loan Amount': row['Loan Amount']
  });
  
  let loanAmountRaw = (row.currentLoanAmount || row.loanAmount || row['loan amount'] || row['Loan Amount'] || '0').toString();
  loanAmountRaw = loanAmountRaw.replace(/[₹Rs\s,]/g, '').trim();
  const loanAmount = parseFloat(loanAmountRaw) || 0;
  
  console.log(`🔧 Final loan amount for ${name}: ${loanAmount}`);
  
  return {
    name: name,
    loanAmount: loanAmount
  };
});

console.log('\n📊 RESULTS:');
processedMembers.forEach((member, i) => {
  console.log(`  ${i + 1}. ${member.name} - ₹${member.loanAmount.toLocaleString()}`);
});

const total = processedMembers.reduce((sum, m) => sum + m.loanAmount, 0);
console.log(`\n💰 Total: ₹${total.toLocaleString()}`);

console.log('\n✅ EXPECTED RESULT:');
console.log('- Ashok Kumar Keshri should show ₹0 (correct)');
console.log('- Anup Kumar Keshri should show ₹24,70,000 (was showing ₹0 before fix)');
console.log('- Manoj Mishra should show ₹1,84,168 (was showing ₹0 before fix)');
console.log('- Total should be ₹26,54,168 (was ₹0 before fix)');

if (total > 0) {
  console.log('\n🎉 SUCCESS: Loan amounts are now being extracted correctly!');
} else {
  console.log('\n❌ FAILURE: Loan amounts are still showing as 0');
}
