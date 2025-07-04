const fs = require('fs');

// Simple PDF text extraction test
async function testPDFParsing() {
  const pdfPath = './test-pdf.pdf';
  
  console.log('✅ Testing PDF file:', pdfPath);
  console.log('📊 File size:', fs.statSync(pdfPath).size, 'bytes');
  
  try {
    // Try using pdfjs-dist (which is already in the project)
    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
    
    const dataBuffer = fs.readFileSync(pdfPath);
    const loadingTask = pdfjsLib.getDocument({ data: dataBuffer });
    const pdf = await loadingTask.promise;
    
    console.log('📄 Total pages:', pdf.numPages);
    
    // Extract text from all pages
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
      console.log(`📝 Page ${i} text length:`, pageText.length);
    }
    
    console.log('\n📖 Full extracted text (first 1000 characters):');
    console.log('=' .repeat(60));
    console.log(fullText.substring(0, 1000));
    console.log('=' .repeat(60));
    
    // Test our parsing patterns
    console.log('\n🧪 Testing parsing patterns:');
    
    // Pattern 1: Standard table format
    const tableRowRegex = /\s*(?:(?:\d+)|(?:[A-Za-z]+))\s+([A-Za-z][A-Za-z\s.\'-]+[A-Za-z])\s+(\d[\d,.]*)(?:\s+([^\s]+)?)?(?:\s+([^\s]+)?)?/g;
    let matches = [...fullText.matchAll(tableRowRegex)];
    console.log(`✨ Pattern 1 found ${matches.length} matches`);
    
    // Show some matches if found
    if (matches.length > 0) {
      console.log('First few matches from Pattern 1:');
      for (let i = 0; i < Math.min(3, matches.length); i++) {
        console.log(`  ${i + 1}. Name: "${matches[i][1]}" | Amount: "${matches[i][2]}"`);
      }
    }
    
    // Pattern 2: Look for name-amount pairs more broadly
    const nameAmountRegex = /([A-Z][A-Za-z\s]+[a-z])\s+(\d[\d,\.]+)/g;
    matches = [...fullText.matchAll(nameAmountRegex)];
    console.log(`✨ Name-Amount pattern found ${matches.length} matches`);
    
    if (matches.length > 0) {
      console.log('First few Name-Amount matches:');
      for (let i = 0; i < Math.min(5, matches.length); i++) {
        console.log(`  ${i + 1}. Name: "${matches[i][1]}" | Amount: "${matches[i][2]}"`);
      }
    }
    
    // Pattern 3: Look for any numeric values that could be amounts
    const numberRegex = /\d[\d,\.]+/g;
    const numbers = [...fullText.matchAll(numberRegex)];
    console.log(`🔢 Found ${numbers.length} numeric values`);
    
    // Show the structure by looking at lines
    const lines = fullText.split('\n').filter(line => line.trim().length > 0);
    console.log(`\n📋 Document has ${lines.length} non-empty lines`);
    console.log('First 10 lines:');
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      console.log(`  ${i + 1}: "${lines[i].trim()}"`);
    }
    
  } catch (error) {
    console.log('❌ Error parsing PDF:', error.message);
    console.log('Stack:', error.stack);
  }
}

testPDFParsing().catch(console.error);
