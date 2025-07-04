import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { hash } from "bcrypt";

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json();

    // Validate token and password
    if (!token) {
      return NextResponse.json(
        { message: "Reset token is required." },
        { status: 400 }
      );
    }

    if (!password || password.length < 8) {
      return NextResponse.json(
        { message: "Password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    // Validate password strength
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    if (!(hasLetter && (hasNumber || hasSpecial))) {
      return NextResponse.json(
        { message: "Password must contain letters and at least one number or special character" },
        { status: 400 }
      );
    }

    // Find the reset token in the database
    const resetTokenRecord = await prisma.passwordResetToken.findFirst({
      where: {
        token,
        expiresAt: {
          gt: new Date() // Not expired yet
        },
        used: false
      },
    });

    if (!resetTokenRecord) {
      return NextResponse.json(
        { message: "Invalid or expired reset token." },
        { status: 400 }
      );
    }

    // Hash the new password
    const hashedPassword = await hash(password, 10);

    // Update user's password and mark token as used in a transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetTokenRecord.userId },
        data: {
          password: hashedPassword
        }
      }),
      prisma.passwordResetToken.update({
        where: { id: resetTokenRecord.id },
        data: {
          used: true
        }
      })
    ]);

    return NextResponse.json({
      message: "Password has been reset successfully. You can now log in with your new password."
    });
  } catch (error) {
    console.error("Password reset error:", error);
    return NextResponse.json(
      { message: "An error occurred while resetting your password." },
      { status: 500 }
    );
  }
}
