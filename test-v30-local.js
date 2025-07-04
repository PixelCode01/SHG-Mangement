#!/usr/bin/env node

/**
 * Test V30 production-ready imports locally
 */

const fs = require('fs');
const FormData = require('form-data');

const LOCAL_URL = 'http://localhost:3000';
const TEST_PDF_PATH = '/home/pixel/Downloads/members.pdf';

async function testLocalV30() {
  console.log('🧪 Testing V30 Production-Ready Imports Locally');
  console.log('================================================');

  try {
    // Check if server is running
    console.log('1️⃣ Checking if dev server is running...');
    try {
      const statusResponse = await fetch(`${LOCAL_URL}/api/pdf-upload-v18`);
      const statusData = await statusResponse.json();
      console.log(`✅ Dev server running - Version: ${statusData.version}`);
    } catch (error) {
      console.log('❌ Dev server not running. Starting it...');
      console.log('Please run "npm run dev" first');
      return;
    }

    // Test PDF upload
    console.log('2️⃣ Testing PDF upload...');
    
    if (!fs.existsSync(TEST_PDF_PATH)) {
      throw new Error(`PDF file not found: ${TEST_PDF_PATH}`);
    }

    const formData = new FormData();
    formData.append('pdf', fs.createReadStream(TEST_PDF_PATH));
    
    const uploadResponse = await fetch(`${LOCAL_URL}/api/pdf-upload-v18`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`HTTP ${uploadResponse.status}: ${errorText}`);
    }
    
    const result = await uploadResponse.json();
    
    console.log(`✅ Success: ${result.success}`);
    console.log(`📊 Members: ${result.memberCount}`);
    console.log(`💰 Total: ₹${result.totalLoanAmount?.toLocaleString()}`);
    console.log(`🔧 Method: ${result.extractionMethod}`);

    console.log('\n🎉 V30 Local test PASSED!');
    
  } catch (error) {
    console.error('❌ V30 Local test FAILED:', error.message);
  }
}

testLocalV30();
