// Test script for the improved PDF extraction with enhanced filtering
const fs = require('fs');

// Copy the improved extraction functions from the API route
function isValidIndianName(name) {
  if (!name || name.length < 3 || name.length > 50) return false;
  
  // Must be all uppercase letters and spaces
  if (!/^[A-Z\s]+$/.test(name)) return false;
  
  // Must not be common garbage strings
  const garbagePatterns = [
    /^[A-Z]+\d+$/,  // Letters followed by numbers
    /^\d+[A-Z]+$/,  // Numbers followed by letters  
    /^[A-Z]{1,2}$/,  // Single or double letters
    /^(NA|NULL|NONE|UNKNOWN|TEST|SAMPLE)$/,
  ];
  
  for (const pattern of garbagePatterns) {
    if (pattern.test(name)) return false;
  }
  
  // Should have at least one space (first name + last name)
  if (!name.includes(' ')) return false;
  
  // Each word should be at least 2 characters
  const words = name.split(' ').filter(w => w.length > 0);
  if (words.some(word => word.length < 2)) return false;
  
  return true;
}

function isInvalidName(name) {
  if (!name) return true;
  
  // List of invalid patterns that should be excluded
  const invalidPatterns = [
    /^UMAR\s+/, // UMAR followed by anything (appears to be a placeholder)
    /^NAME/, // Header text
    /NAMELOANEMAILPHONE/, // Header combination
    /^LOAN/, // Header text
    /^EMAIL/, // Header text
    /^PHONE/, // Header text
    /^\s*$/, // Only whitespace
    /^[0-9\s\-\.\(\)]+$/, // Only numbers and symbols
    /NULL|NONE|UNKNOWN|TEST|SAMPLE|DEFAULT/i, // Common placeholder text
  ];
  
  // Check if name matches any invalid pattern
  for (const pattern of invalidPatterns) {
    if (pattern.test(name)) {
      console.log(`🚫 Rejected invalid name: "${name}" (matched pattern: ${pattern})`);
      return true;
    }
  }
  
  // Additional validation: names that look like headers or corrupted data
  const cleanName = name.trim();
  
  // Reject names that contain newlines (corrupted data)
  if (cleanName.includes('\n') || cleanName.includes('\r')) {
    console.log(`🚫 Rejected name with newlines: "${name}"`);
    return true;
  }
  
  // Reject very short or very long names
  if (cleanName.length < 5 || cleanName.length > 50) {
    console.log(`🚫 Rejected name due to length: "${name}" (length: ${cleanName.length})`);
    return true;
  }
  
  // Reject names with too few or too many words
  const words = cleanName.split(' ').filter(w => w.length > 0);
  if (words.length < 2 || words.length > 4) {
    console.log(`🚫 Rejected name due to word count: "${name}" (words: ${words.length})`);
    return true;
  }
  
  return false;
}

