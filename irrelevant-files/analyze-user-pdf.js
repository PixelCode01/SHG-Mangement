const fs = require('fs');
const path = require('path');

// Extract text from the user's PDF and analyze structure
async function analyzePDF() {
  const pdfPath = './test-pdf.pdf';
  
  if (!fs.existsSync(pdfPath)) {
    console.log('❌ PDF file not found. Please ensure the file is copied to:', pdfPath);
    return;
  }
  
  try {
    console.log('🔍 Analyzing PDF structure...');
    
    // Use the same extraction method as the app
    const { getDocument } = await import('pdfjs-dist');
    const dataBuffer = fs.readFileSync(pdfPath);
    
    const loadingTask = getDocument({ data: dataBuffer });
    const pdf = await loadingTask.promise;
    
    console.log('📄 PDF has', pdf.numPages, 'pages');
    
    const textArray = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items?.map(item => {
        if ('str' in item) {
          return item.str || '';
        }
        return '';
      }).join(' ') || '';
      textArray.push(pageText);
      console.log(`📄 Page ${i} text length: ${pageText.length} characters`);
    }
    
    // Combine all text
    const fullText = textArray.join('\n');
    console.log('📝 Total text length:', fullText.length);
    
    // Save full text to file for analysis
    fs.writeFileSync('./extracted-text.txt', fullText);
    console.log('💾 Full extracted text saved to extracted-text.txt');
    
    // Analyze structure
    const lines = fullText.split(/\r?\n/).filter(line => line.trim().length > 0);
    console.log('📋 Total non-empty lines:', lines.length);
    
    console.log('\n📖 First 20 lines:');
    console.log('='.repeat(80));
    for (let i = 0; i < Math.min(20, lines.length); i++) {
      console.log(`${(i + 1).toString().padStart(3)}: ${lines[i].trim()}`);
    }
    console.log('='.repeat(80));
    
    // Look for key patterns
    console.log('\n🔍 Searching for member data patterns...');
    
    // Look for names (words starting with capital letters)
    const namePattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
    const possibleNames = [...fullText.matchAll(namePattern)]
      .map(match => match[0])
      .filter(name => name.length > 2 && name.split(' ').length <= 4);
    
    console.log(`📛 Found ${possibleNames.length} possible names (first 10):`, possibleNames.slice(0, 10));
    
    // Look for numbers that could be amounts
    const numberPattern = /\b\d{1,10}(?:[,\.]\d{1,3})*\b/g;
    const possibleAmounts = [...fullText.matchAll(numberPattern)]
      .map(match => match[0])
      .filter(num => {
        const parsed = parseFloat(num.replace(/[,\s]/g, ''));
        return parsed >= 100 && parsed <= 100000; // Reasonable loan amount range
      });
    
    console.log(`💰 Found ${possibleAmounts.length} possible loan amounts (first 10):`, possibleAmounts.slice(0, 10));
    
    // Check for common table headers
    const headers = ['name', 'amount', 'loan', 'member', 'sl', 'serial', 'no'];
    headers.forEach(header => {
      if (fullText.toLowerCase().includes(header)) {
        console.log(`✅ Found header keyword: "${header}"`);
      }
    });
    
    // Try a very simple name-amount pairing
    console.log('\n🧪 Testing simple name-amount extraction...');
    
    // Split by lines and look for patterns
    for (let i = 0; i < Math.min(50, lines.length); i++) {
      const line = lines[i].trim();
      
      // Simple pattern: Name followed by number
      const simplePattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(\d[\d,\.]+)/;
      const match = simplePattern.exec(line);
      
      if (match) {
        const name = match[1];
        const amount = match[2];
        console.log(`🎯 Line ${i + 1}: "${name}" -> "${amount}"`);
      }
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
    console.log('Stack:', error.stack);
  }
}

analyzePDF().catch(console.error);
