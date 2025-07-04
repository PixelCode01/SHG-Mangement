import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/app/lib/auth-config';
import { roundToTwoDecimals } from '@/app/lib/currency-utils';

const prisma = new PrismaClient();

// PATCH: Mark contribution as paid
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contributionId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const awaitedParams = await params;
    const { contributionId } = awaitedParams;
    const body = await request.json();
    
    const {
      compulsoryContributionPaid,
      loanInterestPaid,
      lateFinePaid,
      totalPaid: providedTotalPaid,
      cashAllocation,
      status
    } = body;

    // Calculate total paid if not provided
    const calculatedTotalPaid = roundToTwoDecimals(providedTotalPaid || ((compulsoryContributionPaid || 0) + (loanInterestPaid || 0) + (lateFinePaid || 0)));

    // Get the current contribution to calculate remaining amount
    const currentContribution = await prisma.memberContribution.findUnique({
      where: { id: contributionId }
    });

    if (!currentContribution) {
      return NextResponse.json({ error: 'Contribution not found' }, { status: 404 });
    }

    // Calculate remaining amount
    const remainingAmount = roundToTwoDecimals(Math.max(0, currentContribution.minimumDueAmount - calculatedTotalPaid));

    // Update the contribution
    const updatedContribution = await prisma.memberContribution.update({
      where: { id: contributionId },
      data: {
        compulsoryContributionPaid: roundToTwoDecimals(compulsoryContributionPaid || currentContribution.compulsoryContributionPaid),
        loanInterestPaid: roundToTwoDecimals(loanInterestPaid || currentContribution.loanInterestPaid),
        lateFinePaid: roundToTwoDecimals(lateFinePaid || currentContribution.lateFinePaid),
        totalPaid: calculatedTotalPaid,
        remainingAmount,
        status: status || (remainingAmount === 0 ? 'PAID' : 'PENDING'),
        paidDate: remainingAmount === 0 ? new Date() : currentContribution.paidDate,
        updatedAt: new Date(),
        // Store cash allocation as JSON if provided
        ...(cashAllocation && { cashAllocation: JSON.stringify(cashAllocation) })
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

    return NextResponse.json({ contribution: updatedContribution });
  } catch (error) {
    console.error('Error updating contribution:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET: Get specific contribution details
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; contributionId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const awaitedParams = await params;
    const { contributionId } = awaitedParams;

    const contribution = await prisma.memberContribution.findUnique({
      where: { id: contributionId },
      include: {
        member: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        },
        groupPeriodicRecord: {
          select: {
            id: true,
            meetingDate: true,
            groupId: true
          }
        }
      }
    });

    if (!contribution) {
      return NextResponse.json({ error: 'Contribution not found' }, { status: 404 });
    }

    return NextResponse.json({ contribution });
  } catch (error) {
    console.error('Error fetching contribution:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
