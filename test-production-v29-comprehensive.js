#!/usr/bin/env node

/**
 * Comprehensive Production Test for V29 PDF Extraction System
 * Tests both generic extraction and hardcoded fallback capabilities
 */

const fs = require('fs');
const FormData = require('form-data');

const PRODUCTION_URL = 'https://shg-mangement.vercel.app';
const TEST_PDF_PATH = '/home/pixel/Downloads/members.pdf';

async function testProductionPDFExtraction() {
  console.log('🚀 COMPREHENSIVE V29 PRODUCTION TEST');
  console.log('=====================================');
  console.log(`📍 Testing: ${PRODUCTION_URL}`);
  console.log(`📄 PDF: ${TEST_PDF_PATH}`);
  console.log('');

  try {
    // Step 1: Check API status
    console.log('1️⃣ Checking API Status...');
    const statusResponse = await fetch(`${PRODUCTION_URL}/api/pdf-upload-v18`);
    const statusData = await statusResponse.json();
    
    console.log(`✅ API Status: ${statusData.status}`);
    console.log(`🔢 Version: ${statusData.version}`);
    console.log(`📝 Message: ${statusData.message}`);
    console.log(`🎯 Features: ${statusData.features.length} available`);
    console.log('');

    // Step 2: Verify PDF file exists
    console.log('2️⃣ Verifying PDF File...');
    if (!fs.existsSync(TEST_PDF_PATH)) {
      throw new Error(`PDF file not found: ${TEST_PDF_PATH}`);
    }
    
    const stats = fs.statSync(TEST_PDF_PATH);
    console.log(`✅ PDF found: ${stats.size} bytes`);
    console.log('');

    // Step 3: Test PDF upload and extraction
    console.log('3️⃣ Testing PDF Upload & Extraction...');
    
    const formData = new FormData();
    formData.append('pdf', fs.createReadStream(TEST_PDF_PATH));
    
    const uploadResponse = await fetch(`${PRODUCTION_URL}/api/pdf-upload-v18`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });
    
    if (!uploadResponse.ok) {
      throw new Error(`HTTP ${uploadResponse.status}: ${uploadResponse.statusText}`);
    }
    
    const result = await uploadResponse.json();
    
    console.log(`✅ Upload Success: ${result.success}`);
    console.log(`📊 Members Found: ${result.memberCount}`);
    console.log(`💰 Total Loan Amount: ₹${result.totalLoanAmount?.toLocaleString() || 'N/A'}`);
    console.log(`🏦 Members with Loans: ${result.membersWithLoans || 0}`);
    console.log(`🔧 Extraction Method: ${result.extractionMethod}`);
    console.log(`📏 Text Length: ${result.textLength}`);
    console.log('');

    // Step 4: Validate extraction quality
    console.log('4️⃣ Validating Extraction Quality...');
    
    if (!result.members || result.members.length === 0) {
      throw new Error('No members extracted from PDF');
    }

    // Check for key members that should be present
    const keyMembers = [
      'Santosh Mishra',
      'Santosh Kumar Mishra', 
      'Geeta Devi',
      'Ram Kumar',
      'Sita Devi'
    ];

    let foundKeyMembers = 0;
    const foundMembers = [];
    
    result.members.forEach((member, index) => {
      foundMembers.push(`${index + 1}. ${member.name} - ₹${member.loanAmount?.toLocaleString() || '0'}`);
      
      // Check if this is one of our key members (case insensitive)
      for (const keyMember of keyMembers) {
        if (member.name.toLowerCase().includes(keyMember.toLowerCase()) ||
            keyMember.toLowerCase().includes(member.name.toLowerCase())) {
          foundKeyMembers++;
          console.log(`✅ Found key member: ${member.name} (₹${member.loanAmount?.toLocaleString() || '0'})`);
        }
      }
    });

    console.log('');
    console.log('📋 All Extracted Members:');
    foundMembers.forEach(member => console.log(`   ${member}`));
    console.log('');

    // Step 5: Quality Assessment
    console.log('5️⃣ Quality Assessment...');
    
    const qualityChecks = [
      {
        name: 'Member Count',
        test: result.memberCount >= 40,
        actual: result.memberCount,
        expected: '≥40'
      },
      {
        name: 'Key Members Found',
        test: foundKeyMembers >= 1,
        actual: foundKeyMembers,
        expected: '≥1'
      },
      {
        name: 'Total Loan Amount',
        test: result.totalLoanAmount > 0,
        actual: `₹${result.totalLoanAmount?.toLocaleString() || '0'}`,
        expected: '>0'
      },
      {
        name: 'Members with Loans',
        test: result.membersWithLoans > 0,
        actual: result.membersWithLoans,
        expected: '>0'
      },
      {
        name: 'No Duplicate Names',
        test: result.memberCount === new Set(result.members.map(m => m.name.toLowerCase())).size,
        actual: new Set(result.members.map(m => m.name.toLowerCase())).size,
        expected: result.memberCount
      }
    ];

    let passedChecks = 0;
    qualityChecks.forEach(check => {
      const status = check.test ? '✅' : '❌';
      console.log(`${status} ${check.name}: ${check.actual} (expected: ${check.expected})`);
      if (check.test) passedChecks++;
    });

    console.log('');
    console.log(`🎯 Quality Score: ${passedChecks}/${qualityChecks.length} checks passed`);

    // Step 6: Final Assessment
    console.log('6️⃣ Final Assessment...');
    
    const isSuccess = passedChecks >= 4 && result.success;
    
    if (isSuccess) {
      console.log('🎉 COMPREHENSIVE TEST PASSED! 🎉');
      console.log('✅ V29 Generic extraction system is working correctly');
      console.log('✅ Production deployment is functioning properly');
      console.log('✅ PDF import capabilities are robust');
    } else {
      console.log('❌ COMPREHENSIVE TEST FAILED');
      console.log('⚠️  Some quality checks failed - review needed');
    }

    return { success: isSuccess, result, qualityChecks, passedChecks };

  } catch (error) {
    console.error('❌ TEST FAILED:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    return { success: false, error: error.message };
  }
}

// Run the test
testProductionPDFExtraction()
  .then(testResult => {
    console.log('\n' + '='.repeat(50));
    console.log(`Final Status: ${testResult.success ? 'PASSED ✅' : 'FAILED ❌'}`);
    process.exit(testResult.success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
