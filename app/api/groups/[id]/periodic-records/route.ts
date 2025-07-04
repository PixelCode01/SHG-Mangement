import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma'; 
import { z } from 'zod';
import type { Prisma } from '@prisma/client';

// Validation schema for creating a GroupPeriodicRecord
const groupPeriodicRecordSchema = z.object({
  meetingDate: z.string().datetime(),
  recordSequenceNumber: z.number().int().positive().optional().nullable(),
  totalCollectionThisPeriod: z.number().optional().nullable(),
  standingAtStartOfPeriod: z.number().optional().nullable(),
  cashInBankAtEndOfPeriod: z.number().optional().nullable(),
  cashInHandAtEndOfPeriod: z.number().optional().nullable(),
  expensesThisPeriod: z.number().optional().nullable(),
  totalGroupStandingAtEndOfPeriod: z.number().optional().nullable(),
  interestEarnedThisPeriod: z.number().optional().nullable(),
  newContributionsThisPeriod: z.number().optional().nullable(),
  loanProcessingFeesCollectedThisPeriod: z.number().optional().nullable(),
  lateFinesCollectedThisPeriod: z.number().optional().nullable(),
  newMembersJoinedThisPeriod: z.number().int().nonnegative().optional().nullable(),
  memberRecords: z.array(z.object({
    memberId: z.string(),
    memberName: z.string().optional(),
    compulsoryContribution: z.number().optional().nullable(),
    loanRepaymentPrincipal: z.number().optional().nullable(),
    lateFinePaid: z.number().optional().nullable(),
  })).optional(),
});

