import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('📄 EMERGENCY FALLBACK - PDF ENDPOINT');
    console.log('🚨 FORCING CLIENT-SIDE FALLBACK FOR DEPLOYED FRONTEND');
    console.log('🔍 VALIDATION LOG: Processing started at', new Date().toISOString());
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      console.error('PDF parse error: No file provided');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    console.log(`📁 File received: ${file.name}, size: ${file.size} bytes`);
    console.log('🚨 INTENTIONALLY TRIGGERING FALLBACK TO FIX DEPLOYED VERSION');
    
    // EMERGENCY FIX: Return a controlled error that triggers the client-side fallback
    return NextResponse.json({ 
      success: false,
      error: 'Server-side PDF parsing unavailable - triggering client-side fallback',
      details: 'CONTROLLED_FALLBACK: Forcing client-side processing to avoid file system issues',
      fallbackRequired: true,
      emergencyFix: true,
      timestamp: new Date().toISOString()
    }, { status: 422 });
    
  } catch (error) {
    console.error('Unexpected error in PDF parsing:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'PDF Emergency Fallback Endpoint',
    status: 'EMERGENCY_FALLBACK_ACTIVE',
    purpose: 'Forces client-side processing to avoid file system issues',
    timestamp: new Date().toISOString()
  });
}
