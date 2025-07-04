// Test API endpoints with proper error handling
const fetch = require('node-fetch');

async function testEndpoints() {
  const groupId = '68450d0aba4742c4ab83f661';
  const baseUrl = 'http://localhost:3000';
  
  console.log('Testing API endpoints with error details...\n');
  
  // Test 1: GET /contributions/current
  try {
    console.log('1. Testing GET /contributions/current...');
    const response1 = await fetch(`${baseUrl}/api/groups/${groupId}/contributions/current`);
    console.log(`   Status: ${response1.status}`);
    const text1 = await response1.text();
    console.log(`   Response: ${text1.substring(0, 200)}${text1.length > 200 ? '...' : ''}\n`);
  } catch (error) {
    console.log(`   Error: ${error.message}\n`);
  }
  
  // Test 2: GET /contributions/periods/current
  try {
    console.log('2. Testing GET /contributions/periods/current...');
    const response2 = await fetch(`${baseUrl}/api/groups/${groupId}/contributions/periods/current`);
    console.log(`   Status: ${response2.status}`);
    const text2 = await response2.text();
    console.log(`   Response: ${text2.substring(0, 200)}${text2.length > 200 ? '...' : ''}\n`);
  } catch (error) {
    console.log(`   Error: ${error.message}\n`);
  }
  
  // Test 3: GET /groups/{id}
  try {
    console.log('3. Testing GET /groups/{id}...');
    const response3 = await fetch(`${baseUrl}/api/groups/${groupId}`);
    console.log(`   Status: ${response3.status}`);
    const text3 = await response3.text();
    console.log(`   Response: ${text3.substring(0, 200)}${text3.length > 200 ? '...' : ''}\n`);
  } catch (error) {
    console.log(`   Error: ${error.message}\n`);
  }
}

testEndpoints().catch(console.error);
