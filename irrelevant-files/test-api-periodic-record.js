/**
 * Test the periodic record creation API with our test group
 */

const fetch = require('node-fetch');

async function testPeriodicRecordAPI() {
  console.log('🧪 TESTING PERIODIC RECORD API WITH TEST GROUP');
  console.log('============================================================\n');

  const groupId = '683865dc8a9fe822af15905f'; // The group ID from our test
  const baseUrl = 'http://localhost:3000';

  try {
    // Test 1: Get group data
    console.log('1. Testing Group API to verify financial data...');
    const groupResponse = await fetch(`${baseUrl}/api/groups/${groupId}`);
    
    if (groupResponse.ok) {
      const group = await groupResponse.json();
      console.log('✅ Group API Response:');
      console.log(`   Name: ${group.name}`);
      console.log(`   Cash in Hand: ₹${group.cashInHand || 0}`);
      console.log(`   Balance in Bank: ₹${group.balanceInBank || 0}`);
      console.log(`   Monthly Contribution: ₹${group.monthlyContribution || 0}`);
      console.log(`   Interest Rate: ${group.interestRate || 0}%`);
      
      if (group.cashInHand && group.balanceInBank && group.monthlyContribution && group.interestRate) {
        console.log('✅ All financial fields are present in API response');
      } else {
        console.log('❌ Some financial fields are missing from API response');
      }
    } else {
      console.log(`❌ Group API failed: ${groupResponse.status} ${groupResponse.statusText}`);
      const errorText = await groupResponse.text();
      console.log(`   Error: ${errorText}`);
    }

    // Test 2: Test periodic record creation
    console.log('\n2. Testing Periodic Record Creation API...');
    
    const periodicRecordData = {
      recordDate: new Date().toISOString(),
      standingAtStart: 26000,
      standingAtEnd: 26150,
      cashInHandAtEnd: 5000,
      cashInBankAtEnd: 15000,
      interestEarnedThisPeriod: 150,
      compulsoryContribution: 500,
      sharePerMemberThisPeriod: 6537.5, // (26150 / 4)
      notes: 'Test periodic record created via API'
    };

    const createResponse = await fetch(`${baseUrl}/api/groups/${groupId}/periodic-records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(periodicRecordData),
    });

    if (createResponse.ok) {
      const createdRecord = await createResponse.json();
      console.log('✅ Periodic Record Created Successfully:');
      console.log(`   ID: ${createdRecord.id}`);
      console.log(`   Standing at Start: ₹${createdRecord.standingAtStart}`);
      console.log(`   Standing at End: ₹${createdRecord.standingAtEnd}`);
      console.log(`   Cash in Hand at End: ₹${createdRecord.cashInHandAtEnd}`);
      console.log(`   Cash in Bank at End: ₹${createdRecord.cashInBankAtEnd}`);
      console.log(`   Interest Earned: ₹${createdRecord.interestEarnedThisPeriod}`);
      console.log(`   Share per Member: ₹${createdRecord.sharePerMemberThisPeriod}`);
      
      // Verify no external bank interest fields
      if (!createdRecord.hasOwnProperty('externalBankInterestRate') && 
          !createdRecord.hasOwnProperty('externalBankInterestAmount')) {
        console.log('✅ External bank interest fields are properly removed');
      } else {
        console.log('❌ External bank interest fields still present');
      }
      
    } else {
      console.log(`❌ Periodic Record Creation failed: ${createResponse.status} ${createResponse.statusText}`);
      const errorText = await createResponse.text();
      console.log(`   Error: ${errorText}`);
    }

    // Test 3: Get periodic records for the group
    console.log('\n3. Testing Periodic Records List API...');
    const listResponse = await fetch(`${baseUrl}/api/groups/${groupId}/periodic-records`);
    
    if (listResponse.ok) {
      const records = await listResponse.json();
      console.log(`✅ Retrieved ${records.length} periodic record(s)`);
      if (records.length > 0) {
        const record = records[0];
        console.log(`   First record ID: ${record.id}`);
        console.log(`   Record Date: ${new Date(record.recordDate).toLocaleDateString()}`);
        console.log(`   Standing at Start: ₹${record.standingAtStart}`);
      }
    } else {
      console.log(`❌ Periodic Records List failed: ${listResponse.status} ${listResponse.statusText}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  console.log('\n🎉 PERIODIC RECORD API TEST COMPLETE!');
  console.log('\nNow you can test the UI manually:');
  console.log('1. Open http://localhost:3000/groups');
  console.log('2. Find "Test Financial Group"');
  console.log('3. Click "Create Periodic Record"');
  console.log('4. Verify the form is pre-filled with:');
  console.log('   - Standing at Start: ₹26,000');
  console.log('   - Cash in Hand at End: ₹5,000');
  console.log('   - Cash in Bank at End: ₹15,000');
  console.log('   - Monthly Contribution: ₹500');
  console.log('   - Interest Rate: 2.5%');
  console.log('   - Share per Member should auto-calculate');
}

// Run the test
testPeriodicRecordAPI();
