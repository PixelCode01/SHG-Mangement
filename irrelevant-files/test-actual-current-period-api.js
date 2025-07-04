#!/usr/bin/env node

/**
 * Test the actual API endpoint that the frontend calls
 */

async function testCurrentPeriodAPI() {
  console.log('=== Testing Current Period API Endpoint ===\n');

  try {
    // First, get a group ID to test with
    const groupResponse = await fetch('http://localhost:3000/api/groups');
    if (!groupResponse.ok) {
      console.log('❌ Failed to fetch groups');
      return;
    }
    
    const groupsData = await groupResponse.json();
    if (!groupsData.groups || groupsData.groups.length === 0) {
      console.log('❌ No groups found');
      return;
    }

    const testGroup = groupsData.groups[0];
    console.log(`🔍 Testing with group: ${testGroup.name} (ID: ${testGroup.id})`);

    // Test the current period endpoint
    const currentPeriodResponse = await fetch(`http://localhost:3000/api/groups/${testGroup.id}/contributions/periods/current`);
    
    if (!currentPeriodResponse.ok) {
      console.log(`❌ API request failed: ${currentPeriodResponse.status}`);
      const errorText = await currentPeriodResponse.text();
      console.log('Error:', errorText);
      return;
    }

    const currentPeriodData = await currentPeriodResponse.json();
    console.log('\n✅ API Response:');
    console.log(JSON.stringify(currentPeriodData, null, 2));

    if (currentPeriodData.period) {
      const periodDate = new Date(currentPeriodData.period.startDate);
      const monthYear = periodDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      console.log(`\n📅 Frontend will display: "${monthYear}"`);
      console.log(`🔄 Period is closed: ${currentPeriodData.period.isClosed}`);
    } else {
      console.log('\n📅 No current period - frontend will show current month fallback');
    }

    // Test with a few more groups if available
    if (groupsData.groups.length > 1) {
      console.log('\n=== Testing Additional Groups ===');
      for (let i = 1; i < Math.min(3, groupsData.groups.length); i++) {
        const group = groupsData.groups[i];
        console.log(`\n🔍 Testing: ${group.name}`);
        
        const response = await fetch(`http://localhost:3000/api/groups/${group.id}/contributions/periods/current`);
        if (response.ok) {
          const data = await response.json();
          if (data.period) {
            const periodDate = new Date(data.period.startDate);
            const monthYear = periodDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            console.log(`   📅 Shows: "${monthYear}" (Closed: ${data.period.isClosed})`);
          } else {
            console.log(`   📅 No period found`);
          }
        } else {
          console.log(`   ❌ API error: ${response.status}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testCurrentPeriodAPI();
