#!/usr/bin/env node

// COMPREHENSIVE PDF IMPORT DIAGNOSIS - V24
// Deep dive into the actual problem sources with targeted logging

const https = require('https');
const fs = require('fs');
const FormData = require('form-data');

const PROD_URL = 'https://shg-mangement.vercel.app';

console.log('🔬 COMPREHENSIVE PDF IMPORT DIAGNOSIS - V24');
console.log('='.repeat(70));

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

// ASSUMPTION 1: Server-side API Route Runtime Issues
async function diagnoseServerSideAPI() {
  console.log('\n🔍 ASSUMPTION 1: Server-side API Route Runtime Issues');
  console.log('-'.repeat(50));
  
  // Test GET request to see if route exists
  try {
    console.log('📞 Testing GET /api/pdf-upload-v11...');
    const getResponse = await makeRequest(`${PROD_URL}/api/pdf-upload-v11`);
    console.log(`   Status: ${getResponse.statusCode}`);
    console.log(`   Headers: ${JSON.stringify(getResponse.headers, null, 2)}`);
    console.log(`   Response body: ${getResponse.data.substring(0, 500)}`);
    
    if (getResponse.statusCode === 200) {
      console.log('   ✅ Route exists and responds to GET');
    } else {
      console.log('   ❌ Route has issues with GET requests');
    }
  } catch (error) {
    console.log(`   ❌ GET request failed: ${error.message}`);
  }
  
  // Test POST with empty body to see if method is allowed
  try {
    console.log('\n📞 Testing POST /api/pdf-upload-v11 (empty body)...');
    const postResponse = await makeRequest(`${PROD_URL}/api/pdf-upload-v11`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': '0'
      }
    });
    console.log(`   Status: ${postResponse.statusCode}`);
    console.log(`   Response: ${postResponse.data.substring(0, 300)}`);
    
    if (postResponse.statusCode === 405) {
      console.log('   ❌ Method Not Allowed - Route might not support POST');
    } else if (postResponse.statusCode === 400) {
      console.log('   ✅ POST method accepted, expects file data');
    }
  } catch (error) {
    console.log(`   ❌ POST request failed: ${error.message}`);
  }
  
  // Test other PDF routes for comparison
  console.log('\n📞 Testing other PDF routes for comparison...');
  const routes = ['/api/pdf-upload-v13', '/api/pdf-upload-v15', '/api/pdf-parse'];
  
  for (const route of routes) {
    try {
      const response = await makeRequest(`${PROD_URL}${route}`);
      console.log(`   ${route}: ${response.statusCode} - ${response.data.substring(0, 100)}`);
    } catch (error) {
      console.log(`   ${route}: ERROR - ${error.message}`);
    }
  }
}

// ASSUMPTION 2: Client-side Fallback Not Properly Triggering
async function diagnoseClientSideFallback() {
  console.log('\n🔍 ASSUMPTION 2: Client-side Fallback Logic Issues');
  console.log('-'.repeat(50));
  
  const testPdfPath = '/home/pixel/Downloads/members.pdf';
  
  if (!fs.existsSync(testPdfPath)) {
    console.log('   ⚠️ Test PDF file not found, cannot test client-side logic');
    return;
  }
  
  // Simulate what the client-side code would do
  console.log('📄 Simulating client-side PDF processing...');
  
  try {
    const fileBuffer = fs.readFileSync(testPdfPath);
    console.log(`   ✅ PDF file read: ${fileBuffer.length} bytes`);
    
    // Test FormData construction (what the client does)
    const form = new FormData();
    form.append('file', fs.createReadStream(testPdfPath), {
      filename: 'members.pdf',
      contentType: 'application/pdf'
    });
    
    const formHeaders = form.getHeaders();
    console.log(`   ✅ FormData headers: ${JSON.stringify(formHeaders)}`);
    
    // Test actual upload with detailed logging
    console.log('\n📤 Testing actual PDF upload with detailed logging...');
    
    const response = await new Promise((resolve, reject) => {
      const req = https.request(`${PROD_URL}/api/pdf-upload-v11`, {
        method: 'POST',
        headers: formHeaders
      }, (res) => {
        let data = '';
        res.on('data', chunk => {
          data += chunk;
          console.log(`   📊 Received chunk: ${chunk.length} bytes`);
        });
        res.on('end', () => {
          console.log(`   📊 Total response: ${data.length} bytes`);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data
          });
        });
      });
      
      req.on('error', (error) => {
        console.log(`   ❌ Request error: ${error.message}`);
        reject(error);
      });
      
      req.on('finish', () => {
        console.log('   📊 Request finished sending');
      });
      
      form.pipe(req);
      
      form.on('error', (error) => {
        console.log(`   ❌ Form error: ${error.message}`);
        reject(error);
      });
    });
    
    console.log(`   📊 Upload response status: ${response.statusCode}`);
    console.log(`   📊 Upload response headers: ${JSON.stringify(response.headers)}`);
    console.log(`   📊 Upload response body: ${response.data.substring(0, 500)}`);
    
    // Check if response suggests fallback should trigger
    if (response.statusCode !== 200) {
      console.log('   ✅ Server failure detected - fallback should trigger');
    } else {
      console.log('   ⚠️ Server responded successfully - check response content');
    }
    
  } catch (error) {
    console.log(`   ❌ Client-side simulation error: ${error.message}`);
  }
}

