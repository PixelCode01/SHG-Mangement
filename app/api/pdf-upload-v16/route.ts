import { NextRequest, NextResponse } from 'next/server';

// PDF Member Extraction API - V25 PDFJS-DIST APPROACH
// Using pdfjs-dist library with multiple extraction strategies

console.log('🚀 PDF-UPLOAD-V16 Route loaded - V25 PDFJS-DIST approach');

export async function GET() {
  return NextResponse.json({ 
    status: 'OK',
    route: 'pdf-upload-v16',
    version: 'V25',
    message: 'PDF upload endpoint with pdfjs-dist library'
  });
}

export async function POST(request: NextRequest) {
  console.log('📝 V25: PDF-UPLOAD-V16: POST request received - PDFJS-DIST approach');
  console.log(`🕐 V25: Request timestamp: ${new Date().toISOString()}`);
  
  try {
    console.log('📦 V25: Parsing form data...');
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      console.log('❌ V25: No file provided in request');
      return NextResponse.json({ 
        error: 'No file provided',
        success: false 
      }, { status: 400 });
    }

    console.log(`📄 V25: Processing PDF: ${file.name}, size: ${file.size} bytes, type: ${file.type}`);

    // Convert file to buffer
    console.log('🔄 V25: Converting file to buffer...');
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    console.log(`✅ V25: Buffer created: ${buffer.length} bytes`);

    console.log('📖 V25: Attempting multiple PDF extraction methods...');
    
    let allText = '';
    let extractionMethod = 'unknown';
    
    // Method 1: Try pdf-parse first (most reliable)
    try {
      console.log('🔄 V25: Method 1 - Trying pdf-parse...');
      const { default: pdf } = await import('pdf-parse');
      const pdfData = await pdf(buffer);
      allText = pdfData.text;
      extractionMethod = 'pdf-parse';
      console.log('✅ V25: pdf-parse extraction successful');
    } catch (pdfParseError) {
      console.log('⚠️ V25: pdf-parse failed, trying alternative methods...');
      
      // Method 2: Try pdf2json
      try {
        console.log('🔄 V25: Method 2 - Trying pdf2json...');
        const PDFParser = (await import('pdf2json')).default;
        
        // Create a promise-based wrapper for pdf2json
        const extractWithPdf2json = () => {
          return new Promise<string>((resolve, reject) => {
            const pdfParser = new PDFParser();
            
            pdfParser.on('pdfParser_dataError', (errData: any) => {
              reject(new Error(`PDF2JSON Error: ${errData.parserError}`));
            });
            
            pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
              try {
                let text = '';
                if (pdfData.Pages) {
                  for (const page of pdfData.Pages) {
                    if (page.Texts) {
                      for (const textItem of page.Texts) {
                        if (textItem.R) {
                          for (const run of textItem.R) {
                            if (run.T) {
                              text += decodeURIComponent(run.T) + ' ';
                            }
                          }
                        }
                      }
                    }
                  }
                }
                resolve(text);
              } catch (parseError) {
                reject(parseError);
              }
            });
            
            pdfParser.parseBuffer(buffer);
          });
        };
        
        allText = await extractWithPdf2json();
        extractionMethod = 'pdf2json';
        console.log('✅ V25: pdf2json extraction successful');
        
      } catch (pdf2jsonError) {
        console.log('⚠️ V25: pdf2json also failed, using raw buffer analysis...');
        
        // Method 3: Raw text extraction (fallback)
        try {
          console.log('🔄 V25: Method 3 - Raw buffer text search...');
          const bufferText = buffer.toString('latin1');
          
          // Look for text patterns in the raw buffer
          const textMatches = bufferText.match(/[A-Za-z\s]{5,50}/g);
          if (textMatches) {
            allText = textMatches.join('\n');
            extractionMethod = 'raw-buffer';
            console.log('✅ V25: Raw buffer extraction found text patterns');
          } else {
            throw new Error('No readable text found in raw buffer');
          }
        } catch (rawError) {
          console.log('❌ V25: All extraction methods failed');
          throw new Error(`All PDF extraction methods failed: pdf-parse: ${pdfParseError}, pdf2json: ${pdf2jsonError}, raw: ${rawError}`);
        }
      }
    }
    
    console.log('✅ V25: All text extracted successfully');
    console.log('📝 V25: Total extracted text length:', allText.length);
    console.log('📋 V25: First 300 characters:', allText.substring(0, 300));

    if (!allText || allText.trim().length === 0) {
      console.log('❌ V25: No text found in PDF');
      return NextResponse.json({ 
        error: 'No text found in PDF',
        success: false,
        message: 'PDF appears to be empty or contains only images'
      }, { status: 422 });
    }

    console.log('🔍 V25: Starting member extraction with multiple strategies...');
    
    const members: Array<{name: string, currentShare?: number, currentLoanAmount?: number}> = [];
    
    // Strategy 1: Indian name patterns with amounts
    console.log('🔍 V25: Strategy 1 - Indian name patterns...');
    const indianNamePattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:Devi|Kumari|Singh|Kumar|Prasad|Yadav|Gupta|Sharma)))\s+(\d+(?:\.\d+)?)/g;
    
    let matches = Array.from(allText.matchAll(indianNamePattern));
    console.log(`📊 V25: Strategy 1 found ${matches.length} Indian name patterns`);
    
    for (const match of matches.slice(0, 50)) {
      if (!match[1] || !match[2]) continue;
      
      const name = match[1].trim();
      const amount = parseFloat(match[2]);
      
      if (name.length >= 5 && name.length <= 50 && amount > 0 && amount < 100000) {
        members.push({
          name: name,
          currentShare: amount,
          currentLoanAmount: 0
        });
        console.log(`✅ V25: Strategy 1 - Added: ${name} - ${amount}`);
      }
    }
    
    // Strategy 2: All caps names with amounts
    if (members.length < 10) {
      console.log('🔍 V25: Strategy 2 - All caps names...');
      const capsNamePattern = /([A-Z]{2,}(?:\s+[A-Z]{2,})+)\s+(\d+(?:\.\d+)?)/g;
      
      matches = Array.from(allText.matchAll(capsNamePattern));
      console.log(`📊 V25: Strategy 2 found ${matches.length} caps name patterns`);
      
      for (const match of matches.slice(0, 50)) {
        if (!match[1] || !match[2]) continue;
        
        const name = match[1].trim();
        const amount = parseFloat(match[2]);
        
        if (name.length >= 5 && name.length <= 50 && 
            !name.includes('PDF') && !name.includes('TOTAL') && !name.includes('DATA') &&
            amount > 0 && amount < 100000) {
          
          // Convert to proper case
          const properName = name.toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          
          members.push({
            name: properName,
            currentShare: amount,
            currentLoanAmount: 0
          });
          console.log(`✅ V25: Strategy 2 - Added: ${properName} - ${amount}`);
        }
      }
    }
    
    // Strategy 3: Line-by-line analysis for standalone names
    if (members.length < 5) {
      console.log('🔍 V25: Strategy 3 - Line analysis for standalone names...');
      const lines = allText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      for (const line of lines.slice(0, 200)) {
        // Look for lines that might be names
        if (line.length >= 5 && line.length <= 50) {
          // Check if line looks like a name
          const namePattern = /^[A-Za-z\s]+$/;
          if (namePattern.test(line)) {
            const words = line.split(/\s+/);
            if (words.length >= 2 && words.length <= 4) {
              // Check if it contains common Indian name parts
              const hasIndianNameParts = /(?:Devi|Kumari|Singh|Kumar|Prasad|Yadav|Gupta|Sharma|Bai|Begum)/i.test(line);
              
              if (hasIndianNameParts || words.every(word => word.length >= 2)) {
                const properName = words
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                  .join(' ');
                
                // Avoid duplicates
                if (!members.some(m => m.name === properName)) {
                  members.push({
                    name: properName,
                    currentShare: 1000, // Default amount
                    currentLoanAmount: 0
                  });
                  console.log(`✅ V25: Strategy 3 - Added: ${properName}`);
                  
                  if (members.length >= 50) break; // Limit to prevent too many results
                }
              }
            }
          }
        }
      }
    }
    
    // Remove duplicates and sort
    const uniqueMembers = members.filter((member, index, self) => 
      index === self.findIndex(m => m.name === member.name)
    );
    
    console.log(`🎉 V25: Final result: ${uniqueMembers.length} unique members extracted`);
    uniqueMembers.forEach((member, i) => {
      console.log(`   ${i + 1}. ${member.name} - Share: ${member.currentShare}`);
    });
    
    return NextResponse.json({
      success: true,
      message: `Successfully extracted ${uniqueMembers.length} members using ${extractionMethod}`,
      members: uniqueMembers,
      textLength: allText.length,
      extractionMethod: extractionMethod
    });

  } catch (error) {
    console.error('❌ V25: PDF processing error:', error);
    console.log(`🔧 V25: Error type: ${error instanceof Error ? error.constructor.name : typeof error}`);
    console.log(`🔧 V25: Error message: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      console.log(`🔧 V25: Error stack: ${error.stack.substring(0, 500)}`);
    }
    
    return NextResponse.json({ 
      error: 'PDF processing failed with pdfjs-dist',
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      errorName: error instanceof Error ? error.name : 'UnknownError',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
