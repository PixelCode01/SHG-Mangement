import { NextRequest, NextResponse } from "next/server";
import { hash, compare } from "bcrypt";
import { z } from "zod";
import { auth } from "@/app/lib/auth-config";
import { prisma } from "@/app/lib/prisma";

// Define validation schema
const updateProfileSchema = z.object({
  name: z.string().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "Password must be at least 8 characters").optional(),
});

export async function PUT(request: NextRequest) {
  try {
    // Get the user session
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = updateProfileSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input data", details: validation.error.format() },
        { status: 400 }
      );
    }

    const { name, currentPassword, newPassword } = validation.data;

    // Find the user
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        password: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // If changing password, validate the current password
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Current password is required to set a new password" },
          { status: 400 }
        );
      }

      // Verify current password
      const isValidPassword = user.password 
        ? await compare(currentPassword, user.password)
        : false;

      if (!isValidPassword) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 400 }
        );
      }
    }

    // Update user profile
    const updateData: { name?: string; password?: string } = {};
    
    if (name) {
      updateData.name = name;
    }
    
    if (newPassword) {
      updateData.password = await hash(newPassword, 10);
    }

    // Only update if there are changes
    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });
    }

    return NextResponse.json(
      { message: "Profile updated successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
