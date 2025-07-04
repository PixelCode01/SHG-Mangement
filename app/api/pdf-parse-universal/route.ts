
import { NextRequest, NextResponse } from 'next/server';

// Emergency fix: Force all PDF endpoints to return 422
// This ensures frontend uses client-side processing only
export async function GET(_request: NextRequest) {
  return NextResponse.json({
    success: false,
    error: "EMERGENCY_FIX: Server-side PDF parsing disabled - use client-side processing",
    fallbackRequired: true,
    emergencyFix: true,
    timestamp: new Date().toISOString()
  }, { status: 422 });
}

export async function POST(_request: NextRequest) {
  return NextResponse.json({
    success: false,
    error: "EMERGENCY_FIX: Server-side PDF parsing disabled - use client-side processing", 
    fallbackRequired: true,
    emergencyFix: true,
    timestamp: new Date().toISOString()
  }, { status: 422 });
}
