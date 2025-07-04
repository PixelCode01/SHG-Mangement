import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth-config";

// Helper function to identify auth cookies
function getAuthCookiePatterns() {
  return [
    'next-auth.session-token',
    'next-auth.csrf-token',
    'next-auth.callback-url',
    'authjs.session-token', 
    'authjs.csrf-token', 
    'authjs.callback-url'
  ];
}

export async function GET() {
  try {
    // Get the session
    const session = await auth();
    
    // Log session info (for debugging)
    console.log("[Session API] Session requested, found:", 
      session ? `User: ${session.user?.name || 'unknown'}` : "no session");
    
    // Always return a properly formatted session object
    // Make sure we never return undefined or null directly
    const safeSession = session ? {
      ...session,
      user: session.user || null
    } : { user: null };
    
    // Return with proper headers to ensure correct content type
    return new Response(JSON.stringify(safeSession), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
      }
    });
  } catch (error) {
    console.error("[Session API] Error getting session:", error);
    
    // Return a properly formatted error response with status code
    const errorResponse = {
      error: "Failed to get session", 
      user: null,
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error)
    };
    
    // Use standard Response object with explicit JSON stringify
    // This avoids potential NextResponse serialization issues
    return new Response(JSON.stringify(errorResponse), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
      }
    });
  }
}

// Add DELETE handler for session cleanup
export async function DELETE() {
  try {
    console.log("[Session API] DELETE request received - clearing session");
    
    // Get cookie patterns that should be cleared
    const cookiesToClear = getAuthCookiePatterns();
    
    // Create a response that will instruct the browser to clear cookies
    const response = NextResponse.json({ 
      success: true,
      message: "Session cleared",
      clearedCookies: cookiesToClear
    });
    
    // For each auth cookie, set an expired cookie in the response
    for (const cookieName of cookiesToClear) {
      // Setting an expired date in the past effectively clears the cookie
      response.cookies.set({
        name: cookieName,
        value: '',
        expires: new Date(0),
        path: '/',
      });
      
      // Also try with prefix
      response.cookies.set({
        name: `__Secure-${cookieName}`,
        value: '',
        expires: new Date(0),
        path: '/',
      });
    }
    
    return response;
  } catch (error) {
    console.error("[Session API] Error clearing session:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to clear session",
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}