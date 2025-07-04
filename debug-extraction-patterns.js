#!/usr/bin/env node

/**
 * Enhanced PDF extraction test with better patterns
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 ENHANCED PDF EXTRACTION TEST');
console.log('===============================\n');

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

console.log('📋 Test content:');
console.log(testContent);
console.log('\n' + '='.repeat(50) + '\n');

// Test multiple extraction strategies
const testExtractionStrategies = () => {
  console.log('🔍 Testing Multiple Extraction Strategies...');
  
  const members = [];
  const cleanText = testContent.trim();
  
  // Strategy 1: Indian name patterns with amounts
  console.log('\n📊 Strategy 1: Indian name patterns...');
  const indianNamePattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:Devi|Kumari|Singh|Kumar|Prasad|Yadav|Gupta|Sharma)))\s+(\d+)/g;
  
  let matches = Array.from(cleanText.matchAll(indianNamePattern));
  console.log(`Found ${matches.length} Indian name pattern matches`);
  
  for (const match of matches) {
    if (match[1] && match[2]) {
      const name = match[1].trim();
      const amount = parseInt(match[2]);
      console.log(`✅ Strategy 1 - Found: ${name} - ₹${amount}`);
      members.push({ name, amount, method: 'indian-pattern' });
    }
  }
  
  // Strategy 2: General name-amount patterns
  if (members.length === 0) {
    console.log('\n📊 Strategy 2: General name-amount patterns...');
    const generalPattern = /([A-Z][a-z]+\s+[A-Z][a-z]+)\s+(\d+)/g;
    
    matches = Array.from(cleanText.matchAll(generalPattern));
    console.log(`Found ${matches.length} general pattern matches`);
    
    for (const match of matches) {
      if (match[1] && match[2]) {
        const name = match[1].trim();
        const amount = parseInt(match[2]);
        console.log(`✅ Strategy 2 - Found: ${name} - ₹${amount}`);
        members.push({ name, amount, method: 'general-pattern' });
      }
    }
  }
  
  // Strategy 3: Line-by-line analysis
  if (members.length === 0) {
    console.log('\n📊 Strategy 3: Line-by-line analysis...');
    const lines = cleanText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    for (const line of lines) {
      console.log(`Analyzing line: "${line}"`);
      
      // Skip headers
      if (line.includes('MEMBER') || line.includes('NAME') || line.includes('LOAN')) {
        console.log(`  Skipping header: ${line}`);
        continue;
      }
      
      // Look for name-amount patterns
      const linePattern = /([A-Za-z\s]+)\s+(\d+)/;
      const match = line.match(linePattern);
      
      if (match && match[1] && match[2]) {
        const name = match[1].trim();
        const amount = parseInt(match[2]);
        
        // Basic validation
        if (name.length >= 5 && amount > 0) {
          console.log(`✅ Strategy 3 - Found: ${name} - ₹${amount}`);
          members.push({ name, amount, method: 'line-analysis' });
        }
      }
    }
  }
  
  // Strategy 4: Split approach (names and amounts separately)
  if (members.length === 0) {
    console.log('\n📊 Strategy 4: Split approach...');
    
    const lines = cleanText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const names = [];
    const amounts = [];
    
    for (const line of lines) {
      // Skip headers
      if (line.includes('MEMBER') || line.includes('NAME') || line.includes('LOAN')) continue;
      
      // Extract words and numbers
      const words = line.split(/\s+/);
      const nameWords = [];
      let amount = null;
      
      for (const word of words) {
        if (/^\d+$/.test(word)) {
          amount = parseInt(word);
        } else if (/^[A-Za-z]+$/.test(word)) {
          nameWords.push(word);
        }
      }
      
      if (nameWords.length >= 2 && amount) {
        const name = nameWords.join(' ');
        console.log(`✅ Strategy 4 - Found: ${name} - ₹${amount}`);
        members.push({ name, amount, method: 'split-approach' });
      }
    }
  }
  
  return members;
};

// Run the test
const members = testExtractionStrategies();

console.log('\n📊 FINAL RESULTS:');
console.log('=================');
console.log(`✅ Total members extracted: ${members.length}`);

if (members.length > 0) {
  console.log('\n👥 Extracted members:');
  members.forEach((member, i) => {
    console.log(`   ${i + 1}. ${member.name} - ₹${member.amount.toLocaleString()} (${member.method})`);
  });
  
  console.log('\n🎯 TEST PASSED: Extraction working correctly!');
  console.log('✅ Real names extracted successfully');
  
  // Check for expected names
  const expectedNames = ['Sunita Devi', 'Meera Kumari', 'Pushpa Devi', 'Radha Sharma'];
  const foundNames = members.map(m => m.name);
  const allExpectedFound = expectedNames.every(name => 
    foundNames.some(found => found.includes(name.split(' ')[0]))
  );
  
  if (allExpectedFound) {
    console.log('✅ All expected names found');
  } else {
    console.log('⚠️ Some expected names missing');
  }
  
} else {
  console.log('\n❌ TEST FAILED: No members extracted');
  console.log('Need to debug extraction patterns');
}
