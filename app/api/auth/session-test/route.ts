import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * A simplified session check endpoint that doesn't rely on NextAuth directly
 * This is helpful for diagnosing NextAuth issues
 */
export async function GET() {
  try {
    // Get all cookies
    const allCookies = await cookies();
    const cookieNames = allCookies.getAll().map(c => c.name);
    
    // Check for any authentication-related cookies
    const hasAuthCookies = cookieNames.some(name => 
      name.includes('auth') || 
      name.includes('session') ||
      name.includes('token')
    );
    
    // Return basic session status
    return NextResponse.json({
      status: "ok",
      hasSession: hasAuthCookies,
      cookieCount: cookieNames.length,
      cookieNames,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // Handle errors and return a properly formatted response
    console.error("[Session Test API] Error:", error);
    return NextResponse.json({
      status: "error",
      message: "Failed to check session",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error)
    }, { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      }
    });
  }
}
