import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/app/lib/auth-config';

const prisma = new PrismaClient();

// GET: Get all periods (closed contribution periods) for a group
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

    // Get only closed periods for this group, ordered by date (newest first)
    // A period is considered closed when totalCollectionThisPeriod is not null AND greater than 0
    const periods = await prisma.groupPeriodicRecord.findMany({
      where: { 
        groupId,
        // Only get periods that have been "closed" (have closing data set and actual collections)
        totalCollectionThisPeriod: {
          gt: 0
        }
      },
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
        cashAllocations: true
      }
    });

    return NextResponse.json({
      success: true,
      periods: periods
    });
  } catch (error) {
    console.error('Error fetching periods:', error);
    return NextResponse.json(
      { error: 'Failed to fetch periods' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// POST: Create a new period for a group
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
      meetingDate,
      recordSequenceNumber,
      standingAtStartOfPeriod,
      cashInHandAtEndOfPeriod,
      cashInBankAtEndOfPeriod,
      totalGroupStandingAtEndOfPeriod,
      totalCollectionThisPeriod,
      interestEarnedThisPeriod,
      lateFinesCollectedThisPeriod,
      newContributionsThisPeriod
    } = body;

    // Verify user has edit permissions for this group
    const group = await prisma.group.findUnique({
      where: { id: groupId }
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const isLeader = group.leaderId === session.user.memberId;

    if (!isLeader) {
      return NextResponse.json({ error: 'Only group leaders can create periods' }, { status: 403 });
    }

    // Create new period record
    const newPeriod = await prisma.groupPeriodicRecord.create({
      data: {
        groupId,
        meetingDate: new Date(meetingDate),
        recordSequenceNumber: recordSequenceNumber || 1,
        standingAtStartOfPeriod: standingAtStartOfPeriod || 0,
        cashInHandAtEndOfPeriod: cashInHandAtEndOfPeriod || 0,
        cashInBankAtEndOfPeriod: cashInBankAtEndOfPeriod || 0,
        totalGroupStandingAtEndOfPeriod: totalGroupStandingAtEndOfPeriod || 0,
        totalCollectionThisPeriod: totalCollectionThisPeriod || 0,
        interestEarnedThisPeriod: interestEarnedThisPeriod || 0,
        lateFinesCollectedThisPeriod: lateFinesCollectedThisPeriod || 0,
        newContributionsThisPeriod: newContributionsThisPeriod || 0,
        membersPresent: 0, // Will be updated as contributions are made
      }
    });

    return NextResponse.json({
      success: true,
      id: newPeriod.id,
      message: 'New period created successfully'
    });

  } catch (error) {
    console.error('Error creating new period:', error);
    return NextResponse.json(
      { error: 'Failed to create new period' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
