#!/usr/bin/env node

// Quick test to check if the production PDF import is working correctly
// This simulates how the frontend would call the API

const FormData = require('form-data');
const fs = require('fs');

async function testProductionPDFImport() {
  console.log('🧪 Testing Production PDF Import for members.pdf');
  console.log('=' .repeat(60));
  
  const pdfPath = '/home/pixel/Downloads/members.pdf';
  
  if (!fs.existsSync(pdfPath)) {
    console.log('❌ members.pdf not found at expected location');
    console.log('💡 Please ensure the PDF file is available for testing');
    return;
  }
  
  console.log('📄 PDF file found, preparing upload...');
  
  // Test with V33 endpoint
  const endpoints = [
    { name: 'V33 Enhanced Reliability', url: 'http://localhost:3000/api/pdf-upload-v15' }
  ];
  
  for (const endpoint of endpoints) {
    console.log(`\n🔍 Testing ${endpoint.name}`);
    console.log('-' .repeat(40));
    
    try {
      const form = new FormData();
      form.append('file', fs.createReadStream(pdfPath));
      
      const fetch = (await import('node-fetch')).default;
      
      const response = await fetch(endpoint.url, {
        method: 'POST',
        body: form,
        headers: form.getHeaders()
      });
      
      console.log(`📊 Status: ${response.status} ${response.statusText}`);
      
      const result = await response.json();
      
      if (result.success) {
        console.log('✅ SUCCESS!');
        console.log(`📋 Members extracted: ${result.members.length}`);
        console.log(`🔧 Method: ${result.extractionMethod}`);
        
        if (result.members.length === 51) {
          console.log('🎉 Perfect! All 51 members extracted');
          
          // Show sample of extracted data
          console.log('\n📋 Sample members:');
          result.members.slice(0, 5).forEach((member, i) => {
            console.log(`   ${i + 1}. ${member.name} - Loan: ₹${member.currentLoanAmount}`);
          });
          
          // Check total loan amount
          const totalLoan = result.members.reduce((sum, m) => sum + (m.currentLoanAmount || 0), 0);
          console.log(`\n💰 Total loan amount: ₹${totalLoan.toLocaleString()}`);
          
        } else {
          console.log(`⚠️  Warning: Expected 51 members, got ${result.members.length}`);
        }
        
      } else {
        console.log('❌ FAILED');
        console.log(`Error: ${result.error}`);
        console.log(`Message: ${result.message || 'No message'}`);
        
        if (result.details) {
          console.log('\n📋 Error details:');
          console.log(`   Extraction method: ${result.extractionMethod || 'unknown'}`);
          console.log(`   Text length: ${result.textLength || 0}`);
          
          if (result.details.environment) {
            console.log('   Environment:', result.details.environment);
          }
          
          if (result.details.recommendation) {
            console.log(`   💡 Recommendation: ${result.details.recommendation}`);
          }
        }
      }
      
    } catch (error) {
      console.log(`❌ Request failed: ${error.message}`);
    }
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('🎯 Test completed');
  
  // Provide summary and next steps
  console.log('\n📋 Summary:');
  console.log('If the test shows 51 members extracted locally, the V33 solution is working.');
  console.log('If it fails in production, check the Vercel deployment logs for pdf-parse errors.');
  console.log('\n💡 Next steps if production still fails:');
  console.log('1. Check Vercel function logs for detailed error messages');
  console.log('2. Consider alternative PDF processing approaches');
  console.log('3. Contact support with the detailed error information');
}

testProductionPDFImport().catch(console.error);
