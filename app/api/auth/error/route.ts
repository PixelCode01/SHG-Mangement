import { NextResponse } from "next/server";

// This route handles GET /api/auth/error
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const error = searchParams.get('error');
  
  console.error('[Auth Error API] Auth error occurred:', error);
  
  // Return a properly formatted JSON response with more details
  return NextResponse.json({
    error: error || 'Unknown auth error',
    message: getErrorMessage(error),
    timestamp: new Date().toISOString(),
  }, { 
    status: 401,
    headers: {
      'Content-Type': 'application/json',
    }
  });
}

// Helper function to provide more detailed error messages
function getErrorMessage(errorCode: string | null): string {
  switch (errorCode) {
    case 'CredentialsSignin':
      return 'Invalid email or password.';
    case 'SessionRequired':
      return 'You must be signed in to access this page.';
    case 'AccessDenied':
      return 'You do not have permission to access this resource.';
    case 'Verification':
      return 'The token has expired or is invalid.';
    default:
      return 'An authentication error occurred.';
  }
}
