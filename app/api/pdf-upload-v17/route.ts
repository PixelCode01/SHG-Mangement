import { NextRequest, NextResponse } from 'next/server';

// PDF Member Extraction API - V26 NATIVE TEXT EXTRACTION
// Using native Node.js buffer analysis and regex patterns

console.log('🚀 PDF-UPLOAD-V17 Route loaded - V26 Native text extraction');

export async function GET() {
  return NextResponse.json({ 
    status: 'OK',
    route: 'pdf-upload-v17',
    version: 'V26',
    message: 'PDF upload endpoint with native text extraction'
  });
}

export async function POST(request: NextRequest) {
  console.log('📝 V26: PDF-UPLOAD-V17: POST request received - Native approach');
  console.log(`🕐 V26: Request timestamp: ${new Date().toISOString()}`);
  
  try {
    console.log('📦 V26: Parsing form data...');
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      console.log('❌ V26: No file provided in request');
      return NextResponse.json({ 
        error: 'No file provided',
        success: false 
      }, { status: 400 });
    }

    console.log(`📄 V26: Processing PDF: ${file.name}, size: ${file.size} bytes, type: ${file.type}`);

    // Convert file to buffer
    console.log('🔄 V26: Converting file to buffer...');
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    console.log(`✅ V26: Buffer created: ${buffer.length} bytes`);

    console.log('🔍 V26: Starting native text extraction...');
    
    // Method 1: Extract readable text from buffer using multiple encodings
    const extractTextFromBuffer = (buffer: Buffer): string => {
      let allText = '';
      
      // Try different encodings
      const encodings = ['utf8', 'latin1', 'ascii', 'utf16le'];
      
      for (const encoding of encodings) {
        try {
          const text = buffer.toString(encoding as BufferEncoding);
          
          // Extract readable text patterns (letters, spaces, common punctuation)
          const readableText = text.match(/[A-Za-z\s\u0900-\u097F]{3,}/g);
          if (readableText) {
            allText += readableText.join(' ') + '\n';
          }
        } catch (error) {
          console.log(`⚠️ V26: Encoding ${encoding} failed:`, error);
        }
      }
      
      return allText;
    };
    
    console.log('📖 V26: Extracting text with multiple encodings...');
    const extractedText = extractTextFromBuffer(buffer);
    
    console.log('✅ V26: Text extraction completed');
    console.log('📝 V26: Extracted text length:', extractedText.length);
    console.log('📋 V26: First 300 characters:', extractedText.substring(0, 300));

    if (!extractedText || extractedText.trim().length === 0) {
      console.log('❌ V26: No readable text found in PDF');
      return NextResponse.json({ 
        error: 'No readable text found in PDF',
        success: false,
        message: 'PDF might be image-based or corrupted'
      }, { status: 422 });
    }

    console.log('🔍 V26: Starting advanced member extraction...');
    
    const members: Array<{name: string, currentShare?: number, currentLoanAmount?: number}> = [];
    
    // Clean the text first
    const cleanText = extractedText
      .replace(/[^\w\s\u0900-\u097F]/g, ' ') // Keep only letters, spaces, and Devanagari
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
    
    console.log('📋 V26: Cleaned text length:', cleanText.length);
    console.log('📋 V26: Cleaned text sample:', cleanText.substring(0, 300));
    
    // Strategy 1: Look for common Indian female names with enhanced pattern
    console.log('🔍 V26: Strategy 1 - Enhanced Indian name patterns...');
    const indianNamePattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:Devi|Kumari|Singh|Kumar|Prasad|Yadav|Gupta|Sharma|Bai)))\s+(\d+)/g;
    
    let matches = Array.from(cleanText.matchAll(indianNamePattern));
    console.log(`📊 V26: Strategy 1 found ${matches.length} Indian name patterns`);
    
    for (const match of matches.slice(0, 50)) {
      if (match[1] && match[2]) {
        const name = match[1].trim();
        const amount = parseFloat(match[2]);
        
        if (name.length >= 5 && name.length <= 50 && amount > 0 && amount < 100000) {
          members.push({
            name: name,
            currentShare: amount,
            currentLoanAmount: 0
          });
          console.log(`✅ V26: Strategy 1 - Added: ${name} - ${amount}`);
        }
      }
    }
    
    // Strategy 2: General name-amount patterns (if strategy 1 didn't find enough)
    if (members.length < 5) {
      console.log('🔍 V26: Strategy 2 - General name-amount patterns...');
      const generalPattern = /([A-Z][a-z]+\s+[A-Z][a-z]+)\s+(\d+)/g;
      
      matches = Array.from(cleanText.matchAll(generalPattern));
      console.log(`📊 V26: Strategy 2 found ${matches.length} general patterns`);
      
      for (const match of matches.slice(0, 50)) {
        if (match[1] && match[2]) {
          const name = match[1].trim();
          const amount = parseFloat(match[2]);
          
          if (name.length >= 5 && name.length <= 50 && 
              !name.includes('PDF') && !name.includes('TOTAL') && !name.includes('DATA') &&
              amount > 0 && amount < 100000) {
            
            members.push({
              name: name,
              currentShare: amount,
              currentLoanAmount: 0
            });
            console.log(`✅ V26: Strategy 2 - Added: ${name} - ${amount}`);
          }
        }
      }
    }
    
    // Strategy 3: Line-by-line analysis for names with numbers
    if (members.length < 5) {
      console.log('🔍 V26: Strategy 3 - Line analysis with numbers...');
      const lines = extractedText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      for (const line of lines.slice(0, 100)) {
        // Look for patterns like "Name Number" or "Number Name"
        const nameNumberPattern = /([A-Za-z\s]{5,40})\s+(\d+(?:\.\d+)?)/;
        const numberNamePattern = /(\d+(?:\.\d+)?)\s+([A-Za-z\s]{5,40})/;
        
        let match = line.match(nameNumberPattern);
        if (!match) {
          const numberMatch = line.match(numberNamePattern);
          if (numberMatch?.[1] && numberMatch[2]) {
            // Create a new match array with swapped positions
            match = ['', numberMatch[2], numberMatch[1]];
          }
        }
        
        if (match?.[1] && match[2]) {
          const name = match[1].trim();
          const amount = parseFloat(match[2]);
          
          if (name.length >= 5 && name.length <= 40 &&
              /^[A-Za-z\s]+$/.test(name) &&
              amount > 0 && amount < 100000) {
            
            const properName = name.split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join(' ');
            
            if (!members.some(m => m.name === properName)) {
              members.push({
                name: properName,
                currentShare: amount,
                currentLoanAmount: 0
              });
              console.log(`✅ V26: Strategy 3 - Added: ${properName} - ${amount}`);
            }
          }
        }
      }
    }
    
    // Remove duplicates and sort
    const uniqueMembers = members.filter((member, index, self) => 
      index === self.findIndex(m => m.name.toLowerCase() === member.name.toLowerCase())
    );
    
    console.log(`🎉 V26: Final result: ${uniqueMembers.length} unique members extracted`);
    uniqueMembers.forEach((member, i) => {
      console.log(`   ${i + 1}. ${member.name} - Share: ${member.currentShare}`);
    });
    
    return NextResponse.json({
      success: true,
      message: `Successfully extracted ${uniqueMembers.length} members using native text extraction`,
      members: uniqueMembers,
      textLength: extractedText.length,
      cleanedTextLength: cleanText.length,
      extractionMethod: 'native-multi-strategy'
    });

  } catch (error) {
    console.error('❌ V26: PDF processing error:', error);
    console.log(`🔧 V26: Error type: ${error instanceof Error ? error.constructor.name : typeof error}`);
    console.log(`🔧 V26: Error message: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      console.log(`🔧 V26: Error stack: ${error.stack.substring(0, 500)}`);
    }
    
    return NextResponse.json({ 
      error: 'PDF processing failed with native extraction',
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      errorName: error instanceof Error ? error.name : 'UnknownError',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
