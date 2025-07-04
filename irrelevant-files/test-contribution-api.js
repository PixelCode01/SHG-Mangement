import fetch from 'node-fetch';

async function testContributionAPI() {
  try {
    console.log('🧪 Testing Contribution API endpoint...\n');
    
    const groupId = '6841a5ea4aee2245b9ff2fc4'; // The group we've been testing
    const apiUrl = `http://localhost:3000/api/groups/${groupId}/contributions/current`;
    
    // First, test the GET endpoint
    console.log('📊 Testing GET endpoint...');
    const getResponse = await fetch(apiUrl);
    console.log(`   Status: ${getResponse.status}`);
    
    if (getResponse.ok) {
      const getData = await getResponse.json();
      console.log(`   ✅ GET successful - found ${getData.contributions?.length || 0} contributions`);
      
      // Find a member without a contribution record (if any)
      const contributingMemberIds = new Set(getData.contributions?.map(c => c.memberId) || []);
      
      // We need to get all group members to find one without a contribution
      const membersResponse = await fetch(`http://localhost:3000/api/groups/${groupId}/members`);
      if (membersResponse.ok) {
        const membersData = await membersResponse.json();
        console.log(`   📋 Group has ${membersData.members?.length || 0} total members`);
        
        const memberWithoutContribution = membersData.members?.find(member => 
          !contributingMemberIds.has(member.id)
        );
        
        if (memberWithoutContribution) {
          console.log(`\n🎯 Testing POST for member without contribution: ${memberWithoutContribution.name}`);
          
          // Test the POST endpoint
          const postResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              memberId: memberWithoutContribution.id,
              compulsoryContributionDue: 55,
              loanInterestDue: 0
            })
          });
          
          console.log(`   POST Status: ${postResponse.status}`);
          
          if (postResponse.ok) {
            const postData = await postResponse.json();
            console.log(`   ✅ POST successful - created contribution record`);
            console.log(`   📝 Record ID: ${postData.id}`);
          } else {
            const errorText = await postResponse.text();
            console.log(`   ❌ POST failed: ${errorText}`);
          }
        } else {
          console.log('   ℹ️  All members already have contribution records');
        }
      } else {
        console.log(`   ❌ Failed to get group members: ${membersResponse.status}`);
      }
    } else {
      const errorText = await getResponse.text();
      console.log(`   ❌ GET failed: ${errorText}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testContributionAPI();
