import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Return CSRF token test endpoint
    return NextResponse.json({
      status: "ok",
      message: "CSRF test endpoint active",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      hasSecret: !!process.env.NEXTAUTH_SECRET,
      nextAuthUrl: process.env.NEXTAUTH_URL,
    });
  } catch (error) {
    console.error('Error in CSRF test:', error);
    return NextResponse.json(
      { error: 'Failed to check CSRF configuration' },
      { status: 500 }
    );
  }
}