// Additional diagnostics
async function diagnoseNetworkAndCaching() {
  console.log('\n🔍 ADDITIONAL: Network and Caching Issues');
  console.log('-'.repeat(50));
  
  // Check if there are caching issues
  console.log('🔄 Testing with cache-busting...');
  const timestamp = Date.now();
  
  try {
    const response = await makeRequest(`${PROD_URL}/api/pdf-upload-v11?cb=${timestamp}`, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    console.log(`   Cache-busted GET: ${response.statusCode}`);
  } catch (error) {
    console.log(`   Cache-busted GET error: ${error.message}`);
  }
  
  // Check response headers for deployment info
  console.log('\n📊 Checking deployment headers...');
  try {
    const response = await makeRequest(PROD_URL);
    console.log('   Response headers:');
    Object.entries(response.headers).forEach(([key, value]) => {
      if (key.includes('vercel') || key.includes('x-') || key.includes('server')) {
        console.log(`     ${key}: ${value}`);
      }
    });
  } catch (error) {
    console.log(`   Header check error: ${error.message}`);
  }
}

async function generateDiagnosticReport() {
  console.log('\n📋 DIAGNOSTIC REPORT');
  console.log('='.repeat(70));
  
  console.log('🎯 KEY FINDINGS TO VALIDATE:');
  console.log('1. Server API Route Status:');
  console.log('   - Does the route exist and respond?');
  console.log('   - What specific error occurs on POST?');
  console.log('   - Are there runtime environment issues?');
  
  console.log('\n2. Client-side Processing:');
  console.log('   - Is the file upload mechanism working?');
  console.log('   - Is the fallback logic being triggered?');
  console.log('   - Are there browser/CORS restrictions?');
  
  console.log('\n3. Deployment and Caching:');
  console.log('   - Is the latest code deployed?');
  console.log('   - Are there caching issues?');
  console.log('   - Is Vercel environment compatible?');
  
  console.log('\n📝 NEXT STEPS:');
  console.log('1. Add extensive logging to MultiStepGroupForm.tsx PDF upload function');
  console.log('2. Add logging to /api/pdf-upload-v11/route.ts for server diagnostics');
  console.log('3. Test in browser console to see client-side behavior');
  console.log('4. Check Vercel function logs for runtime errors');
}

async function main() {
  console.log(`📅 Diagnosis Time: ${new Date().toISOString()}`);
  console.log(`🎯 Target: ${PROD_URL}`);
  
  await diagnoseServerSideAPI();
  await diagnoseClientSideFallback();
  await diagnoseNetworkAndCaching();
  await generateDiagnosticReport();
  
  console.log('\n' + '='.repeat(70));
  console.log('🔬 COMPREHENSIVE DIAGNOSIS COMPLETE');
  console.log('Ready to add targeted logging based on findings...');
  console.log('='.repeat(70));
}

main().catch(console.error);
