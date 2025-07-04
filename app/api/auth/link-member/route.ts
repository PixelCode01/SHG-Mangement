import { NextResponse } from "next/server";
import { authMiddleware } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

// API handler to link a user with a member
export async function POST(req: Request) {
  try {
    // Check authentication
    const auth = await authMiddleware(req);
    if (!("session" in auth)) {
      return auth; // Returns unauthorized response if not authenticated
    }
    
    const { session } = auth;
    
    // Verify the user from the session actually exists in database
    const sessionUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    });
    
    if (!sessionUser) {
      return NextResponse.json(
        { message: "User session is invalid. Please log in again." },
        { status: 401 }
      );
    }
    
    const { memberId } = await req.json();

    if (!memberId) {
      return NextResponse.json(
        { message: "Member ID is required" },
        { status: 400 }
      );
    }

    // Check if member exists
    const memberExists = await prisma.member.findUnique({
      where: { id: memberId }
    });

    if (!memberExists) {
      return NextResponse.json(
        { message: "Member not found" },
        { status: 404 }
      );
    }

    // Check if member is already linked to another user
    const existingLink = await prisma.user.findFirst({
      where: { memberId }
    });

    if (existingLink && existingLink.id !== session.user.id) {
      return NextResponse.json(
        { message: "This member is already linked to another user" },
        { status: 409 }
      );
    }

    // Link the member to the user
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { memberId },
      include: { member: true }
    });

    // Return user info without password
    const { password: _password, ...userWithoutPassword } = updatedUser;
    
    return NextResponse.json(
      { message: "Member linked successfully", user: userWithoutPassword },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error linking member:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    );
  }
}
