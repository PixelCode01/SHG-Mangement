// Test to analyze PDF structure and find actual member data
async function analyzePdfStructure() {
  console.log('🔍 Analyzing PDF structure to find member data...');
  
  // Simulate the extracted text based on what we're seeing
  const sampleText = `Microsoft Excel for Microsoft Microsoft Excel for Microsoft
Some header text
NAME LOAN
JOHN DOE 5000
JANE SMITH 3000
ROBERT JOHNSON 7500
...more members...
Microsoft Excel for Microsoft`;
  
  console.log('📄 Sample text:', sampleText);
  
  const lines = sampleText.split('\n').map(line => line.trim()).filter(line => line);
  console.log('📝 Lines:', lines);
  
  // Find lines that look like member data (contain both letters and numbers)
  const memberLines = lines.filter(line => {
    // Skip metadata lines
    if (line.includes('Microsoft') || line.includes('Excel')) return false;
    if (line.includes('for')) return false;
    
    // Look for lines with name-like patterns and numbers
    const hasLetters = /[A-Za-z]{2,}/.test(line);
    const hasNumbers = /\d+/.test(line);
    const isNotHeader = !line.toLowerCase().includes('name') || !line.toLowerCase().includes('loan');
    
    return hasLetters && hasNumbers && isNotHeader && line.length > 5;
  });
  
  console.log('👥 Member-like lines:', memberLines);
  
  // Test pattern matching on member lines
  memberLines.forEach((line, index) => {
    const patterns = [
      /^(.+?)(\d+)$/, // Name followed by number
      /^(.+?)\s+(\d+)$/, // Name space number
      /(\w+(?:\s+\w+)*)\s+(\d+)/ // Multiple words followed by number
    ];
    
    for (let i = 0; i < patterns.length; i++) {
      const match = line.match(patterns[i]);
      if (match) {
        console.log(`✅ Line ${index + 1}: Pattern ${i + 1} matched "${match[1]?.trim()}" - ${match[2]}`);
        break;
      }
    }
  });
}

analyzePdfStructure();
