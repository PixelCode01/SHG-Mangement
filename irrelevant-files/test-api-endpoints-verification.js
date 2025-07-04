const fetch = require('node-fetch');

async function testAPIEndpointsForCorrectValues() {
  const groupId = '68483f7957a0ff01552c98aa';
  
  console.log('🧪 Testing API Endpoints for Correct Values...');
  console.log('==============================================');

  try {
    // Test periodic records endpoint
    console.log(`\n📋 Testing Periodic Records API:`);
    const recordsUrl = `http://localhost:3000/api/groups/${groupId}/periodic-records`;
    
    const recordsResponse = await fetch(recordsUrl);
    if (recordsResponse.ok) {
      const records = await recordsResponse.json();
      console.log(`✅ Periodic Records API returned ${records.length} records`);
      
      records.forEach((record, index) => {
        const date = new Date(record.meetingDate).toISOString().split('T')[0];
        console.log(`  Record ${index + 1} (${date}): Standing ₹${record.totalGroupStandingAtEndOfPeriod}`);
      });
    } else {
      console.log(`❌ Periodic Records API failed: ${recordsResponse.status}`);
    }

    // Test the group details API (if it exists)
    console.log(`\n🏢 Testing Group Details API:`);
    const groupUrl = `http://localhost:3000/api/groups/${groupId}`;
    
    const groupResponse = await fetch(groupUrl);
    if (groupResponse.ok) {
      const group = await groupResponse.json();
      console.log(`✅ Group API returned data for: ${group.name || 'Unknown'}`);
      console.log(`  Current Cash in Hand: ₹${group.cashInHand || 0}`);
      console.log(`  Current Cash in Bank: ₹${group.balanceInBank || 0}`);
      console.log(`  Total Current Cash: ₹${(group.cashInHand || 0) + (group.balanceInBank || 0)}`);
    } else {
      console.log(`❌ Group API failed: ${groupResponse.status}`);
    }

    console.log(`\n📊 Expected Values Summary:`);
    console.log(`June 2025 should show: ₹139,389.09 (Cash: ₹11,689.09 + Loans: ₹127,700)`);
    console.log(`July 2025 should show: ₹143,257.77 (Cash: ₹15,557.77 + Loans: ₹127,700)`);
    console.log(`August 2025 should show: ₹143,257.77 (Cash: ₹15,557.77 + Loans: ₹127,700)`);

    console.log(`\n🔍 If frontend still shows different values, the issue is in:`);
    console.log(`1. Frontend component that displays historical contributions`);
    console.log(`2. Frontend calculation logic mixing live and historical data`);
    console.log(`3. Frontend API calls using wrong parameters or endpoints`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAPIEndpointsForCorrectValues()
  .catch(error => {
    console.error('Test script failed:', error);
    process.exit(1);
  });
