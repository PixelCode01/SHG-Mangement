const fs = require('fs');
const path = require('path');

// Import PDF parsing library - using a simple version for testing
async function testPDFParsing() {
  const pdfPath = '/home/pixel/Downloads/SWAWLAMBAN till may 2025.pdf';
  
  // Check if file exists
  if (!fs.existsSync(pdfPath)) {
    console.log('❌ PDF file not found at:', pdfPath);
    return;
  }
  
  console.log('✅ PDF file found at:', pdfPath);
  console.log('📊 File size:', fs.statSync(pdfPath).size, 'bytes');
  
  // Try to use pdf-parse package for simple extraction
  try {
    const pdfParse = require('pdf-parse');
    const dataBuffer = fs.readFileSync(pdfPath);
    
    const data = await pdfParse(dataBuffer);
    console.log('📄 Total pages:', data.numpages);
    console.log('📝 Extracted text length:', data.text.length);
    
    // Show first 500 characters of extracted text
    console.log('\n📖 First 500 characters of extracted text:');
    console.log('=' .repeat(60));
    console.log(data.text.substring(0, 500));
    console.log('=' .repeat(60));
    
    // Try to identify table structure
    const lines = data.text.split('\n');
    console.log('\n🔍 Analyzing line structure:');
    
    for (let i = 0; i < Math.min(20, lines.length); i++) {
      const line = lines[i].trim();
      if (line.length > 0) {
        console.log(`Line ${i + 1}: "${line}"`);
      }
    }
    
    // Test our existing regex patterns
    console.log('\n🧪 Testing existing regex patterns:');
    
    // Pattern 1: Standard table format
    const tableRowRegex = /\s*(?:(?:\d+)|(?:[A-Za-z]+))\s+([A-Za-z][A-Za-z\s.\'-]+[A-Za-z])\s+(\d[\d,.]*)(?:\s+([^\s]+)?)?(?:\s+([^\s]+)?)?/g;
    let matches = [...data.text.matchAll(tableRowRegex)];
    console.log(`Pattern 1 found ${matches.length} matches`);
    
    // Pattern 2: Structured table
    const structuredTableRegex = /\b([A-Za-z][A-Za-z\s.\'-]+[A-Za-z])\s*,?\s*(\d[\d,.]*)\s*(?:,?\s*([^,\n\d+@[^,\n\s]+))?\s*(?:,?\s*(\+?\d[\d\s-]+))?/g;
    matches = [...data.text.matchAll(structuredTableRegex)];
    console.log(`Pattern 2 found ${matches.length} matches`);
    
    // Pattern 3: Loose pattern
    const looseTableRegex = /([A-Za-z][A-Za-z\s.\'-]+[A-Za-z])\s*[:=-]?\s*(?:Rs\.?|₹|INR|$)?\s*(\d[\d,.]*)/gi;
    matches = [...data.text.matchAll(looseTableRegex)];
    console.log(`Pattern 3 found ${matches.length} matches`);
    
    // Show first few matches if any
    if (matches.length > 0) {
      console.log('\n📋 First few matches from Pattern 3:');
      for (let i = 0; i < Math.min(5, matches.length); i++) {
        console.log(`Match ${i + 1}: Name="${matches[i][1]}", Amount="${matches[i][2]}"`);
      }
    }
    
  } catch (error) {
    console.log('❌ Error parsing PDF:', error.message);
    
    // Try installing pdf-parse if not available
    if (error.message.includes("Cannot find module 'pdf-parse'")) {
      console.log('💡 Installing pdf-parse package...');
      const { execSync } = require('child_process');
      try {
        execSync('npm install pdf-parse', { cwd: __dirname, stdio: 'inherit' });
        console.log('✅ pdf-parse installed. Please run this script again.');
      } catch (installError) {
        console.log('❌ Failed to install pdf-parse:', installError.message);
      }
    }
  }
}

testPDFParsing().catch(console.error);
