import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma'; // Corrected import path
import { z } from 'zod';
import { ContributionType } from '@prisma/client'; // Import enum

// Validation schema for updating a NextGenMember
const updateNextGenMemberSchema = z.object({
  nextGenName: z.string().min(1, 'Name is required').optional(),
  contribution: z.number().positive('Contribution must be positive').optional().nullable(),
  contributionType: z.nativeEnum(ContributionType).optional().nullable(), // Added contributionType
  // Add other updatable fields as needed
});

// GET /api/members/{memberId}/nextgen/{nextGenId}
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; nextGenId: string }> }
) {
  const { id: primaryMemberId, nextGenId } = await params;
  if (!primaryMemberId || !nextGenId) {
    return NextResponse.json({ error: 'Primary Member ID and NextGen Member ID are required' }, { status: 400 });
  }

  try {
    const nextGenMember = await prisma.nextGenMember.findUnique({
      where: {
        id: nextGenId,
        primaryMemberId: primaryMemberId, // Ensure it belongs to the correct primary member
      },
    });

    if (!nextGenMember) {
      return NextResponse.json({ error: 'NextGen Member not found' }, { status: 404 });
    }

    return NextResponse.json(nextGenMember);
  } catch (error) {
    console.error("Failed to fetch NextGen member:", error);
    return NextResponse.json({ error: 'Failed to fetch NextGen member' }, { status: 500 });
  }
}

// PUT /api/members/{memberId}/nextgen/{nextGenId}
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; nextGenId: string }> }
) {
  const { id: primaryMemberId, nextGenId } = await params;
  if (!primaryMemberId || !nextGenId) {
    return NextResponse.json({ error: 'Primary Member ID and NextGen Member ID are required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const validation = updateNextGenMemberSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid input', details: validation.error.flatten() }, { status: 400 });
    }

    // Create properly typed update data
    const updateData: Record<string, unknown> = {};
    Object.keys(validation.data).forEach(key => {
      const value = validation.data[key as keyof typeof validation.data];
      if (value !== undefined) {
        updateData[key] = value;
      }
    });

    const updatedNextGenMember = await prisma.nextGenMember.update({
      where: {
        id: nextGenId,
        primaryMemberId: primaryMemberId,
      },
      data: updateData,
    });

    return NextResponse.json(updatedNextGenMember);
  } catch (error) {
    console.error("Failed to update NextGen member:", error);
    const typedError = error as Error & { code?: string };
    // Check for specific Prisma errors if needed, e.g., record not found
    if (typedError.code === 'P2025') { // Prisma's error code for record not found
        return NextResponse.json({ error: 'NextGen member not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to update NextGen member' }, { status: 500 });
  }
}

// DELETE /api/members/{memberId}/nextgen/{nextGenId}
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; nextGenId: string }> }
) {
  const { id: primaryMemberId, nextGenId } = await params;
  if (!primaryMemberId || !nextGenId) {
    return NextResponse.json({ error: 'Primary Member ID and NextGen Member ID are required' }, { status: 400 });
  }

  try {
    await prisma.nextGenMember.delete({
      where: {
        id: nextGenId,
        primaryMemberId: primaryMemberId, // Ensures deletion is scoped to the primary member
      },
    });
    return NextResponse.json({ message: 'NextGen member deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error("Failed to delete NextGen member:", error);
    const typedError = error as Error & { code?: string };
    // Handle specific errors, e.g., if the record to delete is not found
    if (typedError.code === 'P2025') { // Prisma's error code for record not found
        return NextResponse.json({ error: 'NextGen member not found or already deleted' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to delete NextGen member' }, { status: 500 });
  }
}
