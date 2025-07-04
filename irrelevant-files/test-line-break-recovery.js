// Test line break preservation in text cleaning
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
      // Clean up multiple spaces but preserve line breaks
      .replace(/[ \t]+/g, ' ')  // Only replace spaces and tabs, not newlines
      .replace(/\n\s+/g, '\n')
      .replace(/\s+\n/g, '\n')
      .replace(/\n+/g, '\n')  // Collapse multiple line breaks to single
      .trim();
      
    console.log(`🧹 Text cleaning: ${text.length} → ${cleaned.length} characters`);
    console.log(`🔍 Cleaned sample (first 100 chars): "${cleaned.substring(0, 100)}"`);
    
    return cleaned;
    
  } catch (error) {
    console.error('Error in text cleaning:', error);
    return text;
  }
}

function recoverLineBreaks(text) {
  if (!text) return '';
  
  console.log('🔧 Attempting to recover line breaks from text structure...');
  
  let recovered = text;
  
  try {
    // Convert patterns where names are followed directly by numbers (member loan amounts)
    // Pattern: "MISHRA178604 ASHOK" -> "MISHRA178604\nASHOK"
    recovered = recovered.replace(/([A-Z]{2,}[A-Z\s]*?)(\d+)\s+([A-Z]{2,})/g, '$1$2\n$3');
    
    // Convert patterns where a name ends with numbers and is followed by another name
    // Pattern: "SANTOSH MISHRA178604 ASHOK KUMAR" -> "SANTOSH MISHRA178604\nASHOK KUMAR"
    recovered = recovered.replace(/([A-Z]+(?:\s+[A-Z]+)*\d+)\s+([A-Z]+(?:\s+[A-Z]+)*)/g, '$1\n$2');
    
    // Handle the specific pattern from this PDF: "NAME + NUMBER + SPACE + NAME"
    // Pattern: "KESHRI0 ANUP" -> "KESHRI0\nANUP"
    recovered = recovered.replace(/([A-Z]+)(\d+)\s+([A-Z]{3,})/g, '$1$2\n$3');
    
    // Convert number patterns followed by names into line breaks (but only at word boundaries)
    // Pattern: "1000 2 Name" -> "1000\n2 Name" (assumes previous member's amount followed by new member number)
    recovered = recovered.replace(/(\d{3,})\s+(\d+\s+[A-Za-z]{2,})/g, '$1\n$2');
    
    // Convert patterns where a number is followed immediately by a capital letter (new member)
    // Pattern: "Devi1 Sunita" -> "Devi\n1 Sunita"
    recovered = recovered.replace(/([A-Za-z]+)(\d+\s+[A-Z][a-z]+)/g, '$1\n$2');
    
    // Handle cases where member numbers are directly adjacent to names
    // Pattern: "Name1Name2" -> "Name\n1Name2"
    recovered = recovered.replace(/([a-z])(\d+[A-Z])/g, '$1\n$2');
    
    // Clean up multiple line breaks
    recovered = recovered.replace(/\n+/g, '\n').trim();
    
    const originalLines = text.split('\n').length;
    const recoveredLines = recovered.split('\n').length;
    
    console.log(`📈 Line break recovery: ${originalLines} → ${recoveredLines} lines`);
    console.log(`🔍 Recovery sample (first 300 chars): "${recovered.substring(0, 300)}"`);
    
    return recovered;
    
  } catch (error) {
    console.error('Error in line break recovery:', error);
    return text;
  }
}

// Test with sample text that mimics what might be extracted from a PDF
const sampleText = "NAMELOAN SANTOSH MISHRA178604 ASHOK KUMAR KESHRI0 ANUP KUMAR KESHRI2470000 PRAMOD KUMAR KESHRI0 MANOJ MISHRA184168 VIKKI THAKUR30624 SUNIL KUMAR MAHTO0";

console.log('Original text:');
console.log(sampleText);
console.log('\nAfter cleaning:');
const cleaned = cleanExtractedText(sampleText);
console.log(cleaned);
console.log('\nAfter line break recovery:');
const recovered = recoverLineBreaks(cleaned);
console.log(recovered);
console.log('\nLines found:');
recovered.split('\n').forEach((line, i) => {
  console.log(`${i + 1}: "${line}"`);
});
