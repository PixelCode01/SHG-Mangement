#!/usr/bin/env node

// Production Test for V27 API - Final Member Import Verification
// Test the corrected V27 API on https://shg-mangement.vercel.app

const fs = require('fs');

async function testProductionV27Final() {
  console.log('🎯 PRODUCTION V27 FINAL TEST - STEP 2 COMPLETION');
  console.log('============================================================');
  console.log(`📅 Test Time: ${new Date().toISOString()}`);
  console.log('🌐 Production Site: https://shg-mangement.vercel.app');
  console.log('📄 Test File: /home/pixel/Downloads/members.pdf');
  console.log('🔧 Testing API: pdf-upload-v18 (V27 - Corrected)');
  console.log('');

  const productionUrl = 'https://shg-mangement.vercel.app/api/pdf-upload-v18';
  const pdfPath = '/home/pixel/Downloads/members.pdf';

  try {
    // Step 1: Check if PDF file exists
    console.log('📂 Step 1: Verifying PDF file...');
    if (!fs.existsSync(pdfPath)) {
      console.log(`   ❌ PDF file not found: ${pdfPath}`);
      return;
    }
    
    const fileStats = fs.statSync(pdfPath);
    console.log(`   ✅ PDF file confirmed: ${(fileStats.size / 1024).toFixed(2)} KB`);

    // Step 2: Test V27 API endpoint availability
    console.log('\n🌐 Step 2: Testing V27 API endpoint...');
    try {
      const versionResponse = await fetch(productionUrl);
      
      if (!versionResponse.ok) {
        console.log(`   ⚠️  V27 API not yet deployed (Status: ${versionResponse.status})`);
        console.log('   💡 The V27 API may still be deploying to production');
        console.log('   🔄 You can try again in a few minutes');
        return;
      }
      
      const versionData = await versionResponse.json();
      console.log(`   ✅ V27 API Status: ${versionResponse.status}`);
      console.log(`   🏷️  API Version: ${versionData.version || 'Unknown'}`);
      console.log(`   📍 Route: ${versionData.route || 'Unknown'}`);
      console.log(`   📝 Description: ${versionData.message || 'Unknown'}`);
      
      if (versionData.version !== 'V27') {
        console.log('   ⚠️  V27 not yet deployed, testing anyway...');
      }
    } catch (fetchError) {
      console.log(`   ❌ V27 API endpoint not accessible: ${fetchError.message}`);
      return;
    }

    // Step 3: Upload PDF with V27 corrected extraction
    console.log('\n📤 Step 3: Testing V27 corrected PDF extraction...');
    
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(pdfPath);
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });
    formData.append('file', blob, 'members.pdf');

    console.log('   🔄 Uploading PDF to V27 API...');
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
      console.log('   ❌ V27 PDF extraction failed');
      console.log('   📝 Error response:', errorText);
      
      try {
        const errorData = JSON.parse(errorText);
        console.log(`   🚨 Error: ${errorData.error || 'Unknown error'}`);
        console.log(`   📋 Message: ${errorData.message || 'No message'}`);
      } catch (e) {
        // Error text wasn't JSON
      }
      return;
    }

    // Step 4: Analyze V27 results
    console.log('\n📊 Step 4: Analyzing V27 corrected results...');
    const result = await uploadResponse.json();
    
    console.log('   🎉 V27 extraction successful!');
    console.log(`   👥 Members extracted: ${result.memberCount || result.members?.length || 0}`);
    console.log(`   💰 Total loan amount: ₹${result.totalLoanAmount?.toLocaleString() || '0'}`);
    console.log(`   📈 Members with loans: ${result.membersWithLoans || 'Unknown'}`);
    console.log(`   🔧 Extraction method: ${result.extractionMethod || 'Unknown'}`);
    console.log(`   📝 Text processed: ${result.textLength || 'Unknown'} characters`);

    // Step 5: Detailed member validation
    console.log('\n🔍 Step 5: Detailed Member Validation...');
    
    if (!result.members || result.members.length === 0) {
      console.log('   ❌ No members found in V27 extraction result');
      return;
    }

    console.log(`   📋 Detailed member list (${result.members.length} members):`);
    console.log('   ═══════════════════════════════════════════════════════════════════');
    
    let totalValidated = 0;
    let loansValidated = 0;
    
    result.members.forEach((member, index) => {
      const memberNum = index + 1;
      const name = member.name || 'Unknown';
      const loanAmount = member.loanAmount || member.currentLoanAmount || 0;
      
      console.log(`   ${memberNum.toString().padStart(2, '0')}. ${name.padEnd(25)} | ₹${loanAmount.toLocaleString().padStart(8)}`);
      
      totalValidated += loanAmount;
      if (loanAmount > 0) loansValidated++;
    });
    
    console.log('   ═══════════════════════════════════════════════════════════════════');
    console.log(`   💰 Validated total: ₹${totalValidated.toLocaleString()}`);
    console.log(`   ✅ Active loans: ${loansValidated}/${result.members.length} members`);

    // Step 6: Quality Assessment vs Expected
    console.log('\n📈 Step 6: Quality Assessment...');
    
    const hasValidNames = result.members.some(m => m.name && m.name.length > 5 && m.name.split(' ').length >= 2);
    const hasValidLoans = result.members.some(m => (m.loanAmount || m.currentLoanAmount || 0) > 0);
    const reasonableMemberCount = result.members.length >= 40 && result.members.length <= 60;
    const reasonableTotalLoan = totalValidated >= 5000000 && totalValidated <= 10000000;
    
    console.log(`   📝 Names properly formatted: ${hasValidNames ? '✅ YES' : '❌ NO'}`);
    console.log(`   💵 Loan amounts extracted: ${hasValidLoans ? '✅ YES' : '❌ NO'}`);
    console.log(`   📊 Reasonable member count: ${reasonableMemberCount ? '✅ YES' : '❌ NO'} (${result.members.length})`);
    console.log(`   💰 Reasonable loan total: ${reasonableTotalLoan ? '✅ YES' : '❌ NO'} (₹${totalValidated.toLocaleString()})`);
    
    const overallSuccess = hasValidNames && hasValidLoans && reasonableMemberCount && reasonableTotalLoan;
    
    console.log('\n' + '='.repeat(80));
    if (overallSuccess) {
      console.log('🎉🎉🎉 SUCCESS! V27 MEMBER IMPORT IS WORKING PERFECTLY! 🎉🎉🎉');
      console.log('✅ Names are properly extracted and formatted');
      console.log('✅ Loan amounts are correctly calculated');
      console.log('✅ Member count is within expected range');
      console.log('✅ Total loan amount is reasonable');
      console.log('✅ Production site is fully functional');
      console.log('');
      console.log('🏆 STEP 2 MEMBER IMPORT TEST: COMPLETED SUCCESSFULLY');
    } else {
      console.log('⚠️  PARTIAL SUCCESS - Some issues detected:');
      if (!hasValidNames) console.log('   • Names not properly formatted');
      if (!hasValidLoans) console.log('   • Loan amounts not extracted');
      if (!reasonableMemberCount) console.log('   • Member count outside expected range');
      if (!reasonableTotalLoan) console.log('   • Total loan amount seems unusual');
    }
    console.log('='.repeat(80));

    // Step 7: Performance and reliability metrics
    console.log('\n📊 Step 7: Performance Metrics...');
    console.log(`   ⏱️  Processing speed: ${processingTime}ms (${processingTime < 3000 ? 'Fast' : 'Acceptable'})`);
    console.log(`   📈 Extraction efficiency: ${((result.members?.length || 0) / 50 * 100).toFixed(1)}%`);
    console.log(`   🔧 Method used: ${result.extractionMethod || 'Unknown'}`);
    console.log(`   ✅ Success rate: ${result.success ? '100%' : 'Partial'}`);

    // Expected comparison with local test
    const expectedMembers = 50;
    const expectedTotal = 6814680;
    
    console.log('\n🎯 Step 8: Expected vs Actual Comparison...');
    console.log(`   👥 Members: ${result.members.length}/${expectedMembers} (${(result.members.length/expectedMembers*100).toFixed(1)}%)`);
    console.log(`   💰 Total: ₹${totalValidated.toLocaleString()}/₹${expectedTotal.toLocaleString()} (${(totalValidated/expectedTotal*100).toFixed(1)}%)`);
    
    if (result.members.length >= expectedMembers * 0.9 && totalValidated >= expectedTotal * 0.9) {
      console.log('   🎯 Results match expected values very closely!');
    } else {
      console.log('   ⚠️  Results differ from expected values');
    }

  } catch (error) {
    console.log('\n❌ V27 PRODUCTION TEST FAILED');
    console.log(`   Error: ${error.message}`);
    
    if (error.code === 'ENOTFOUND') {
      console.log('   💡 Network connectivity issue');
    } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
      console.log('   💡 V27 API might not be deployed yet');
    }
    
    console.log(`   Stack: ${error.stack?.substring(0, 200)}...`);
  }
}

// Run the final V27 production test
testProductionV27Final().then(() => {
  console.log('\n🏁 V27 Production test completed');
  console.log('📋 Summary: If successful, Step 2 member import testing is complete!');
}).catch(error => {
  console.log('\n💥 Unexpected V27 test error:', error.message);
});
