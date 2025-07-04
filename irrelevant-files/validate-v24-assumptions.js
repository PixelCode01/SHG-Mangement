#!/usr/bin/env node

// V24 ASSUMPTION VALIDATION TEST
// Test the diagnostic fixes and validate our assumptions

const https = require('https');
const fs = require('fs');
const FormData = require('form-data');

const PROD_URL = 'https://shg-mangement.vercel.app';

console.log('🔬 V24 ASSUMPTION VALIDATION TEST');
console.log('='.repeat(60));

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });
    
    req.on('error', reject);
    
    if (options.method === 'POST' && options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

async function testAssumption1_EndpointFixed() {
  console.log('\n🔍 ASSUMPTION 1: Fixed Endpoint (/api/pdf-upload-v15) Works');
  console.log('-'.repeat(50));
  
  try {
    // Test the corrected endpoint
    const response = await makeRequest(`${PROD_URL}/api/pdf-upload-v15`);
    console.log(`📊 GET /api/pdf-upload-v15: ${response.statusCode}`);
    
    if (response.statusCode === 200) {
      const result = JSON.parse(response.data);
      console.log('✅ ASSUMPTION 1 VALIDATED: Working endpoint responds correctly');
      console.log(`   Route: ${result.route}, Version: ${result.version}`);
      return true;
    } else {
      console.log('❌ ASSUMPTION 1 FAILED: Working endpoint not responding');
      return false;
    }
  } catch (error) {
    console.log(`❌ ASSUMPTION 1 ERROR: ${error.message}`);
    return false;
  }
}

async function testAssumption2_RealPDFExtraction() {
  console.log('\n🔍 ASSUMPTION 2: Real PDF Extraction with Working Endpoint');
  console.log('-'.repeat(50));
  
  const testPdfPath = '/home/pixel/Downloads/members.pdf';
  
  if (!fs.existsSync(testPdfPath)) {
    console.log('   ⚠️ Test PDF file not found, cannot validate assumption');
    return false;
  }
  
  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(testPdfPath), {
      filename: 'members.pdf',
      contentType: 'application/pdf'
    });
    
    const formHeaders = form.getHeaders();
    
    console.log('📤 Uploading PDF to CORRECTED endpoint (/api/pdf-upload-v15)...');
    
    const response = await new Promise((resolve, reject) => {
      const req = https.request(`${PROD_URL}/api/pdf-upload-v15`, {
        method: 'POST',
        headers: formHeaders
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            data: data
          });
        });
      });
      
      req.on('error', reject);
      form.pipe(req);
    });
    
    console.log(`📊 Upload response status: ${response.statusCode}`);
    
    if (response.statusCode === 200) {
      try {
        const result = JSON.parse(response.data);
        console.log('✅ ASSUMPTION 2 VALIDATED: PDF extraction working');
        
        if (result.success && result.members) {
          console.log(`🎉 SUCCESS: Extracted ${result.members.length} members`);
          console.log(`📋 Sample members: ${result.members.slice(0, 3).map(m => m.name).join(', ')}`);
          
          // Check for real names vs garbage
          const realNames = result.members.filter(m => 
            m.name && m.name.length > 5 && 
            !m.name.includes('PDF') && 
            !m.name.includes('DATA')
          );
          
          console.log(`✅ Real names: ${realNames.length}/${result.members.length}`);
          
          if (realNames.length > 40) {
            console.log('🎯 HYPOTHESIS CONFIRMED: Real names extracted successfully');
            return true;
          } else {
            console.log('⚠️ Low real name count - may still have issues');
            return false;
          }
        } else {
          console.log('❌ ASSUMPTION 2 FAILED: No members in response');
          console.log('📋 Response:', result);
          return false;
        }
      } catch (parseError) {
        console.log('❌ ASSUMPTION 2 FAILED: Cannot parse response');
        console.log('📋 Raw response:', response.data.substring(0, 300));
        return false;
      }
    } else {
      console.log('❌ ASSUMPTION 2 FAILED: Upload failed');
      console.log('📋 Response:', response.data.substring(0, 200));
      return false;
    }
    
  } catch (error) {
    console.log(`❌ ASSUMPTION 2 ERROR: ${error.message}`);
    return false;
  }
}

async function testAssumption3_ClientSideFallback() {
  console.log('\n🔍 ASSUMPTION 3: Client-side Fallback Logic');
  console.log('-'.repeat(50));
  
  // We can't fully test client-side logic from Node.js
  // But we can verify the fallback triggers when server fails
  
  console.log('📝 This assumption will be validated when:');
  console.log('   1. Server extraction fails (405/500 errors)');
  console.log('   2. Browser console shows "V24: FALLBACK TRIGGER" message');
  console.log('   3. Client-side extraction runs with pattern matching');
  
  console.log('✅ ASSUMPTION 3: Setup for validation - check browser console');
  return true;
}

async function generateValidationReport() {
  console.log('\n📋 VALIDATION REPORT');
  console.log('='.repeat(60));
  
  const assumption1 = await testAssumption1_EndpointFixed();
  const assumption2 = await testAssumption2_RealPDFExtraction();
  const assumption3 = await testAssumption3_ClientSideFallback();
  
  console.log('\n🎯 VALIDATION RESULTS:');
  console.log(`   Assumption 1 (Fixed Endpoint): ${assumption1 ? '✅ VALIDATED' : '❌ FAILED'}`);
  console.log(`   Assumption 2 (Real Extraction): ${assumption2 ? '✅ VALIDATED' : '❌ FAILED'}`);
  console.log(`   Assumption 3 (Client Fallback): ${assumption3 ? '✅ SETUP' : '❌ FAILED'}`);
  
  if (assumption1 && assumption2) {
    console.log('\n🎉 DIAGNOSTIC SUCCESS: Both critical assumptions validated!');
    console.log('✅ The PDF import should now work correctly in production');
    console.log('📝 Next: Test in browser at https://shg-mangement.vercel.app/groups/create');
  } else {
    console.log('\n⚠️ DIAGNOSTIC INCOMPLETE: Some assumptions not validated');
    console.log('📝 Need to investigate further or implement additional fixes');
  }
  
  return {
    endpointFixed: assumption1,
    extractionWorking: assumption2,
    fallbackReady: assumption3
  };
}

async function main() {
  console.log(`📅 Test Time: ${new Date().toISOString()}`);
  console.log(`🎯 Target: ${PROD_URL}`);
  console.log('🔧 Testing V24 diagnostic fixes...');
  
  const results = await generateValidationReport();
  
  console.log('\n' + '='.repeat(60));
  console.log('🔬 V24 ASSUMPTION VALIDATION COMPLETE');
  
  if (results.endpointFixed && results.extractionWorking) {
    console.log('🎯 READY FOR PRODUCTION TESTING');
  } else {
    console.log('🛠️ NEEDS ADDITIONAL INVESTIGATION');
  }
  
  console.log('='.repeat(60));
}

main().catch(console.error);
