import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import crypto from "crypto";
import { isRateLimited } from "@/app/lib/rate-limiter";

// Validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export async function POST(req: Request) {
  try {
    // Rate limiting to prevent abuse
    const ip = req.headers.get('x-forwarded-for') || 'unknown-ip';
    
    if (isRateLimited(`password-reset-${ip}`)) {
      return NextResponse.json(
        { message: "Too many password reset attempts. Please try again later." },
        { status: 429 }
      );
    }

    // Get email from request body
    const { email } = await req.json();

    // Validate email
    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { message: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findFirst({
      where: { email },
    });

    // Always return success even if user not found for security reasons
    // This prevents email enumeration attacks
    if (!user) {
      console.log(`Password reset requested for non-existent user: ${email}`);
      return NextResponse.json({
        message: "If your email is registered, you'll receive a password reset link."
      });
    }

    // Generate a reset token that expires in 1 hour
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store the hashed token in the database
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: resetToken,
        expiresAt: resetTokenExpiry,
      },
    });

    // In a real implementation, you would send an email with the reset link
    // For this implementation, we'll just return the token for testing
    console.log(`Password reset token for ${email}: ${resetToken}`);

    // Return success message
    return NextResponse.json({
      message: "If your email is registered, you'll receive a password reset link."
    });
  } catch (error) {
    console.error("Password reset request error:", error);
    return NextResponse.json(
      { message: "An error occurred while processing your request." },
      { status: 500 }
    );
  }
}
