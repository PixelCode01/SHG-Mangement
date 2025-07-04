import { NextRequest, NextResponse } from 'next/server';

// PDF Member Extraction API - V31 VERCEL-OPTIMIZED DYNAMIC IMPORTS + GENERIC EXTRACTION
// Fixed pattern to handle names and numbers concatenated without spaces
// Added generic extraction for various PDF formats
// Optimized for Vercel serverless environment with better error handling

console.log('🚀 PDF-UPLOAD-V18 Route loaded - V31 Vercel-optimized dynamic imports');

// Generic extraction functions for various PDF formats
interface ExtractedMember {
  name: string;
  loanAmount: number;
}

async function tryGenericExtraction(text: string, _method: string): Promise<ExtractedMember[]> {
  console.log('🔍 Generic: Attempting flexible extraction...');
  const members: ExtractedMember[] = [];
  
  try {
    // Clean the text
    const cleanedText = text
      .replace(/NAMELOANEMAILPHONE/g, '')  // Remove concatenated header
      .replace(/NAME\s+LOAN\s+EMAIL\s+PHONE/g, '')  // Remove spaced header
      .replace(/NAME.*?LOAN.*?EMAIL.*?PHONE/gi, '') // Remove header variations
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    console.log('🔍 Generic: Cleaned text length:', cleanedText.length);
    
    // Strategy 1: Look for name patterns followed by numbers (flexible)
    const patterns = [
      // Pattern 1: Names with numbers (most common)
      /([A-Za-z][A-Za-z\s\.]{3,40}?)\s*[:\-]?\s*(\d{1,10})/g,
      // Pattern 2: Names in title case or proper case
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*[:\-]?\s*(\d{1,10})/g,
      // Pattern 3: All caps names
      /([A-Z][A-Z\s]{3,40}?)\s*[:\-]?\s*(\d{1,10})/g,
      // Pattern 4: Names with various separators
      /([A-Za-z][A-Za-z\s\.\-]{3,40}?)\s*[\|\:\-\,\;]\s*(\d{1,10})/g
    ];
    
    for (let patternIndex = 0; patternIndex < patterns.length; patternIndex++) {
      const pattern = patterns[patternIndex];
      if (!pattern) continue;
      
      const matches = Array.from(cleanedText.matchAll(pattern));
      
      console.log(`🔍 Generic: Pattern ${patternIndex + 1} found ${matches.length} matches`);
      
      for (const match of matches) {
        if (!match[1] || !match[2]) continue;
        
        const rawName = match[1].trim();
        const amount = parseInt(match[2]);
        
        // Skip obvious non-names
        if (isValidMemberName(rawName) && isValidAmount(amount)) {
          const properName = formatName(rawName);
          
          // Avoid duplicates
          if (!members.find(m => m.name.toLowerCase() === properName.toLowerCase())) {
            members.push({
              name: properName,
              loanAmount: amount
            });
            
            console.log(`✅ Generic: Added: ${properName} - ₹${amount.toLocaleString()}`);
          }
        }
      }
      
      // If we found reasonable results with this pattern, use them
      if (members.length >= 5) {
        console.log(`🎉 Generic: Pattern ${patternIndex + 1} successful with ${members.length} members`);
        break;
      } else if (members.length > 0) {
        console.log(`⚠️ Generic: Pattern ${patternIndex + 1} found only ${members.length} members, trying next pattern...`);
        members.length = 0; // Clear and try next pattern
      }
    }
    
    // Strategy 2: Look for tabular data
    if (members.length === 0) {
      console.log('🔍 Generic: Trying tabular data extraction...');
      const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      for (const line of lines) {
        // Look for lines that might contain name and amount separated by spaces or tabs
        const parts = line.split(/\s{2,}|\t/).filter(part => part.trim().length > 0);
        
        if (parts.length >= 2) {
          const potentialName = parts[0]?.trim();
          const potentialAmount = parts[parts.length - 1]?.trim();
          
          if (potentialName && potentialAmount && isValidMemberName(potentialName) && /^\d+$/.test(potentialAmount)) {
            const amount = parseInt(potentialAmount);
            if (isValidAmount(amount)) {
              const properName = formatName(potentialName);
              
              if (!members.find(m => m.name.toLowerCase() === properName.toLowerCase())) {
                members.push({
                  name: properName,
                  loanAmount: amount
                });
                
                console.log(`✅ Generic: Tabular: ${properName} - ₹${amount.toLocaleString()}`);
              }
            }
          }
        }
      }
    }
    
    console.log(`🔍 Generic: Final result: ${members.length} members found`);
    return members;
    
  } catch (error) {
    console.log('❌ Generic: Extraction failed:', error);
    return [];
  }
}

