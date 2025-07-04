import { NextResponse } from "next/server";
import { hash } from "bcrypt";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    // Check if the test user already exists
    const existingUser = await prisma.user.findFirst({
      where: { email: 'test@example.com' },
    });

    if (existingUser) {
      // Update the existing user
      const hashedPassword = await hash('testpass123', 10);
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          password: hashedPassword,
          name: 'Test User',
        },
      });
      
      return NextResponse.json({
        status: "updated",
        message: "Test user updated successfully",
        user: {
          email: 'test@example.com',
          name: 'Test User',
        },
      });
    } else {
      // Create a new test user
      const hashedPassword = await hash('testpass123', 10);
      await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          password: hashedPassword,
          role: 'MEMBER',
        },
      });
      
      return NextResponse.json({
        status: "created",
        message: "Test user created successfully",
        user: {
          email: 'test@example.com',
          name: 'Test User',
        },
      });
    }
  } catch (error) {
    console.error('Error creating/updating test user:', error);
    return NextResponse.json(
      { error: 'Failed to create/update test user' },
      { status: 500 }
    );
  }
}
