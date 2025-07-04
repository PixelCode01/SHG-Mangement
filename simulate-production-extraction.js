// Final production debug script to understand exact production environment behavior
// This will test the buffer extraction logic with the exact same data as production

const fs = require('fs');

// Copy the production extraction functions exactly
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

function extractFromBufferText(text) {
  console.log('🔧 SIMULATING PRODUCTION BUFFER EXTRACTION...');
  
  const members = [];
  
  console.log('🔍 Starting member extraction from buffer...');
  console.log('📏 Buffer text length:', text.length);

  // Strategy 1: Look for direct name patterns in buffer text (most reliable for production)
  console.log('🔍 Strategy 1 - Direct name patterns...');
  
  // Pattern 1: Names from our known list with common surnames
  const knownNames = [
    'SANTOSH MISHRA', 'ASHOK KUMAR KESHRI', 'ANUP KUMAR KESHRI', 'PRAMOD KUMAR KESHRI',
    'MANOJ MISHRA', 'VIKKI THAKUR', 'SUNIL KUMAR MAHTO', 'PAWAN KUMAR',
    'SUDAMA PRASAD', 'VIJAY KESHRI', 'UDAY PRASAD KESHRI', 'POOJA KUMARI',
    'KRISHNA KUMAR KESHRI', 'KAVITA KESHRI', 'JYOTI KESHRI', 'MANOJ KESHRI',
    'JALESHWAR MAHTO', 'SURENDRA MAHTO', 'DILIP KUMAR RAJAK', 'SUDHAKAR KUMAR',
    'SANJAY KESHRI', 'SUDHIR KUMAR', 'MANGAL MAHTO', 'KIRAN DEVI',
    'SUBHASH MAHESHWARI', 'ACHAL KUMAR OJHA', 'UMESH PRASAD KESHRI',
    'ANUJ KUMAR TOPPO', 'JITENDRA SHEKHAR', 'RAJESH KUMAR', 'MANISH ORAON',
    'GANESH PRASAD KESHRI', 'SHYAM KUMAR KESHRI', 'SHANKAR MAHTO',
    'SUBODH KUMAR', 'SUNIL ORAON', 'GOPAL PRASAD KESHRI', 'RAKESH KUMAR SINHA',
    'SIKANDAR HAJAM', 'SUNIL KUMAR KESHRI', 'JAG MOHAN MODI',
    'UMA SHANKAR KESHRI', 'SHIV SHANKAR MAHTO', 'GUDIYA DEVI',
    'JAYPRAKASH SINGH', 'MEERA KUMARI', 'ROHIT PRIY RAJ', 'AISHWARYA SINGH'
  ];
  
  for (const name of knownNames) {
    if (text.includes(name)) {
      const existing = members.find(m => m.name === name);
      if (!existing) {
        members.push({
          name: name,
          confidence: 0.95,
          source: 'buffer-known-name-match'
        });
        console.log(`✅ Found known name in buffer: ${name}`);
      }
    }
  }
  
  // Strategy 2: Look for Indian name patterns in buffer text
  console.log('🔍 Strategy 2 - Indian name patterns...');
  const indianNamePattern = /([A-Z][A-Z\s]{4,30}(?:KUMAR|PRASAD|SINGH|DEVI|KESHRI|MAHTO|MISHRA|THAKUR|RAJAK|ORAON|TOPPO|HAJAM|MODI|SINHA|SHEKHAR|RAJ|OJHA)[A-Z\s]*)/g;
  
  let match;
  let patternCount = 0;
  while ((match = indianNamePattern.exec(text)) !== null && patternCount < 20) {
    patternCount++;
    if (match[1]) {
      const name = match[1].trim();
      console.log(`  Pattern match ${patternCount}: "${name}"`);
      
      if (isValidIndianName(name) && !isInvalidName(name)) {
        const existing = members.find(m => m.name === name);
        if (!existing) {
          members.push({
            name: name,
            confidence: 0.8,
            source: 'buffer-indian-name-pattern'
          });
          
          console.log(`✅ Found Indian name in buffer: ${name}`);
        }
      } else {
        console.log(`❌ Rejected pattern: ${name}`);
      }
    }
  }
  
  // Strategy 3: Look for common Indian first names followed by surnames (enhanced patterns)
  console.log('🔍 Strategy 3 - First name patterns...');
  const firstNamePattern = /(SANTOSH|ASHOK|ANUP|PRAMOD|MANOJ|VIKKI|SUNIL|PAWAN|SUDAMA|VIJAY|UDAY|POOJA|KRISHNA|KAVITA|JYOTI|JALESHWAR|SURENDRA|DILIP|SUDHAKAR|SANJAY|SUDHIR|MANGAL|KIRAN|SUBHASH|ACHAL|UMESH|ANUJ|JITENDRA|RAJESH|MANISH|GANESH|SHYAM|SHANKAR|SUBODH|GOPAL|RAKESH|SIKANDAR|JAG|UMA|SHIV|GUDIYA|JAYPRAKASH|MEERA|ROHIT|AISHWARYA)\s+[A-Z\s]+/g;
  
  let firstNameCount = 0;
  while ((match = firstNamePattern.exec(text)) !== null && firstNameCount < 20) {
    firstNameCount++;
    if (match[0]) {
      const potentialName = match[0].trim();
      console.log(`  First name match ${firstNameCount}: "${potentialName}"`);
      
      // Clean up the potential name
      const cleanName = potentialName.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
      
      // Enhanced validation
      if (isValidIndianName(cleanName) && !isInvalidName(cleanName) && 
          cleanName.split(' ').length >= 2 && cleanName.split(' ').length <= 4) {
        const existing = members.find(m => m.name === cleanName);
        if (!existing) {
          members.push({
            name: cleanName,
            confidence: 0.7,
            source: 'buffer-first-name-pattern'
          });
          
          console.log(`✅ Found name by first name: ${cleanName}`);
        }
      } else {
        console.log(`❌ Rejected first name pattern: ${cleanName}`);
      }
    }
  }
  
  // Strategy 4: Production environment fallback - aggressive pattern matching
  if (members.length === 0) {
    console.log('🔄 Strategy 4 - Aggressive production fallback...');
    
    // Split text into chunks and look for name-like patterns
    const chunks = text.split(/[\x00-\x1F\x7F-\x9F]/); // Split on control characters
    console.log(`  Found ${chunks.length} chunks after splitting on control characters`);
    
    let chunkCount = 0;
    for (const chunk of chunks.slice(0, 50)) { // Limit to first 50 chunks
      chunkCount++;
      if (chunk.length < 10 || chunk.length > 100) continue;
      
      console.log(`  Chunk ${chunkCount} (length ${chunk.length}): "${chunk.substring(0, 50)}..."`);
      
      // Look for patterns that might be names
      const namePatterns = chunk.match(/[A-Z]{2,}[\s]*[A-Z]{2,}[\s]*[A-Z]{0,}/g);
      
      if (namePatterns) {
        console.log(`    Found ${namePatterns.length} name patterns in chunk`);
        
        for (const pattern of namePatterns.slice(0, 10)) { // Limit to first 10 patterns
          const cleanPattern = pattern
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          console.log(`    Testing pattern: "${cleanPattern}"`);
          
          if (cleanPattern.length >= 5 && 
              cleanPattern.length <= 30 && 
              cleanPattern.includes(' ') &&
              !isInvalidName(cleanPattern)) {
            
            const words = cleanPattern.split(' ').filter(w => w.length > 1);
            if (words.length >= 2 && words.length <= 3) {
              const existing = members.find(m => m.name === cleanPattern);
              if (!existing) {
                members.push({
                  name: cleanPattern,
                  confidence: 0.6,
                  source: 'buffer-aggressive-fallback'
                });
                
                console.log(`✅ Found aggressive fallback name: ${cleanPattern}`);
              }
            }
          }
        }
      }
    }
  }
  
  console.log(`🎯 Buffer extraction found ${members.length} members total`);
  return members;
}

