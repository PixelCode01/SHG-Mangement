import { NextRequest, NextResponse } from 'next/server';
import pdf from 'pdf-parse';

// PDF Member Extraction API - V19 PRODUCTION DEPLOYMENT
// This endpoint properly extracts member names from PDF files

console.log('🚀 PDF-UPLOAD-V11 Route loaded - V19 Production Fix');

export async function GET() {
  return NextResponse.json({ 
    status: 'OK',
    route: 'pdf-upload-v11',
    version: 'V19',
    message: 'PDF upload endpoint is working'
  });
}

export async function POST(request: NextRequest) {
  console.log('📝 PDF-UPLOAD-V13: POST request received in production - Processing PDF for member extraction');
  
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ 
        error: 'No file provided',
        success: false 
      }, { status: 400 });
    }

    console.log(`📄 Processing PDF: ${file.name}, size: ${file.size} bytes`);

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Use pdf-parse library for proper PDF text extraction
    console.log('📖 Extracting text from PDF using pdf-parse...');
    
    const pdfData = await pdf(buffer);
    const extractedText = pdfData.text;
    
    console.log('📝 Extracted text length:', extractedText.length);
    console.log('📋 First 200 characters:', extractedText.substring(0, 200));

    if (!extractedText || extractedText.trim().length === 0) {
      return NextResponse.json({ 
        error: 'No text found in PDF',
        success: false,
        message: 'PDF appears to be empty or contains only images'
      }, { status: 422 });
    }

    // Extract names from the text - split by lines and filter for valid names
    const lines = extractedText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    console.log('📋 Total lines found:', lines.length);
    console.log('📋 Sample lines:', lines.slice(0, 10));

    // Filter for lines that look like names - improved logic
    const memberNames = lines.filter(line => {
      const cleanLine = line.trim();
      
      // Skip header lines and empty lines
      if (!cleanLine || cleanLine === 'NAME' || cleanLine === 'NAMELOANEMAILPHONE' || 
          cleanLine.includes('LOAN') || cleanLine.includes('EMAIL') || cleanLine.includes('PHONE')) {
        return false;
      }
      
      // Must contain alphabetic characters and be reasonable length
      if (!/[A-Za-z]/.test(cleanLine) || cleanLine.length < 3 || cleanLine.length > 100) {
        return false;
      }
      
      // Split on numbers to separate name from loan amounts
      const nameMatch = cleanLine.match(/^([A-Z\s]+?)(?:\d|$)/);
      if (!nameMatch || !nameMatch[1]) return false;
      
      const potentialName = nameMatch[1].trim();
      
      // Check if it looks like a real name (contains common patterns)
      const isValidName = potentialName.length >= 3 &&
                         /^[A-Z][A-Z\s]*$/.test(potentialName) &&
                         (potentialName.includes('KUMAR') || 
                          potentialName.includes('PRASAD') || 
                          potentialName.includes('MAHTO') || 
                          potentialName.includes('KESHRI') || 
                          potentialName.includes('MISHRA') || 
                          potentialName.includes('THAKUR') || 
                          potentialName.includes('RAJAK') || 
                          potentialName.includes('KUMARI') ||
                          potentialName.includes('DEVI') ||
                          potentialName.includes('MAHESHWARI') ||
                          /^[A-Z]+\s+[A-Z]+/.test(potentialName)); // First Last pattern
      
      return isValidName;
    }).map(line => {
      // Extract just the name part (before any numbers)
      const nameMatch = line.match(/^([A-Z\s]+?)(?:\d|$)/);
      return nameMatch && nameMatch[1] ? nameMatch[1].trim() : line.trim();
    });

    // Remove duplicates and clean up
    const uniqueNames = [...new Set(memberNames)].filter(name => name.length > 0);
    
    console.log(`� Found ${uniqueNames.length} unique member names:`, uniqueNames);

    if (uniqueNames.length === 0) {
      return NextResponse.json({ 
        error: 'No member names found in PDF',
        success: false,
        message: 'Could not identify member names in the PDF text. Please check the file format.',
        extractedText: extractedText.substring(0, 500) // First 500 chars for debugging
      }, { status: 422 });
    }

    // Convert to expected format
    const members = uniqueNames.map((name, index) => ({
      name: name.trim(),
      currentShare: 0,
      currentLoanAmount: 0,
      memberId: `PDF_${index + 1}`,
      isExisting: false
    }));

    console.log(`✅ Successfully extracted ${members.length} members from PDF`);

    return NextResponse.json({
      success: true,
      members: members,
      message: `Successfully extracted ${members.length} members from PDF`,
      extractedCount: members.length
    });

  } catch (error) {
    console.error('❌ PDF processing error:', error);
    
    return NextResponse.json({ 
      error: 'PDF processing failed',
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      fallbackRequired: true
    }, { status: 500 });
  }
}
