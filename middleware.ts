import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { addSecurityHeaders } from "./app/lib/security-headers";

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const searchParams = req.nextUrl.searchParams; // Define searchParams once at the top
  console.log('[Middleware] Path:', path);

  // Create the response first so we can add headers to it
  let response: NextResponse;

  const cookiesList = req.cookies.getAll();
  const cookieNames = cookiesList.map(c => c.name);
  console.log('[Middleware] All Cookie names found:', JSON.stringify(cookieNames));

  // Define actual session token cookie names accurately
  const actualSessionTokenCookieNames = [
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
    'authjs.session-token',
    '__Secure-authjs.session-token'
    // Add any other specific names if your NextAuth setup uses different ones for the session token itself
  ];

  // Check for a real session token
  const isAuthenticated = cookieNames.some(name => actualSessionTokenCookieNames.includes(name));
  console.log('[Middleware] IsAuthenticated (based on actual session tokens):', isAuthenticated);

  // Allow API routes (including /api/auth/* for NextAuth operations)
  if (path.startsWith('/api/')) {
    console.log('[Middleware] Allowing access to API path:', path);
    response = NextResponse.next();
    // Add security headers to API responses as well
    addSecurityHeaders(response.headers);
    return response;
  }

  // Handle special auth-related query parameters (e.g., after login/registration)
  const authParam = searchParams.get('auth');
  if (authParam === 'success' || authParam === 'register') {
    console.log(`[Middleware] Auth '${authParam}' parameter detected for path '${path}'.`);
    const incomingUrl = new URL(req.url);

    // Check if we need to fix the port
    const isWrongPort = incomingUrl.hostname === 'localhost' && incomingUrl.port === '3001';
    
    // Always create a modified URL
    const targetUrl = isWrongPort 
      ? new URL(incomingUrl.pathname, `http://localhost:3000`) // Base URL with correct port
      : new URL(req.url); // Use current URL but we'll modify it
    
    // Copy all search params from incomingUrl to targetUrl, except for 'auth'
    incomingUrl.searchParams.forEach((value, key) => {
      if (key.toLowerCase() !== 'auth') {
        targetUrl.searchParams.set(key, value);
      }
    });

    if (isWrongPort) {
      console.log(`[Middleware] Auth param on localhost:3001. Redirecting to ${targetUrl.toString()} to correct port.`);
      return NextResponse.redirect(targetUrl);
    } else if (path === '/' && incomingUrl.searchParams.has('auth')) {
      console.log('[Middleware] Rewriting URL to remove auth param from home page (original port).');
      return NextResponse.rewrite(targetUrl);
    }
    
    // For non-home paths, or if auth param wasn't there to begin with, just proceed.
    return NextResponse.next();
  }

  // Handle public pages: home, login, register, etc.
  if (path === "/") {
    console.log('[Middleware] Allowing access to home page.');
    return NextResponse.next();
  }

  if (path === "/login" || path === "/register" || path === "/login/alternative-login" || path === "/register/success") {
    // Allow POST requests for form submissions
    if (req.method === 'POST') {
      console.log(`[Middleware] POST request to auth page '${path}', allowing.`);
      return NextResponse.next();
    }

    // Allow if it's an auth callback or error display
    const callbackUrl = searchParams.get('callbackUrl');
    const fromAuth = searchParams.has('from') && searchParams.get('from') === 'auth';
    const error = searchParams.get('error');
    if (callbackUrl || fromAuth || error) {
      console.log(`[Middleware] Auth callback/error detected for '${path}', allowing.`);
      return NextResponse.next();
    }

    // Always allow access to registration success page
    if (path === "/register/success") {
      console.log('[Middleware] Allowing access to registration success page.');
      return NextResponse.next();
    }

    // If user is genuinely authenticated, redirect them from login/register to home
    if (isAuthenticated && path !== "/login/alternative-login") {
      console.log(`[Middleware] User authenticated, redirecting from auth page '${path}' to home.`);
      return NextResponse.redirect(new URL("/", req.url));
    }

    // Otherwise, allow unauthenticated access to these auth-related pages
    console.log(`[Middleware] Allowing unauthenticated access to auth page '${path}'.`);
    return NextResponse.next();
  }

  // Protect all other routes
  if (!isAuthenticated) {
    console.log(`[Middleware] User not authenticated, redirecting from protected path '${path}' to login.`);
    // const loginUrl = new URL("/login", req.url);
    // loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname + req.nextUrl.search); // Optional: redirect back after login
    response = NextResponse.redirect(new URL("/login", req.url));
    // Add security headers
    addSecurityHeaders(response.headers);
    return response;
  }

  // User is authenticated, allow access to the protected route
  console.log(`[Middleware] User authenticated, allowing access to protected path '${path}'.`);
  response = NextResponse.next();
  // Add security headers
  addSecurityHeaders(response.headers);
  return response;
}

// Define paths that should be protected by authentication
export const config = {
  // Apply middleware to all routes, but we'll explicitly handle which ones
  // require authentication in the middleware function itself
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images (your public images folder)
     * - public (your public folder)
     *
     * Note: We're including /api/ routes in the matcher so we can log them,
     * but we'll allow them through in the middleware function itself
     */
    '/((?!_next/static|_next/image|favicon.ico|images|public).*)',
  ],
};