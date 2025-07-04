import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/app/lib/auth-config';

const prisma = new PrismaClient();

// GET: Generate and retrieve contribution report
export async function GET(
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
    const { searchParams } = new URL(request.url);
    const recordId = searchParams.get('recordId');

    if (!recordId) {
      return NextResponse.json({ error: 'Record ID is required' }, { status: 400 });
    }

    // Get the periodic record with all related data
    const periodicRecord = await prisma.groupPeriodicRecord.findUnique({
      where: { id: recordId },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            groupId: true,
            collectionFrequency: true,
            monthlyContribution: true,
          }
        },
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

    if (!periodicRecord) {
      return NextResponse.json({ error: 'Periodic record not found' }, { status: 404 });
    }

    if (periodicRecord.groupId !== groupId) {
      return NextResponse.json({ error: 'Record does not belong to this group' }, { status: 403 });
    }

    // Calculate report data
    const totalMembers = periodicRecord.memberContributions.length;
    const totalDue = periodicRecord.memberContributions.reduce((sum: number, contrib: any) => sum + contrib.minimumDueAmount, 0);
    const totalPaid = periodicRecord.memberContributions.reduce((sum: number, contrib: any) => sum + contrib.totalPaid, 0);
    const totalRemaining = periodicRecord.memberContributions.reduce((sum: number, contrib: any) => sum + contrib.remainingAmount, 0);
    const membersCompleted = periodicRecord.memberContributions.filter((contrib: any) => contrib.status === 'PAID').length;
    const membersPending = totalMembers - membersCompleted;
    
    const compulsoryContributionTotal = periodicRecord.memberContributions.reduce((sum: number, contrib: any) => sum + contrib.compulsoryContributionDue, 0);
    const loanInterestTotal = periodicRecord.memberContributions.reduce((sum: number, contrib: any) => sum + (contrib.loanInterestDue || 0), 0);
    const lateFineTotal = periodicRecord.memberContributions.reduce((sum: number, contrib: any) => sum + contrib.lateFineAmount, 0);
    
    const compulsoryContributionPaid = periodicRecord.memberContributions.reduce((sum: number, contrib: any) => sum + contrib.compulsoryContributionPaid, 0);
    const loanInterestPaid = periodicRecord.memberContributions.reduce((sum: number, contrib: any) => sum + contrib.loanInterestPaid, 0);
    const lateFinePaid = periodicRecord.memberContributions.reduce((sum: number, contrib: any) => sum + contrib.lateFinePaid, 0);

    const reportData = {
      groupInfo: {
        id: periodicRecord.group.id,
        name: periodicRecord.group.name,
        groupId: periodicRecord.group.groupId,
        collectionFrequency: periodicRecord.group.collectionFrequency,
        monthlyContribution: periodicRecord.group.monthlyContribution,
      },
      periodInfo: {
        meetingDate: periodicRecord.meetingDate,
        recordSequenceNumber: periodicRecord.recordSequenceNumber,
      },
      summary: {
        totalMembers,
        membersCompleted,
        membersPending,
        totalDue,
        totalPaid,
        totalRemaining,
        collectionPercentage: totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0,
      },
      breakdown: {
        compulsoryContribution: {
          due: compulsoryContributionTotal,
          paid: compulsoryContributionPaid,
          remaining: compulsoryContributionTotal - compulsoryContributionPaid,
        },
        loanInterest: {
          due: loanInterestTotal,
          paid: loanInterestPaid,
          remaining: loanInterestTotal - loanInterestPaid,
        },
        lateFines: {
          due: lateFineTotal,
          paid: lateFinePaid,
          remaining: lateFineTotal - lateFinePaid,
        }
      },
      memberDetails: periodicRecord.memberContributions.map((contrib: any) => ({
        member: contrib.member,
        status: contrib.status,
        dueAmount: contrib.minimumDueAmount,
        paidAmount: contrib.totalPaid,
        remainingAmount: contrib.remainingAmount,
        daysLate: contrib.daysLate,
        breakdown: {
          compulsoryContribution: {
            due: contrib.compulsoryContributionDue,
            paid: contrib.compulsoryContributionPaid,
          },
          loanInterest: {
            due: contrib.loanInterestDue || 0,
            paid: contrib.loanInterestPaid,
          },
          lateFine: {
            due: contrib.lateFineAmount,
            paid: contrib.lateFinePaid,
          }
        }
      })),
      cashAllocation: periodicRecord.cashAllocations[0] || null,
      generatedAt: new Date(),
    };

    // Save the report to database
    const savedReport = await prisma.contributionReport.create({
      data: {
        groupPeriodicRecordId: recordId,
        reportData: reportData,
        generatedBy: session.user.id,
      }
    });

    return NextResponse.json({ 
      report: reportData,
      reportId: savedReport.id 
    });
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Save a custom report
export async function POST(
  request: NextRequest,
  _params: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { groupPeriodicRecordId, customReportData } = body;

    const savedReport = await prisma.contributionReport.create({
      data: {
        groupPeriodicRecordId,
        reportData: customReportData,
        generatedBy: session.user.id,
      }
    });

    return NextResponse.json({ reportId: savedReport.id });
  } catch (error) {
    console.error('Error saving custom report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
