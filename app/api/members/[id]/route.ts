import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

const prisma = new PrismaClient();

// Zod schema for validating the PUT request body
const updateMemberSchema = z.object({
  memberId: z.string().min(1, "Member ID cannot be empty.").optional(), // Keep optional for partial updates
  name: z.string().min(1, "Name cannot be empty.").optional(),
  email: z.string().email("Invalid email address.").optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const member = await prisma.member.findUnique({
      where: { id },
      include: {
        memberships: {
          include: {
            group: true, // Include group details in memberships
          },
        },
        ledGroups: true, // Include groups led by this member
      },
    });

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }
    return NextResponse.json(member);
  } catch (error) {
    console.error('Error fetching member:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validation = updateMemberSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ errors: validation.error.errors }, { status: 400 });
    }

    // Create properly typed update data
    const updateData: Record<string, unknown> = {};
    Object.keys(validation.data).forEach(key => {
      const value = validation.data[key as keyof typeof validation.data];
      if (value !== undefined) {
        updateData[key] = value;
      }
    });

    const updatedMember = await prisma.member.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updatedMember);
  } catch (error) {
    console.error('Error updating member:', error);
    const typedError = error as Error & { code?: string; meta?: { target?: string[] } };
    // Handle potential Prisma errors like unique constraint violations if not caught above
    if (typedError.code === 'P2002' && typedError.meta?.target?.includes('memberId')) {
        return NextResponse.json({ error: 'Custom Member ID already exists' }, { status: 409 });
    }
    if (typedError.code === 'P2025') { // Record to update not found
        return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Check if the member is a leader of any group
    const ledGroupsCount = await prisma.group.count({
      where: { leaderId: id },
    });

    if (ledGroupsCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete member: Member is a leader of one or more groups. Please change the leader first.' },
        { status: 400 }
      );
    }

    // If not a leader, proceed with deletion
    // Note: Related MemberGroupMemberships will be deleted automatically due to cascading deletes defined in schema.prisma
    await prisma.member.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Member deleted successfully' }, { status: 200 }); // Or 204 No Content
  } catch (error) {
    console.error('Error deleting member:', error);
    const typedError = error as Error & { code?: string };
     if (typedError.code === 'P2025') { // Record to delete not found
        return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}