function isValidMemberName(name: string): boolean {
  if (!name || name.length < 2 || name.length > 60) return false;
  
  // Check if it looks like a name
  const namePattern = /^[A-Za-z][A-Za-z\s\.\-\']{1,58}[A-Za-z]$/;
  if (!namePattern.test(name)) return false;
  
  // Skip obvious non-names and headers
  const invalidPatterns = [
    /^(NAME|LOAN|AMOUNT|EMAIL|PHONE|TOTAL|SUM|BALANCE|ADDRESS|DATE|TIME|PAGE|ID)$/i,
    /NAME.*LOAN.*EMAIL.*PHONE/i,  // Specific header pattern
    /LOAN.*EMAIL.*PHONE/i,        // Partial header pattern
    /EMAIL.*PHONE/i,              // Another header fragment
    /^\d+$/,
    /^[A-Z]+$/,  // All caps single words (likely headers)
    /^.{1,2}$/, // Too short
    /^(RS|INR|USD|EUR)\.?\d/i, // Currency indicators
  ];
  
  for (const invalidPattern of invalidPatterns) {
    if (invalidPattern.test(name.trim())) return false;
  }
  
  return true;
}

function isValidAmount(amount: number): boolean {
  // Reasonable loan amount range (0 to 100 million)
  return amount >= 0 && amount <= 100000000;
}

function formatName(rawName: string): string {
  return rawName
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .trim();
}

async function tryHardcodedExtraction(text: string): Promise<ExtractedMember[]> {
  console.log('🔍 Hardcoded: Using original V28 logic...');
  const members: ExtractedMember[] = [];
  
  try {
    // Original V28 hardcoded logic
    const cleanedText = text
      .replace(/NAMELOANEMAILPHONE/g, '')  // Remove concatenated header (pdf-parse)
      .replace(/NAME\s+LOAN\s+EMAIL\s+PHONE/g, '')  // Remove spaced header (pdf2json)
      .replace(/\n/g, ' ')  // Replace line breaks with spaces
      .replace(/\s+/g, ' ')  // Normalize multiple spaces
      .trim();
    
    const nameNumberPattern = /([A-Z][A-Z\s]{4,40}?)\s*(\d+)/g;
    const matches = Array.from(cleanedText.matchAll(nameNumberPattern));
    
    console.log(`🔍 Hardcoded: Found ${matches.length} matches`);
    
    for (const match of matches) {
      if (!match[1] || !match[2]) continue;
      
      const rawName = match[1].trim();
      const amount = parseInt(match[2]);
      
      // Skip headers and invalid entries
      if (rawName.includes('NAME') || rawName.includes('LOAN') || 
          rawName.includes('EMAIL') || rawName.includes('PHONE') ||
          rawName.includes('TOTAL') || rawName.includes('SUM') ||
          rawName.length < 5) {
        continue;
      }
      
      // Convert to proper case
      const properName = rawName.toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      // Validate as reasonable member data
      const nameWords = properName.split(' ');
      if (nameWords.length >= 2 && nameWords.length <= 4 && 
          properName.length >= 5 && properName.length <= 50) {
        
        members.push({
          name: properName,
          loanAmount: amount
        });
      }
    }
    
    console.log(`🔍 Hardcoded: Extracted ${members.length} members`);
    return members;
    
  } catch (error) {
    console.log('❌ Hardcoded: Extraction failed:', error);
    return [];
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: 'OK',
    route: 'pdf-upload-v18',
    version: 'V31',
    message: 'PDF upload endpoint with Vercel-optimized dynamic imports + generic extraction + V28 hardcoded fallback',
    features: [
      'Vercel-optimized dynamic imports for serverless environment',
      'Enhanced error handling for production stability',
      'Generic flexible extraction for various PDF formats',
      'Multiple regex patterns (Title Case, UPPER CASE, mixed)',
      'Various separators (spaces, colons, dashes, pipes)',
      'Tabular data extraction',
      'Automatic fallback to V28 hardcoded logic',
      'Backward compatibility maintained'
    ]
  });
}

