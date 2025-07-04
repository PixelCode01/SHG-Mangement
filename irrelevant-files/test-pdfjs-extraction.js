#!/usr/bin/env node

/**
 * Test Client-Side PDF Extraction with PDF.js
 * This script tests the improved PDF extraction logic to ensure it works correctly.
 */

const fs = require('fs');
const path = require('path');

async function testPDFjsExtraction() {
  console.log('🧪 Testing Client-Side PDF.js Extraction...');
  
  try {
    // Import PDF.js 
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js');
    
    console.log('✅ PDF.js imported successfully');
    console.log(`📦 PDF.js version: ${pdfjsLib.version}`);
    
    // Set worker source
    pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/build/pdf.worker.js');
    
    console.log('✅ Worker source configured');
    
    // Test with a sample PDF if available
    const testFile = 'test-sample.pdf'; // You can add a real PDF file here for testing
    
    if (fs.existsSync(testFile)) {
      console.log(`📄 Testing with sample PDF: ${testFile}`);
      
      const arrayBuffer = fs.readFileSync(testFile);
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      console.log(`📄 PDF loaded with ${pdf.numPages} pages`);
      
      let textContent = '';
      
      // Extract text from first page
      const page = await pdf.getPage(1);
      const content = await page.getTextContent();
      
      const pageText = content.items
        .map(item => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      textContent += pageText;
      
      console.log(`📝 Extracted text (first 200 chars): ${textContent.substring(0, 200)}...`);
      console.log(`📊 Total text length: ${textContent.length} characters`);
      
    } else {
      console.log('ℹ️ No test PDF file found, but PDF.js import and setup is working');
    }
    
    console.log('✅ Client-side PDF.js extraction test completed successfully!');
    
    // Test API endpoint
    console.log('\n🌐 Testing /api/pdf-text-process endpoint...');
    
    const fetch = (await import('node-fetch')).default;
    
    const testText = `
    SWAWLAMBAN MICROFINANCE LIMITED
    
    NAME                    LOAN
    SUNITA DEVI             25000
    KAMLA DEVI              15000
    RITA SHARMA             30000
    ANITA KUMARI            20000
    MEERA DEVI              18000
    `;
    
    const response = await fetch('http://localhost:3000/api/pdf-text-process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: testText,
        fileName: 'test-sample.pdf',
        fileSize: 12345,
        extractionMethod: 'test-pdfjs'
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ API endpoint working:', result);
      
      if (result.success && result.members) {
        console.log(`📊 Successfully processed ${result.members.length} members:`);
        result.members.forEach((member, index) => {
          console.log(`  ${index + 1}. ${member.name} - ₹${member.loanAmount}`);
        });
      }
    } else {
      console.log(`❌ API endpoint failed: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.log('Error details:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testPDFjsExtraction().catch(console.error);
}

module.exports = { testPDFjsExtraction };
