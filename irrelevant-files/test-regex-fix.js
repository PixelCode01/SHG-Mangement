// Test the regex fix for concatenated name+amount format
const fs = require('fs');
const pdfParse = require('pdf-parse');

async function testRegexFix() {
  console.log('=== Testing Regex Fix for Concatenated Format ===\n');
  
  // Test file path
  const testFile = '/home/pixel/Downloads/SWAWLAMBAN till may 2025.pdf';
  
  if (!fs.existsSync(testFile)) {
    console.log('❌ Test file not found');
    return;
  }
  
  // Parse PDF
  const buffer = fs.readFileSync(testFile);
  const data = await pdfParse(buffer);
  
  const lines = data.text.split(/\r?\n/).map(line => line.trim()).filter(line => line);
  console.log(`📝 Total lines extracted: ${lines.length}\n`);
  
  // Test both regex patterns
  const oldPattern = /^([A-Z\s]+?)\s+(\d+)$/; // Old pattern (expects space)
  const newPattern = /^(.+?)(\d+)$/; // New pattern (concatenated)
  
  console.log('🔍 Testing Old Pattern (expects space between name and amount):');
  let oldMatches = 0;
  for (const line of lines) {
    if (line && !line.toLowerCase().includes('name') && !line.toLowerCase().includes('loan') && line !== 'AI') {
      const match = line.match(oldPattern);
      if (match) {
        oldMatches++;
        if (oldMatches <= 3) {
          console.log(`  ✅ "${line}" → Name: "${match[1].trim()}", Amount: ${match[2]}`);
        }
      }
    }
  }
  console.log(`📊 Old pattern found: ${oldMatches} matches\n`);
  
  console.log('🔍 Testing New Pattern (concatenated name+amount):');
  let newMatches = 0;
  for (const line of lines) {
    if (line && 
        !line.toLowerCase().includes('name') && 
        !line.toLowerCase().includes('loan') && 
        !line.toLowerCase().includes('total') &&
        line !== 'AI') {
      
      const match = line.match(newPattern);
      if (match) {
        const name = match[1].trim();
        const amount = parseInt(match[2]);
        
        // Apply validation rules
        if (name.length >= 3 && 
            amount >= 0 && 
            amount <= 10000000 && 
            !name.includes('NAMELOAN') && 
            !name.includes('NAME LOAN') &&
            !name.includes('MAY') &&
            !name.includes('MONTH') &&
            !name.includes('TOTAL') &&
            !name.includes('BANK') &&
            !/\d/.test(name.replace(/[A-Z\s\.\-\']/g, '')) && 
            match[2].length <= 7) {
          
          newMatches++;
          if (newMatches <= 5) {
            console.log(`  ✅ "${line}" → Name: "${name}", Amount: ₹${amount.toLocaleString()}`);
          }
        }
      }
    }
  }
  console.log(`📊 New pattern found: ${newMatches} matches\n`);
  
  // Sample problematic lines
  console.log('🔍 Sample lines that demonstrate the format:');
  const sampleLines = lines.filter(line => 
    line.includes('SANTOSH') || 
    line.includes('ASHOK') || 
    line.includes('ANUP')
  ).slice(0, 3);
  
  sampleLines.forEach(line => {
    console.log(`  📝 "${line}"`);
    const oldMatch = line.match(oldPattern);
    const newMatch = line.match(newPattern);
    console.log(`     Old pattern match: ${oldMatch ? 'YES' : 'NO'}`);
    console.log(`     New pattern match: ${newMatch ? 'YES' : 'NO'}`);
    if (newMatch) {
      console.log(`     → Name: "${newMatch[1].trim()}", Amount: ₹${parseInt(newMatch[2]).toLocaleString()}`);
    }
    console.log('');
  });
  
  console.log(`🎯 Summary:`);
  console.log(`   Old pattern (with space): ${oldMatches} matches`);
  console.log(`   New pattern (concatenated): ${newMatches} matches`);
  console.log(`   Improvement: +${newMatches - oldMatches} matches`);
}

testRegexFix().catch(console.error);
