#!/usr/bin/env node

/**
 * Test with a very basic PDF file to see if the issue is with the specific PDF
 */

const fs = require('fs');
const FormData = require('form-data');

const PRODUCTION_URL = 'https://shg-mangement.vercel.app';

async function testWithMinimalPDF() {
  console.log('🧪 Testing with Minimal Data to Isolate Issue');
  console.log('==============================================');

  try {
    // Create a very small test file instead of PDF
    const testContent = "Test Name 12345\nAnother Person 67890";
    const testBuffer = Buffer.from(testContent);
    
    console.log('1️⃣ Testing with plain text file (to isolate PDF parsing issue)...');
    
    const formData = new FormData();
    formData.append('pdf', testBuffer, {
      filename: 'test.txt',
      contentType: 'text/plain'
    });
    
    const uploadResponse = await fetch(`${PRODUCTION_URL}/api/pdf-upload-v18`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.log(`❌ Text test failed with ${uploadResponse.status}:`);
      console.log(errorText.substring(0, 500));
    } else {
      const result = await uploadResponse.json();
      console.log('✅ Text test successful:', result.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testWithMinimalPDF();
