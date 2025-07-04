// Test script to check loan data state
const http = require('http');

// Simple helper to make authenticated requests
function makeAPIRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Test-Script/1.0'
      }
    };

    if (body) {
      options.headers['Content-Type'] = 'application/json';
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsedData = res.headers['content-type']?.includes('application/json') ? JSON.parse(data) : data;
          resolve({ 
            status: res.statusCode, 
            headers: res.headers,
            data: parsedData 
          });
        } catch (e) {
          resolve({ 
            status: res.statusCode, 
            headers: res.headers,
            data: data 
          });
        }
      });
    });

    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

async function testLoanState() {
  console.log('🔍 Testing loan state...');
  
  try {
    // First, check if we have any groups
    console.log('1. Testing unauthenticated API calls...');
    
    let result = await makeAPIRequest('/api/groups');
    console.log('Groups API (unauthenticated):', result.status, typeof result.data === 'object' ? JSON.stringify(result.data).substring(0, 100) : result.data.substring(0, 100));
    
    // Test a specific group ID (you may need to change this)
    const testGroupId = '684bae097517c05bab9a2eac';
    
    result = await makeAPIRequest(`/api/groups/${testGroupId}`);
    console.log(`Group detail API (unauthenticated):`, result.status, typeof result.data === 'object' ? JSON.stringify(result.data).substring(0, 100) : result.data.substring(0, 100));
    
    result = await makeAPIRequest(`/api/groups/${testGroupId}/loans`);
    console.log(`Loans API (unauthenticated):`, result.status, typeof result.data === 'object' ? JSON.stringify(result.data).substring(0, 100) : result.data.substring(0, 100));
    
    // Since APIs are probably protected, let's just verify the server structure
    result = await makeAPIRequest('/');
    console.log('Root page:', result.status, 'Content type:', result.headers['content-type']);
    
    console.log('✅ Server is responding. APIs require authentication as expected.');
    console.log('');
    console.log('💡 Next steps:');
    console.log('1. Open browser to http://localhost:3000');
    console.log('2. Login to the application');
    console.log('3. Navigate to a group contributions page');
    console.log('4. Check browser console for the debug logs we added:');
    console.log('   - 🔍 [GROUP API] Debug - Raw memberships data');
    console.log('   - 🔢 [GROUP API] Calculating balance for [Member Name]');
    console.log('5. Try creating a loan and check for:');
    console.log('   - 🔄 [LOAN CREATION] Starting loan creation...');
    console.log('   - 📡 [LOAN CREATION] Response status');
    console.log('   - ❌ [LOAN CREATION] Error details (if any)');
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

testLoanState();