export async function POST(request: NextRequest) {
  console.log('📝 V31: PDF-UPLOAD-V18: POST request received - Vercel-optimized dynamic imports');
  console.log(`🕐 V31: Request timestamp: ${new Date().toISOString()}`);
  
  try {
    console.log('📦 V31: Parsing form data with enhanced error handling...');
    
    // Enhanced FormData parsing for Vercel compatibility
    let formData: FormData;
    try {
      formData = await request.formData();
      console.log('✅ V31: FormData parsed successfully');
    } catch (formDataError) {
      console.log('❌ V31: FormData parsing failed:', formDataError);
      return NextResponse.json({ 
        error: 'Failed to parse multipart form data',
        success: false,
        message: 'The request could not be parsed as multipart form data. Please ensure you are uploading a valid file.',
        details: formDataError instanceof Error ? formDataError.message : 'Unknown parsing error'
      }, { status: 400 });
    }
    
    const file = formData.get('pdf') as File;
    
    if (!file) {
      console.log('❌ V31: No file provided in request');
      return NextResponse.json({ 
        error: 'No file provided',
        success: false 
      }, { status: 400 });
    }

    console.log(`📄 V31: Processing PDF: ${file.name}, size: ${file.size} bytes, type: ${file.type}`);

    // Convert file to buffer
    console.log('🔄 V31: Converting file to buffer...');
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    console.log(`✅ V31: Buffer created: ${buffer.length} bytes`);

    console.log('📖 V31: Attempting PDF extraction with Vercel-optimized dynamic imports...');
    
    let allText = '';
    let extractionMethod = 'unknown';
    
    // Method 1: Try pdf2json first (gives better spacing) - Vercel optimized
    try {
      console.log('🔄 V31: Method 1 - Trying pdf2json with Vercel-optimized import...');
      
      // Use dynamic import with explicit error handling for Vercel
      const PDFParserModule = await import('pdf2json');
      const PDFParser = PDFParserModule.default;
      
      const extractWithPdf2json = () => {
        return new Promise<string>((resolve, reject) => {
          try {
            const pdfParser = new PDFParser();
            
            pdfParser.on('pdfParser_dataError', (errData: any) => {
              reject(new Error(`PDF2JSON Error: ${errData?.parserError || 'Unknown error'}`));
            });
            
            pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
              try {
                let text = '';
                if (pdfData?.Pages) {
                  for (const page of pdfData.Pages) {
                    if (page?.Texts) {
                      for (const textItem of page.Texts) {
                        if (textItem?.R) {
                          for (const run of textItem.R) {
                            if (run?.T) {
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
          } catch (initError) {
            reject(new Error(`PDF2JSON initialization failed: ${initError}`));
          }
        });
      };
      
      allText = await extractWithPdf2json();
      extractionMethod = 'pdf2json';
      console.log('✅ V31: pdf2json extraction successful');
      
    } catch (pdf2jsonError) {
      console.log('⚠️ V31: pdf2json failed, trying pdf-parse...', pdf2jsonError);
      
      // Method 2: Try pdf-parse as backup with Vercel optimization
      try {
        console.log('🔄 V31: Method 2 - Trying pdf-parse with Vercel-optimized import...');
        
        // Use dynamic import with explicit error handling for Vercel
        const pdfParseModule = await import('pdf-parse');
        const pdf = pdfParseModule.default;
        
        const pdfData = await pdf(buffer);
        allText = pdfData.text;
        extractionMethod = 'pdf-parse';
        console.log('✅ V31: pdf-parse extraction successful');
      } catch (pdfParseError) {
        console.log('❌ V31: Both extraction methods failed');
        throw new Error(`All PDF extraction methods failed: pdf2json: ${pdf2jsonError}, pdf-parse: ${pdfParseError}`);
      }
    }
    
    console.log('✅ V27: Text extraction completed');
    console.log('📝 V27: Total extracted text length:', allText.length);
    console.log('📋 V27: First 300 characters:', allText.substring(0, 300));

    if (!allText || allText.trim().length === 0) {
      console.log('❌ V27: No text found in PDF');
      return NextResponse.json({ 
        error: 'No text found in PDF',
        success: false,
        message: 'PDF appears to be empty or contains only images'
      }, { status: 422 });
    }

    console.log('🔍 V28: Starting enhanced member extraction with generic support...');
    
    const members: Array<{
      name: string; 
      loanAmount: number;
      currentLoanAmount: number; 
      currentShare?: number;
    }> = [];
    
    // Strategy 1: Try generic flexible extraction for any PDF format
    console.log('🔍 V28: Strategy 1 - Generic flexible extraction...');
    let extractedMembers = await tryGenericExtraction(allText, extractionMethod);
    
    // Strategy 2: Fallback to hardcoded logic if generic extraction doesn't find enough members
    if (extractedMembers.length < 5) {
      console.log(`� V28: Generic found only ${extractedMembers.length} members, trying hardcoded fallback...`);
      const hardcodedMembers = await tryHardcodedExtraction(allText);
      
      // Use whichever method found more members
      if (hardcodedMembers.length > extractedMembers.length) {
        extractedMembers = hardcodedMembers;
        console.log(`🔍 V28: Using hardcoded extraction with ${hardcodedMembers.length} members`);
      } else {
        console.log(`🔍 V28: Keeping generic extraction with ${extractedMembers.length} members`);
      }
    } else {
      console.log(`🔍 V28: Generic extraction successful with ${extractedMembers.length} members`);
    }
    
    // Convert extracted members to final format
    extractedMembers.forEach(member => {
      members.push({
        name: member.name,
        loanAmount: member.loanAmount,
        currentLoanAmount: member.loanAmount,
        currentShare: member.loanAmount > 0 ? Math.min(5000, Math.max(1000, member.loanAmount * 0.1)) : 1000
      });
      
      console.log(`✅ V28: Added: ${member.name} - Loan: ₹${member.loanAmount.toLocaleString()}`);
    });
    
    // Remove duplicates by name
    const uniqueMembers = members.filter((member, index, self) => 
      index === self.findIndex(m => m.name.toLowerCase() === member.name.toLowerCase())
    );
    
    console.log(`🎉 V28: Final result: ${uniqueMembers.length} unique members extracted`);
    
    // Calculate totals
    const totalLoanAmount = uniqueMembers.reduce((sum, member) => sum + member.loanAmount, 0);
    const membersWithLoans = uniqueMembers.filter(m => m.loanAmount > 0).length;
    
    console.log(`💰 V28: Total loan amount: ₹${totalLoanAmount.toLocaleString()}`);
    console.log(`📈 V28: Members with loans: ${membersWithLoans}/${uniqueMembers.length}`);
    
    uniqueMembers.forEach((member, i) => {
      console.log(`   ${i + 1}. ${member.name} - ₹${member.loanAmount.toLocaleString()}`);
    });
    
    return NextResponse.json({
      success: true,
      message: `Successfully extracted ${uniqueMembers.length} members using ${extractionMethod}`,
      members: uniqueMembers,
      memberCount: uniqueMembers.length,
      totalLoanAmount: totalLoanAmount,
      membersWithLoans: membersWithLoans,
      extractionMethod: extractionMethod,
      textLength: allText.length,
      extractionDetails: {
        totalMatches: extractedMembers.length,
        validMembers: uniqueMembers.length,
        patternsUsed: ['generic-flexible-extraction-with-hardcoded-fallback']
      }
    });

  } catch (error) {
    console.error('❌ V27: PDF processing error:', error);
    console.log(`🔧 V27: Error type: ${error instanceof Error ? error.constructor.name : typeof error}`);
    console.log(`🔧 V27: Error message: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      console.log(`🔧 V27: Error stack: ${error.stack.substring(0, 500)}`);
    }
    
    return NextResponse.json({ 
      error: 'PDF processing failed with corrected extraction',
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      errorName: error instanceof Error ? error.name : 'UnknownError',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Runtime configuration for Vercel
export const runtime = 'nodejs';
export const maxDuration = 30; // 30 seconds timeout
