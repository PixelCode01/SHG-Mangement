import { NextResponse } from "next/server";

// This route handles GET /api/auth/providers
export async function GET() {
  // Return the OAuth providers information
  const providers = {
    credentials: {
      type: "credentials",
      id: "credentials",
      name: "Credentials"
    }
  };
  
  return NextResponse.json(providers);
}
