import { prisma } from '@/app/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Schema for validating adding a member to a group
const addMemberSchema = z.object({
  memberId: z.string().min(1, 'Member ID is required'),
  // Optional current financial data when adding member
  currentShareAmount: z.number().nonnegative().optional(),
  currentLoanAmount: z.number().nonnegative().optional(),
  initialInterest: z.number().nonnegative().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await params;
  if (!groupId) {
    return NextResponse.json({ error: 'Group ID is required' }, { status: 400 });
  }

  try {
    const json = await request.json();

    // Validate input data
    const validationResult = addMemberSchema.safeParse(json);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input data', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { memberId, currentShareAmount, currentLoanAmount, initialInterest } = validationResult.data;

    // Use transaction to check existence and create membership
    const result = await prisma.$transaction(async (tx) => {
      // 1. Check if the group exists and get current data
      const group = await tx.group.findUnique({
        where: { id: groupId },
        select: { 
          id: true, 
          name: true,
          memberships: { select: { id: true } },
          groupPeriodicRecords: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { 
              id: true,
              totalGroupStandingAtEndOfPeriod: true,
              createdAt: true
            }
          }
        },
      });
      if (!group) {
        throw new Error('Group not found'); // Will be caught below
      }

      // 2. Check if the member exists
      const memberExists = await tx.member.findUnique({
        where: { id: memberId },
        select: { id: true, name: true },
      });
      if (!memberExists) {
        throw new Error('Member not found'); // Will be caught below
      }

      // 3. Check if the membership already exists
      const existingMembership = await tx.memberGroupMembership.findUnique({
        where: {
          memberId_groupId: {
            memberId: memberId,
            groupId: groupId,
          },
        },
      });
      if (existingMembership) {
        throw new Error('Member is already in this group'); // Will be caught below
      }

      // 4. Create the membership
      const membershipData = {
        groupId: parseInt(groupId),
        memberId: parseInt(memberId),
        ...(currentShareAmount !== undefined && { currentShareAmount }),
        ...(currentLoanAmount !== undefined && { currentLoanAmount }),
        ...(initialInterest !== undefined && { initialInterest }),
      };

      const membership = await tx.memberGroupMembership.create({
        data: membershipData as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Prisma relation typing issue
      });

      // 5. Update group financial data if share amount is provided
      let updatedGroupStanding = null;
      if (currentShareAmount && currentShareAmount > 0) {
        const currentGroupStanding = group.groupPeriodicRecords[0]?.totalGroupStandingAtEndOfPeriod || 0;
        const newGroupStanding = currentGroupStanding + currentShareAmount;
        
        // Update the latest periodic record or create a new one if none exists
        if (group.groupPeriodicRecords.length > 0 && group.groupPeriodicRecords[0]) {
          await tx.groupPeriodicRecord.updateMany({
            where: {
              groupId: groupId,
              createdAt: group.groupPeriodicRecords[0].createdAt
            },
            data: {
              totalGroupStandingAtEndOfPeriod: newGroupStanding,
              cashInHandAtEndOfPeriod: newGroupStanding, // Assuming the share amount goes to cash
            }
          });
        }
        updatedGroupStanding = newGroupStanding;
      }

      const currentMemberCount = group.memberships.length;
      const newMemberCount = currentMemberCount + 1;

      return {
        membership,
        memberData: memberExists,
        groupData: {
          name: group.name,
          previousMemberCount: currentMemberCount,
          newMemberCount: newMemberCount,
          shareAmountAdded: currentShareAmount || 0,
          updatedGroupStanding: updatedGroupStanding
        }
      };
    });

    return NextResponse.json({
      membership: result.membership,
      message: `${result.memberData.name} has been successfully added to ${result.groupData.name}`,
      details: {
        newMemberCount: result.groupData.newMemberCount,
        previousMemberCount: result.groupData.previousMemberCount,
        shareAmountAdded: result.groupData.shareAmountAdded,
        updatedGroupStanding: result.groupData.updatedGroupStanding
      }
    }, { status: 201 });

  } catch (error) {
    const typedError = error as Error;
    console.error(`Error adding member to group ${groupId}:`, typedError);

    // Handle specific errors from the transaction
    if (typedError.message === 'Group not found') {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }
    if (typedError.message === 'Member not found') {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }
    if (typedError.message === 'Member is already in this group') {
      return NextResponse.json({ error: 'Member is already in this group' }, { status: 409 }); // Conflict
    }

    // Handle potential Prisma unique constraint errors (though checked above)
    if ('code' in typedError && (typedError as Error & { code?: string }).code === 'P2002') {
      return NextResponse.json(
        { error: 'Membership already exists.' }, // More specific than the generic message
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to add member to group', details: typedError.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
