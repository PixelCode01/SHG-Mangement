async function debugPeriodicRecordCalculation() {
  const fetch = (await import('node-fetch')).default;
  console.log('=== DEBUGGING PERIODIC RECORD CALCULATION ===\n');

  const API_BASE = 'http://localhost:3000';
  const GROUP_ID = '6839b49bd57c6ee9ab7b9512'; // jijn group

  try {
    // 1. Get current group state
    console.log('📊 1. GETTING CURRENT GROUP STATE...');
    const groupResponse = await fetch(`${API_BASE}/api/groups/${GROUP_ID}`);
    const groupData = await groupResponse.json();
    
    console.log(`Current Group Standing: ₹${groupData.currentStanding?.toLocaleString()}`);
    console.log(`Current Cash in Hand: ₹${groupData.currentCashInHand?.toLocaleString()}`);
    console.log(`Current Cash in Bank: ₹${groupData.currentCashInBank?.toLocaleString()}`);
    
    // 2. Get all periodic records to understand the calculation pattern
    console.log('\n📋 2. GETTING PERIODIC RECORDS...');
    const recordsResponse = await fetch(`${API_BASE}/api/groups/${GROUP_ID}/periodic-records`);
    const records = await recordsResponse.json();
    
    console.log(`Total Records: ${records.length}`);
    
    // Show the last few records
    const lastFew = records.slice(-3);
    console.log('\nLast 3 Records:');
    lastFew.forEach((record, i) => {
      console.log(`  ${i + 1}. Date: ${new Date(record.meetingDate).toLocaleDateString()}`);
      console.log(`     Start: ₹${record.standingAtStartOfPeriod?.toLocaleString()}`);
      console.log(`     End: ₹${record.totalGroupStandingAtEndOfPeriod?.toLocaleString()}`);
      console.log(`     Change: ₹${(record.totalGroupStandingAtEndOfPeriod - record.standingAtStartOfPeriod)?.toLocaleString()}`);
      console.log('');
    });
    
    // 3. Calculate current loan totals manually
    console.log('💰 3. CALCULATING CURRENT LOAN TOTALS...');
    const membersResponse = await fetch(`${API_BASE}/api/groups/${GROUP_ID}/members`);
    const members = await membersResponse.json();
    
    let totalCurrentLoanAmount = 0;
    let membersWithLoans = 0;
    
    members.forEach(member => {
      if (member.currentLoanAmount && member.currentLoanAmount > 0) {
        totalCurrentLoanAmount += member.currentLoanAmount;
        membersWithLoans++;
      }
    });
    
    console.log(`Total Current Loan Amount: ₹${totalCurrentLoanAmount.toLocaleString()}`);
    console.log(`Members with Loans: ${membersWithLoans}`);
    
    // 4. Calculate expected total standing
    const currentCash = (groupData.currentCashInHand || 0) + (groupData.currentCashInBank || 0);
    const expectedTotalStanding = currentCash + totalCurrentLoanAmount;
    
    console.log('\n🧮 4. MANUAL CALCULATION:');
    console.log(`Current Cash Total: ₹${currentCash.toLocaleString()}`);
    console.log(`Current Loan Assets: ₹${totalCurrentLoanAmount.toLocaleString()}`);
    console.log(`Expected Total Standing: ₹${expectedTotalStanding.toLocaleString()}`);
    console.log(`Actual Group Standing: ₹${groupData.currentStanding?.toLocaleString()}`);
    console.log(`Difference: ₹${(groupData.currentStanding - expectedTotalStanding)?.toLocaleString()}`);
    
    // 5. Test a simple loan repayment
    console.log('\n🧪 5. TESTING LOAN REPAYMENT...');
    
    // Find a member with a loan
    const memberWithLoan = members.find(m => m.currentLoanAmount && m.currentLoanAmount > 0);
    if (!memberWithLoan) {
      console.log('❌ No members with loans found');
      return;
    }
    
    console.log(`Testing with: ${memberWithLoan.name} (Current loan: ₹${memberWithLoan.currentLoanAmount.toLocaleString()})`);
    
    const testAmount = 500;
    console.log(`Repayment amount: ₹${testAmount}`);
    
    // Expected results
    const expectedNewLoanAmount = memberWithLoan.currentLoanAmount - testAmount;
    const expectedNewCash = currentCash + testAmount;
    const expectedNewTotalStanding = expectedNewCash + (totalCurrentLoanAmount - testAmount);
    
    console.log('\nEXPECTED RESULTS:');
    console.log(`Member loan after: ₹${expectedNewLoanAmount.toLocaleString()}`);
    console.log(`Group cash after: ₹${expectedNewCash.toLocaleString()}`);
    console.log(`Total standing after: ₹${expectedNewTotalStanding.toLocaleString()}`);
    console.log(`Standing change: ₹0 (should be zero)`);
    
    // Create the test record
    const testData = {
      meetingDate: new Date().toISOString(),
      newContributionsThisPeriod: 0,
      interestEarnedThisPeriod: 0,
      lateFinesCollectedThisPeriod: 0,
      loanProcessingFeesCollectedThisPeriod: 0,
      expensesThisPeriod: 0,
      memberRecords: [{
        memberId: memberWithLoan.id,
        memberName: memberWithLoan.name,
        compulsoryContribution: 0,
        loanRepaymentPrincipal: testAmount,
        lateFinePaid: 0
      }]
    };
    
    console.log('\n🚀 CREATING TEST RECORD...');
    const createResponse = await fetch(`${API_BASE}/api/groups/${GROUP_ID}/periodic-records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.log('❌ Failed to create record:', errorText);
      return;
    }
    
    const newRecord = await createResponse.json();
    console.log('✅ Record created:', newRecord.id);
    
    // Check the results
    console.log('\n📊 ACTUAL RESULTS:');
    console.log(`Start standing: ₹${newRecord.standingAtStartOfPeriod?.toLocaleString()}`);
    console.log(`End standing: ₹${newRecord.totalGroupStandingAtEndOfPeriod?.toLocaleString()}`);
    console.log(`Standing change: ₹${(newRecord.totalGroupStandingAtEndOfPeriod - newRecord.standingAtStartOfPeriod)?.toLocaleString()}`);
    
    // Verify member loan amount was updated
    const updatedMemberResponse = await fetch(`${API_BASE}/api/groups/${GROUP_ID}/members`);
    const updatedMembers = await updatedMemberResponse.json();
    const updatedMember = updatedMembers.find(m => m.id === memberWithLoan.id);
    
    console.log(`Member loan before: ₹${memberWithLoan.currentLoanAmount.toLocaleString()}`);
    console.log(`Member loan after: ₹${updatedMember.currentLoanAmount?.toLocaleString()}`);
    console.log(`Loan change: ₹${(updatedMember.currentLoanAmount - memberWithLoan.currentLoanAmount)?.toLocaleString()}`);
    
    // Final assessment
    console.log('\n🎯 ASSESSMENT:');
    const standingChanged = newRecord.totalGroupStandingAtEndOfPeriod !== newRecord.standingAtStartOfPeriod;
    const loanCorrectlyReduced = updatedMember.currentLoanAmount === expectedNewLoanAmount;
    
    console.log(`Standing changed: ${standingChanged ? '❌ YES' : '✅ NO'}`);
    console.log(`Loan correctly reduced: ${loanCorrectlyReduced ? '✅ YES' : '❌ NO'}`);
    
    if (standingChanged) {
      console.log('\n🔍 ISSUE ANALYSIS:');
      console.log('The standing should not change when a loan is repaid because:');
      console.log('- Loan repayments convert loan assets to cash assets');
      console.log('- Total assets (cash + loans) should remain the same');
      console.log('- The issue might be in how the starting balance is calculated');
      console.log('- Or there might be an error in the ending balance calculation');
    }
    
  } catch (error) {
    console.error('❌ Error during debugging:', error);
  }
}

debugPeriodicRecordCalculation();
