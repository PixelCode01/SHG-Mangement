import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/app/lib/auth-config';
import { roundToTwoDecimals } from '@/app/lib/currency-utils';
import { calculatePeriodDueDate } from '@/app/lib/due-date-utils';

const prisma = new PrismaClient();

// GET: Get current period contributions for a group
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const awaitedParams = await params;
    const groupId = awaitedParams.id;

    // Get the most recent periodic record for this group
    const currentRecord = await prisma.groupPeriodicRecord.findFirst({
      where: { groupId },
      orderBy: { meetingDate: 'desc' },
      include: {
        memberContributions: {
          include: {
            member: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              }
            }
          }
        },
        cashAllocations: {
          orderBy: { lastModifiedAt: 'desc' },
          take: 1
        }
      }
    });

    if (!currentRecord) {
      // Return a structured response indicating no current period exists
      return NextResponse.json({ 
        error: 'No active period found',
        hasCurrentPeriod: false,
        message: 'No active contribution period exists for this group. Please create a new period first.'
      }, { status: 404 });
    }

    return NextResponse.json({
      record: currentRecord,
      contributions: currentRecord.memberContributions,
      cashAllocation: currentRecord.cashAllocations[0] || null
    });
  } catch (error) {
    console.error('Error fetching contributions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create a contribution record for a specific member in the current period
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const awaitedParams = await params;
    const groupId = awaitedParams.id;
    const body = await request.json();
    
    const {
      memberId,
      compulsoryContributionDue,
      loanInterestDue = 0
    } = body;

    if (!memberId) {
      return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
    }

    // Get or create the current periodic record
    const currentRecord = await prisma.groupPeriodicRecord.findFirst({
      where: { groupId },
      orderBy: { meetingDate: 'desc' }
    });

    // If no periodic record exists, do NOT automatically create one
    // This prevents automatic creation of periods with incorrect values
    if (!currentRecord) {
      return NextResponse.json({ 
        error: 'No active contribution period found',
        hasCurrentPeriod: false,
        message: 'Please ensure an active contribution period exists before adding member contributions.'
      }, { status: 404 });
    }

    // Get group settings for default amounts and collection schedule
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        monthlyContribution: true,
        collectionFrequency: true,
        collectionDayOfMonth: true,
        collectionDayOfWeek: true,
        collectionWeekOfMonth: true
      }
    });

    const defaultContributionAmount = roundToTwoDecimals(compulsoryContributionDue || group?.monthlyContribution || 0);
    const loanInterestAmount = roundToTwoDecimals(loanInterestDue);
    const minimumDueAmount = roundToTwoDecimals(defaultContributionAmount + loanInterestAmount);

    // Calculate due date properly using collection schedule
    const groupSchedule = {
      collectionFrequency: group?.collectionFrequency || 'MONTHLY',
      collectionDayOfMonth: group?.collectionDayOfMonth || null,
      collectionDayOfWeek: group?.collectionDayOfWeek || null,
      collectionWeekOfMonth: group?.collectionWeekOfMonth || null
    };
    
    const dueDate = calculatePeriodDueDate(groupSchedule, currentRecord.meetingDate);

    // Use upsert to handle the case where contribution already exists
    const contribution = await prisma.memberContribution.upsert({
      where: {
        groupPeriodicRecordId_memberId: {
          groupPeriodicRecordId: currentRecord.id,
          memberId: memberId
        }
      },
      update: {
        // If it exists, update with new values if provided
        compulsoryContributionDue: defaultContributionAmount,
        loanInterestDue: loanInterestAmount,
        minimumDueAmount: minimumDueAmount,
        remainingAmount: minimumDueAmount,
        dueDate: dueDate,
        updatedAt: new Date()
      },
      create: {
        groupPeriodicRecordId: currentRecord.id,
        memberId: memberId,
        compulsoryContributionDue: defaultContributionAmount,
        loanInterestDue: loanInterestAmount,
        minimumDueAmount: minimumDueAmount,
        remainingAmount: minimumDueAmount,
        dueDate: dueDate,
        status: 'PENDING',
        compulsoryContributionPaid: 0,
        loanInterestPaid: 0,
        lateFinePaid: 0,
        totalPaid: 0
      },
      include: {
        member: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        }
      }
    });

    return NextResponse.json(contribution);
  } catch (error) {
    console.error('Error creating contribution record:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
