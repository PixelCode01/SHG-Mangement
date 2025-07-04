import { prisma } from '@/app/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authMiddleware, canEditGroup } from '@/app/lib/auth';
import { CollectionFrequency } from '@prisma/client';

// Schema for validating regeneration request data
const regenerateHistoricalRecordsSchema = z.object({
  dateOfStarting: z.string().datetime({ message: "Invalid date format" }),
  members: z.array(z.object({
    memberId: z.string().min(1),
    initialShareAmount: z.number().nonnegative().nullable(),
    initialLoanAmount: z.number().nonnegative().nullable(),
    initialInterest: z.number().nonnegative().nullable(),
  })),
});

// Function to add periods to a date based on frequency
const addPeriodsToDate = (startDate: Date, frequency: CollectionFrequency, periods: number): Date => {
  const date = new Date(startDate);
  switch (frequency) {
    case 'WEEKLY':
      date.setDate(date.getDate() + periods * 7);
      break;
    case 'FORTNIGHTLY':
      date.setDate(date.getDate() + periods * 14);
      break;
    case 'MONTHLY':
      date.setMonth(date.getMonth() + periods);
      break;
    case 'YEARLY':
      date.setFullYear(date.getFullYear() + periods);
      break;
  }
  return date;
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await params;
  if (!groupId) {
    return NextResponse.json({ error: 'Group ID is required' }, { status: 400 });
  }

  try {
    // Check authentication first
    const authResult = await authMiddleware(request);
    
    // If the result is a NextResponse, it means auth failed
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    const { session } = authResult;
    
    // If we reach here, the user is authenticated
    const userId = session.user.id;
    
    // Check if user has edit permission for this group
    const hasEditAccess = await canEditGroup(userId, groupId);
    
    if (!hasEditAccess) {
      return NextResponse.json(
        { error: 'You do not have permission to edit this group' },
        { status: 403 }
      );
    }

    const json = await request.json();

    // Validate input data
    const validationResult = regenerateHistoricalRecordsSchema.safeParse(json);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input data', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { dateOfStarting, members } = validationResult.data;

    // Get group details to check collection frequency
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { collectionFrequency: true, name: true },
    });

    if (!group?.collectionFrequency) {
      return NextResponse.json(
        { error: 'Group not found or missing collection frequency' },
        { status: 404 }
      );
    }

    // Begin transaction to remove existing records and create new ones
    const result = await prisma.$transaction(async (tx) => {
      // 1. Delete existing periodic records for this group 
      // (This will cascade delete memberRecords due to referential actions)
      await tx.groupPeriodicRecord.deleteMany({
        where: { groupId },
      });

      // 2. Generate new historical records
      let recordsCreatedCount = 0;
      let lastRecordStanding = 0;
      let currentRecordSequence = 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const groupStartDate = new Date(dateOfStarting);
      groupStartDate.setHours(0, 0, 0, 0);

      let meetingDate = new Date(groupStartDate);
      
      // Generate records until today
      while (meetingDate < today) {
        currentRecordSequence++;
        const isFirstRecord = currentRecordSequence === 1;

        // Map member data to member records
        const memberRecordsPayload = members.map(member => ({
          memberId: member.memberId,
          compulsoryContribution: (member.initialShareAmount || 0), 
          loanRepaymentPrincipal: 0,
          loanRepaymentInterest: isFirstRecord ? (((member.initialLoanAmount || 0) * (member.initialInterest || 0)) / 100) : 0,
          lateFinePaid: 0,
        }));

        // Calculate contributions
        const newContributionsThisPeriod = members.reduce((sum, m) => sum + (m.initialShareAmount || 0), 0);

        const interestEarnedThisPeriod = isFirstRecord
          ? members.reduce((sum, m) => sum + (((m.initialLoanAmount || 0) * (m.initialInterest || 0)) / 100), 0)
          : 0;

        const totalCollectionThisPeriod = newContributionsThisPeriod + interestEarnedThisPeriod;

        // Calculate expenses
        const expensesThisPeriod = 0;
        // Do not subtract loan amounts from group standing
        // if (isFirstRecord) {
        //   const totalInitialLoansDisbursed = members.reduce((sum, m) => sum + (m.initialLoanAmount || 0), 0);
        //   expensesThisPeriod += totalInitialLoansDisbursed;
        // }

        // Calculate standing
        const totalGroupStandingAtEndOfPeriod = lastRecordStanding + totalCollectionThisPeriod - expensesThisPeriod;

        // Create record
        await tx.groupPeriodicRecord.create({
          data: {
            groupId: groupId,
            meetingDate: meetingDate,
            recordSequenceNumber: currentRecordSequence,
            standingAtStartOfPeriod: lastRecordStanding,
            newContributionsThisPeriod: newContributionsThisPeriod,
            interestEarnedThisPeriod: interestEarnedThisPeriod,
            totalCollectionThisPeriod: totalCollectionThisPeriod,
            expensesThisPeriod: expensesThisPeriod,
            totalGroupStandingAtEndOfPeriod: totalGroupStandingAtEndOfPeriod,
            cashInHandAtEndOfPeriod: totalGroupStandingAtEndOfPeriod,
            cashInBankAtEndOfPeriod: 0,
            loanProcessingFeesCollectedThisPeriod: 0,
            lateFinesCollectedThisPeriod: 0,
            newMembersJoinedThisPeriod: isFirstRecord ? members.length : 0,
            membersPresent: members.length,
            memberRecords: {
              createMany: {
                data: memberRecordsPayload,
              },
            },
          },
        });

        recordsCreatedCount++;
        lastRecordStanding = totalGroupStandingAtEndOfPeriod;
        
        // Move date forward based on collection frequency
        meetingDate = addPeriodsToDate(meetingDate, group.collectionFrequency, 1);
      }

      return { recordsCreatedCount };
    });

    return NextResponse.json({
      message: 'Historical records regenerated successfully',
      recordsCreated: result.recordsCreatedCount,
    });
  } catch (error: unknown) {
    console.error(`Error regenerating historical records for group ${groupId}:`, error);
    return NextResponse.json(
      { error: 'Failed to regenerate historical records', details: (error as Error).message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
