#!/bin/bash

# Emergency fix script to apply fallback to all PDF endpoints
echo "🚨 Applying emergency fallback to all PDF endpoints..."

EMERGENCY_CONTENT='import { NextRequest, NextResponse } from '\''next/server'\'';

export async function POST(request: NextRequest) {
  try {
    console.log('\''📄 EMERGENCY FALLBACK - PDF ENDPOINT'\'');
    console.log('\''🚨 FORCING CLIENT-SIDE FALLBACK FOR DEPLOYED FRONTEND'\'');
    console.log('\''🔍 VALIDATION LOG: Processing started at'\'', new Date().toISOString());
    
    const formData = await request.formData();
    const file = formData.get('\''file'\'') as File;
    
    if (!file) {
      console.error('\''PDF parse error: No file provided'\'');
      return NextResponse.json({ error: '\''No file provided'\'' }, { status: 400 });
    }
    
    console.log(`📁 File received: ${file.name}, size: ${file.size} bytes`);
    console.log('\''🚨 INTENTIONALLY TRIGGERING FALLBACK TO FIX DEPLOYED VERSION'\'');
    
    // EMERGENCY FIX: Return a controlled error that triggers the client-side fallback
    return NextResponse.json({ 
      success: false,
      error: '\''Server-side PDF parsing unavailable - triggering client-side fallback'\'',
      details: '\''CONTROLLED_FALLBACK: Forcing client-side processing to avoid file system issues'\'',
      fallbackRequired: true,
      emergencyFix: true,
      timestamp: new Date().toISOString()
    }, { status: 422 });
    
  } catch (error) {
    console.error('\''Unexpected error in PDF parsing:'\'', error);
    return NextResponse.json({ 
      error: '\''Internal server error'\'', 
      details: error instanceof Error ? error.message : '\''Unknown error'\''
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: '\''PDF Emergency Fallback Endpoint'\'',
    status: '\''EMERGENCY_FALLBACK_ACTIVE'\'',
    purpose: '\''Forces client-side processing to avoid file system issues'\'',
    timestamp: new Date().toISOString()
  });
}'

# List of problematic endpoints (excluding pdf-text-process which is production-safe)
ENDPOINTS=(
  "app/api/pdf-debug/route.ts"
  "app/api/pdf-parse/route.ts"
  "app/api/pdf-parse-swawlamban/route.ts"
  "app/api/pdf-parse-isolated/route.ts"
  "app/api/pdf-parse-alt/route.ts"
  "app/api/pdf-parse-new/route.ts"
  "app/api/pdf-production/route.ts"
  "app/api/pdf-final/route.ts"
  "app/api/pdf-parse-pdfjs/route.ts"
  "app/api/pdf-final-simple/route.ts"
)

for endpoint in "${ENDPOINTS[@]}"; do
  if [ -f "$endpoint" ]; then
    echo "🔧 Fixing $endpoint..."
    echo "$EMERGENCY_CONTENT" > "$endpoint"
  else
    echo "⚠️ $endpoint not found, skipping..."
  fi
done

echo "✅ Emergency fallback applied to all PDF endpoints!"
echo "🚀 Now all PDF endpoints will trigger client-side fallback"
