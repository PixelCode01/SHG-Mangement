import { auth } from '@/app/lib/auth-config';
import { NextRequest, NextResponse } from 'next/server';

/**
 * API route to check current session status from the server
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  
  return NextResponse.json({ 
    status: session ? 'authenticated' : 'unauthenticated',
    session,
    timestamp: new Date().toISOString(),
    cookies: {
      count: request.cookies.getAll().length,
      names: request.cookies.getAll().map(c => c.name)
    }
  });
}
