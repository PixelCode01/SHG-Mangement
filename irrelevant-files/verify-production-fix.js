// PRODUCTION VERIFICATION SCRIPT - V17 PDF FIX
// Test if the V17 absolute block is working in production

const https = require('https');

async function verifyProductionFix() {
  console.log('🔍 VERIFYING V17 PDF FIX IN PRODUCTION');
  console.log('='.repeat(50));
  console.log('');

  // Test 1: Check if PDF endpoint returns 422
  console.log('📋 TEST 1: PDF Endpoint Returns 422');
  try {
    const response = await fetch('https://shg-mangement.vercel.app/api/pdf-upload-v11', {
      method: 'POST',
      body: new FormData() // Empty form data
    });
    
    console.log(`   Status: ${response.status}`);
    if (response.status === 422) {
      console.log('   ✅ PASS: Server correctly returns 422');
      const data = await response.json();
      console.log(`   📄 Response: ${data.error}`);
    } else {
      console.log('   ❌ FAIL: Expected 422, got', response.status);
    }
  } catch (error) {
    console.log('   ❌ ERROR:', error.message);
  }
  console.log('');

  // Test 2: Check deployment timestamp
  console.log('📋 TEST 2: Check Latest Deployment');
  try {
    const response = await fetch('https://shg-mangement.vercel.app/');
    const headers = response.headers;
    console.log(`   Date: ${headers.get('date')}`);
    console.log(`   Vercel ID: ${headers.get('x-vercel-id')}`);
    console.log(`   Cache: ${headers.get('x-vercel-cache')}`);
    
    // Check if we can find our timestamp in the page
    const html = await response.text();
    const hasOurTimestamp = html.includes('1750075600000') || html.includes('1750074881610');
    console.log(`   ✅ Contains our timestamp: ${hasOurTimestamp}`);
  } catch (error) {
    console.log('   ❌ ERROR:', error.message);
  }
  console.log('');

  // Test 3: Recommendations
  console.log('🎯 NEXT STEPS:');
  console.log('1. Wait 2-3 minutes for full deployment');
  console.log('2. Hard refresh browser (Ctrl+Shift+R)');
  console.log('3. Open dev tools and check console logs');
  console.log('4. Try uploading a PDF - should see V17 emergency alert');
  console.log('5. Look for logs: "🚨 V17: MAXIMUM CACHE BUST"');
  console.log('');
  
  console.log('🚨 If issue persists:');
  console.log('   - Browser cache might be extremely stubborn');
  console.log('   - Try incognito/private mode');
  console.log('   - Or use different browser entirely');
}

// Run in Node.js environment
if (typeof window === 'undefined') {
  // Node.js environment - use fetch polyfill
  global.fetch = require('node-fetch');
  global.FormData = require('form-data');
  verifyProductionFix().catch(console.error);
}
