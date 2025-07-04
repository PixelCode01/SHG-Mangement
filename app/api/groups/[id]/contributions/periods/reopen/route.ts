import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/app/lib/auth-config';

const prisma = new PrismaClient();

// POST: Reopen a closed period
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
    const { periodId } = body;

    // Verify user has edit permissions for this group
    const group = await prisma.group.findUnique({
      where: { id: groupId }
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const isLeader = group.leaderId === session.user.memberId;

    if (!isLeader) {
      return NextResponse.json({ error: 'Only group leaders can reopen periods' }, { status: 403 });
    }

    // Start transaction to reopen period
    const result = await prisma.$transaction(async (tx) => {
      // Get the period to reopen
      const periodToReopen = await tx.groupPeriodicRecord.findUnique({
        where: { id: periodId },
        include: {
          memberContributions: true
        }
      });

      if (!periodToReopen) {
        throw new Error('Period not found');
      }

      // Check if this is the most recent closed period
      const moreRecentPeriods = await tx.groupPeriodicRecord.findMany({
        where: {
          groupId: groupId,
          recordSequenceNumber: {
            gt: periodToReopen.recordSequenceNumber || 0
          }
        }
      });

      if (moreRecentPeriods.length > 0) {
        throw new Error('Can only reopen the most recent closed period');
      }

      // Get current active period (the most recent one that's not closed)
      const currentActivePeriod = await tx.groupPeriodicRecord.findFirst({
        where: {
          groupId: groupId,
          totalCollectionThisPeriod: null // Not closed
        },
        orderBy: { recordSequenceNumber: 'desc' }
      });

      // If there's an active period, we need to delete it (since we're reopening the previous one)
      if (currentActivePeriod) {
        // Delete member contributions for the current active period first
        await tx.memberContribution.deleteMany({
          where: {
            groupPeriodicRecordId: currentActivePeriod.id
          }
        });

        // Delete the current active period
        await tx.groupPeriodicRecord.delete({
          where: { id: currentActivePeriod.id }
        });
      }

      // Reopen the selected period by clearing its closing data
      const reopenedPeriod = await tx.groupPeriodicRecord.update({
        where: { id: periodId },
        data: {
          // Clear closing data since we're reopening - this makes it "active" again
          totalCollectionThisPeriod: null,
          interestEarnedThisPeriod: null,
          lateFinesCollectedThisPeriod: null,
          updatedAt: new Date()
        }
      });

      // Update member contributions to allow modifications again
      await tx.memberContribution.updateMany({
        where: {
          groupPeriodicRecordId: periodId
        },
        data: {
          updatedAt: new Date()
        }
      });

      return {
        success: true,
        reopenedPeriod: reopenedPeriod,
        message: 'Period reopened successfully'
      };
    }, {
      timeout: 30000 // 30 second timeout
    });

    console.log('Period reopened successfully:', result);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error reopening period:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reopen period' },
      { status: 500 }
    );
  }
}