function extractFromCleanText(text) {
  console.log('🧹 Testing improved clean text extraction...');
  
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  console.log('📋 Total lines found:', lines.length);
  
  const members = [];
  
  // Enhanced header and garbage filtering
  const dataLines = lines.filter(line => {
    // Filter out headers and common garbage
    const excludePatterns = [
      'NAMELOANEMAILPHONE',
      'NAME',
      'LOAN',
      'EMAIL', 
      'PHONE',
      'NaN',
      /^[\d\s\-\.\(\)]+$/, // Only numbers/symbols
      /^[A-Z]{1,2}$/, // Single or double letters
      /^\d+$/, // Only numbers
      /^[\s]*$/ // Only whitespace
    ];
    
    for (const pattern of excludePatterns) {
      if (typeof pattern === 'string' && line === pattern) return false;
      if (pattern instanceof RegExp && pattern.test(line)) return false;
    }
    
    return line.length > 3;
  });
  
  console.log('📋 Data lines to process:', dataLines.length);
  
  for (const line of dataLines) {
    console.log(`🔍 Processing line: "${line}"`);
    
    // Strategy 1: Pattern for name followed by number (without space): "SANTOSH MISHRA178604"
    const nameNumberPattern = /^([A-Z][A-Z\s]+?)(\d+)$/;
    const match = line.match(nameNumberPattern);
    
    if (match && match[1] && match[2]) {
      const name = match[1].trim();
      
      console.log(`   ✅ Pattern 1 matched - Name: "${name}"`);
      
      // Validate the extracted name
      if (isValidIndianName(name) && !isInvalidName(name)) {
        members.push({
          name: name,
          confidence: 0.9,
          source: 'clean-name-number-pattern'
        });
        
        console.log(`✅ Added member: ${name}`);
        continue;
      } else {
        console.log(`❌ Rejected name: ${name}`);
      }
    }
    
    // Strategy 2: Pattern with space between name and number: "SUDHAKAR KUMAR 56328"
    const spacePattern = /^([A-Z][A-Z\s]+?)\s+(\d+)$/;
    const spaceMatch = line.match(spacePattern);
    
    if (spaceMatch && spaceMatch[1] && spaceMatch[2]) {
      const name = spaceMatch[1].trim();
      
      console.log(`   ✅ Pattern 2 matched - Name: "${name}"`);
      
      if (isValidIndianName(name) && !isInvalidName(name)) {
        members.push({
          name: name,
          confidence: 0.9,
          source: 'clean-name-space-number-pattern'
        });
        
        console.log(`✅ Added member: ${name}`);
        continue;
      } else {
        console.log(`❌ Rejected name: ${name}`);
      }
    }
    
    // Strategy 3: Look for standalone names (uppercase, 2+ words)
    if (/^[A-Z][A-Z\s]+$/.test(line) && line.includes(' ')) {
      const name = line.trim();
      
      if (isValidIndianName(name) && !isInvalidName(name) && name.split(' ').length >= 2) {
        members.push({
          name: name,
          confidence: 0.7,
          source: 'clean-standalone-name-pattern'
        });
        
        console.log(`✅ Added standalone name: ${name}`);
        continue;
      } else {
        console.log(`❌ Rejected standalone name: ${name}`);
      }
    }
    
    console.log(`   ⚠️ No pattern matched for line: "${line}"`);
  }
  
  return members;
}

async function testImprovedExtraction() {
  console.log('🔍 TESTING IMPROVED PDF EXTRACTION WITH ENHANCED FILTERING...');
  
  const pdfPath = '/home/pixel/Downloads/members.pdf';
  
  if (!fs.existsSync(pdfPath)) {
    console.error('❌ PDF file not found:', pdfPath);
    return;
  }
  
  const buffer = fs.readFileSync(pdfPath);
  console.log(`📄 PDF loaded: ${buffer.length} bytes`);
  
  let extractedText = '';
  
  // Test pdf-parse extraction (like production)
  try {
    console.log('\n📖 Testing pdf-parse extraction...');
    const pdf = require('pdf-parse');
    const pdfData = await pdf(buffer, { max: 0 });
    extractedText = pdfData.text || '';
    console.log(`✅ Extraction successful. Text length: ${extractedText.length}`);
    console.log('📝 First 200 chars:', extractedText.substring(0, 200));
  } catch (error) {
    console.log('❌ pdf-parse failed:', error.message);
    return;
  }
  
  // Test the improved member extraction
  console.log('\n🔍 TESTING IMPROVED MEMBER EXTRACTION...');
  const members = extractFromCleanText(extractedText);
  
  console.log(`\n🎉 FINAL RESULTS:`);
  console.log(`📊 Total valid members found: ${members.length}`);
  console.log(`📝 Valid members:`);
  members.forEach((member, index) => {
    console.log(`  ${index + 1}. ${member.name} (${member.source}, confidence: ${member.confidence})`);
  });
}

testImprovedExtraction().catch(console.error);
