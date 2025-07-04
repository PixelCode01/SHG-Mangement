#!/usr/bin/env node

// Test PDF extraction exactly as it would work in production
// This simulates the Vercel environment to identify why PDF extraction fails

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Production PDF Extraction for members.pdf');
console.log('=' .repeat(60));

async function testPDFExtraction() {
  const pdfPath = '/home/pixel/Downloads/members.pdf';
  
  if (!fs.existsSync(pdfPath)) {
    console.log('❌ members.pdf not found at expected location');
    return;
  }
  
  console.log('📄 Reading members.pdf...');
  const buffer = fs.readFileSync(pdfPath);
  console.log(`✅ PDF loaded: ${buffer.length} bytes`);
  
  // Test 1: Try pdf-parse (this should work locally)
  console.log('\n🔬 Test 1: pdf-parse extraction');
  try {
    const pdf = require('pdf-parse');
    const pdfData = await pdf(buffer);
    
    console.log(`✅ pdf-parse successful: ${pdfData.text.length} characters extracted`);
    console.log('📝 First 500 chars:');
    console.log(pdfData.text.substring(0, 500));
    console.log('...');
    
    // Test member extraction on clean text
    const members = extractMembersFromCleanText(pdfData.text);
    console.log(`🎯 Members extracted from pdf-parse: ${members.length}`);
    
    if (members.length > 0) {
      console.log('📋 Sample members:');
      members.slice(0, 5).forEach(member => {
        console.log(`   ${member.name} - Loan: ₹${member.loanAmount || 0}`);
      });
    }
    
  } catch (error) {
    console.log('❌ pdf-parse failed:', error.message);
  }
  
  // Test 2: Simulate production failure - buffer fallback
  console.log('\n🔬 Test 2: Buffer fallback (production simulation)');
  try {
    const bufferText = buffer.toString('utf8');
    console.log(`📄 Buffer text length: ${bufferText.length} characters`);
    console.log('📝 First 500 chars of buffer:');
    console.log(bufferText.substring(0, 500));
    console.log('...');
    
    // Test member extraction on buffer text
    const bufferMembers = extractMembersFromBufferText(bufferText);
    console.log(`🎯 Members extracted from buffer: ${bufferMembers.length}`);
    
    if (bufferMembers.length > 0) {
      console.log('📋 Sample buffer members:');
      bufferMembers.slice(0, 5).forEach(member => {
        console.log(`   ${member.name} - Loan: ₹${member.loanAmount || 0}`);
      });
    }
    
  } catch (error) {
    console.log('❌ Buffer extraction failed:', error.message);
  }
  
  // Test 3: Try different buffer encodings
  console.log('\n🔬 Test 3: Alternative encodings');
  
  const encodings = ['latin1', 'ascii', 'binary'];
  for (const encoding of encodings) {
    try {
      const encodedText = buffer.toString(encoding);
      console.log(`\n📄 ${encoding} encoding: ${encodedText.length} characters`);
      
      // Look for member patterns in this encoding
      const memberMatches = encodedText.match(/[A-Z][A-Z\s]+\d+/g) || [];
      console.log(`🔍 ${encoding} member-like patterns found: ${memberMatches.length}`);
      
      if (memberMatches.length > 0) {
        console.log('📋 Sample patterns:');
        memberMatches.slice(0, 3).forEach(match => {
          console.log(`   ${match}`);
        });
      }
      
    } catch (error) {
      console.log(`❌ ${encoding} encoding failed:`, error.message);
    }
  }
  
  // Test 4: Direct PDF content analysis
  console.log('\n🔬 Test 4: PDF content structure analysis');
  try {
    const pdfContent = buffer.toString('binary');
    
    // Look for text objects
    const textObjects = pdfContent.match(/BT\s*.*?\s*ET/gs) || [];
    console.log(`📄 PDF text objects found: ${textObjects.length}`);
    
    // Look for string patterns
    const stringPatterns = pdfContent.match(/\([^)]+\)\s*Tj/g) || [];
    console.log(`📄 PDF string patterns found: ${stringPatterns.length}`);
    
    if (stringPatterns.length > 0) {
      console.log('📋 Sample PDF strings:');
      stringPatterns.slice(0, 10).forEach(str => {
        const match = str.match(/\(([^)]+)\)/);
        if (match && match[1]) {
          console.log(`   "${match[1]}"`);
        }
      });
    }
    
  } catch (error) {
    console.log('❌ PDF structure analysis failed:', error.message);
  }
}

// Helper functions (simplified versions of the API functions)
function extractMembersFromCleanText(text) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const members = [];
  
  for (const line of lines) {
    // Primary pattern: Name + loan amount
    const nameAmountPattern = /^([A-Z][A-Z\s]+?)(\d+)$/;
    const match = line.match(nameAmountPattern);
    
    if (match && match[1] && match[2]) {
      const name = match[1].trim();
      const loanAmount = parseInt(match[2], 10);
      
      if (isValidName(name)) {
        members.push({
          name: name,
          loanAmount: loanAmount,
          source: 'clean-text'
        });
      }
    }
  }
  
  return members;
}

function extractMembersFromBufferText(text) {
  // For buffer text, try to find any readable member patterns
  const memberPatterns = text.match(/[A-Z][A-Z\s]+\d+/g) || [];
  const members = [];
  
  for (const pattern of memberPatterns) {
    const nameAmountMatch = pattern.match(/^([A-Z][A-Z\s]+?)(\d+)$/);
    
    if (nameAmountMatch && nameAmountMatch[1] && nameAmountMatch[2]) {
      const name = nameAmountMatch[1].trim();
      const loanAmount = parseInt(nameAmountMatch[2], 10);
      
      if (isValidName(name)) {
        members.push({
          name: name,
          loanAmount: loanAmount,
          source: 'buffer-text'
        });
      }
    }
  }
  
  return members;
}

function isValidName(name) {
  // Basic validation - must have at least 2 words and reasonable length
  if (!name || name.length < 5 || name.length > 50) return false;
  if (name.split(' ').length < 2) return false;
  if (/\d/.test(name)) return false; // No numbers in name
  return true;
}

// Run the test
testPDFExtraction().catch(console.error);
