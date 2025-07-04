#!/usr/bin/env node

/**
 * IMMEDIATE PDF ENDPOINTS TEST
 * Tests all PDF endpoints immediately to check current status
 */

const BASE_URL = 'https://shg-mangement.vercel.app';

async function testImmediately() {
  console.log('🚀 IMMEDIATE TEST: PDF Endpoints Status Check');
  console.log('=============================================');
  console.log('Time:', new Date().toISOString());
  console.log('');
  
  const endpoints = [
    '/api/pdf-extract-v4',
    '/api/pdf-parse-universal', 
    '/api/pdf-production',
    '/api/pdf-upload-v11',
    '/api/pdf-upload-v13'
  ];
  
  console.log('📡 Testing endpoints immediately...');
  console.log('');
  
  for (const endpoint of endpoints) {
    try {
      const formData = new FormData();
      formData.append('file', new Blob(['test'], { type: 'application/pdf' }), 'test.pdf');
      
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        body: formData
      });
      
      const statusIcon = response.status === 422 ? '✅' : '❌';
      console.log(`${statusIcon} ${endpoint}: Returns ${response.status}`);
      
      if (response.status === 422) {
        try {
          const data = await response.json();
          if (data.emergencyFix) {
            console.log(`   🚨 Emergency fix flag detected`);
          }
        } catch (e) {
          // JSON parse error, but 422 is still good
        }
      }
      
    } catch (error) {
      console.log(`❌ ${endpoint}: Error - ${error.message}`);
    }
  }
  
  console.log('');
  console.log('Check completed at:', new Date().toISOString());
}

testImmediately().catch(console.error);
