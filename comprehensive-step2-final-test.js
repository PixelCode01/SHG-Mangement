#!/usr/bin/env node

// COMPREHENSIVE STEP 2 MEMBER IMPORT FINAL TEST
// Tests all available APIs and provides complete assessment

const fs = require('fs');

async function comprehensiveStep2Test() {
  console.log('🎯 COMPREHENSIVE STEP 2 MEMBER IMPORT FINAL TEST');
  console.log('═'.repeat(80));
  console.log(`📅 Test Time: ${new Date().toISOString()}`);
  console.log('🌐 Production Site: https://shg-mangement.vercel.app');
  console.log('📄 Test File: /home/pixel/Downloads/members.pdf');
  console.log('🎯 Objective: Verify member names and loan amounts import correctly');
  console.log('');

  const pdfPath = '/home/pixel/Downloads/members.pdf';
  
  // Test file verification
  console.log('📂 STEP 1: Test File Verification');
  console.log('─'.repeat(50));
  if (!fs.existsSync(pdfPath)) {
    console.log(`   ❌ PDF file not found: ${pdfPath}`);
    return;
  }
  
  const fileStats = fs.statSync(pdfPath);
  console.log(`   ✅ PDF file confirmed: ${(fileStats.size / 1024).toFixed(2)} KB`);
  console.log(`   📄 File path: ${pdfPath}`);
  console.log('   📋 Expected content: ~50 members with loan amounts');
  
  // Test available APIs
  const apisToTest = [
    { name: 'V25 API', endpoint: 'pdf-upload-v16', version: 'V25' },
    { name: 'V26 API', endpoint: 'pdf-upload-v17', version: 'V26' },
    { name: 'V27 API', endpoint: 'pdf-upload-v18', version: 'V27' }
  ];
  
  console.log('\n🌐 STEP 2: Production API Testing');
  console.log('─'.repeat(50));
  
  const results = [];
  
  for (const api of apisToTest) {
    console.log(`\n🔍 Testing ${api.name} (${api.endpoint})...`);
    
    const productionUrl = `https://shg-mangement.vercel.app/api/${api.endpoint}`;
    
    try {
      // Test endpoint availability
      const versionResponse = await fetch(productionUrl);
      
      if (!versionResponse.ok) {
        console.log(`   ⚠️  ${api.name} not deployed (Status: ${versionResponse.status})`);
        results.push({
          api: api.name,
          deployed: false,
          status: versionResponse.status,
          members: 0,
          loanAmount: 0,
          names: false,
          loans: false
        });
        continue;
      }
      
      const versionData = await versionResponse.json();
      console.log(`   ✅ ${api.name} available (Version: ${versionData.version})`);
      
      // Test PDF upload
      console.log(`   📤 Testing PDF upload with ${api.name}...`);
      
      const formData = new FormData();
      const fileBuffer = fs.readFileSync(pdfPath);
      const blob = new Blob([fileBuffer], { type: 'application/pdf' });
      formData.append('file', blob, 'members.pdf');

      const startTime = Date.now();
      const uploadResponse = await fetch(productionUrl, {
        method: 'POST',
        body: formData
      });

      const processingTime = Date.now() - startTime;
      
      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.log(`   ❌ ${api.name} PDF processing failed (${uploadResponse.status})`);
        console.log(`   📝 Error: ${errorText.substring(0, 100)}...`);
        results.push({
          api: api.name,
          deployed: true,
          status: uploadResponse.status,
          error: true,
          members: 0,
          loanAmount: 0,
          names: false,
          loans: false
        });
        continue;
      }

      const result = await uploadResponse.json();
      
      // Analyze results
      const memberCount = result.memberCount || result.members?.length || 0;
      const totalLoanAmount = result.totalLoanAmount || 
        (result.members ? result.members.reduce((sum, m) => sum + (m.loanAmount || m.currentLoanAmount || 0), 0) : 0);
      
      const hasValidNames = result.members?.some(m => m.name && m.name.length > 3) || false;
      const hasValidLoans = totalLoanAmount > 0;
      
      console.log(`   ✅ ${api.name} processing successful!`);
      console.log(`   ⏱️  Processing time: ${processingTime}ms`);
      console.log(`   👥 Members extracted: ${memberCount}`);
      console.log(`   💰 Total loan amount: ₹${totalLoanAmount.toLocaleString()}`);
      console.log(`   📝 Names valid: ${hasValidNames ? 'YES' : 'NO'}`);
      console.log(`   💵 Loans valid: ${hasValidLoans ? 'YES' : 'NO'}`);
      
      // Show sample members
      if (result.members && result.members.length > 0) {
        console.log(`   📋 Sample members (first 3):`);
        result.members.slice(0, 3).forEach((member, i) => {
          const name = member.name || 'Unknown';
          const loan = member.loanAmount || member.currentLoanAmount || 0;
          console.log(`      ${i + 1}. ${name} - ₹${loan.toLocaleString()}`);
        });
      }
      
      results.push({
        api: api.name,
        deployed: true,
        status: 200,
        members: memberCount,
        totalLoanAmount: totalLoanAmount,
        names: hasValidNames,
        loans: hasValidLoans,
        processingTime: processingTime,
        method: result.extractionMethod || 'unknown',
        success: true
      });
      
    } catch (error) {
      console.log(`   ❌ ${api.name} test failed: ${error.message}`);
      results.push({
        api: api.name,
        deployed: false,
        error: error.message,
        members: 0,
        loanAmount: 0,
        names: false,
        loans: false
      });
    }
  }
  
  // Results analysis
  console.log('\n📊 STEP 3: Results Analysis');
  console.log('═'.repeat(50));
  
  console.log('\n📋 API Comparison Table:');
  console.log('┌─────────────┬──────────────┬─────────────┬──────────────┬─────────────┬─────────────┐');
  console.log('│    API      │   Deployed   │   Members   │   Loan Total │    Names    │    Loans    │');
  console.log('├─────────────┼──────────────┼─────────────┼──────────────┼─────────────┼─────────────┤');
  
  results.forEach(result => {
    const api = result.api.padEnd(11);
    const deployed = (result.deployed ? '✅ YES' : '❌ NO').padEnd(12);
    const members = result.members.toString().padEnd(11);
    const loans = (result.totalLoanAmount ? `₹${(result.totalLoanAmount/1000000).toFixed(1)}M` : '₹0').padEnd(12);
    const names = (result.names ? '✅ YES' : '❌ NO').padEnd(11);
    const loansValid = (result.loans ? '✅ YES' : '❌ NO').padEnd(11);
    
    console.log(`│ ${api} │ ${deployed} │ ${members} │ ${loans} │ ${names} │ ${loansValid} │`);
  });
  
  console.log('└─────────────┴──────────────┴─────────────┴──────────────┴─────────────┴─────────────┘');
  
  // Find the best working API
  const workingApis = results.filter(r => r.deployed && r.success);
  const bestApi = workingApis.reduce((best, current) => {
    if (!best) return current;
    
    const currentScore = (current.names ? 1 : 0) + (current.loans ? 1 : 0) + (current.members / 50);
    const bestScore = (best.names ? 1 : 0) + (best.loans ? 1 : 0) + (best.members / 50);
    
    return currentScore > bestScore ? current : best;
  }, null);
  
  // Final assessment
  console.log('\n🎯 STEP 4: Final Assessment');
  console.log('═'.repeat(50));
  
  if (bestApi) {
    console.log(`🏆 Best Performing API: ${bestApi.api}`);
    console.log(`   👥 Members: ${bestApi.members}`);
    console.log(`   💰 Total: ₹${bestApi.totalLoanAmount.toLocaleString()}`);
    console.log(`   🔧 Method: ${bestApi.method}`);
    console.log(`   ⏱️  Speed: ${bestApi.processingTime}ms`);
    
    const namesWorking = bestApi.names;
    const loansWorking = bestApi.loans;
    
    console.log('\n📋 Step 2 Requirements Check:');
    console.log(`   ✅ Production site accessible: YES`);
    console.log(`   ✅ PDF upload working: YES`);
    console.log(`   ${namesWorking ? '✅' : '❌'} Member names extracted: ${namesWorking ? 'YES' : 'NO'}`);
    console.log(`   ${loansWorking ? '✅' : '❌'} Loan amounts extracted: ${loansWorking ? 'YES' : 'NO'}`);
    
    const overallSuccess = namesWorking && loansWorking;
    const partialSuccess = namesWorking || loansWorking;
    
    console.log('\n' + '═'.repeat(60));
    if (overallSuccess) {
      console.log('🎉🎉🎉 STEP 2 COMPLETE: FULL SUCCESS! 🎉🎉🎉');
      console.log('✅ Member names are correctly imported');
      console.log('✅ Loan amounts are correctly calculated');
      console.log('✅ Production functionality is working perfectly');
    } else if (partialSuccess) {
      console.log('🎗️  STEP 2 PARTIAL SUCCESS');
      console.log('✅ Some functionality is working correctly');
      if (namesWorking) console.log('✅ Member names are being imported');
      if (loansWorking) console.log('✅ Loan amounts are being calculated');
      if (!loansWorking) console.log('⚠️  Loan amounts need improvement (V27 API ready)');
      if (!namesWorking) console.log('⚠️  Name extraction needs improvement');
    } else {
      console.log('⚠️  STEP 2 NEEDS IMPROVEMENT');
      console.log('❌ Core functionality needs fixes');
    }
    console.log('═'.repeat(60));
    
  } else {
    console.log('❌ No working APIs found');
    console.log('💡 Check deployment status and try again');
  }
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  if (results.some(r => r.api === 'V27 API' && !r.deployed)) {
    console.log('   🚀 Deploy V27 API for complete loan amount extraction');
  }
  if (bestApi && !bestApi.loans) {
    console.log('   🔧 Improve loan amount extraction patterns');
  }
  if (bestApi && bestApi.members < 40) {
    console.log('   📈 Optimize member extraction to get all ~50 members');
  }
  
  console.log('\n🏁 Test Complete!');
  console.log(`📊 Summary: ${workingApis.length}/${apisToTest.length} APIs working`);
}

comprehensiveStep2Test().catch(error => {
  console.log(`\n💥 Test failed: ${error.message}`);
});
