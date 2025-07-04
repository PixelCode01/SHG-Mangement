#!/usr/bin/env node

/**
 * COMPREHENSIVE EMERGENCY FIX TEST
 * 
 * This script tests ALL PDF endpoints to ensure they return 422
 * and verifies the complete fix is working.
 */

const BASE_URL = 'https://shg-mangement.vercel.app';

async function testAllPDFEndpoints() {
  console.log('🔍 COMPREHENSIVE TEST: All PDF Endpoints Emergency Fix');
  console.log('========================================================');
  console.log('Time:', new Date().toISOString());
  console.log('');
  
  // All PDF endpoints that should return 422
  const endpoints = [
    '/api/pdf-extract-v4',
    '/api/pdf-parse-universal', 
    '/api/pdf-production',
    '/api/pdf-upload-v11',
    '/api/pdf-upload-v13'
  ];
  
  console.log('📡 Testing ALL PDF endpoints for 422 status...');
  console.log('');
  
  let allCorrect = true;
  const results = [];
  
  for (const endpoint of endpoints) {
    try {
      const formData = new FormData();
      formData.append('file', new Blob(['test'], { type: 'application/pdf' }), 'test.pdf');
      
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        body: formData
      });
      
      if (response.status === 422) {
        const data = await response.json();
        if (data.fallbackRequired && data.emergencyFix) {
          console.log(`✅ ${endpoint}: Returns 422 with emergency flags (CORRECT)`);
          results.push({ endpoint, status: 'PASS', details: 'Returns 422 with emergency flags' });
        } else {
          console.log(`⚠️  ${endpoint}: Returns 422 but missing emergency flags`);
          results.push({ endpoint, status: 'PARTIAL', details: 'Returns 422 but missing emergency flags' });
          allCorrect = false;
        }
      } else {
        console.log(`❌ ${endpoint}: Returns ${response.status} (INCORRECT - should be 422)`);
        results.push({ endpoint, status: 'FAIL', details: `Returns ${response.status} instead of 422` });
        allCorrect = false;
      }
    } catch (error) {
      console.log(`❌ ${endpoint}: Network error - ${error.message}`);
      results.push({ endpoint, status: 'ERROR', details: error.message });
      allCorrect = false;
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('');
  console.log('📊 SUMMARY OF RESULTS:');
  console.log('======================');
  
  for (const result of results) {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'PARTIAL' ? '⚠️' : '❌';
    console.log(`${icon} ${result.endpoint}: ${result.status} - ${result.details}`);
  }
  
  console.log('');
  
  if (allCorrect) {
    console.log('🎉 ALL TESTS PASSED! Complete emergency fix is working correctly.');
    console.log('');
    console.log('🧪 READY FOR MANUAL TESTING:');
    console.log('============================');
    console.log('1. Open https://shg-mangement.vercel.app in INCOGNITO mode');
    console.log('2. Log in and go to Groups → Create Group');
    console.log('3. Fill out Step 1 and proceed to Step 2'); 
    console.log('4. Open browser console (F12)');
    console.log('5. Look for "🚨 EMERGENCY STEP 2 FIX ACTIVE" message');
    console.log('6. Upload a PDF file (any PDF will work)');
    console.log('7. Verify:');
    console.log('   - PDF uploads without hanging');
    console.log('   - Members are extracted/displayed');
    console.log('   - "Next Step" button works');
    console.log('   - Step 2 → Step 3 navigation is smooth');
    console.log('');
    console.log('💡 The fix is complete and all endpoints are correctly configured!');
  } else {
    console.log('❌ SOME TESTS FAILED! Emergency fix is not fully deployed.');
    console.log('');
    console.log('🔧 RECOMMENDED ACTIONS:');
    console.log('1. Wait 2-3 minutes for Vercel deployment to complete');
    console.log('2. Run this script again');
    console.log('3. Check Vercel deployment logs if issues persist');
  }
  
  console.log('');
  console.log('Script completed at:', new Date().toISOString());
}

// Wait a moment for deployment, then run test
console.log('⏳ Waiting 90 seconds for Vercel deployment to complete...');
setTimeout(() => {
  testAllPDFEndpoints().catch(console.error);
}, 90000);
