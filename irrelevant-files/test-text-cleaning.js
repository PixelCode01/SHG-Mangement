// Test script to debug PDF text extraction
const fs = require('fs');
const path = require('path');

async function testTextCleaning() {
  // Simulate the corrupted text we're seeing
  const corruptedText = `xì\t|SUöøÏ}/I­Mº·iÚ´iÒ´I7`;
  
  console.log('🔍 Original corrupted text:', JSON.stringify(corruptedText));
  console.log('🔍 Original length:', corruptedText.length);
  
  // Apply the same cleaning logic as in the API (updated version)
  function cleanExtractedText(text) {
    if (!text) return '';
    
    let cleaned = text;
    
    try {
      // More aggressive cleaning for heavily corrupted PDFs
      cleaned = cleaned
        // Remove all control characters and non-printable characters
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
        // Remove most special characters except basic punctuation
        .replace(/[^\x20-\x7E]/g, ' ')
        // Remove hex escape sequences
        .replace(/x[0-9A-Fa-f]{2}/g, ' ')
        // Remove common corruption patterns
        .replace(/[{}|\\/\[\]]/g, ' ')
        .replace(/[­·´]/g, ' ')
        // Clean up multiple spaces and normalize
        .replace(/\s+/g, ' ')
        .replace(/\n\s+/g, '\n')
        .replace(/\s+\n/g, '\n')
        .trim();
        
      // If text is too short after cleaning, try pattern extraction
      if (cleaned.length < text.length * 0.1) {
        console.log('⚠️ Text cleaning removed too much content, trying pattern extraction');
        
        // Try to extract readable words and numbers from the original
        const words = text.match(/[A-Za-z]{2,}/g) || [];
        const numbers = text.match(/\d+/g) || [];
        
        if (words.length > 0 || numbers.length > 0) {
          cleaned = [...words, ...numbers].join(' ');
          console.log(`🔧 Pattern extraction result: "${cleaned}"`);
        } else {
          return text;
        }
      }
      
      return cleaned;
      
    } catch (error) {
      console.error('Error in text cleaning:', error);
      return text;
    }
  }
  
  const cleaned = cleanExtractedText(corruptedText);
  console.log('🧹 Cleaned text:', JSON.stringify(cleaned));
  console.log('🧹 Cleaned length:', cleaned.length);
  
  // Test if we can extract a pattern
  const match = cleaned.match(/^(.+?)(\d+)$/);
  if (match) {
    console.log('✅ Pattern found:', match[1].trim(), 'Amount:', match[2]);
  } else {
    console.log('❌ No pattern found in cleaned text');
  }
  
  // Test with full example text that might contain headers
  const testText = `NAME LOAN
${corruptedText}
TOTAL 7`;
  
  console.log('\n🔍 Testing with context:');
  console.log('Original:', JSON.stringify(testText));
  
  const cleanedWithContext = cleanExtractedText(testText);
  console.log('Cleaned:', JSON.stringify(cleanedWithContext));
  
  const lines = cleanedWithContext.split('\n').map(line => line.trim()).filter(line => line);
  console.log('Lines:', lines);
}

testTextCleaning();