// POST /api/groups/{groupId}/periodic-records
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idFromParams } = await params; 
  if (!idFromParams) {
    return NextResponse.json({ error: 'Group ID is required' }, { status: 400 });
  }

  const objectIdRegex = /^[0-9a-fA-F]{24}$/;

  try {
    let group;
    if (objectIdRegex.test(idFromParams)) {
      // If idFromParams looks like an ObjectId, try finding by id first
      group = await prisma.group.findUnique({
        where: { id: idFromParams },
      });
    } else {
      // If idFromParams doesn't look like an ObjectId, try finding by name
      group = await prisma.group.findFirst({
        where: { name: idFromParams },
      });
    }

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const actualGroupId = group.id;

    const body = await request.json();
    const validationResult = groupPeriodicRecordSchema.safeParse(body);

    if (!validationResult.success) {
      console.error("Validation errors:", validationResult.error.errors);
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const periodicData = validationResult.data;

    const newRecord = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Get latest record to determine sequence number and starting standing
      const latestRecord = await tx.groupPeriodicRecord.findFirst({
        where: { groupId: actualGroupId },
        orderBy: [
          { meetingDate: 'desc' },
          { createdAt: 'desc' }
        ]
      });

      let nextRecordSequenceNumber = 1;
      let standingAtStartOfPeriod = 0;

      if (latestRecord) {
        nextRecordSequenceNumber = (latestRecord.recordSequenceNumber || 0) + 1;
        standingAtStartOfPeriod = latestRecord.totalGroupStandingAtEndOfPeriod || 0;
      }

      // Get all active loans for the group to calculate total loan assets
      const activeLoans = await tx.loan.findMany({
        where: {
          groupId: actualGroupId,
          status: 'ACTIVE'
        }
      });

      const totalLoanAssetsFromActiveLoans = activeLoans.reduce(
        (sum, loan) => sum + (loan.currentBalance || 0), 0
      );

      // FIXED: Also get membership loan assets for consistency with period closing
      const membershipLoanAssets = await tx.memberGroupMembership.aggregate({
        where: {
          groupId: actualGroupId
        },
        _sum: {
          currentLoanAmount: true
        }
      });
      const totalLoanAssetsFromMemberships = membershipLoanAssets._sum.currentLoanAmount || 0;

      // Use the same priority logic as period closing for consistency
      let totalLoanAssets = 0;
      if (totalLoanAssetsFromMemberships > 0) {
        totalLoanAssets = totalLoanAssetsFromMemberships;
        console.log(`Using membership loans: ₹${totalLoanAssets}`);
      } else if (totalLoanAssetsFromActiveLoans > 0) {
        totalLoanAssets = totalLoanAssetsFromActiveLoans;
        console.log(`Using active loans: ₹${totalLoanAssets}`);
      } else {
        totalLoanAssets = 0;
        console.log(`No loan assets found`);
      }

      // Calculate cash balances
      const cashInHand = periodicData.cashInHandAtEndOfPeriod || 0;
      const cashInBank = periodicData.cashInBankAtEndOfPeriod || 0;
      const totalCash = cashInHand + cashInBank;

      // Calculate total group standing using the correct formula:
      // Total Standing = Cash in Hand + Cash in Bank + Total Loan Assets
      const totalGroupStandingAtEndOfPeriod = totalCash + totalLoanAssets;

      // DEBUGGING: Log periodic record calculation
      console.log('\n=== PERIODIC RECORD CREATION CALCULATION ===');
      console.log(`Group ID: ${actualGroupId}`);
      console.log(`Cash in Hand: ₹${cashInHand}`);
      console.log(`Cash in Bank: ₹${cashInBank}`);
      console.log(`Total Cash: ₹${totalCash}`);
      console.log(`Active Loans Count: ${activeLoans.length}`);
      console.log(`Total Loan Assets: ₹${totalLoanAssets}`);
      activeLoans.forEach(loan => {
        console.log(`  - Loan ${loan.id}: ₹${loan.currentBalance || 0} (${loan.status})`);
      });
      console.log(`Formula: ₹${totalCash} + ₹${totalLoanAssets} = ₹${totalGroupStandingAtEndOfPeriod}`);
      console.log(`Standing at Start of Period: ₹${standingAtStartOfPeriod}`);
      console.log(`Record Sequence Number: ${nextRecordSequenceNumber}`);
      console.log('============================================');

      console.log(`Calculating total standing: Cash(${totalCash}) + Loans(${totalLoanAssets}) = ${totalGroupStandingAtEndOfPeriod}`);

      // Create the periodic record
      const dataForCreate: Prisma.GroupPeriodicRecordUncheckedCreateInput = {
        groupId: actualGroupId,
        meetingDate: new Date(periodicData.meetingDate),
        recordSequenceNumber: nextRecordSequenceNumber,
        standingAtStartOfPeriod: standingAtStartOfPeriod,
        totalGroupStandingAtEndOfPeriod: totalGroupStandingAtEndOfPeriod,
        newContributionsThisPeriod: periodicData.newContributionsThisPeriod || null,
        lateFinesCollectedThisPeriod: periodicData.lateFinesCollectedThisPeriod || null,
        cashInBankAtEndOfPeriod: cashInBank,
        cashInHandAtEndOfPeriod: cashInHand,
        totalCollectionThisPeriod: periodicData.totalCollectionThisPeriod || null,
        expensesThisPeriod: periodicData.expensesThisPeriod || null,
        interestEarnedThisPeriod: periodicData.interestEarnedThisPeriod || null,
        loanProcessingFeesCollectedThisPeriod: periodicData.loanProcessingFeesCollectedThisPeriod || null,
        newMembersJoinedThisPeriod: periodicData.newMembersJoinedThisPeriod || null,
      };

      const createdRecord = await tx.groupPeriodicRecord.create({
        data: dataForCreate
      });

      return tx.groupPeriodicRecord.findUnique({
        where: { id: createdRecord.id },
        include: { memberContributions: true }, 
      });
    });

    return NextResponse.json(newRecord, { status: 201 });
  } catch (error) {
    console.error("Failed to create periodic record:", error);
    if (error instanceof Error && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A periodic record for this meeting date already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Failed to create periodic record' }, { status: 500 });
  }
}

