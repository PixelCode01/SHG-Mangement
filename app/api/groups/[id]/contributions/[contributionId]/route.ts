import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/app/lib/auth-config';
import { roundToTwoDecimals } from '@/app/lib/currency-utils';
import { calculateLateFineInfo } from '@/app/lib/due-date-utils';
import { calculateLateFineAmount } from '@/app/lib/late-fine-utils';

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
      loanInsurancePaid,
      groupSocialPaid,
      totalPaid: providedTotalPaid,
      cashAllocation,
      status,
      submissionDate
    } = body;

    // Get the current contribution to access group data and period information
    const currentContribution = await prisma.memberContribution.findUnique({
      where: { id: contributionId },
      include: {
        groupPeriodicRecord: {
          include: {
            group: {
              include: {
                lateFineRules: true
              }
            }
          }
        }
      }
    });

    if (!currentContribution) {
      return NextResponse.json({ error: 'Contribution not found' }, { status: 404 });
    }

    // Get the original expected contribution
    const originalExpectedContribution = currentContribution.compulsoryContributionDue;

    // If submissionDate is provided, recalculate late fine based on that date
    let recalculatedLateFine = lateFinePaid;
    let recalculatedDaysLate = currentContribution.daysLate;
    
    if (submissionDate) {
      const paymentDate = new Date(submissionDate);
      const group = currentContribution.groupPeriodicRecord.group;
      const periodStartDate = currentContribution.groupPeriodicRecord.createdAt;
      
      // Calculate late fine info based on the provided submission date
      const lateFineInfo = calculateLateFineInfo(
        {
          collectionFrequency: group.collectionFrequency,
          collectionDayOfMonth: group.collectionDayOfMonth,
          collectionDayOfWeek: group.collectionDayOfWeek,
          collectionWeekOfMonth: group.collectionWeekOfMonth
        },
        periodStartDate,
        paymentDate
      );
      
      // Calculate the late fine amount using the group's late fine rules
      const lateFineRule = group.lateFineRules?.[0];
      const calculatedLateFineAmount = calculateLateFineAmount(
        lateFineRule,
        lateFineInfo.daysLate,
        originalExpectedContribution
      );
      
      recalculatedDaysLate = lateFineInfo.daysLate;
      
      // Use the calculated late fine if lateFinePaid is not explicitly provided
      if (lateFinePaid === undefined || lateFinePaid === null) {
        recalculatedLateFine = calculatedLateFineAmount;
      } else {
        recalculatedLateFine = lateFinePaid;
      }
    }

    // Calculate total paid with the recalculated late fine
    const calculatedTotalPaid = roundToTwoDecimals(providedTotalPaid || (
      (compulsoryContributionPaid || 0) + 
      (loanInterestPaid || 0) + 
      (recalculatedLateFine || 0) + 
      (loanInsurancePaid || 0) + 
      (groupSocialPaid || 0)
    ));

    // Calculate remaining amount
    const remainingAmount = roundToTwoDecimals(Math.max(0, currentContribution.minimumDueAmount - calculatedTotalPaid));

    // Update the contribution with recalculated values
    const updatedContribution = await prisma.memberContribution.update({
      where: { id: contributionId },
      data: {
        compulsoryContributionPaid: roundToTwoDecimals(compulsoryContributionPaid || currentContribution.compulsoryContributionPaid),
        loanInterestPaid: roundToTwoDecimals(loanInterestPaid || currentContribution.loanInterestPaid),
        lateFinePaid: roundToTwoDecimals(recalculatedLateFine || currentContribution.lateFinePaid),
        loanInsurancePaid: roundToTwoDecimals(loanInsurancePaid || currentContribution.loanInsurancePaid),
        groupSocialPaid: roundToTwoDecimals(groupSocialPaid || currentContribution.groupSocialPaid),
        totalPaid: calculatedTotalPaid,
        remainingAmount,
        daysLate: recalculatedDaysLate,
        // Update late fine amount in the record for future reference
        lateFineAmount: roundToTwoDecimals(recalculatedLateFine || currentContribution.lateFineAmount),
        status: status || (remainingAmount === 0 ? 'PAID' : 'PENDING'),
        paidDate: remainingAmount === 0 ? (submissionDate ? new Date(submissionDate) : new Date()) : currentContribution.paidDate,
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
