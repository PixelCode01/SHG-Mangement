import { NextRequest, NextResponse } from 'next/server';

// PDF Member Extraction API - V20 SIMPLE TEST
// Testing if the route deploys without pdf-parse

console.log('🚀 PDF-UPLOAD-V12 Route loaded - V20 Simple Test');

export async function GET() {
  return NextResponse.json({ 
    status: 'OK',
    route: 'pdf-upload-v12',
    version: 'V20',
    message: 'PDF upload endpoint is working - simple version'
  });
}

export async function POST(request: NextRequest) {
  console.log('📝 PDF-UPLOAD-V12: POST request received');
  
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

    // For now, return a test response to see if the route works
    return NextResponse.json({
      success: true,
      message: 'Route is working, but PDF parsing is temporarily disabled for testing',
      fileName: file.name,
      fileSize: file.size,
      testMode: true
    });

  } catch (error) {
    console.error('❌ PDF processing error:', error);
    
    return NextResponse.json({ 
      error: 'PDF processing failed',
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}
