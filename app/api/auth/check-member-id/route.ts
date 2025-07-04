import { NextResponse } from "next/server";
import { checkMemberIdValidity } from "@/app/lib/auth";

export async function POST(req: Request) {
  try {
    const { memberId } = await req.json();

    if (!memberId) {
      return NextResponse.json(
        { valid: false, message: "Member ID is required" },
        { status: 400 }
      );
    }

    const result = await checkMemberIdValidity(memberId);
    
    if (!result.valid) {
      return NextResponse.json(
        { valid: false, message: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { valid: true, message: "Member ID is valid" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Check member ID error:", error);
    return NextResponse.json(
      { valid: false, message: `Error checking Member ID: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
