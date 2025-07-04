#!/usr/bin/env node

// Test the V33 API with members.pdf to ensure it still works correctly

const fs = require('fs');
const FormData = require('form-data');

async function testV33API() {
  console.log('🧪 Testing V33 API with members.pdf');
  console.log('=' .repeat(50));
  
  const pdfPath = '/home/pixel/Downloads/members.pdf';
  
  if (!fs.existsSync(pdfPath)) {
    console.log('❌ members.pdf not found');
    return;
  }
  
  // Create form data
  const form = new FormData();
  form.append('file', fs.createReadStream(pdfPath));
  
  console.log('📡 Sending request to local API...');
  
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
      console.log('✅ API call successful!');
      console.log(`📋 Members extracted: ${result.members.length}`);
      console.log(`🔧 Extraction method: ${result.extractionMethod}`);
      console.log(`📏 Text length: ${result.textLength}`);
      
      if (result.summary) {
        console.log('\n📊 Summary:');
        console.log(`   Total members: ${result.summary.totalMembers}`);
        console.log(`   Total loan amount: ₹${result.summary.totalLoanAmount}`);
        console.log(`   Average loan amount: ₹${result.summary.averageLoanAmount}`);
        console.log(`   Members with loans: ${result.summary.membersWithLoans}`);
      }
      
      console.log('\n📋 First 10 members:');
      result.members.slice(0, 10).forEach((member, index) => {
        console.log(`   ${index + 1}. ${member.name} - Loan: ₹${member.currentLoanAmount || 0}`);
      });
      
      // Verify we got all expected members
      if (result.members.length === 51) {
        console.log('\n✅ SUCCESS: All 51 members extracted!');
      } else {
        console.log(`\n⚠️  WARNING: Expected 51 members, got ${result.members.length}`);
      }
      
    } else {
      console.log('❌ API call failed');
      console.log('Error:', result.error);
      console.log('Details:', result.details);
    }
    
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }
}

testV33API().catch(console.error);
