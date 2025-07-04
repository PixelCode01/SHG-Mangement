const fs = require('fs');

async function simplePDFAnalysis() {
  const pdfPath = './public/swawlamban-may-2025.pdf';
  
  if (!fs.existsSync(pdfPath)) {
    console.log('❌ PDF file not found');
    return;
  }
  
  try {
    const pdfParse = require('pdf-parse');
    const dataBuffer = fs.readFileSync(pdfPath);
    
    console.log('📄 Reading PDF...');
    const data = await pdfParse(dataBuffer);
    
    console.log('✅ PDF parsed successfully');
    console.log('📊 Pages:', data.numpages);
    console.log('📝 Text length:', data.text.length);
    
    // Save the extracted text
    fs.writeFileSync('./extracted-text.txt', data.text);
    console.log('💾 Text saved to extracted-text.txt');
    
    // Show first part of the text
    console.log('\n📖 First 1000 characters:');
    console.log('='.repeat(60));
    console.log(data.text.substring(0, 1000));
    console.log('='.repeat(60));
    
    // Analyze lines
    const lines = data.text.split('\n').filter(line => line.trim());
    console.log(`\n📋 Total lines: ${lines.length}`);
    
    console.log('\n📝 First 15 lines:');
    for (let i = 0; i < Math.min(15, lines.length); i++) {
      console.log(`${(i+1).toString().padStart(3)}: ${lines[i].trim()}`);
    }
    
    // Look for member data patterns
    console.log('\n🔍 Looking for name-amount patterns...');
    
    // Test current regex patterns
    const patterns = [
      // Pattern 1: Standard table
      /\s*(?:(?:\d+)|(?:[A-Za-z]+))\s+([A-Za-z][A-Za-z\s.\'-]+[A-Za-z])\s+(\d[\d,.]*)(?:\s+([^\s]+)?)?(?:\s+([^\s]+)?)?/g,
      // Pattern 2: Name followed by number
      /([A-Z][a-zA-Z\s]+)\s+(\d[\d,\.]+)/g,
      // Pattern 3: Simple name-amount
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(\d+(?:[,\.]\d+)*)/g
    ];
    
    patterns.forEach((pattern, index) => {
      const matches = [...data.text.matchAll(pattern)];
      console.log(`\n🧪 Pattern ${index + 1} found ${matches.length} matches:`);
      
      for (let i = 0; i < Math.min(5, matches.length); i++) {
        console.log(`  ${i+1}. Name: "${matches[i][1]}" | Amount: "${matches[i][2]}"`);
      }
    });
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

simplePDFAnalysis().catch(console.error);
