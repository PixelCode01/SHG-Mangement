import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { authMiddleware, canAccessGroup } from '@/app/lib/auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  if (!id) {
    return NextResponse.json({ error: 'Group ID is required' }, { status: 400 });
  }

  try {
    // Check authentication
    const authResult = await authMiddleware(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { session } = authResult;
    const userId = session.user.id;

    // Check group access
    const hasAccess = await canAccessGroup(userId, id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have permission to access this group' },
        { status: 403 }
      );
    }

    // Get group with comprehensive data
    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        leader: {
          select: { id: true, name: true, email: true }
        },
        memberships: {
          include: {
            member: {
              include: {
                loans: {
                  where: {
                    groupId: id,
                    status: 'ACTIVE'
                  }
                }
              }
            }
          }
        },
        groupPeriodicRecords: {
          orderBy: { meetingDate: 'desc' },
          take: 12, // Last 12 records for trend analysis
          include: {
            memberRecords: true,
            loansIssuedThisPeriod: true,
            loanPaymentsReceivedThisPeriod: true
          }
        }
      }
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Calculate summary statistics
    const latestRecord = group.groupPeriodicRecords[0];
    const totalMembers = group.memberships.length;
    
    // Helper function to ensure valid numbers
    const safeNumber = (value: unknown): number => {
      const num = Number(value) || 0;
      return isNaN(num) || !isFinite(num) ? 0 : num;
    };

    // Financial Overview
    const currentCashInBank = safeNumber(latestRecord?.cashInBankAtEndOfPeriod);
    const currentCashInHand = safeNumber(latestRecord?.cashInHandAtEndOfPeriod);
    const totalGroupStanding = safeNumber(latestRecord?.totalGroupStandingAtEndOfPeriod);
    const sharePerMember = totalMembers > 0 ? safeNumber(totalGroupStanding / totalMembers) : 0;

    // Loan Statistics - Fixed to include both loan sources
    // const activeLoans = group.memberships.flatMap(m => m.member.loans); // Unused variable
    
    // Calculate total loans including both membership loan amounts and active loan records
    let totalLoanAmount = 0;
    let totalOutstandingAmount = 0;
    let loansWithData = 0;
    
    group.memberships.forEach(membership => {
      // Get loan amount from membership data (historical/initial loans)
      const membershipLoanAmount = safeNumber(membership.currentLoanAmount || 0);
      
      // Get active loan balances from loans table (new loans)
      const activeLoanBalance = safeNumber(membership.member.loans?.reduce((total, loan) => 
        total + safeNumber(loan.currentBalance), 0) || 0);
      
      // Use whichever source has data (prefer active loans if they exist)
      const memberCurrentLoanBalance = activeLoanBalance > 0 ? activeLoanBalance : membershipLoanAmount;
      
      if (memberCurrentLoanBalance > 0) {
        totalLoanAmount += memberCurrentLoanBalance;
        totalOutstandingAmount += memberCurrentLoanBalance;
        loansWithData++;
      }
    });
    
    const totalActiveLoans = loansWithData;

    // Recent Activity (last 6 months)
    const recentRecords = group.groupPeriodicRecords.slice(0, 6);
    const totalCollectionsRecent = safeNumber(recentRecords.reduce((sum, record) => 
      sum + safeNumber(record.totalCollectionThisPeriod), 0));
    const totalInterestEarned = safeNumber(recentRecords.reduce((sum, record) => 
      sum + safeNumber(record.interestEarnedThisPeriod), 0));
    const totalExpenses = safeNumber(recentRecords.reduce((sum, record) => 
      sum + safeNumber(record.expensesThisPeriod), 0));

    // Interest Profit Analysis (replacement for member contributions)
    const interestProfitAnalysis = recentRecords.map(record => {
      const interestEarned = safeNumber(record.interestEarnedThisPeriod);
      const expenses = safeNumber(record.expensesThisPeriod);
      const netInterestProfit = interestEarned - expenses;
      
      return {
        date: record.meetingDate,
        period: new Date(record.meetingDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        interestEarned,
        expenses,
        netInterestProfit,
        profitMargin: interestEarned > 0 ? safeNumber((netInterestProfit / interestEarned) * 100) : 0
      };
    }).reverse(); // Reverse to show chronological order

    // Monthly Trends (for charts)
    const monthlyTrends = group.groupPeriodicRecords.map(record => ({
      date: record.meetingDate,
      totalStanding: safeNumber(record.totalGroupStandingAtEndOfPeriod),
      collections: safeNumber(record.totalCollectionThisPeriod),
      expenses: safeNumber(record.expensesThisPeriod),
      interestEarned: safeNumber(record.interestEarnedThisPeriod),
      cashInBank: safeNumber(record.cashInBankAtEndOfPeriod),
      cashInHand: safeNumber(record.cashInHandAtEndOfPeriod),
      membersPresent: safeNumber(record.membersPresent)
    }));

    // Growth Analysis
    const oldestRecord = group.groupPeriodicRecords[group.groupPeriodicRecords.length - 1];
    const oldestStanding = safeNumber(oldestRecord?.totalGroupStandingAtEndOfPeriod);
    const growthFromStart = oldestStanding > 0 ? 
      safeNumber(((totalGroupStanding - oldestStanding) / oldestStanding) * 100) : 0;

    const summary = {
      groupInfo: {
        id: group.id,
        name: group.name,
        leader: group.leader,
        totalMembers,
        dateOfStarting: group.dateOfStarting,
        address: group.address,
        organization: group.organization,
        bankAccountNumber: group.bankAccountNumber,
        bankName: group.bankName
      },
      financialOverview: {
        totalGroupStanding,
        currentCashInBank,
        currentCashInHand,
        sharePerMember,
        growthFromStart: safeNumber(Math.round(growthFromStart * 100) / 100)
      },
      loanStatistics: {
        totalActiveLoans,
        totalLoanAmount,
        totalOutstandingAmount,
        averageLoanSize: totalActiveLoans > 0 ? safeNumber(totalLoanAmount / totalActiveLoans) : 0,
        repaymentRate: totalLoanAmount > 0 ? safeNumber(((totalLoanAmount - totalOutstandingAmount) / totalLoanAmount) * 100) : 0
      },
      recentActivity: {
        totalCollections: totalCollectionsRecent,
        totalInterestEarned,
        totalExpenses,
        netIncome: safeNumber(totalCollectionsRecent + totalInterestEarned - totalExpenses),
        periodsAnalyzed: recentRecords.length
      },
      interestProfitAnalysis,
      monthlyTrends,
      recordsAnalyzed: group.groupPeriodicRecords.length,
      lastUpdated: latestRecord?.meetingDate || group.updatedAt
    };

    return NextResponse.json(summary);

  } catch (error) {
    console.error(`Error generating group summary for ${id}:`, error);
    return NextResponse.json(
      { error: 'Failed to generate group summary' },
      { status: 500 }
    );
  }
}
