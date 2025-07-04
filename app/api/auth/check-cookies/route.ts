import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const allCookies = await cookies();
    const cookieNames = allCookies.getAll().map((c: { name: string; value: string }) => c.name);
    
    // Filter for auth-related cookies
    const authCookies = cookieNames.filter((name: string) => 
      name.includes('auth') || 
      name.includes('next-auth') || 
      name.includes('session')
    );
    
    return NextResponse.json({
      status: "ok",
      cookieCount: cookieNames.length,
      cookieNames,
      authCookies,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error checking cookies:', error);
    return NextResponse.json(
      { error: 'Failed to check cookies' },
      { status: 500 }
    );
  }
}
