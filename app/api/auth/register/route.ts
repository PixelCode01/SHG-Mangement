import { NextResponse } from "next/server";
import { hash } from "bcrypt";
import { prisma } from "@/app/lib/prisma";
import { UserRole } from "@prisma/client";
import { checkMemberIdValidity } from "@/app/lib/auth";
import { isRateLimited } from "@/app/lib/rate-limiter";

export async function POST(req: Request) {
  try {
    // Apply rate limiting based on IP
    const ip = req.headers.get('x-forwarded-for') || 'unknown-ip';
    
    if (isRateLimited(`register-${ip}`)) {
      return NextResponse.json(
        { message: "Too many registration attempts. Please try again later." },
        { status: 429 }
      );
    }
    
    const { name, email, phone, password, role, memberId } = await req.json();

    // Validate the data - user must provide either email or phone
    if (!name || (!email && !phone) || !password) {
      return NextResponse.json(
        { message: "Missing required fields. Name, password, and either email or phone are required." },
        { status: 400 }
      );
    }

    // Validate email format if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { message: "Invalid email format" },
        { status: 400 }
      );
    }

    // Validate phone format if provided
    if (phone && !/^\+?[\d\s\-\(\)]{10,}$/.test(phone)) {
      return NextResponse.json(
        { message: "Invalid phone number format. Please include country code if international." },
        { status: 400 }
      );
    }

    // Validate role
    const userRole = role || "MEMBER";
    if (!Object.values(UserRole).includes(userRole as UserRole)) {
      return NextResponse.json(
        { message: "Invalid user role" },
        { status: 400 }
      );
    }

    // Validate memberId if role is MEMBER
    if (userRole === "MEMBER" && !memberId) {
      return NextResponse.json(
        { message: "Member ID is required for Member role" },
        { status: 400 }
      );
    }

    // Check if user already exists by email or phone
    const existingUserByEmail = email ? await prisma.user.findFirst({
      where: { email },
    }) : null;

    // Check for existing phone number (normalize it first)
    const normalizedPhone = phone ? phone.replace(/[\s\-\(\)]/g, '') : null;
    const existingUserByPhone = normalizedPhone ? await prisma.user.findFirst({
      where: { phone: normalizedPhone },
    }) : null;

    if (existingUserByEmail) {
      return NextResponse.json(
        { message: "User with this email already exists" },
        { status: 409 }
      );
    }

    if (existingUserByPhone) {
      return NextResponse.json(
        { message: "User with this phone number already exists" },
        { status: 409 }
      );
    }

    // Validate password strength (matching the frontend requirements)
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    if (password.length < 8) {
      return NextResponse.json(
        { message: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }
    
    if (!(hasLetter && (hasNumber || hasSpecial))) {
      return NextResponse.json(
        { message: "Password must contain letters and at least one number or special character" },
        { status: 400 }
      );
    }

    // If memberId is provided, check if it exists and validate using our helper function
    if (memberId) {
      // Use the enhanced validation function to get more detailed info
      const { valid, message, member } = await checkMemberIdValidity(memberId);
      
      if (!valid) {
        return NextResponse.json(
          { message },
          { status: 400 }
        );
      }
      
      // Log success for auditing purposes
      console.log(`Registration: Valid member ID detected for ${member?.name || 'unknown member'}`);
    }

    // Hash the password
    const hashedPassword = await hash(password, 10);

    // Use a transaction to create the user
    const user = await prisma.$transaction(async (tx) => {
      const memberIdToUse = memberId;
      
      console.log(`[Register API] Processing registration for email: ${email}, role: ${userRole}, provided memberId: ${memberId}`);

      // Note: We no longer automatically create member records for GROUP_LEADER roles
      // Leaders will need to create their member profile separately when needed
      
      console.log(`[Register API] Proceeding to create User record for ${email}. memberId to be used: ${memberIdToUse}`);
      // Create the user
      const userData: {
        name: string;
        password: string;
        role: UserRole;
        memberId?: string;
        email?: string;
        phone?: string;
      } = {
        name,
        password: hashedPassword,
        role: userRole as UserRole,
        memberId: userRole === "MEMBER" ? memberIdToUse : undefined, // Only link memberId for MEMBER role
      };
      
      // Only add email if provided
      if (email) {
        userData.email = email;
      }
      
      // Only add phone if provided (normalize it)
      if (phone) {
        userData.phone = phone.replace(/[\s\-\(\)]/g, '');
      }
      
      const newUser = await tx.user.create({
        data: userData,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          memberId: true,
          createdAt: true,
          updatedAt: true,
          image: true,
          // Explicitly don't select password
        }
      });
      
      console.log(`[Register API] Successfully created User for ${email} with ID: ${newUser.id}, linked memberId: ${newUser.memberId}`);
      return newUser;
    });
    
    return NextResponse.json(
      { message: "User created successfully", user },
      { status: 201 }
    );
  } catch (error) {
    const typedError = error as Error & { code?: string; meta?: { target?: string[] } };
    console.error("[Register API] Full error object:", JSON.stringify(typedError, null, 2));
    console.error("[Register API] Registration error details:", typedError.message, typedError.code, typedError.meta);
    
    // Enhanced error handling with more specific messages
    if (error instanceof Error) {
      // Check for our custom member creation error first
      if (error.message.startsWith("A member profile with the email")) {
        return NextResponse.json(
          { message: error.message },
          { status: 409 } // Conflict
        );
      }

      // Handle Prisma-specific errors
      // It's safer to check if these properties exist before accessing them
      const prismaError = error as Error & { code?: string; meta?: { target?: string[] } };
      const prismaErrorCode = prismaError.code;
      const prismaErrorMeta = prismaError.meta;

      // Email-related errors (specifically for User.email unique constraint)
      if (prismaErrorCode === 'P2002' && prismaErrorMeta?.target?.includes('email')) {
        // This specific check might be for the User model's email.
        // The member creation unique email constraint is handled by the custom error message above.
        return NextResponse.json(
          { message: "This email is already registered for a user account. Please try logging in instead." },
          { status: 409 }
        );
      } 
      // Phone-related errors (specifically for User.phone unique constraint)
      else if (prismaErrorCode === 'P2002' && prismaErrorMeta?.target?.includes('phone')) {
        return NextResponse.json(
          { message: "This phone number is already registered for a user account. Please try logging in instead." },
          { status: 409 }
        );
      } 
      // Prisma validation errors
      else if (error.message.includes("Invalid `prisma.user.create()`")) {
        return NextResponse.json(
          { message: "Invalid user data provided. Please check all fields and try again." },
          { status: 400 }
        );
      }
      // Password hashing errors
      else if (error.message.includes("bcrypt")) {
        return NextResponse.json(
          { message: "Error processing your password. Please try a different password." },
          { status: 400 }
        );
      }
      // Member ID related errors
      else if (error.message.includes("memberId")) {
        return NextResponse.json(
          { message: "Error with the provided Member ID. Please verify it and try again." },
          { status: 400 }
        );
      }
      // Database connection errors - don't expose internal details to client
      else if (error.message.includes("connect") || error.message.includes("timeout")) {
        console.error("Database connection error during registration:", error);
        return NextResponse.json(
          { message: "Service temporarily unavailable. Please try again later." },
          { status: 503 }
        );
      }
    }
    
    // Generic error for unhandled cases
    return NextResponse.json(
      { message: "Registration failed due to a server error. Please try again later." },
      { status: 500 }
    );
  }
}