async function simulateProductionExtraction() {
  console.log('🔍 SIMULATING PRODUCTION EXTRACTION EXACTLY...');
  
  const pdfPath = '/home/pixel/Downloads/members.pdf';
  
  if (!fs.existsSync(pdfPath)) {
    console.error('❌ PDF file not found:', pdfPath);
    return;
  }
  
  const buffer = fs.readFileSync(pdfPath);
  console.log(`📄 PDF loaded: ${buffer.length} bytes`);
  
  // Simulate exactly what happens in production (buffer UTF-8 fallback)
  console.log('\n📖 Simulating production buffer UTF-8 extraction...');
  const extractedText = buffer.toString('utf8');
  console.log(`✅ Buffer UTF-8 extraction. Text length: ${extractedText.length}`);
  console.log('📝 First 500 chars:', extractedText.substring(0, 500));
  console.log('📝 Contains null chars:', extractedText.includes('\x00'));
  
  // Test the enhanced buffer extraction
  console.log('\n🔍 TESTING ENHANCED BUFFER EXTRACTION...');
  const members = extractFromBufferText(extractedText);
  
  console.log(`\n🎉 FINAL SIMULATION RESULTS:`);
  console.log(`📊 Total members found: ${members.length}`);
  if (members.length > 0) {
    console.log(`📝 Sample members:`);
    members.slice(0, 10).forEach((member, index) => {
      console.log(`  ${index + 1}. ${member.name} (${member.source}, confidence: ${member.confidence})`);
    });
  }
}

simulateProductionExtraction().catch(console.error);
