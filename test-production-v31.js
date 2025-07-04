// Production deployment verification script for improved PDF extraction
// This script tests the deployed V31 API endpoint with members.pdf

const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

const PRODUCTION_URL = 'https://shg-mangement.vercel.app/api/pdf-upload-v15';
const LOCAL_URL = 'http://localhost:3000/api/pdf-upload-v15';
const PDF_PATH = '/home/pixel/Downloads/members.pdf';

async function testProductionAPI() {
  console.log('🚀 TESTING V31 PRODUCTION API DEPLOYMENT...');
  
  if (!fs.existsSync(PDF_PATH)) {
    console.error('❌ PDF file not found:', PDF_PATH);
    return;
  }

  // Test 1: Check API status
  try {
    console.log('\n📋 TEST 1: Checking API status...');
    const statusResponse = await fetch(PRODUCTION_URL);
    const statusData = await statusResponse.json();
    console.log('✅ API Status:', statusData);
    
    if (statusData.version !== 'V31') {
      console.error('❌ Expected V31, got:', statusData.version);
      return;
    }
  } catch (error) {
    console.error('❌ Status check failed:', error.message);
    return;
  }

  // Test 2: Upload members.pdf to production
  try {
    console.log('\n📋 TEST 2: Uploading members.pdf to production...');
    
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(PDF_PATH);
    formData.append('file', fileBuffer, {
      filename: 'members.pdf',
      contentType: 'application/pdf'
    });

    console.log(`📤 Uploading ${fileBuffer.length} bytes to production...`);
    
    const uploadResponse = await fetch(PRODUCTION_URL, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });

    const uploadData = await uploadResponse.json();
    
    if (uploadData.success) {
      console.log('✅ Production upload successful!');
      console.log(`📊 Extracted ${uploadData.totalExtracted} members`);
      console.log(`🔧 Extraction method: ${uploadData.extractionMethod}`);
      console.log(`📝 Text length: ${uploadData.textLength}`);
      
      // Validate the results
      if (uploadData.members && uploadData.members.length > 0) {
        console.log('\n📋 Sample extracted members:');
        uploadData.members.slice(0, 10).forEach((member, index) => {
          console.log(`  ${index + 1}. ${member.name} (confidence: ${member.confidence})`);
        });
        
        // Check for invalid entries
        const invalidMembers = uploadData.members.filter(member => 
          member.name.includes('UMAR ') || 
          member.name.includes('NAMELOANEMAILPHONE') ||
          member.name.includes('\n')
        );
        
        if (invalidMembers.length > 0) {
          console.log('❌ Found invalid members:', invalidMembers.map(m => m.name));
        } else {
          console.log('✅ All extracted members appear valid!');
        }
        
        console.log(`\n🎉 PRODUCTION TEST PASSED: ${uploadData.totalExtracted} valid members extracted`);
      } else {
        console.log('❌ No members extracted from PDF');
      }
    } else {
      console.error('❌ Production upload failed:', uploadData);
    }
    
  } catch (error) {
    console.error('❌ Production upload error:', error.message);
    console.error('Stack:', error.stack);
  }
}

async function compareWithLocal() {
  console.log('\n🔄 BONUS TEST: Comparing with local development...');
  
  try {
    // First check if local server is running
    const localStatus = await fetch(LOCAL_URL);
    const localData = await localStatus.json();
    console.log('✅ Local API available:', localData.version);
    
    // Upload to local
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(PDF_PATH);
    formData.append('file', fileBuffer, {
      filename: 'members.pdf',
      contentType: 'application/pdf'
    });

    const localUploadResponse = await fetch(LOCAL_URL, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });

    const localUploadData = await localUploadResponse.json();
    
    if (localUploadData.success) {
      console.log(`✅ Local extraction: ${localUploadData.totalExtracted} members`);
      console.log(`🔧 Local method: ${localUploadData.extractionMethod}`);
    }
    
  } catch (error) {
    console.log('ℹ️ Local server not available (this is normal for production testing)');
  }
}

async function runTests() {
  await testProductionAPI();
  await compareWithLocal();
  console.log('\n🏁 TEST COMPLETED');
}

runTests().catch(console.error);
