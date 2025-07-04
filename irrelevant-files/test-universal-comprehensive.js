// Comprehensive test for Universal PDF Parser functionality
const fs = require('fs');
const pdfParse = require('pdf-parse');

// Mock the NextRequest/NextResponse for testing
class MockNextRequest {
  constructor(formData) {
    this.formData = () => Promise.resolve(formData);
  }
}

class MockFormData {
  constructor(file) {
    this.file = file;
  }
  
  get(key) {
    return this.file;
  }
}

class MockFile {
  constructor(filePath) {
    this.name = filePath.split('/').pop();
    this.type = 'application/pdf';
    const buffer = fs.readFileSync(filePath);
    this.size = buffer.length;
    this._buffer = buffer;
  }
  
  async arrayBuffer() {
    return this._buffer.buffer.slice(
      this._buffer.byteOffset,
      this._buffer.byteOffset + this._buffer.byteLength
    );
  }
}

// Simulate the universal parser logic
async function testUniversalParser() {
  console.log('=== Comprehensive Universal Parser Test ===\n');
  
  const testFile = '/home/pixel/Downloads/SWAWLAMBAN till may 2025.pdf';
  
  if (!fs.existsSync(testFile)) {
    console.log('❌ Test file not found');
    return;
  }
  
  console.log('📄 Testing SWAWLAMBAN format detection...\n');
  
  // Simulate the parser logic
  const file = new MockFile(testFile);
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  const data = await pdfParse(buffer, { max: 0 });
  const fullText = data.text;
  const lines = fullText.split(/\r?\n/).map(line => line.trim()).filter(line => line);
  
  console.log(`📝 Total lines extracted: ${lines.length}`);
  
  // Find header row
  let headerIndex = -1;
  let formatType = 'unknown';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    
    // Check for SWAWLAMBAN specific format first
    if (line.includes('name') && line.includes('loan') && !line.includes('email') && !line.includes('phone')) {
      headerIndex = i;
      formatType = 'swawlamban';
      console.log(`📋 Found SWAWLAMBAN header at line ${i + 1}: "${lines[i]}"`);
      break;
    }
    
    // Check for structured format
    if (line.includes('name') && line.includes('loan') && (line.includes('email') || line.includes('phone'))) {
      headerIndex = i;
      formatType = 'structured';
      console.log(`📋 Found structured header at line ${i + 1}: "${lines[i]}"`);
      break;
    }
  }
  
  if (headerIndex === -1) {
    console.log('⚠️ No clear headers found, would use pattern detection...');
    formatType = 'pattern';
  }
  
  console.log(`🎯 Format detected: ${formatType}\n`);
  
  // Test SWAWLAMBAN parsing logic
  if (formatType === 'swawlamban') {
    console.log('🔍 Testing SWAWLAMBAN parsing logic...\n');
    
    const members = [];
    const failedLines = [];
    
    // Process lines after header
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines, headers, and totals
      if (!line || 
          line.toLowerCase().includes('total') || 
          line.toLowerCase().includes('grand') ||
          line.toLowerCase().includes('name') ||
          line.toLowerCase().includes('loan') ||
          line === 'AI') {
        continue;
      }
      
      // SWAWLAMBAN pattern: NAME followed by AMOUNT (concatenated, no space)
      const match = line.match(/^(.+?)(\\d+)$/);
      
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
            !/\\d/.test(name.replace(/[A-Z\\s\\.\\-\\']/g, '')) && 
            match[2].length <= 7) {
          
          members.push({
            name: name,
            'loan amount': amount.toString(),
            email: '',
            phone: ''
          });
          
          if (members.length <= 5) {
            console.log(`✅ Parsed: ${name} - ₹${amount.toLocaleString()}`);
          }
        } else {
          failedLines.push(line);
        }
      } else {
        failedLines.push(line);
      }
    }
    
    console.log(`\\n📊 SWAWLAMBAN Parsing Results:`);
    console.log(`   - Total members parsed: ${members.length}`);
    console.log(`   - Lines that failed parsing: ${failedLines.length}`);
    
    // Calculate statistics
    const membersWithLoans = members.filter(m => parseInt(m['loan amount']) > 0).length;
    const membersWithoutLoans = members.length - membersWithLoans;
    const totalLoanAmount = members.reduce((sum, m) => sum + parseInt(m['loan amount']), 0);
    
    console.log(`   - Members with loans: ${membersWithLoans}`);
    console.log(`   - Members without loans: ${membersWithoutLoans}`);
    console.log(`   - Total loan amount: ₹${totalLoanAmount.toLocaleString()}`);
    
    // Validation against expected results
    console.log(`\\n🎯 Validation:`);
    console.log(`   Expected: 51 members, 31 with loans, ₹6,993,284 total`);
    console.log(`   Actual: ${members.length} members, ${membersWithLoans} with loans, ₹${totalLoanAmount.toLocaleString()} total`);
    console.log(`   Match: ${members.length === 51 && membersWithLoans === 31 && totalLoanAmount === 6993284 ? '✅ PERFECT' : '❌ MISMATCH'}`);
    
    if (failedLines.length > 0 && failedLines.length <= 5) {
      console.log(`\\n⚠️ Failed lines (first ${Math.min(5, failedLines.length)}):`);
      failedLines.slice(0, 5).forEach((line, i) => {
        console.log(`   ${i + 1}. "${line}"`);
      });
    }
  }
  
  console.log('\\n✅ Universal parser test completed!');
}

testUniversalParser().catch(console.error);
