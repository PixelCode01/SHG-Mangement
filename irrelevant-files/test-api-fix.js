const fetch = require('node-fetch');

async function testPeriodicRecordAPI() {
  console.log('🧪 Testing Periodic Record API with Fixed Calculation...\n');

  const groupId = '684805fbe1e16d8057f414ad';
  const apiUrl = `http://localhost:3000/api/groups/${groupId}/periodic-records`;

  const testData = {
    meetingDate: new Date().toISOString(),
    newContributionsThisPeriod: 500, // Small contribution to test
    interestEarnedThisPeriod: 0,
    lateFinesCollectedThisPeriod: 0,
    loanProcessingFeesCollectedThisPeriod: 0,
    expensesThisPeriod: 0,
    memberRecords: [] // No member-specific records for simplicity
  };

  console.log('📤 Sending test data:', JSON.stringify(testData, null, 2));

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    if (response.ok) {
      const result = await response.json();
      console.log('\n✅ API Response:', JSON.stringify({
        id: result.id,
        meetingDate: result.meetingDate,
        standingAtStartOfPeriod: result.standingAtStartOfPeriod,
        totalGroupStandingAtEndOfPeriod: result.totalGroupStandingAtEndOfPeriod,
        newContributionsThisPeriod: result.newContributionsThisPeriod
      }, null, 2));

      // Test our formula: Total Standing = Cash + Loan Assets
      // Expected: Previous standing (₹11,742) + ₹500 contribution = ₹12,242
      // But with loan assets: ₹11,742 (cash) + ₹500 (new contribution) + ₹126,700 (loans) = ₹138,942
      
      const expectedStanding = 11742 + 500 + 126700; // ₹138,942
      const actualStanding = result.totalGroupStandingAtEndOfPeriod;
      
      console.log(`\n📊 Expected vs Actual:`);
      console.log(`  Expected: ₹${expectedStanding} (Cash + Contribution + Loan Assets)`);
      console.log(`  Actual: ₹${actualStanding}`);
      console.log(`  Difference: ₹${Math.abs(expectedStanding - actualStanding)}`);
      
      if (Math.abs(expectedStanding - actualStanding) < 1000) { // Allow some tolerance
        console.log('\n🎉 ✅ FIX IS WORKING! Total standing correctly includes loan assets.');
      } else {
        console.log('\n❌ Fix may not be working as expected.');
      }

    } else {
      const errorText = await response.text();
      console.log('❌ API Error:', response.status, errorText.substring(0, 200) + '...');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testPeriodicRecordAPI();
