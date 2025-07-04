#!/usr/bin/env node

// Diagnose PDF Content for Member Extraction
// Analyze what text patterns exist in the members.pdf file

const fs = require('fs');

async function diagnosePDFContent() {
  console.log('🔍 PDF CONTENT DIAGNOSIS');
  console.log('============================================================');
  
  const pdfPath = '/home/pixel/Downloads/members.pdf';
  
  try {
    // Check if file exists
    if (!fs.existsSync(pdfPath)) {
      console.log(`❌ PDF file not found: ${pdfPath}`);
      return;
    }
    
    const fileStats = fs.statSync(pdfPath);
    console.log(`📄 PDF file: ${(fileStats.size / 1024).toFixed(2)} KB`);
    
    // Read as buffer
    const buffer = fs.readFileSync(pdfPath);
    console.log(`📦 Buffer size: ${buffer.length} bytes`);
    
    // Try different text extraction methods
    console.log('\n🔍 Method 1: UTF-8 extraction...');
    const utf8Text = buffer.toString('utf8');
    const utf8Readable = utf8Text.match(/[A-Za-z\s]{5,}/g);
    if (utf8Readable) {
      console.log(`   Found ${utf8Readable.length} readable text chunks`);
      console.log('   Sample text chunks:');
      utf8Readable.slice(0, 10).forEach((chunk, i) => {
        console.log(`   ${i + 1}. "${chunk.substring(0, 50)}..."`);
      });
    } else {
      console.log('   No readable text found with UTF-8');
    }
    
    console.log('\n🔍 Method 2: Latin1 extraction...');
    const latin1Text = buffer.toString('latin1');
    const latin1Readable = latin1Text.match(/[A-Za-z\s]{5,}/g);
    if (latin1Readable) {
      console.log(`   Found ${latin1Readable.length} readable text chunks`);
      console.log('   Sample text chunks:');
      latin1Readable.slice(0, 10).forEach((chunk, i) => {
        console.log(`   ${i + 1}. "${chunk.substring(0, 50)}..."`);
      });
    } else {
      console.log('   No readable text found with Latin1');
    }
    
    console.log('\n🔍 Method 3: Looking for name patterns...');
    const allText = utf8Text + ' ' + latin1Text;
    
    // Common Indian name patterns
    const namePatterns = [
      /([A-Z][a-z]+\s+(?:Devi|Kumari|Singh|Kumar|Prasad))/g,
      /([A-Z][a-z]+\s+[A-Z][a-z]+\s+[A-Z][a-z]+)/g,
      /([A-Z][a-z]+\s+[A-Z][a-z]+)/g,
      /([A-Z]{2,}\s+[A-Z]{2,})/g
    ];
    
    namePatterns.forEach((pattern, i) => {
      const matches = Array.from(allText.matchAll(pattern));
      console.log(`   Pattern ${i + 1}: ${matches.length} matches`);
      if (matches.length > 0) {
        console.log('   Sample matches:');
        matches.slice(0, 5).forEach((match, j) => {
          console.log(`     ${j + 1}. "${match[1]}"`);
        });
      }
    });
    
    console.log('\n🔍 Method 4: Raw text search...');
    // Look for any sequences that might be names
    const possibleNames = allText.match(/[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){1,3}/g);
    if (possibleNames) {
      console.log(`   Found ${possibleNames.length} possible name sequences`);
      console.log('   Sample sequences:');
      [...new Set(possibleNames)].slice(0, 15).forEach((name, i) => {
        console.log(`   ${i + 1}. "${name}"`);
      });
    } else {
      console.log('   No obvious name sequences found');
    }
    
    console.log('\n🔢 Method 5: Looking for numbers...');
    const numbers = allText.match(/\d+(?:\.\d+)?/g);
    if (numbers) {
      const numericValues = numbers.map(n => parseFloat(n)).filter(n => n > 0 && n < 1000000);
      console.log(`   Found ${numericValues.length} numeric values`);
      console.log('   Sample values:', numericValues.slice(0, 20).join(', '));
      
      // Statistics
      if (numericValues.length > 0) {
        const sorted = numericValues.sort((a, b) => a - b);
        console.log(`   Range: ${sorted[0]} - ${sorted[sorted.length - 1]}`);
        console.log(`   Median: ${sorted[Math.floor(sorted.length / 2)]}`);
      }
    } else {
      console.log('   No numeric values found');
    }
    
    console.log('\n📋 Method 6: PDF stream analysis...');
    // Look for PDF streams that might contain text
    const streamPattern = /stream(.*?)endstream/gs;
    const streams = Array.from(buffer.toString('latin1').matchAll(streamPattern));
    console.log(`   Found ${streams.length} PDF streams`);
    
    streams.slice(0, 3).forEach((stream, i) => {
      const streamContent = stream[1];
      const readableText = streamContent.match(/[A-Za-z\s]{10,}/g);
      if (readableText) {
        console.log(`   Stream ${i + 1} has ${readableText.length} readable text chunks`);
        console.log(`   Sample: "${readableText[0]?.substring(0, 100)}..."`);
      }
    });
    
  } catch (error) {
    console.log(`❌ Error during diagnosis: ${error.message}`);
  }
}

diagnosePDFContent();
