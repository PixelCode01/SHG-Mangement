const fs = require('fs');
const path = require('path');

async function testPDFPatterns() {
  try {
    console.log('🔍 Testing PDF pattern extraction...');
    
    const pdfParse = require('pdf-parse');
    
    // Test with the user's PDF file
    const pdfPath = '/home/pixel/Downloads/Swawlamban_Loan_Info.pdf';
    
    console.log(`📄 Analyzing: ${pdfPath}`);
    
    if (!fs.existsSync(pdfPath)) {
      console.log('❌ PDF file not found at specified path');
      console.log('📁 Let me check what files are available in Downloads...');
      
      try {
        const downloadFiles = fs.readdirSync('/home/pixel/Downloads').filter(f => f.toLowerCase().includes('pdf'));
        console.log('📄 PDF files found in Downloads:', downloadFiles);
        return;
      } catch (e) {
        console.log('⚠️  Cannot access Downloads folder');
        console.log('🔄 Using existing test data instead...');
        
        // Use the saved text from previous analysis
        const testText = fs.readFileSync('/home/pixel/aichat/SHG-Mangement-main/tmp/last-parsed-pdf.txt', 'utf8');
        await analyzePatterns(testText, 'test-data');
        return;
      }
    }
    
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(dataBuffer);
    
    console.log(`✅ PDF parsed successfully`);
    console.log(`📊 Pages: ${data.numpages}`);
    console.log(`📝 Text length: ${data.text.length} characters`);
    
    // Save the text for analysis
    await analyzePatterns(data.text, path.basename(pdfPath));
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

async function analyzePatterns(text, source) {
  console.log(`\n🔍 Analyzing patterns in: ${source}`);
  console.log('='.repeat(60));
  
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  console.log(`📝 Total lines: ${lines.length}`);
  
  // Show first 20 lines to understand structure
  console.log('\n📋 First 20 lines:');
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    console.log(`${(i+1).toString().padStart(3)}: "${lines[i]}"`);
  }
  
  console.log('\n🧪 Testing different patterns...');
  
  // Pattern 1: SWAWLAMBAN concatenated format (NAME followed by digits)
  console.log('\n1️⃣ Testing SWAWLAMBAN concatenated pattern...');
  const pattern1 = /^([A-Z][A-Z\s\.\-\']*[A-Z])(\d+)$/;
  let pattern1Matches = 0;
  const pattern1Members = [];
  
  for (const line of lines) {
    const match = line.match(pattern1);
    if (match) {
      const name = match[1].trim();
      const amount = parseInt(match[2]);
      
      if (name.length >= 3 && amount >= 0 && amount <= 10000000) {
        pattern1Members.push({ name, amount });
        pattern1Matches++;
        if (pattern1Matches <= 5) {
          console.log(`   ✅ "${name}" → ₹${amount.toLocaleString()}`);
        }
      }
    }
  }
  console.log(`   📊 Total matches: ${pattern1Matches}`);
  
  // Pattern 2: Name and amount separated by spaces/tabs
  console.log('\n2️⃣ Testing separated name-amount pattern...');
  const pattern2 = /^([A-Z][A-Za-z\s\.\-\']+)\s+(\d[\d,\.]*)\s*$/;
  let pattern2Matches = 0;
  const pattern2Members = [];
  
  for (const line of lines) {
    const match = line.match(pattern2);
    if (match) {
      const name = match[1].trim();
      const amount = parseInt(match[2].replace(/[,\.]/g, ''));
      
      if (name.length >= 3 && amount >= 0 && amount <= 10000000 && !/\d/.test(name)) {
        pattern2Members.push({ name, amount });
        pattern2Matches++;
        if (pattern2Matches <= 5) {
          console.log(`   ✅ "${name}" → ₹${amount.toLocaleString()}`);
        }
      }
    }
  }
  console.log(`   📊 Total matches: ${pattern2Matches}`);
  
  // Pattern 3: Table format with clear separators
  console.log('\n3️⃣ Testing table format pattern...');
  const pattern3 = /^(.+?)\s{2,}(\d[\d,\.]*)\s*(?:\s{2,}(.+?))?(?:\s{2,}(.+?))?$/;
  let pattern3Matches = 0;
  const pattern3Members = [];
  
  for (const line of lines) {
    const match = line.match(pattern3);
    if (match) {
      const name = match[1].trim();
      const amount = parseInt(match[2].replace(/[,\.]/g, ''));
      
      if (name.length >= 3 && amount >= 0 && amount <= 10000000 && /^[A-Za-z\s\.\-\']+$/.test(name)) {
        pattern3Members.push({ name, amount, email: match[3] || '', phone: match[4] || '' });
        pattern3Matches++;
        if (pattern3Matches <= 5) {
          console.log(`   ✅ "${name}" → ₹${amount.toLocaleString()}`);
        }
      }
    }
  }
  console.log(`   📊 Total matches: ${pattern3Matches}`);
  
  // Pattern 4: Look for separate NAME and LOAN sections
  console.log('\n4️⃣ Testing separated sections pattern...');
  let nameHeaderIndex = -1;
  let loanHeaderIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toUpperCase().trim();
    if (/^NAME\s*$/i.test(line)) {
      nameHeaderIndex = i;
      console.log(`   📍 Found NAME header at line ${i + 1}`);
    }
    if (/^LOAN\s*$/i.test(line)) {
      loanHeaderIndex = i;
      console.log(`   📍 Found LOAN header at line ${i + 1}`);
    }
  }
  
  let pattern4Members = [];
  if (nameHeaderIndex !== -1 && loanHeaderIndex !== -1) {
    const names = [];
    const amounts = [];
    
    // Extract names between NAME header and LOAN header
    for (let i = nameHeaderIndex + 1; i < loanHeaderIndex; i++) {
      const line = lines[i].trim();
      if (line && /^[A-Z][A-Z\s\.\-\']+$/.test(line) && line.length > 2) {
        names.push(line);
      }
    }
    
    // Extract amounts after LOAN header
    for (let i = loanHeaderIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (/^\d+$/.test(line)) {
        amounts.push(parseInt(line));
      } else if (line && !/^[A-Z][A-Z\s\.\-\']+$/.test(line)) {
        break; // Stop if we hit something that's not a pure number
      }
    }
    
    console.log(`   📊 Names found: ${names.length}, Amounts found: ${amounts.length}`);
    
    // Pair names with amounts
    const maxLength = Math.min(names.length, amounts.length);
    for (let i = 0; i < maxLength; i++) {
      pattern4Members.push({ name: names[i], amount: amounts[i] });
      if (i < 5) {
        console.log(`   ✅ "${names[i]}" → ₹${amounts[i].toLocaleString()}`);
      }
    }
  }
  console.log(`   📊 Total matches: ${pattern4Members.length}`);
  
  // Summary
  console.log('\n📊 PATTERN ANALYSIS SUMMARY');
  console.log('='.repeat(60));
  console.log(`1️⃣ SWAWLAMBAN concatenated: ${pattern1Matches} members`);
  console.log(`2️⃣ Separated name-amount: ${pattern2Matches} members`);
  console.log(`3️⃣ Table format: ${pattern3Matches} members`);
  console.log(`4️⃣ Separated sections: ${pattern4Members.length} members`);
  
  // Find the best pattern
  const patterns = [
    { name: 'SWAWLAMBAN concatenated', count: pattern1Matches, members: pattern1Members },
    { name: 'Separated name-amount', count: pattern2Matches, members: pattern2Members },
    { name: 'Table format', count: pattern3Matches, members: pattern3Members },
    { name: 'Separated sections', count: pattern4Members.length, members: pattern4Members }
  ];
  
  const bestPattern = patterns.reduce((best, current) => 
    current.count > best.count ? current : best
  );
  
  console.log(`\n🏆 BEST PATTERN: ${bestPattern.name} (${bestPattern.count} members)`);
  
  if (bestPattern.count > 0) {
    console.log('\n📋 Sample members from best pattern:');
    bestPattern.members.slice(0, 10).forEach((member, i) => {
      console.log(`   ${i + 1}. ${member.name} - ₹${member.amount.toLocaleString()}`);
    });
    
    const totalLoanAmount = bestPattern.members.reduce((sum, m) => sum + m.amount, 0);
    const membersWithLoans = bestPattern.members.filter(m => m.amount > 0).length;
    
    console.log('\n📊 Statistics:');
    console.log(`   - Total members: ${bestPattern.count}`);
    console.log(`   - Members with loans: ${membersWithLoans}`);
    console.log(`   - Members without loans: ${bestPattern.count - membersWithLoans}`);
    console.log(`   - Total loan amount: ₹${totalLoanAmount.toLocaleString()}`);
  }
}

testPDFPatterns();
