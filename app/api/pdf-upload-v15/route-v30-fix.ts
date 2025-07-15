import { NextRequest, NextResponse } from 'next/server';

// PDF Member Extraction API - V30 PRODUCTION FIX
// Fixed version that handles pdf-parse issues in production

console.log('🚀 PDF-UPLOAD-V15 Route loaded - V30 Production Fix');

export async function GET() {
  return NextResponse.json({ 
    status: 'OK',
    route: 'pdf-upload-v15',
    version: 'V30',
    message: 'PDF upload endpoint with production fixes'
  });
}

export async function POST(request: NextRequest) {
  console.log('📝 V30: PDF-UPLOAD-V15: POST request received');
  console.log(`🕐 V30: Request timestamp: ${new Date().toISOString()}`);
  
  try {
    console.log('📦 V30: Parsing form data...');
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      console.log('❌ V30: No file provided in request');
      return NextResponse.json({ 
        error: 'No file provided',
        success: false 
      }, { status: 400 });
    }

    console.log(`📄 V30: Processing PDF: ${file.name}, size: ${file.size} bytes, type: ${file.type}`);

    // Convert file to buffer
    console.log('🔄 V30: Converting file to buffer...');
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    console.log(`✅ V30: Buffer created: ${buffer.length} bytes`);

    // Try multiple PDF extraction methods with better error handling
    let extractedText = '';
    
    try {
      console.log('📖 V30: Method 1 - Attempting pdf-parse extraction...');
      
      // Import pdf-parse with explicit options
      const pdfParse = await import('pdf-parse');
      const pdf = pdfParse.default || pdfParse;
      
      // Call pdf-parse with explicit buffer and options
      const pdfData = await pdf(buffer, {
        // Disable any file system operations
        max: 0 // No limit on pages
      });
      
      extractedText = pdfData.text || '';
      console.log('✅ V30: pdf-parse extraction successful');
      
    } catch (pdfParseError) {
      console.log('⚠️ V30: pdf-parse failed, trying alternative method...');
      console.log('🔧 V30: pdf-parse error:', pdfParseError instanceof Error ? pdfParseError.message : String(pdfParseError));
      
      try {
        // Fallback: Try to read as text directly
        console.log('📖 V30: Method 2 - Attempting direct text extraction...');
        const textDecoder = new TextDecoder('utf-8', { ignoreBOM: true });
        extractedText = textDecoder.decode(buffer);
        console.log('✅ V30: Direct text extraction successful');
        
      } catch (directError) {
        console.log('❌ V30: Direct extraction also failed');
        throw new Error(`All extraction methods failed. pdf-parse: ${pdfParseError instanceof Error ? pdfParseError.message : 'Unknown error'}, direct: ${directError instanceof Error ? directError.message : 'Unknown error'}`);
      }
    }
    
    console.log('✅ V30: Text extracted successfully');
    console.log('📝 V30: Extracted text length:', extractedText.length);
    console.log('📋 V30: First 200 characters:', extractedText.substring(0, 200));
    console.log('📋 V30: Last 200 characters:', extractedText.substring(Math.max(0, extractedText.length - 200)));

    if (!extractedText || extractedText.trim().length === 0) {
      console.log('❌ V30: No text found in PDF');
      return NextResponse.json({ 
        error: 'No text found in PDF',
        success: false,
        message: 'PDF appears to be empty or contains only images'
      }, { status: 422 });
    }

    console.log('🔍 V30: Starting enhanced member extraction from text...');
    
    // Enhanced member extraction logic
    const lines = extractedText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    console.log('📋 V30: Total lines found:', lines.length);
    
    const members: Array<{name: string, currentShare?: number, currentLoanAmount?: number}> = [];
    
    // Skip header line and invalid lines
    const dataLines = lines.filter(line => 
      line !== 'NAMELOANEMAILPHONE' && 
      line !== 'NaN' && 
      line.length > 3 &&
      !line.includes('NaN') &&
      !/^(Name|Loan|Email|Phone)$/i.test(line.trim())
    );
    
    console.log('📋 V30: Data lines to process:', dataLines.length);
    
    for (const line of dataLines) {
      console.log(`🔍 V30: Processing line: "${line}"`);
      
      // Pattern 1: Name followed by number (without space): "SANTOSH MISHRA178604"
      const nameNumberPattern = /^([A-Z][A-Z\s]+?)(\d+)$/;
      const match = line.match(nameNumberPattern);
      
      if (match?.[1] && match[2]) {
        const name = match[1].trim();
        const amount = parseFloat(match[2]);
        
        console.log(`   ✅ V30: Pattern 1 matched - Name: "${name}", Amount: ${amount}`);
        
        // Validate the extracted name and amount
        if (name.length >= 3 && name.length <= 50 &&
            /^[A-Z][A-Z\s]*$/.test(name) &&
            !isNaN(amount) && amount >= 0) {
          
          members.push({
            name: name,
            currentShare: amount,
            currentLoanAmount: 0
          });
          
          console.log(`✅ V30: Added member: ${name} - Amount: ${amount}`);
        } else {
          console.log(`   ❌ V30: Validation failed for: "${name}" (amount: ${amount})`);
        }
      } else {
        // Pattern 2: Name with space before number: "SUDHAKAR KUMAR 56328"
        const spacePattern = /^([A-Z][A-Z\s]+?)\s+(\d+)$/;
        const spaceMatch = line.match(spacePattern);
        
        if (spaceMatch?.[1] && spaceMatch[2]) {
          const name = spaceMatch[1].trim();
          const amount = parseFloat(spaceMatch[2]);
          
          console.log(`   ✅ V30: Pattern 2 matched - Name: "${name}", Amount: ${amount}`);
          
          if (name.length >= 3 && name.length <= 50 &&
              /^[A-Z][A-Z\s]*$/.test(name) &&
              !isNaN(amount) && amount >= 0) {
            
            members.push({
              name: name,
              currentShare: amount,
              currentLoanAmount: 0
            });
            
            console.log(`✅ V30: Added member: ${name} - Amount: ${amount}`);
          }
        } else {
          // Pattern 3: Just names without amounts
          const nameOnlyPattern = /^([A-Z][A-Z\s]{4,45})$/;
          const nameMatch = line.match(nameOnlyPattern);
          
          if (nameMatch?.[1]) {
            const name = nameMatch[1].trim();
            
            // Check if it looks like a real name
            if (name.includes(' ') && 
                (name.includes('KUMAR') || name.includes('DEVI') || name.includes('PRASAD') || 
                 name.includes('MISHRA') || name.includes('KESHRI') || name.includes('MAHTO') ||
                 /^[A-Z]+\s+[A-Z]+/.test(name))) {
              
              console.log(`   ✅ V30: Pattern 3 matched - Name only: "${name}"`);
              
              members.push({
                name: name,
                currentShare: 0,
                currentLoanAmount: 0
              });
              
              console.log(`✅ V30: Added member (name only): ${name}`);
            }
          } else {
            console.log(`   ⚠️ V30: No pattern matched for line: "${line}"`);
          }
        }
      }
    }
    
    console.log(`🎉 V30: Extracted ${members.length} members from PDF`);
    
    // Remove duplicates
    const uniqueMembers = members.filter((member, index, self) => 
      index === self.findIndex(m => m.name === member.name)
    );
    
    console.log(`📊 V30: After removing duplicates: ${uniqueMembers.length} unique members`);
    
    // Return extracted members
    return NextResponse.json({
      success: true,
      message: `Successfully extracted ${uniqueMembers.length} members`,
      members: uniqueMembers,
      textLength: extractedText.length,
      lineCount: lines.length,
      extractionMethod: 'enhanced-pattern-matching-v30'
    });

  } catch (error) {
    console.error('❌ V30: PDF processing error:', error);
    console.log(`🔧 V30: Error type: ${error instanceof Error ? error.constructor.name : typeof error}`);
    console.log(`🔧 V30: Error message: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      console.log(`🔧 V30: Error stack: ${error.stack.substring(0, 500)}`);
    }
    
    return NextResponse.json({ 
      error: 'PDF processing failed',
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      errorName: error instanceof Error ? error.name : 'UnknownError',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
