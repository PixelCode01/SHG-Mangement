import { prisma } from '@/app/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Schema for validating current data update
const updateMembershipSchema = z.object({
  currentShareAmount: z.number().nonnegative().optional().nullable(),
  currentLoanAmount: z.number().nonnegative().optional().nullable(),
  initialInterest: z.number().nonnegative().optional().nullable(),
});

// DELETE /api/groups/[id]/members/[memberId] - Remove a member from a group
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id: groupId, memberId } = await params;

  if (!groupId || !memberId) {
    return NextResponse.json(
      { message: 'Group ID and Member ID are required' },
      { status: 400 }
    );
  }

  try {
    // Find the specific membership record linking the group and member
    const membership = await prisma.memberGroupMembership.findFirst({
      where: {
        groupId: groupId,
        memberId: memberId,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { message: 'Membership not found' },
        { status: 404 }
      );
    }

    // Delete the membership record
    await prisma.memberGroupMembership.delete({
      where: {
        id: membership.id, // Use the primary key of the membership table
      },
    });

    console.log(`Removed member ${memberId} from group ${groupId}`);
    // Return success response, no body needed for DELETE usually
    return new NextResponse(null, { status: 204 });

  } catch (error) {
    console.error(`Error removing member ${memberId} from group ${groupId}:`, error);
    // Check for specific Prisma errors if needed
    return NextResponse.json(
      { message: 'Failed to remove member from group' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  const { id: groupId, memberId } = await params;

  if (!groupId || !memberId) {
    return NextResponse.json({ error: 'Group ID and Member ID are required' }, { status: 400 });
  }

  try {
    const json = await request.json();

    // Validate input data
    const validationResult = updateMembershipSchema.safeParse(json);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input data', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const dataToUpdate = validationResult.data;

    // Check if there's anything to update
    if (Object.keys(dataToUpdate).length === 0) {
        return NextResponse.json({ message: 'No update data provided' }, { status: 200 });
    }

    // Create properly typed update data
    const updateData: Record<string, unknown> = {};
    
    if (dataToUpdate.currentShareAmount !== undefined) {
      updateData.currentShareAmount = dataToUpdate.currentShareAmount;
    }
    if (dataToUpdate.currentLoanAmount !== undefined) {
      updateData.currentLoanAmount = dataToUpdate.currentLoanAmount;
    }
    if (dataToUpdate.initialInterest !== undefined) {
      updateData.initialInterest = dataToUpdate.initialInterest;
    }

    // Perform the update on the MemberGroupMembership record
    const updatedMembership = await prisma.memberGroupMembership.update({
      where: {
        memberId_groupId: { // Use the compound unique key
          memberId: memberId,
          groupId: groupId,
        },
      },
      data: updateData,
    });

    return NextResponse.json(updatedMembership);

  } catch (error) {
    const typedError = error as Error & { code?: string };
    console.error(`Error updating membership for member ${memberId} in group ${groupId}:`, typedError);
    if (typedError.code === 'P2025') { // Prisma error code for record not found
      return NextResponse.json({ error: 'Membership record not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Failed to update membership data', details: typedError.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
