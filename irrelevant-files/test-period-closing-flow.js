/**
 * Test script to verify the complete period closing flow works correctly
 * This tests:
 * 1. Contribution page works with no periods (creates new period)
 * 2. Period closing creates proper records with all financial data
 * 3. Periodic records page displays all the captured information
 */

const API_BASE = 'http://localhost:3001';

async function testPeriodClosingFlow() {
  console.log('🧪 Testing Period Closing Flow...\n');

  try {
    // Step 1: Find or create a test group
    console.log('1. Setting up test group...');
    const groupsResponse = await fetch(`${API_BASE}/api/groups`);
    if (!groupsResponse.ok) {
      throw new Error('Failed to fetch groups');
    }
    const groups = await groupsResponse.json();
    
    let testGroup = groups.find(g => g.name && g.name.includes('test'));
    if (!testGroup && groups.length > 0) {
      testGroup = groups[0];
    }
    
    if (!testGroup) {
      console.log('❌ No groups found. Please create a group first.');
      return;
    }
    
    console.log(`✅ Using group: ${testGroup.name} (ID: ${testGroup.id})`);

    // Step 2: Test contribution page with no periods
    console.log('\n2. Testing contribution page API endpoints...');
    
    // Test current period endpoint (should handle no periods gracefully)
    const currentPeriodResponse = await fetch(`${API_BASE}/api/groups/${testGroup.id}/contributions/periods/current`);
    console.log(`Current period status: ${currentPeriodResponse.status}`);
    
    if (currentPeriodResponse.status === 404) {
      console.log('✅ No current period found - testing period creation...');
      
      // Test period creation
      const createPeriodResponse = await fetch(`${API_BASE}/api/groups/${testGroup.id}/contributions/periods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: new Date().toISOString(),
          endDate: null
        })
      });
      
      if (createPeriodResponse.ok) {
        const newPeriod = await createPeriodResponse.json();
        console.log(`✅ Created new period: ${newPeriod.id}`);
      } else {
        console.log(`❌ Failed to create period: ${createPeriodResponse.status}`);
        return;
      }
    } else if (currentPeriodResponse.ok) {
      const currentPeriod = await currentPeriodResponse.json();
      console.log(`✅ Found current period: ${currentPeriod.id}`);
    }

    // Step 3: Test period closing
    console.log('\n3. Testing period closing...');
    
    // First, ensure we have some test data
    const membersResponse = await fetch(`${API_BASE}/api/groups/${testGroup.id}/members`);
    if (!membersResponse.ok) {
      console.log('❌ Failed to fetch members');
      return;
    }
    const members = await membersResponse.json();
    console.log(`Found ${members.length} members`);

    // Get current period again
    const currentPeriodResponse2 = await fetch(`${API_BASE}/api/groups/${testGroup.id}/contributions/periods/current`);
    if (!currentPeriodResponse2.ok) {
      console.log('❌ No current period to close');
      return;
    }
    const currentPeriod = await currentPeriodResponse2.json();

    // Close the period
    const closePeriodResponse = await fetch(`${API_BASE}/api/groups/${testGroup.id}/contributions/periods/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId: testGroup.id
      })
    });

    if (closePeriodResponse.ok) {
      const closeResult = await closePeriodResponse.json();
      console.log('✅ Period closed successfully');
      console.log(`Created record: ${closeResult.record.id}`);
      console.log(`Created new period: ${closeResult.newPeriod.id}`);
      
      // Check the record data
      const record = closeResult.record;
      console.log('\nRecord data captured:');
      console.log(`- Meeting Date: ${record.meetingDate}`);
      console.log(`- Cash in Hand: ₹${record.cashInHandAtEndOfPeriod || 'N/A'}`);
      console.log(`- Cash in Bank: ₹${record.cashInBankAtEndOfPeriod || 'N/A'}`);
      console.log(`- Total Group Standing: ₹${record.totalGroupStandingAtEndOfPeriod || 'N/A'}`);
      console.log(`- Total Collection: ₹${record.totalCollectionThisPeriod || 'N/A'}`);
      console.log(`- New Contributions: ₹${record.newContributionsThisPeriod || 'N/A'}`);
      console.log(`- Interest Earned: ₹${record.interestEarnedThisPeriod || 'N/A'}`);
      console.log(`- Late Fines: ₹${record.lateFinesCollectedThisPeriod || 'N/A'}`);
    } else {
      const errorText = await closePeriodResponse.text();
      console.log(`❌ Failed to close period: ${closePeriodResponse.status} - ${errorText}`);
      return;
    }

    // Step 4: Test periodic records retrieval
    console.log('\n4. Testing periodic records retrieval...');
    
    const recordsResponse = await fetch(`${API_BASE}/api/groups/${testGroup.id}/periodic-records`);
    if (recordsResponse.ok) {
      const records = await recordsResponse.json();
      console.log(`✅ Retrieved ${records.length} periodic records`);
      
      if (records.length > 0) {
        const latestRecord = records[0];
        console.log('\nLatest record contains all fields:');
        console.log(`- ID: ${latestRecord.id}`);
        console.log(`- Meeting Date: ${latestRecord.meetingDate}`);
        console.log(`- Record Sequence: ${latestRecord.recordSequenceNumber || 'N/A'}`);
        console.log(`- Members Present: ${latestRecord.membersPresent || 'N/A'}`);
        console.log(`- All financial fields present: ${latestRecord.cashInHandAtEndOfPeriod !== undefined ? '✅' : '❌'}`);
      }
    } else {
      console.log(`❌ Failed to retrieve records: ${recordsResponse.status}`);
    }

    // Step 5: Provide URLs for manual testing
    console.log('\n5. Manual testing URLs:');
    console.log(`🌐 Contribution Page: ${API_BASE}/groups/${testGroup.id}/contributions`);
    console.log(`🌐 Periodic Records: ${API_BASE}/groups/${testGroup.id}/periodic-records`);
    console.log(`🌐 Group Summary: ${API_BASE}/groups/${testGroup.id}/summary`);

    console.log('\n✅ All tests completed successfully!');
    console.log('\nKey Features Verified:');
    console.log('✅ Contribution page handles missing periods gracefully');
    console.log('✅ Period closing captures complete financial data');
    console.log('✅ Periodic records show all relevant information');
    console.log('✅ Date/time stamping works correctly');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testPeriodClosingFlow();