// GET /api/groups/{groupId}/periodic-records
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idFromParams } = await params;
  
  if (!idFromParams) {
    return NextResponse.json({ error: 'Group ID is required' }, { status: 400 });
  }

  const objectIdRegex = /^[0-9a-fA-F]{24}$/;

  try {
    let group;
    if (objectIdRegex.test(idFromParams)) {
      // If idFromParams looks like an ObjectId, try finding by id first
      group = await prisma.group.findUnique({
        where: { id: idFromParams },
      });
    } else {
      // If idFromParams doesn't look like an ObjectId, try finding by name
      group = await prisma.group.findFirst({
        where: { name: idFromParams },
      });
    }

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const actualGroupId = group.id;

    // Get all periodic records for this group
    const records = await prisma.groupPeriodicRecord.findMany({
      where: { groupId: actualGroupId },
      include: {
        memberContributions: {
          include: {
            member: {
              select: { name: true }
            }
          }
        }
      },
      orderBy: [
        { meetingDate: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    // DEBUGGING: Log retrieved records for comparison
    console.log('\n=== PERIODIC RECORDS RETRIEVAL ===');
    console.log(`Group ID: ${actualGroupId}`);
    console.log(`Found ${records.length} periodic records`);
    
    records.forEach((record, index) => {
      console.log(`Record ${index + 1} (Sequence ${record.recordSequenceNumber}):`);
      console.log(`  - Meeting Date: ${record.meetingDate}`);
      console.log(`  - Cash in Hand: ₹${record.cashInHandAtEndOfPeriod || 0}`);
      console.log(`  - Cash in Bank: ₹${record.cashInBankAtEndOfPeriod || 0}`);
      console.log(`  - Stored Total Standing: ₹${record.totalGroupStandingAtEndOfPeriod || 0}`);
      console.log(`  - Standing at Start: ₹${record.standingAtStartOfPeriod || 0}`);
    });
    console.log('=====================================');

    // For each record, recalculate the total standing to ensure it's correct
    const recordsWithCorrectStanding = await Promise.all(records.map(async (r) => {
      // FIXED: Use consistent loan calculation method matching period closing logic
      
      // Method 1: Get membership loan assets (most reliable)
      const membershipLoanAssets = await prisma.memberGroupMembership.aggregate({
        where: {
          groupId: actualGroupId
        },
        _sum: {
          currentLoanAmount: true
        }
      });
      const totalLoanAssetsFromMemberships = membershipLoanAssets._sum.currentLoanAmount || 0;

      // Method 2: Get active loans for the group at the time of this record
      const activeLoans = await prisma.loan.findMany({
        where: {
          groupId: actualGroupId,
          status: 'ACTIVE',
          // Only include loans created before or on this record's date
          createdAt: {
            lte: r.meetingDate
          }
        }
      });
      const totalLoanAssetsFromActiveLoans = activeLoans.reduce(
        (sum, loan) => sum + (loan.currentBalance || 0), 0
      );

      // Use the same priority logic as period closing for consistency
      let totalLoanAssets = 0;
      if (totalLoanAssetsFromMemberships > 0) {
        totalLoanAssets = totalLoanAssetsFromMemberships;
      } else if (totalLoanAssetsFromActiveLoans > 0) {
        totalLoanAssets = totalLoanAssetsFromActiveLoans;
      } else {
        totalLoanAssets = 0;
      }

      const cashInHand = r.cashInHandAtEndOfPeriod || 0;
      const cashInBank = r.cashInBankAtEndOfPeriod || 0;
      const totalCash = cashInHand + cashInBank;

      // Calculate correct total standing
      const correctTotalStanding = totalCash + totalLoanAssets;

      // DEBUGGING: Log recalculation for each record
      console.log(`\nRecalculating Record ${r.recordSequenceNumber} (${r.meetingDate}):`);
      console.log(`  Cash in Hand: ₹${cashInHand}`);
      console.log(`  Cash in Bank: ₹${cashInBank}`);
      console.log(`  Total Cash: ₹${totalCash}`);
      console.log(`  Membership Loans: ₹${totalLoanAssetsFromMemberships}`);
      console.log(`  Active Loans (${activeLoans.length}): ₹${totalLoanAssetsFromActiveLoans}`);
      console.log(`  Used Loan Assets: ₹${totalLoanAssets}`);
      console.log(`  Stored Standing: ₹${r.totalGroupStandingAtEndOfPeriod || 0}`);
      console.log(`  Recalculated Standing: ₹${correctTotalStanding}`);
      console.log(`  Match: ${(r.totalGroupStandingAtEndOfPeriod || 0) === correctTotalStanding ? 'YES ✓' : 'NO ✗'}`);

      return {
        id: r.id,
        meetingDate: r.meetingDate,
        recordSequenceNumber: r.recordSequenceNumber,
        standingAtStartOfPeriod: r.standingAtStartOfPeriod,
        totalGroupStandingAtEndOfPeriod: correctTotalStanding
      };
    }));

    return NextResponse.json(recordsWithCorrectStanding);
  } catch (error) {
    console.error("Failed to fetch periodic records:", error);
    return NextResponse.json({ error: 'Failed to fetch periodic records' }, { status: 500 });
  }
}
