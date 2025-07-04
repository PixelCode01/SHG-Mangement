const fs = require('fs');
const path = require('path');

// Mock the PDF parsing functions from our React component
async function testPDFParsing() {
  console.log('🧪 Testing PDF parsing functionality...');
  
  // Read the extracted text that we already have
  const extractedTextPath = path.join(__dirname, 'extracted-text.txt');
  let text;
  
  try {
    text = fs.readFileSync(extractedTextPath, 'utf8');
    console.log('✅ Successfully read extracted text');
    console.log(`📄 Text length: ${text.length} characters`);
  } catch (error) {
    console.error('❌ Error reading extracted text:', error);
    return;
  }

  // Test the separatedLinesHandler function
  console.log('\n🔍 Testing separatedLinesHandler...');
  
  function separatedLinesHandler(text) {
    console.log('🔎 Looking for NAME and LOAN headers...');
    
    // Look for headers with exact matching
    const nameHeaderRegex = /^NAME\s*$/im;
    const loanHeaderRegex = /^LOAN\s*$/im;
    
    const nameMatch = text.match(nameHeaderRegex);
    const loanMatch = text.match(loanHeaderRegex);
    
    console.log('📍 Name header found:', !!nameMatch, nameMatch ? `at position ${nameMatch.index}` : '');
    console.log('📍 Loan header found:', !!loanMatch, loanMatch ? `at position ${loanMatch.index}` : '');
    
    if (!nameMatch || !loanMatch) {
      console.log('⚠️ Headers not found, trying flexible approach...');
      return handleFlexibleSeparatedFormat(text);
    }
    
    const lines = text.split('\n');
    let nameStartIndex = -1;
    let loanStartIndex = -1;
    
    // Find the line indices
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (nameHeaderRegex.test(line)) {
        nameStartIndex = i;
        console.log(`📍 Found NAME header at line ${i}: "${line}"`);
      }
      if (loanHeaderRegex.test(line)) {
        loanStartIndex = i;
        console.log(`📍 Found LOAN header at line ${i}: "${line}"`);
      }
    }
    
    if (nameStartIndex === -1 || loanStartIndex === -1) {
      console.log('❌ Could not find header line indices');
      return [];
    }
    
    // Extract names (between NAME header and LOAN header)
    const names = [];
    console.log(`🔎 Extracting names from line ${nameStartIndex + 1} to ${loanStartIndex - 1}`);
    
    for (let i = nameStartIndex + 1; i < loanStartIndex; i++) {
      const line = lines[i].trim();
      if (line && /^[A-Z][A-Z\s\.]+$/.test(line) && line.length > 2) {
        names.push(line);
        console.log(`✅ Found name: "${line}"`);
      }
    }
    
    // Extract amounts (after LOAN header)
    const amounts = [];
    console.log(`🔎 Extracting amounts from line ${loanStartIndex + 1} onwards`);
    
    for (let i = loanStartIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line && /^\d+$/.test(line)) {
        amounts.push(parseInt(line));
        console.log(`💰 Found amount: ${line}`);
      }
    }
    
    console.log(`📊 Summary: ${names.length} names, ${amounts.length} amounts`);
    
    // Pair names with amounts
    const members = [];
    const maxLength = Math.min(names.length, amounts.length);
    
    for (let i = 0; i < maxLength; i++) {
      members.push({
        name: names[i],
        initialLoanAmount: amounts[i]
      });
      console.log(`👤 Member ${i + 1}: ${names[i]} - ₹${amounts[i]}`);
    }
    
    return members;
  }
  
  function handleFlexibleSeparatedFormat(text) {
    console.log('🔄 Trying flexible separated format...');
    
    // Try variations of headers
    const nameVariations = ['NAME', 'NAMES', 'MEMBER NAME', 'MEMBER NAMES'];
    const loanVariations = ['LOAN', 'LOANS', 'LOAN AMOUNT', 'AMOUNT'];
    
    const lines = text.split('\n');
    let nameStartIndex = -1;
    let loanStartIndex = -1;
    
    // Look for name section
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim().toUpperCase();
      if (nameVariations.some(variation => line.includes(variation))) {
        nameStartIndex = i;
        console.log(`📍 Found name section at line ${i}: "${lines[i].trim()}"`);
        break;
      }
    }
    
    // Look for loan section
    for (let i = nameStartIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim().toUpperCase();
      if (loanVariations.some(variation => line.includes(variation))) {
        loanStartIndex = i;
        console.log(`📍 Found loan section at line ${i}: "${lines[i].trim()}"`);
        break;
      }
    }
    
    if (nameStartIndex === -1 || loanStartIndex === -1) {
      console.log('❌ Could not find sections in flexible format');
      return [];
    }
    
    // Extract names and amounts using the same logic
    const names = [];
    for (let i = nameStartIndex + 1; i < loanStartIndex; i++) {
      const line = lines[i].trim();
      if (line && /^[A-Z][A-Z\s\.]+$/.test(line) && line.length > 2) {
        names.push(line);
      }
    }
    
    const amounts = [];
    for (let i = loanStartIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line && /^\d+$/.test(line)) {
        amounts.push(parseInt(line));
      }
    }
    
    console.log(`📊 Flexible Summary: ${names.length} names, ${amounts.length} amounts`);
    
    const members = [];
    const maxLength = Math.min(names.length, amounts.length);
    
    for (let i = 0; i < maxLength; i++) {
      members.push({
        name: names[i],
        initialLoanAmount: amounts[i]
      });
    }
    
    return members;
  }
  
  // Run the test
  const result = separatedLinesHandler(text);
  
  console.log('\n🎯 FINAL RESULTS:');
  console.log(`✅ Successfully parsed ${result.length} members`);
  
  if (result.length > 0) {
    console.log('\n👥 Sample members:');
    result.slice(0, 5).forEach((member, index) => {
      console.log(`${index + 1}. ${member.name} - ₹${member.initialLoanAmount}`);
    });
    
    if (result.length > 5) {
      console.log(`... and ${result.length - 5} more members`);
    }
  } else {
    console.log('❌ No members were parsed');
  }
  
  return result;
}

// Run the test
testPDFParsing().catch(console.error);
