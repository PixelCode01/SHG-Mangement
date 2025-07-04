async function testApiAuth() {
  console.log('🧪 Testing API Authentication...\n');
  
  const baseUrl = 'http://localhost:3002';
  
  try {
    // Test 1: GET /api/groups (without authentication)
    console.log('1. Testing GET /api/groups (without auth)...');
    const response1 = await fetch(`${baseUrl}/api/groups`);
    console.log(`   Status: ${response1.status}`);
    
    if (response1.status === 401) {
      console.log('   ❌ Authentication required - this explains the issue!');
    } else if (response1.status === 200) {
      const data = await response1.json();
      console.log(`   ✅ Success - Found ${data.length || 0} groups`);
    } else {
      const error = await response1.text();
      console.log(`   ❌ Unexpected response: ${error}`);
    }
    
    // Test 2: POST /api/groups (without authentication)
    console.log('\n2. Testing POST /api/groups (without auth)...');
    const testGroupData = {
      name: 'API Test Group',
      address: 'Test Address', 
      registrationNumber: 'REG-API-TEST',
      organization: 'Test Org',
      leaderId: '507f1f77bcf86cd799439011', // dummy ID
      memberCount: 1,
      dateOfStarting: new Date().toISOString(),
      description: 'Test group via API',
      collectionFrequency: 'MONTHLY',
      members: []
    };
    
    const response2 = await fetch(`${baseUrl}/api/groups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testGroupData)
    });
    
    console.log(`   Status: ${response2.status}`);
    
    if (response2.status === 401) {
      console.log('   ❌ Authentication required for group creation too!');
    } else if (response2.status === 200 || response2.status === 201) {
      console.log('   ✅ Group creation succeeded');
    } else {
      const error = await response2.text();
      console.log(`   ❌ Error: ${error}`);
    }
    
  } catch (error) {
    console.error('❌ API test failed:', error.message);
  }
}

// Make fetch available
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

testApiAuth();
