import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('📄 CLIENT-SIDE PROCESSED TEXT ENDPOINT');
    console.log('🔍 Processing started at', new Date().toISOString());
    
    const body = await request.json();
    const { text, fileName, fileSize } = body;
    
    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }
    
    console.log(`📁 Processing extracted text from: ${fileName}, original size: ${fileSize} bytes`);
    console.log(`📝 Text length: ${text.length} characters`);
    
    // Apply aggressive text cleaning
    console.log('🧹 Applying text cleaning...');
    
    const cleanedText = text
      // Remove control characters except \n, \r, \t
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
      // Remove excessive spaces
      .replace(/[ ]{2,}/g, ' ')
      // Clean weird character sequences
      .replace(/[^\w\s\.\,\-\(\)\'\"\₹\n\r\t]/g, ' ')
      // Normalize line breaks
      .replace(/\n{3,}/g, '\n\n')
      .replace(/ +\n/g, '\n')
      .replace(/\n +/g, '\n')
      .trim();
    
    console.log('🧹 Text cleaned, length:', cleanedText.length);
    
    // Apply line break recovery for member data
    const lines = cleanedText.split('\n').map((line: string) => line.trim()).filter((line: string) => line.length > 0);
    const recoveredLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (!line || line.length === 0) continue;
      
      // Look for patterns where name and amount might be joined
      const nameAmountMatch = line.match(/^([A-Za-z\s]+?)(\d+)$/);
      if (nameAmountMatch?.[1] && nameAmountMatch[2]) {
        const name = nameAmountMatch[1].trim();
        const amount = nameAmountMatch[2].trim();
        
        if (name.length > 2 && amount.length > 0) {
          recoveredLines.push(name);
          recoveredLines.push(amount);
          console.log(`🔄 Line break recovery: "${name}" + "${amount}"`);
          continue;
        }
      }
      
      recoveredLines.push(line);
    }
    
    console.log(`🔄 Line break recovery completed. Lines: ${lines.length} -> ${recoveredLines.length}`);
    
    // Extract members using pattern matching
    const members: any[] = [];
    const namePattern = /^[A-Z][A-Z\s]{2,}$/;
    const amountPattern = /^\d{1,10}$/;
    
    console.log('🔍 Starting member extraction...');
    
    for (let i = 0; i < recoveredLines.length - 1; i++) {
      const currentLine = recoveredLines[i];
      const nextLine = recoveredLines[i + 1];
      
      if (!currentLine || !nextLine) continue;
      
      // Skip obvious headers and metadata
      if (currentLine.toLowerCase().includes('member') || 
          currentLine.toLowerCase().includes('name') ||
          currentLine.toLowerCase().includes('loan') ||
          currentLine.toLowerCase().includes('amount') ||
          currentLine.toLowerCase().includes('microsoft') ||
          currentLine.toLowerCase().includes('excel') ||
          currentLine.toLowerCase().includes('sheet') ||
          currentLine.toLowerCase().includes('pdf')) {
        continue;
      }
      
      // Check if current line looks like a name and next line looks like an amount
      if (namePattern.test(currentLine) && amountPattern.test(nextLine)) {
        const memberName = currentLine.trim();
        const loanAmount = parseInt(nextLine.replace(/,/g, '')) || 0;
        
        members.push({
          name: memberName,
          loanAmount: loanAmount,
          'loan amount': nextLine,
          email: '',
          phone: ''
        });
        
        i++; // Skip the amount line in next iteration
      }
    }
    
    console.log(`🎉 Extraction complete! Found ${members.length} members`);
    
    const statistics = {
      totalMembers: members.length,
      membersWithLoans: members.filter(m => m.loanAmount > 0).length,
      membersWithoutLoans: members.filter(m => m.loanAmount === 0).length,
      totalLoanAmount: members.reduce((sum, m) => sum + m.loanAmount, 0)
    };
    
    const debugInfo = {
      originalTextLength: text.length,
      cleanedTextLength: cleanedText.length,
      totalLines: lines.length,
      recoveredLines: recoveredLines.length,
      patternMatches: members.length,
      sampleText: cleanedText.substring(0, 300),
      sampleLines: recoveredLines.slice(0, 10),
      memberSample: members.slice(0, 3)
    };
    
    return NextResponse.json({
      success: true,
      members,
      statistics,
      text: text.substring(0, 500),
      headerFound: members.length > 0,
      patternDetected: members.length > 0,
      debug: debugInfo,
      version: 'CLIENT_SIDE_PROCESSING',
      deploymentCheck: 'TEXT_PROCESSING_ONLY',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Text processing error:', error);
    return NextResponse.json({ 
      error: 'Failed to process text', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Client-side text processing endpoint',
    methods: ['POST'],
    expectedInput: { text: 'string', fileName: 'string', fileSize: 'number' },
    timestamp: new Date().toISOString()
  });
}
