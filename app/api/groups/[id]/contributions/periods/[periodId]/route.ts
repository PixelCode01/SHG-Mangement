import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/app/lib/auth-config';

const prisma = new PrismaClient();

// GET: Get specific period data by period ID
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const awaitedParams = await params;
    const groupId = awaitedParams.id;
    const periodId = awaitedParams.periodId;

    // Get the specific period data
    const period = await prisma.groupPeriodicRecord.findFirst({
      where: { 
        id: periodId,
        groupId 
      },
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

    if (!period) {
      return NextResponse.json({ error: 'Period not found' }, { status: 404 });
    }

    // Convert member contributions to the expected format
    const contributions = period.memberContributions.reduce((acc: any, contrib: any) => {
      acc[contrib.memberId] = contrib;
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      period: {
        id: period.id,
        meetingDate: period.meetingDate,
        periodNumber: period.recordSequenceNumber,
        totalCollected: period.totalCollectionThisPeriod,
        interestEarned: period.interestEarnedThisPeriod,
        lateFinesCollected: period.lateFinesCollectedThisPeriod,
        closedAt: period.updatedAt,
        cashAllocations: period.cashAllocations
      },
      contributions: contributions
    });
  } catch (error) {
    console.error('Error fetching period data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch period data' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
