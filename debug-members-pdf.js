// Debug script for members.pdf extraction failure
// This script will test all extraction methods and show exactly why it's failing

const fs = require('fs');
const path = require('path');

async function debugPDFExtraction() {
  console.log('🔍 DEBUGGING members.pdf extraction failure...');
  
  const pdfPath = '/home/pixel/Downloads/members.pdf';
  
  if (!fs.existsSync(pdfPath)) {
    console.error('❌ PDF file not found:', pdfPath);
    return;
  }
  
  const buffer = fs.readFileSync(pdfPath);
  console.log(`📄 PDF loaded: ${buffer.length} bytes`);
  
  let extractedText = '';
  let extractionMethod = '';
  let extractionSuccess = false;
  
  // Test 1: pdf-parse primary
  try {
    console.log('\n📖 TEST 1: pdf-parse primary extraction...');
    const pdf = require('pdf-parse');
    const pdfData = await pdf(buffer, { max: 0 });
    extractedText = pdfData.text || '';
    extractionMethod = 'pdf-parse-primary';
    extractionSuccess = true;
    console.log(`✅ Primary extraction successful. Text length: ${extractedText.length}`);
    console.log('📝 First 200 chars:', extractedText.substring(0, 200));
  } catch (error) {
    console.log('❌ Primary pdf-parse failed:', error.message);
    
    // Test 2: pdf-parse fallback
    try {
      console.log('\n📖 TEST 2: pdf-parse fallback extraction...');
      const pdf = require('pdf-parse');
      const pdfData = await pdf(buffer, { version: 'v1.10.100', max: 0 });
      extractedText = pdfData.text || '';
      extractionMethod = 'pdf-parse-fallback';
      extractionSuccess = true;
      console.log(`✅ Fallback extraction successful. Text length: ${extractedText.length}`);
    } catch (fallbackError) {
      console.log('❌ Fallback pdf-parse failed:', fallbackError.message);
      
      // Test 3: Buffer UTF-8
      try {
        console.log('\n📖 TEST 3: Buffer UTF-8 extraction...');
        extractedText = buffer.toString('utf8');
        extractionMethod = 'buffer-utf8';
        extractionSuccess = true;
        console.log(`✅ Buffer UTF-8 extraction. Text length: ${extractedText.length}`);
      } catch (bufferError) {
        console.log('❌ Buffer UTF-8 failed:', bufferError.message);
        
        // Test 4: Buffer Latin1
        try {
          console.log('\n📖 TEST 4: Buffer Latin1 extraction...');
          extractedText = buffer.toString('latin1');
          extractionMethod = 'buffer-latin1';
          extractionSuccess = true;
          console.log(`✅ Buffer Latin1 extraction. Text length: ${extractedText.length}`);
        } catch (latin1Error) {
          console.log('❌ All extraction methods failed');
          return;
        }
      }
    }
  }
  
  if (!extractionSuccess) {
    console.log('❌ No extraction method worked');
    return;
  }
  
  console.log(`\n🔧 Final extraction method: ${extractionMethod}`);
  console.log(`📝 Final extracted text length: ${extractedText.length}`);
  
  // Test member extraction
  console.log('\n🔍 TESTING MEMBER EXTRACTION...');
  
  const members = [];
  
  // Strategy 1: Indian name patterns
  console.log('\n📋 Strategy 1: Indian name patterns...');
  const indianNamePattern = /([A-Z][A-Z\s]{4,30}(?:KUMAR|PRASAD|SINGH|DEVI|KESHRI|MAHTO|MISHRA|THAKUR|RAJAK|ORAON|TOPPO|HAJAM|MODI|SINHA|SHEKHAR|RAJ)[A-Z\s]*)/g;
  
  let match;
  while ((match = indianNamePattern.exec(extractedText)) !== null) {
    const name = match[1].trim();
    if (isValidIndianName(name)) {
      const existing = members.find(m => m.name === name);
      if (!existing) {
        members.push({
          name: name,
          confidence: 0.8,
          source: 'indian-pattern'
        });
        console.log(`✅ Found Indian pattern: ${name}`);
      }
    }
  }
  
  // Strategy 2: Common first names
  console.log('\n📋 Strategy 2: Common first names...');
  const commonFirstNames = [
    'SANTOSH', 'ASHOK', 'ANUP', 'PRAMOD', 'MANOJ', 'VIKKI', 'SUNIL', 'PAWAN',
    'SUDAMA', 'VIJAY', 'UDAY', 'POOJA', 'KRISHNA', 'KAVITA', 'JYOTI',
    'JALESHWAR', 'SURENDRA', 'DILIP', 'SUDHAKAR', 'SANJAY', 'SUDHIR', 'MANGAL', 'KIRAN',
    'SUBHASH', 'ACHAL', 'UMESH', 'ANUJ', 'JITENDRA', 'RAJESH', 'MANISH', 'GANESH',
    'SHYAM', 'SHANKAR', 'SUBODH', 'GOPAL', 'RAKESH', 'SIKANDAR', 'JAG', 'UMA', 'SHIV',
    'GUDIYA', 'JAYPRAKASH', 'MEERA', 'ROHIT', 'AISHWARYA'
  ];
  
  const lines = extractedText.split(/[\n\r]+/).map(line => line.trim()).filter(line => line.length > 0);
  console.log(`📄 Total lines to check: ${lines.length}`);
  
  for (const line of lines) {
    for (const firstName of commonFirstNames) {
      if (line.includes(firstName)) {
        // Try to extract full name
        const nameMatch = line.match(new RegExp(`(${firstName}[A-Z\\s]+?)(?=[0-9]|$|[^A-Z\\s])`, 'g'));
        if (nameMatch) {
          for (const fullName of nameMatch) {
            const cleanName = fullName.trim();
            if (isValidIndianName(cleanName)) {
              const existing = members.find(m => m.name === cleanName);
              if (!existing) {
                members.push({
                  name: cleanName,
                  confidence: 0.7,
                  source: 'first-name-pattern'
                });
                console.log(`✅ Found by first name: ${cleanName}`);
              }
            }
          }
        }
      }
    }
  }
  
  console.log(`\n🎉 FINAL RESULTS:`);
  console.log(`📊 Total members found: ${members.length}`);
  console.log(`🔧 Extraction method: ${extractionMethod}`);
  console.log(`📝 Members:`, members.map(m => m.name));
  
  if (members.length === 0) {
    console.log('\n🚨 ANALYSIS: Why extraction failed:');
    console.log('1. Check if PDF contains readable text (not just images)');
    console.log('2. Check if names are in expected format (FIRST LAST)');
    console.log('3. Check if text extraction is getting binary data instead of text');
    
    // Show sample of extracted text for analysis
    console.log('\n📄 SAMPLE EXTRACTED TEXT (first 500 chars):');
    console.log(JSON.stringify(extractedText.substring(0, 500)));
    
    console.log('\n📄 SAMPLE EXTRACTED TEXT (binary check):');
    const hasBinaryData = /[\x00-\x08\x0E-\x1F\x7F-\xFF]/.test(extractedText.substring(0, 1000));
    console.log(`Contains binary data: ${hasBinaryData}`);
  }
}

function isValidIndianName(name) {
  if (!name || name.length < 3 || name.length > 50) return false;
  
  // Must be all uppercase letters and spaces
  if (!/^[A-Z\s]+$/.test(name)) return false;
  
  // Must not be common garbage strings
  const garbagePatterns = [
    /^[A-Z]+\d+$/,  // Letters followed by numbers
    /^\d+[A-Z]+$/,  // Numbers followed by letters  
    /^[A-Z]{1,2}$/,  // Single or double letters
    /^(NA|NULL|NONE|UNKNOWN|TEST|SAMPLE)$/,
  ];
  
  for (const pattern of garbagePatterns) {
    if (pattern.test(name)) return false;
  }
  
  // Should have at least one space (first name + last name)
  if (!name.includes(' ')) return false;
  
  // Each word should be at least 2 characters
  const words = name.split(' ').filter(w => w.length > 0);
  if (words.some(word => word.length < 2)) return false;
  
  return true;
}

// Run the debug
debugPDFExtraction().catch(console.error);
