// Test the PDF debug endpoint
async function testPdfDebug() {
  console.log('🔧 Testing PDF debug endpoint...');
  
  // You would replace this with the actual PDF file in a real test
  const testText = `Microsoft Excel for Microsoft
  
NAME                    LOAN AMOUNT
RAJESH KUMAR           5000
SUNITA DEVI            3000  
MOHAN LAL              7500
RAMESH SINGH           2000
...more members...

Microsoft Excel for Microsoft`;

  console.log('📄 Test text structure:');
  console.log(testText);
  
  // Simulate the filtering process
  let cleaned = testText
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  console.log('🧹 After text cleaning:', cleaned);
  
  // Apply metadata filtering
  let filtered = cleaned
    .replace(/Microsoft Excel/gi, ' ')
    .replace(/Microsoft/gi, ' ')
    .replace(/Excel/gi, ' ')
    .replace(/for Microsoft/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  console.log('🔍 After metadata filtering:', filtered);
  
  const lines = filtered.split('\n').map(line => line.trim()).filter(line => line);
  console.log('📝 Lines after filtering:', lines);
  
  // Test pattern matching
  const patterns = [
    /^(.+?)(\d+)$/,
    /^(.+?)\s+(\d+)$/,
    /(\w+(?:\s+\w+)*)\s+(\d+)/
  ];
  
  lines.forEach((line, index) => {
    for (let i = 0; i < patterns.length; i++) {
      const match = line.match(patterns[i]);
      if (match && match[1] && match[2]) {
        const name = match[1].trim();
        const amount = parseInt(match[2]);
        if (name.length > 0 && amount > 0) {
          console.log(`✅ Line ${index + 1}: "${name}" - ₹${amount}`);
          break;
        }
      }
    }
  });
}

testPdfDebug();
