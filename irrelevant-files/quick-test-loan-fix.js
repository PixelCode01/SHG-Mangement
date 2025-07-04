async function quickTestLoanRepayment() {
  const fetch = (await import('node-fetch')).default;
  
  const API_BASE = 'http://localhost:3000';
  const GROUP_ID = '6839b49bd57c6ee9ab7b9512';
  
  console.log('🧪 QUICK LOAN REPAYMENT TEST\n');
  
  const testData = {
    meetingDate: new Date().toISOString(),
    newContributionsThisPeriod: 0,
    interestEarnedThisPeriod: 0,
    lateFinesCollectedThisPeriod: 0,
    loanProcessingFeesCollectedThisPeriod: 0,
    expensesThisPeriod: 0,
    memberRecords: [{
      memberId: "6839b461d57c6ee9ab7b94df", // SANTOSH MISHRA
      memberName: "SANTOSH MISHRA",
      compulsoryContribution: 0,
      loanRepaymentPrincipal: 500, // Test with ₹500 this time
      lateFinePaid: 0
    }]
  };
  
  try {
    const response = await fetch(`${API_BASE}/api/groups/${GROUP_ID}/periodic-records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });
    
    if (response.ok) {
      const result = await response.json();
      const standingChange = result.totalGroupStandingAtEndOfPeriod - result.standingAtStartOfPeriod;
      
      console.log(`✅ Test completed successfully:`);
      console.log(`   Start standing: ₹${result.standingAtStartOfPeriod?.toLocaleString()}`);
      console.log(`   End standing: ₹${result.totalGroupStandingAtEndOfPeriod?.toLocaleString()}`);
      console.log(`   Change: ₹${standingChange?.toLocaleString()}`);
      console.log(`   Result: ${standingChange === 0 ? '✅ PERFECT (no change)' : '❌ Issue (standing changed)'}`);
    } else {
      console.log('❌ Request failed:', response.status);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

quickTestLoanRepayment();
