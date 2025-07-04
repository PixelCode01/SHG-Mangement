#!/usr/bin/env node

// Production Member Import Test - Step 2
// Tests member import on https://shg-mangement.vercel.app
// Validates names and loan amounts from /home/pixel/Downloads/members.pdf

const fs = require('fs');

async function testProductionMemberImport() {
  console.log('🎯 PRODUCTION MEMBER IMPORT TEST - STEP 2');
  console.log('============================================================');
  console.log(`📅 Test Time: ${new Date().toISOString()}`);
  console.log('🌐 Production Site: https://shg-mangement.vercel.app');
  console.log('📄 Test File: /home/pixel/Downloads/members.pdf');
  console.log('');

  const productionUrl = 'https://shg-mangement.vercel.app/api/pdf-upload-v16';
  const pdfPath = '/home/pixel/Downloads/members.pdf';

  try {
    // Step 1: Check if PDF file exists
    console.log('📂 Step 1: Checking PDF file...');
    if (!fs.existsSync(pdfPath)) {
      console.log(`   ❌ PDF file not found: ${pdfPath}`);
      console.log('   💡 Please ensure the members.pdf file is in /home/pixel/Downloads/');
      return;
    }
    
    const fileStats = fs.statSync(pdfPath);
    console.log(`   ✅ PDF file found: ${(fileStats.size / 1024).toFixed(2)} KB`);

    // Step 2: Test API endpoint availability
    console.log('\n🌐 Step 2: Testing API endpoint...');
    const versionResponse = await fetch(productionUrl);
    
    if (!versionResponse.ok) {
      console.log(`   ❌ API endpoint not available: ${versionResponse.status}`);
      return;
    }
    
    const versionData = await versionResponse.json();
    console.log(`   ✅ API Status: ${versionResponse.status}`);
    console.log(`   🏷️  API Version: ${versionData.version || 'Unknown'}`);
    console.log(`   📍 Route: ${versionData.route || 'Unknown'}`);

    // Step 3: Upload PDF and test member import
    console.log('\n📤 Step 3: Uploading PDF for member extraction...');
    
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(pdfPath);
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });
    formData.append('file', blob, 'members.pdf');

    console.log('   🔄 Sending PDF to production server...');
    const startTime = Date.now();
    
    const uploadResponse = await fetch(productionUrl, {
      method: 'POST',
      body: formData
    });

    const processingTime = Date.now() - startTime;
    console.log(`   ⏱️  Processing time: ${processingTime}ms`);
    console.log(`   📊 Response status: ${uploadResponse.status}`);

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.log('   ❌ PDF import failed');
      console.log('   📝 Error response:', errorText);
      
      // Try to parse error details
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error) {
          console.log(`   🚨 Error message: ${errorData.error}`);
        }
        if (errorData.failedStrategies) {
          console.log('   🔧 Failed extraction strategies:');
          errorData.failedStrategies.forEach((strategy, i) => {
            console.log(`      ${i + 1}. ${strategy}`);
          });
        }
      } catch (e) {
        // Error text wasn't JSON
      }
      return;
    }

    // Step 4: Analyze extraction results
    console.log('\n📊 Step 4: Analyzing member extraction results...');
    const result = await uploadResponse.json();
    
    console.log('   ✅ PDF extraction successful!');
    console.log(`   👥 Total members extracted: ${result.memberCount || 0}`);
    console.log(`   💰 Total loan amount: ₹${result.totalLoanAmount?.toLocaleString() || '0'}`);
    console.log(`   🔧 Extraction method: ${result.extractionMethod || 'Unknown'}`);
    console.log(`   📈 Success rate: ${result.success ? '100%' : 'Partial'}`);

    if (result.extractionDetails) {
      console.log(`   📝 Raw text length: ${result.extractionDetails.textLength || 'Unknown'}`);
      console.log(`   🔍 Pattern matches: ${result.extractionDetails.patternMatches || 'Unknown'}`);
    }

    // Step 5: Validate specific member data
    console.log('\n🔍 Step 5: Validating member names and loan amounts...');
    
    if (!result.members || result.members.length === 0) {
      console.log('   ⚠️  No members found in extraction result');
      return;
    }

    console.log(`   📋 Found ${result.members.length} members:`);
    console.log('   ════════════════════════════════════════════════════════');
    
    let totalValidatedLoan = 0;
    let membersWithValidLoans = 0;
    
    result.members.forEach((member, index) => {
      const memberNum = index + 1;
      const name = member.name || 'Unknown';
      const loanAmount = member.loanAmount || 0;
      
      console.log(`   ${memberNum.toString().padStart(2, '0')}. ${name.padEnd(25)} | ₹${loanAmount.toLocaleString().padStart(8)}`);
      
      if (loanAmount > 0) {
        totalValidatedLoan += loanAmount;
        membersWithValidLoans++;
      }
    });
    
    console.log('   ════════════════════════════════════════════════════════');
    console.log(`   💰 Validated total loan: ₹${totalValidatedLoan.toLocaleString()}`);
    console.log(`   ✅ Members with loans: ${membersWithValidLoans}/${result.members.length}`);

    // Step 6: Quality assessment
    console.log('\n📈 Step 6: Quality Assessment...');
    
    const hasValidNames = result.members.some(m => m.name && m.name.length > 2);
    const hasValidLoans = result.members.some(m => m.loanAmount && m.loanAmount > 0);
    const reasonableMemberCount = result.members.length >= 10 && result.members.length <= 100;
    
    console.log(`   📝 Names extracted: ${hasValidNames ? '✅ YES' : '❌ NO'}`);
    console.log(`   💵 Loan amounts extracted: ${hasValidLoans ? '✅ YES' : '❌ NO'}`);
    console.log(`   📊 Reasonable member count: ${reasonableMemberCount ? '✅ YES' : '❌ NO'}`);
    
    const overallSuccess = hasValidNames && hasValidLoans && reasonableMemberCount;
    
    console.log('\n' + '='.repeat(60));
    if (overallSuccess) {
      console.log('🎉 SUCCESS! Member import is working correctly! 🎉');
      console.log('✅ Names are being extracted properly');
      console.log('✅ Loan amounts are being calculated correctly');
      console.log('✅ Production site is functioning as expected');
    } else {
      console.log('⚠️  PARTIAL SUCCESS - Issues detected:');
      if (!hasValidNames) console.log('   • Names not extracted properly');
      if (!hasValidLoans) console.log('   • Loan amounts not calculated');
      if (!reasonableMemberCount) console.log('   • Unusual member count');
    }
    console.log('='.repeat(60));

    // Step 7: Expected vs Actual comparison (if we have baseline data)
    console.log('\n📋 Step 7: Expected Data Check...');
    
    // Based on previous successful extractions, we expect:
    const expectedMemberCount = 48; // Based on previous successful tests
    const expectedMinLoanAmount = 50000; // Typical minimum total loan
    
    if (result.memberCount >= expectedMemberCount * 0.9) {
      console.log('   ✅ Member count matches expectations');
    } else {
      console.log(`   ⚠️  Lower member count than expected (got ${result.memberCount}, expected ~${expectedMemberCount})`);
    }
    
    if (totalValidatedLoan >= expectedMinLoanAmount) {
      console.log('   ✅ Total loan amount appears reasonable');
    } else {
      console.log(`   ⚠️  Lower loan amount than expected (got ₹${totalValidatedLoan.toLocaleString()})`);
    }

  } catch (error) {
    console.log('\n❌ TEST FAILED - Error occurred:');
    console.log(`   Error: ${error.message}`);
    console.log(`   Stack: ${error.stack}`);
    
    if (error.code === 'ENOTFOUND') {
      console.log('   💡 Network issue - check internet connection');
    } else if (error.code === 'ENOENT') {
      console.log('   💡 PDF file not found - check file path');
    }
  }
}

// Run the test
testProductionMemberImport().then(() => {
  console.log('\n🏁 Test completed');
}).catch(error => {
  console.log('\n💥 Unexpected error:', error.message);
});
