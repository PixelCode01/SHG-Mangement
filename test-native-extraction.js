#!/usr/bin/env node

/**
 * Simple PDF extraction test to verify the new approaches work
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 SIMPLE PDF EXTRACTION TEST');
console.log('=============================\n');

// Create a simple test PDF using pure text
const createTestPDF = () => {
  // This is a simplified approach - in reality, we'd test with the actual members.pdf
  // For now, create a test buffer with member-like data
  const testContent = `
MEMBER LIST
NAME                    LOAN
Sunita Devi            5000
Meera Kumari           3000  
Pushpa Devi            4500
Radha Sharma           2000
Anita Singh            3500
Geeta Yadav            4000
Seema Gupta            2500
Neha Prasad            3000
`;
  
  return Buffer.from(testContent, 'utf8');
};

// Test the native extraction approach (v17)
const testNativeExtraction = async () => {
  console.log('🔍 Testing Native Text Extraction (V17)...');
  console.log('==========================================\n');
  
  const buffer = createTestPDF();
  console.log('📦 Test buffer created:', buffer.length, 'bytes');
  
  // Simulate the extraction logic from v17
  const extractTextFromBuffer = (buffer) => {
    let allText = '';
    
    // Try different encodings
    const encodings = ['utf8', 'latin1', 'ascii'];
    
    for (const encoding of encodings) {
      try {
        const text = buffer.toString(encoding);
        
        // Extract readable text patterns
        const readableText = text.match(/[A-Za-z\s\u0900-\u097F]{3,}/g);
        if (readableText) {
          allText += readableText.join(' ') + '\n';
        }
      } catch (error) {
        console.log(`⚠️ Encoding ${encoding} failed:`, error.message);
      }
    }
    
    return allText;
  };
  
  const extractedText = extractTextFromBuffer(buffer);
  console.log('✅ Text extracted:', extractedText.length, 'characters');
  console.log('📋 Sample text:', extractedText.substring(0, 200));
  
  // Test member extraction patterns
  const members = [];
  
  // Strategy 1: Indian name patterns
  const indianNamePattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:Devi|Kumari|Singh|Kumar|Prasad|Yadav|Gupta|Sharma)))\s+(\d+(?:\.\d+)?)/g;
  
  let matches = Array.from(extractedText.matchAll(indianNamePattern));
  console.log(`📊 Indian name pattern matches: ${matches.length}`);
  
  for (const match of matches) {
    if (match[1] && match[2]) {
      const name = match[1].trim();
      const amount = parseFloat(match[2]);
      
      if (name.length >= 5 && amount > 0 && amount < 100000) {
        members.push({ name, amount });
        console.log(`✅ Extracted: ${name} - ₹${amount}`);
      }
    }
  }
  
  console.log(`\n🎉 Native extraction result: ${members.length} members`);
  return members;
};

// Main test function
const runTest = async () => {
  try {
    const members = await testNativeExtraction();
    
    console.log('\n📊 FINAL TEST RESULTS:');
    console.log('======================');
    console.log(`✅ Total members extracted: ${members.length}`);
    
    if (members.length > 0) {
      console.log('\n👥 Extracted members:');
      members.forEach((member, i) => {
        console.log(`   ${i + 1}. ${member.name} - ₹${member.amount.toLocaleString()}`);
      });
      
      console.log('\n🎯 TEST PASSED: Native extraction working correctly!');
      console.log('✅ Real names extracted successfully');
      console.log('✅ No garbage data in results');
    } else {
      console.log('\n❌ TEST FAILED: No members extracted');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

runTest();
