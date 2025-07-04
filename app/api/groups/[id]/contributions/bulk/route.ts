import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/app/lib/auth-config';
import { calculatePeriodInterest } from '@/app/lib/interest-utils';
import { roundToTwoDecimals } from '@/app/lib/currency-utils';
import { calculatePeriodDueDate } from '@/app/lib/due-date-utils';

const prisma = new PrismaClient();

// POST: Create contributions for all group members for a new period
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
      membersPresent,
      compulsoryContributionAmount
    } = body;

    // Safeguard: Convert empty array to null for backward compatibility
    let safeMembersPresent = membersPresent;
    if (Array.isArray(membersPresent) && membersPresent.length === 0) {
      safeMembersPresent = null;
    }

    // Check if group exists and get group settings
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        memberships: {
          include: {
            member: {
              select: {
                id: true,
                name: true,
                loans: {
                  where: {
                    status: 'ACTIVE'
                  },
                  select: {
                    id: true,
                    currentBalance: true,
                    interestRate: true
                  }
                }
              }
            }
          }
        },
        lateFineRules: {
          where: {
            isEnabled: true
          }
        }
      }
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Create the periodic record
    const periodicRecord = await prisma.groupPeriodicRecord.create({
      data: {
        groupId,
        meetingDate: new Date(meetingDate),
        recordSequenceNumber,
        membersPresent: safeMembersPresent
      }
    });

    // Get late fine rules (unused for now, but available for future enhancement)
    // const lateFineRule = group.lateFineRules[0] || null;

    // Create contributions for each member
    const memberContributions = [];
    
    for (const membership of group.memberships) {
      const member = membership.member;
      
      // Calculate loan interest due (if any active loans)
      let loanInterestDue = 0;
      for (const loan of member.loans) {
        // Fix: Use period-adjusted interest calculation instead of monthly rate assumption
        const periodInterest = calculatePeriodInterest(
          loan.currentBalance,
          loan.interestRate,
          group.collectionFrequency || 'MONTHLY'
        );
        loanInterestDue += periodInterest;
      }
      loanInterestDue = roundToTwoDecimals(loanInterestDue);

      // Calculate due date based on collection schedule
      const groupSchedule = {
        collectionFrequency: group.collectionFrequency,
        collectionDayOfMonth: group.collectionDayOfMonth || null,
        collectionDayOfWeek: group.collectionDayOfWeek || null,
        collectionWeekOfMonth: group.collectionWeekOfMonth || null
      };
      
      const dueDate = calculatePeriodDueDate(groupSchedule, meetingDate);

      // Ensure all members have the same compulsory contribution amount
      const contributionAmount = roundToTwoDecimals(compulsoryContributionAmount || group.monthlyContribution || 0);
      const minimumDueAmount = roundToTwoDecimals(contributionAmount + loanInterestDue);

      const contribution = await prisma.memberContribution.create({
        data: {
          groupPeriodicRecordId: periodicRecord.id,
          memberId: member.id,
          compulsoryContributionDue: contributionAmount, // Same amount for all members
          loanInterestDue,
          minimumDueAmount,
          remainingAmount: minimumDueAmount,
          dueDate,
          status: 'PENDING',
          // Initialize payment fields
          compulsoryContributionPaid: 0,
          loanInterestPaid: 0,
          lateFinePaid: 0,
          totalPaid: 0,
          daysLate: 0,
          lateFineAmount: 0
        }
      });

      memberContributions.push(contribution);
    }

    return NextResponse.json({
      periodicRecord,
      contributionsCreated: memberContributions.length,
      contributions: memberContributions
    });
  } catch (error) {
    console.error('Error creating period contributions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Update contributions in bulk (mark multiple as paid)
export async function PATCH(
  request: NextRequest,
  _params: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { contributionUpdates } = body;

    if (!Array.isArray(contributionUpdates)) {
      return NextResponse.json({ error: 'contributionUpdates must be an array' }, { status: 400 });
    }

    const updatedContributions = [];

    for (const update of contributionUpdates) {
      const {
        contributionId,
        compulsoryContributionPaid,
        loanInterestPaid,
        lateFinePaid,
        status
      } = update;

      // Get current contribution
      const currentContribution = await prisma.memberContribution.findUnique({
        where: { id: contributionId }
      });

      if (!currentContribution) {
        continue; // Skip if not found
      }

      // Calculate total paid and remaining
      const totalPaid = (compulsoryContributionPaid || 0) + (loanInterestPaid || 0) + (lateFinePaid || 0);
      const remainingAmount = Math.max(0, currentContribution.minimumDueAmount - totalPaid);

      const updatedContribution = await prisma.memberContribution.update({
        where: { id: contributionId },
        data: {
          compulsoryContributionPaid: compulsoryContributionPaid !== undefined ? compulsoryContributionPaid : currentContribution.compulsoryContributionPaid,
          loanInterestPaid: loanInterestPaid !== undefined ? loanInterestPaid : currentContribution.loanInterestPaid,
          lateFinePaid: lateFinePaid !== undefined ? lateFinePaid : currentContribution.lateFinePaid,
          totalPaid,
          remainingAmount,
          status: status || (remainingAmount === 0 ? 'PAID' : 'PENDING'),
          paidDate: remainingAmount === 0 ? new Date() : currentContribution.paidDate,
          updatedAt: new Date()
        }
      });

      updatedContributions.push(updatedContribution);
    }

    return NextResponse.json({ 
      updatedCount: updatedContributions.length,
      contributions: updatedContributions 
    });
  } catch (error) {
    console.error('Error bulk updating contributions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
