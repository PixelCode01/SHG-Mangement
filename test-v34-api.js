#!/usr/bin/env node

// Test V34 multi-strategy PDF extraction

const fs = require('fs');
const FormData = require('form-data');

async function testV34API() {
  console.log('🧪 Testing V34 Multi-Strategy PDF Extraction');
  console.log('=' .repeat(60));
  
  const pdfPath = '/home/pixel/Downloads/members.pdf';
  
  if (!fs.existsSync(pdfPath)) {
    console.log('❌ members.pdf not found');
    return;
  }
  
  // Create form data
  const form = new FormData();
  form.append('file', fs.createReadStream(pdfPath));
  
  console.log('📡 Testing V34 API...');
  
  try {
    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch('http://localhost:3000/api/pdf-upload-v15', {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });
    
    console.log(`📊 Response status: ${response.status}`);
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ V34 API call successful!');
      console.log(`📋 Members extracted: ${result.members.length}`);
      console.log(`🔧 Extraction method: ${result.extractionMethod}`);
      console.log(`📏 Text length: ${result.textLength}`);
      
      if (result.summary) {
        console.log('\n📊 Summary:');
        console.log(`   Total members: ${result.summary.totalMembers}`);
        console.log(`   Total loan amount: ₹${result.summary.totalLoanAmount.toLocaleString()}`);
        console.log(`   Average loan amount: ₹${result.summary.averageLoanAmount.toLocaleString()}`);
        console.log(`   Members with loans: ${result.summary.membersWithLoans}`);
      }
      
      console.log('\n📋 First 10 members:');
      result.members.slice(0, 10).forEach((member, index) => {
        console.log(`   ${index + 1}. ${member.name} - Loan: ₹${(member.currentLoanAmount || 0).toLocaleString()}`);
      });
      
      // Verify we got all expected members
      if (result.members.length === 51) {
        console.log('\n🎉 PERFECT! All 51 members extracted!');
      } else {
        console.log(`\n⚠️  Note: Got ${result.members.length} members (expected 51)`);
      }
      
    } else {
      console.log('❌ V34 API call failed');
      console.log('Error:', result.error);
      console.log('Message:', result.message);
      
      if (result.details) {
        console.log('\n📋 Error details:');
        console.log(`   Extraction method: ${result.extractionMethod}`);
        
        if (result.details.strategies) {
          console.log('   Failed strategies:');
          result.details.strategies.forEach((strategy, i) => {
            console.log(`     ${i + 1}. ${strategy.name}: ${strategy.error}`);
          });
        }
        
        if (result.details.environment) {
          console.log('   Environment:', result.details.environment);
        }
        
        if (result.details.recommendations) {
          console.log('   💡 Recommendations:');
          result.details.recommendations.forEach((rec, i) => {
            console.log(`     ${i + 1}. ${rec}`);
          });
        }
      }
    }
    
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('🎯 V34 Test completed');
  
  console.log('\n💡 Next steps:');
  console.log('1. If this test succeeds, the problem is production-specific');
  console.log('2. Deploy V34 to production and test with the actual production URL');
  console.log('3. Check Vercel function logs if production still fails');
  console.log('4. V34 includes pdf2json and binary extraction fallbacks');
}

testV34API().catch(console.error);
