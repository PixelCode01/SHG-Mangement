import { NextRequest, NextResponse } from 'next/server';

// EMERGENCY FIX: Server-side PDF processing disabled
// This endpoint now returns 422 to force client-side PDF processing

export async function POST(request: NextRequest) {
  console.log('🚨 EMERGENCY FIX: pdf-upload-v11 returning 422 to force client-side processing');
  console.log('Request headers:', request.headers.get('content-type'));
  
  // EMERGENCY FIX: Always return 422 to force fallback to client-side processing
  return NextResponse.json({ 
    error: 'Server-side PDF processing disabled', 
    fallbackRequired: true,
    emergencyFix: true,
    message: 'Please use client-side PDF processing',
    endpoint: '/api/pdf-upload-v11'
  }, { status: 422 });
}

// Original code has been disabled for emergency fix
// This ensures consistent behavior between local and deployed environments
// Client-side PDF processing will be used instead
