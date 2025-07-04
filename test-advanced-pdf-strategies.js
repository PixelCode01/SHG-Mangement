#!/usr/bin/env node

// Advanced PDF extraction that works reliably in Vercel production environment
// This addresses common issues like memory limits, timeouts, and dependency problems

const fs = require('fs');

console.log('🔧 Testing Advanced PDF Extraction Strategies');
console.log('=' .repeat(60));

async function testAdvancedPDFExtraction() {
  const pdfPath = '/home/pixel/Downloads/members.pdf';
  
  if (!fs.existsSync(pdfPath)) {
    console.log('❌ members.pdf not found');
    return;
  }
  
  const buffer = fs.readFileSync(pdfPath);
  console.log(`📄 PDF loaded: ${buffer.length} bytes`);
  
  // Strategy 1: Standard pdf-parse (current approach)
  console.log('\n🔬 Strategy 1: Standard pdf-parse');
  try {
    const pdf = require('pdf-parse');
    const result = await pdf(buffer);
    console.log(`✅ Success: ${result.text.length} chars`);
    
    const members = extractMembersFromText(result.text);
    console.log(`👥 Members extracted: ${members.length}`);
    
  } catch (error) {
    console.log('❌ Failed:', error.message);
  }
  
  // Strategy 2: pdf2json (alternative library)
  console.log('\n🔬 Strategy 2: pdf2json');
  try {
    const PDFParser = require('pdf2json');
    
    await new Promise((resolve, reject) => {
      const pdfParser = new PDFParser();
      
      pdfParser.on('pdfParser_dataError', errData => {
        console.log('❌ pdf2json failed:', errData.parserError);
        reject(errData);
      });
      
      pdfParser.on('pdfParser_dataReady', pdfData => {
        try {
          const text = pdfParser.getRawTextContent();
          console.log(`✅ pdf2json success: ${text.length} chars`);
          
          const members = extractMembersFromText(text);
          console.log(`👥 Members extracted: ${members.length}`);
          resolve(text);
        } catch (err) {
          reject(err);
        }
      });
      
      pdfParser.parseBuffer(buffer);
    });
    
  } catch (error) {
    console.log('❌ pdf2json failed:', error.message);
  }
  
  // Strategy 3: pdfjs-dist (used in browsers)
  console.log('\n🔬 Strategy 3: pdfjs-dist');
  try {
    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
    
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    console.log(`📊 PDF pages: ${pdf.numPages}`);
    
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }
    
    console.log(`✅ pdfjs-dist success: ${fullText.length} chars`);
    
    const members = extractMembersFromText(fullText);
    console.log(`👥 Members extracted: ${members.length}`);
    
  } catch (error) {
    console.log('❌ pdfjs-dist failed:', error.message);
  }
  
  // Strategy 4: Simple text extraction patterns from binary
  console.log('\n🔬 Strategy 4: Binary text patterns');
  try {
    const binaryText = buffer.toString('latin1');
    
    // Look for member patterns in the binary data
    const memberPatterns = [];
    
    // Pattern 1: Look for sequences that look like names followed by numbers
    const nameNumPattern = /([A-Z][A-Z\s]{5,30})(\d{1,7})/g;
    let match;
    
    while ((match = nameNumPattern.exec(binaryText)) !== null) {
      const name = match[1].trim();
      const amount = parseInt(match[2], 10);
      
      // Filter for valid-looking names
      if (name.length > 5 && name.split(' ').length >= 2 && !name.includes('\\x')) {
        memberPatterns.push({ name, amount });
      }
    }
    
    console.log(`✅ Binary patterns found: ${memberPatterns.length}`);
    
    if (memberPatterns.length > 0) {
      console.log('📋 Sample binary patterns:');
      memberPatterns.slice(0, 5).forEach((pattern, i) => {
        console.log(`   ${i + 1}. ${pattern.name} - ${pattern.amount}`);
      });
    }
    
  } catch (error) {
    console.log('❌ Binary extraction failed:', error.message);
  }
  
  // Strategy 5: Create a production-compatible version
  console.log('\n🔬 Strategy 5: Production-safe extraction');
  
  const productionSafeExtraction = createProductionSafeExtractor();
  const productionResult = await productionSafeExtraction(buffer);
  
  console.log(`📊 Production-safe result: ${productionResult.success ? 'SUCCESS' : 'FAILED'}`);
  if (productionResult.success) {
    console.log(`👥 Members: ${productionResult.members.length}`);
    console.log(`🔧 Method: ${productionResult.method}`);
  } else {
    console.log(`❌ Error: ${productionResult.error}`);
  }
}

function extractMembersFromText(text) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const members = [];
  
  for (const line of lines) {
    // Pattern: Name followed by loan amount
    const match = line.match(/^([A-Z][A-Z\s]+?)(\d+)$/);
    if (match && match[1] && match[2]) {
      const name = match[1].trim();
      const amount = parseInt(match[2], 10);
      
      if (name.length > 5 && name.split(' ').length >= 2) {
        members.push({ name, amount });
      }
    }
  }
  
  return members;
}

function createProductionSafeExtractor() {
  return async function(buffer) {
    const strategies = [
      {
        name: 'pdf-parse-minimal',
        async extract() {
          const pdf = require('pdf-parse');
          const result = await pdf(buffer, { max: 0 });
          return result.text;
        }
      },
      {
        name: 'pdf-parse-default',
        async extract() {
          const pdf = require('pdf-parse');
          const result = await pdf(buffer);
          return result.text;
        }
      },
      {
        name: 'pdf2json',
        async extract() {
          const PDFParser = require('pdf2json');
          return new Promise((resolve, reject) => {
            const pdfParser = new PDFParser();
            pdfParser.on('pdfParser_dataError', reject);
            pdfParser.on('pdfParser_dataReady', () => {
              resolve(pdfParser.getRawTextContent());
            });
            pdfParser.parseBuffer(buffer);
          });
        }
      }
    ];
    
    for (const strategy of strategies) {
      try {
        console.log(`🔄 Trying ${strategy.name}...`);
        const text = await strategy.extract();
        const members = extractMembersFromText(text);
        
        if (members.length > 40) { // Should get ~51 members
          return {
            success: true,
            members,
            method: strategy.name,
            textLength: text.length
          };
        }
      } catch (error) {
        console.log(`⚠️ ${strategy.name} failed:`, error.message);
        continue;
      }
    }
    
    return {
      success: false,
      error: 'All extraction strategies failed',
      members: []
    };
  };
}

testAdvancedPDFExtraction().catch(console.error);
