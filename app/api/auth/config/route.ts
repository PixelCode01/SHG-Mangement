import { NextResponse } from "next/server";

export async function GET() {
  // Get the current configuration
  const config = {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NODE_ENV: process.env.NODE_ENV,
    BASE_URL: process.env.BASE_URL,
    // Don't include sensitive values like NEXTAUTH_SECRET or database credentials
  };

  // Return the configuration as JSON
  return NextResponse.json({
    status: "ok",
    message: "Auth configuration",
    config,
    timestamp: new Date().toISOString(),
  });
}
