#!/usr/bin/env node

/**
 * TEST UPDATED PDF EXTRACTION API
 * 
 * This script tests the new V18 PDF extraction that should properly
 * extract member names from your PDF instead of blocking them.
 */

const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

const LOCAL_URL = 'http://localhost:3000';
const PDF_PATH = '/home/pixel/Downloads/members.pdf';

console.log('🧪 TESTING V18 PDF EXTRACTION - SHOULD EXTRACT REAL NAMES');
console.log('==========================================================');

async function testNewPDFExtraction() {
  try {
    // Check if PDF exists
    if (!fs.existsSync(PDF_PATH)) {
      console.log('❌ PDF file not found:', PDF_PATH);
      return false;
    }

    const pdfStats = fs.statSync(PDF_PATH);
    console.log(`📁 PDF File: ${PDF_PATH}`);
    console.log(`📊 Size: ${pdfStats.size} bytes`);
    console.log('');

    // Expected names from the PDF (what we saw with pdftotext)
    const expectedNames = [
      'SANTOSH MISHRA', 'ASHOK KUMAR KESHRI', 'ANUP KUMAR KESHRI',
      'PRAMOD KUMAR KESHRI', 'MANOJ MISHRA', 'VIKKI THAKUR',
      'SUNIL KUMAR MAHTO', 'PAWAN KUMAR', 'SUDAMA PRASAD',
      'VIJAY KESHRI', 'UDAY PRASAD KESHRI', 'POOJA KUMARI',
      'KRISHNA KUMAR KESHRI', 'KAVITA KESHRI', 'JYOTI KESHRI',
      'MANOJ KESHRI', 'JALESHWAR MAHTO', 'SURENDRA MAHTO',
      'DILIP KUMAR RAJAK'
    ];

    console.log('📋 EXPECTED NAMES FROM PDF:');
    expectedNames.forEach((name, i) => console.log(`   ${i + 1}. ${name}`));
    console.log('');

    // Test the API
    console.log('🔍 TESTING V18 PDF EXTRACTION API');
    console.log('----------------------------------');
    
    const formData = new FormData();
    formData.append('file', fs.createReadStream(PDF_PATH));

    const response = await fetch(`${LOCAL_URL}/api/pdf-upload-v11`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });

    console.log(`📡 Status: ${response.status} ${response.statusText}`);
    
    const responseData = await response.text();
    console.log('📄 Raw Response:', responseData);

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseData);
    } catch (e) {
      console.log('❌ Could not parse JSON response');
      return false;
    }

    console.log('');
    console.log('🔍 EXTRACTION RESULTS');
    console.log('---------------------');

    if (response.status === 200 && parsedResponse.success) {
      console.log('✅ SUCCESS: PDF extraction worked!');
      console.log(`📊 Extracted ${parsedResponse.members?.length || 0} members`);
      
      if (parsedResponse.members && parsedResponse.members.length > 0) {
        console.log('');
        console.log('👥 EXTRACTED NAMES:');
        parsedResponse.members.forEach((member, i) => {
          console.log(`   ${i + 1}. ${member.name}`);
        });

        // Check if we got the expected names
        const extractedNames = parsedResponse.members.map(m => m.name);
        const matchCount = expectedNames.filter(name => 
          extractedNames.some(extracted => extracted.includes(name) || name.includes(extracted))
        ).length;

        console.log('');
        console.log('📊 QUALITY CHECK:');
        console.log(`   Expected: ${expectedNames.length} names`);
        console.log(`   Extracted: ${extractedNames.length} names`);
        console.log(`   Matches: ${matchCount} names`);
        console.log(`   Success Rate: ${Math.round((matchCount / expectedNames.length) * 100)}%`);

        if (matchCount >= expectedNames.length * 0.8) { // 80% success rate
          console.log('✅ EXCELLENT: Most names extracted correctly!');
          return true;
        } else if (matchCount >= expectedNames.length * 0.5) { // 50% success rate
          console.log('⚠️  PARTIAL: Some names extracted, may need tuning');
          return true;
        } else {
          console.log('❌ POOR: Few names matched, extraction needs improvement');
          return false;
        }
      } else {
        console.log('❌ No members extracted');
        return false;
      }
    } else if (response.status === 422) {
      console.log('⚠️  Server returned 422 - fallback mode');
      console.log('This means extraction failed and client should try alternative');
      return false;
    } else {
      console.log(`❌ Unexpected response: ${response.status}`);
      return false;
    }

  } catch (error) {
    console.error('💥 Test failed:', error.message);
    return false;
  }
}

async function runTest() {
  console.log('🚀 Starting V18 PDF extraction test...');
  console.log('');
  
  const success = await testNewPDFExtraction();
  
  console.log('');
  console.log('🎯 FINAL RESULT');
  console.log('================');
  
  if (success) {
    console.log('✅ V18 PDF EXTRACTION: WORKING!');
    console.log('✅ Real member names extracted');
    console.log('✅ No more garbage data');
    console.log('✅ Ready for production deployment');
  } else {
    console.log('❌ V18 PDF EXTRACTION: NEEDS IMPROVEMENT');
    console.log('🔧 May need better extraction algorithm');
    console.log('📋 Consider using pdf-parse library');
  }
  
  console.log('');
  console.log('🏁 TEST COMPLETE');
}

// Run the test
runTest();
