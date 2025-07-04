import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/app/lib/auth-config';
import { calculatePeriodInterestFromDecimal } from '@/app/lib/interest-utils';
import { validateAndRecalculateLateFines, calculateLateFineAmount } from '@/app/lib/late-fine-utils';
import { calculatePeriodDueDate, calculateDaysLate } from '@/app/lib/due-date-utils';

const prisma = new PrismaClient();

// POST: Close current period and create new one
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
    const { periodId, memberContributions, actualContributions } = body;

    // **DIAGNOSTIC LOGGING** - Track close period request
    console.log('🏁 [CLOSE PERIOD API] Starting period close...');
    console.log('   - Group ID:', groupId);
    console.log('   - Period ID to close:', periodId);
    console.log('   - User ID:', session.user.id);
    console.log('   - Member Contributions Count:', memberContributions?.length || 0);
    console.log('   - Actual Contributions Count:', Object.keys(actualContributions || {}).length);

    // Verify user has edit permissions for this group and fetch collection schedule
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        lateFineRules: {
          include: {
            tierRules: true
          }
        }
      }
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const isLeader = group.leaderId === session.user.memberId;

    if (!isLeader) {
      return NextResponse.json({ error: 'Only group leaders can close periods' }, { status: 403 });
    }

    console.log('🏁 [CLOSE PERIOD API] Authorization successful, user is group leader');
    console.log('🏁 [COLLECTION SCHEDULE] Group collection frequency:', group.collectionFrequency);
    console.log('🏁 [COLLECTION SCHEDULE] Collection day of month:', group.collectionDayOfMonth);
    console.log('🏁 [COLLECTION SCHEDULE] Collection day of week:', group.collectionDayOfWeek);

    // **LATE FINE VALIDATION** - Recalculate late fines based on group's actual collection schedule
    console.log('🏁 [LATE FINE VALIDATION] Validating late fines against group schedule...');
    
    // Get the active late fine rule for the group
    const lateFineRule = group.lateFineRules?.find(rule => rule.isEnabled) || null;
    console.log('🏁 [LATE FINE RULE]:', lateFineRule ? 
      `${lateFineRule.ruleType} rule enabled` : 'No active late fine rule');
    
    // Get the current period start date to calculate due dates
    const periodInfo = await prisma.groupPeriodicRecord.findUnique({
      where: { id: periodId },
      select: { 
        totalCollectionThisPeriod: true,
        recordSequenceNumber: true,
        groupId: true,
        createdAt: true,
        updatedAt: true,
        meetingDate: true
      }
    });
    
    if (!periodInfo) {
      return NextResponse.json({ error: 'Period not found' }, { status: 404 });
    }

    // **DEBUGGING: Log all date references for analysis**
    console.log('🔍 [DATE ANALYSIS] Period date references:');
    console.log(`   - Period ID: ${periodId}`);
    console.log(`   - Created At: ${periodInfo.createdAt.toISOString()}`);
    console.log(`   - Meeting Date: ${periodInfo.meetingDate.toISOString()}`);
    console.log(`   - Updated At: ${periodInfo.updatedAt.toISOString()}`);
    console.log(`   - Current Time: ${new Date().toISOString()}`);

    // **DEBUGGING: Log collection schedule in detail**
    console.log('🔍 [COLLECTION SCHEDULE] Group collection configuration:');
    console.log(`   - Frequency: ${group.collectionFrequency}`);
    console.log(`   - Day of Month: ${group.collectionDayOfMonth} (type: ${typeof group.collectionDayOfMonth})`);
    console.log(`   - Day of Week: ${group.collectionDayOfWeek} (type: ${typeof group.collectionDayOfWeek})`);
    console.log(`   - Week of Month: ${group.collectionWeekOfMonth} (type: ${typeof group.collectionWeekOfMonth})`);

    // **DEBUGGING: Test due date calculation with both reference dates**
    const testDueDateWithCreated = calculatePeriodDueDate({
      collectionFrequency: group.collectionFrequency,
      collectionDayOfMonth: group.collectionDayOfMonth,
      collectionDayOfWeek: group.collectionDayOfWeek,
      collectionWeekOfMonth: group.collectionWeekOfMonth
    }, periodInfo.createdAt);

    const testDueDateWithMeeting = calculatePeriodDueDate({
      collectionFrequency: group.collectionFrequency,
      collectionDayOfMonth: group.collectionDayOfMonth,
      collectionDayOfWeek: group.collectionDayOfWeek,
      collectionWeekOfMonth: group.collectionWeekOfMonth
    }, periodInfo.meetingDate);

    console.log('🔍 [DUE DATE TEST] Due date calculations:');
    console.log(`   - Using createdAt (${periodInfo.createdAt.toISOString()}): ${testDueDateWithCreated.toISOString()}`);
    console.log(`   - Using meetingDate (${periodInfo.meetingDate.toISOString()}): ${testDueDateWithMeeting.toISOString()}`);

    // **DEBUGGING: Test days late calculation with current time**
    const currentTime = new Date();
    const daysLateFromCreated = calculateDaysLate(testDueDateWithCreated, currentTime);
    const daysLateFromMeeting = calculateDaysLate(testDueDateWithMeeting, currentTime);

    console.log('🔍 [DAYS LATE TEST] Days late calculations (from current time):');
    console.log(`   - From createdAt due date: ${daysLateFromCreated} days`);
    console.log(`   - From meetingDate due date: ${daysLateFromMeeting} days`);
    console.log(`   - Time diff (created): ${(currentTime.getTime() - testDueDateWithCreated.getTime()) / (1000 * 60 * 60 * 24)} days (raw)`);
    console.log(`   - Time diff (meeting): ${(currentTime.getTime() - testDueDateWithMeeting.getTime()) / (1000 * 60 * 60 * 24)} days (raw)`);

    // **DEBUGGING: Analyze member contributions data from frontend**
    console.log('🔍 [FRONTEND DATA] Member contributions received:');
    memberContributions.forEach((mc: any, index: number) => {
      console.log(`   Member ${index + 1} (${mc.memberId}):`);
      console.log(`     - Expected Contribution: ₹${mc.expectedContribution}`);
      console.log(`     - Late Fine Amount: ₹${mc.lateFineAmount}`);
      console.log(`     - Days Late: ${mc.daysLate}`);
      console.log(`     - Remaining Amount: ₹${mc.remainingAmount}`);
    });

    // **DEBUGGING: Analyze actual contributions data**
    console.log('🔍 [ACTUAL CONTRIBUTIONS] Payment data:');
    Object.entries(actualContributions).forEach(([memberId, contrib]: [string, any]) => {
      console.log(`   Member ${memberId}:`);
      console.log(`     - Total Paid: ₹${contrib.totalPaid || 0}`);
      console.log(`     - Loan Interest Paid: ₹${contrib.loanInterestPaid || 0}`);
      console.log(`     - Paid Date: ${contrib.paidDate || 'Not set'}`);
      
      // Test due date calculation for this member's payment
      if (contrib.paidDate) {
        const paymentDate = new Date(contrib.paidDate);
        const daysLateForPayment = calculateDaysLate(testDueDateWithCreated, paymentDate);
        const memberContrib = memberContributions.find((mc: any) => mc.memberId === memberId);
        console.log(`     - Payment Date: ${paymentDate.toISOString()}`);
        console.log(`     - Days late for this payment: ${daysLateForPayment}`);
        
        // Test late fine calculation
        if (lateFineRule && memberContrib) {
          const testLateFine = calculateLateFineAmount(lateFineRule, daysLateForPayment, memberContrib.expectedContribution || 100);
          console.log(`     - Calculated late fine: ₹${testLateFine}`);
        }
      }
    });

    // Validate and recalculate late fines based on actual group schedule
    const groupSchedule = {
      collectionFrequency: group.collectionFrequency,
      collectionDayOfMonth: group.collectionDayOfMonth,
      collectionDayOfWeek: group.collectionDayOfWeek,
      collectionWeekOfMonth: group.collectionWeekOfMonth
    };

    const validatedContributions = validateAndRecalculateLateFines(
      memberContributions,
      periodInfo.createdAt, // Use period creation date as period start
      groupSchedule,
      lateFineRule
    );

    // **DEBUGGING: Log validation results in detail**
    console.log('🔍 [VALIDATION RESULTS] Late fine validation outcomes:');
    validatedContributions.forEach((vc, index) => {
      console.log(`   Member ${index + 1} (${vc.memberId}):`);
      console.log(`     - Original Late Fine: ₹${vc.originalLateFineAmount}`);
      console.log(`     - Recalculated Late Fine: ₹${vc.lateFineAmount}`);
      console.log(`     - Original Days Late: ${memberContributions.find((mc: any) => mc.memberId === vc.memberId)?.daysLate || 'Unknown'}`);
      console.log(`     - Recalculated Days Late: ${vc.daysLate}`);
      console.log(`     - Expected Contribution: ₹${vc.expectedContribution}`);
      console.log(`     - Needs Correction: ${vc.recalculated ? 'YES' : 'NO'}`);
      if (vc.recalculated) {
        const originalMC = memberContributions.find((mc: any) => mc.memberId === vc.memberId);
        console.log(`     - Difference in Fine: ₹${vc.lateFineAmount - vc.originalLateFineAmount}`);
        console.log(`     - Difference in Days: ${vc.daysLate - (originalMC?.daysLate || 0)}`);
      }
    });

    // Log any discrepancies found
    const recalculatedCount = validatedContributions.filter(vc => vc.recalculated).length;
    if (recalculatedCount > 0) {
      console.log(`🏁 [LATE FINE CORRECTION] Recalculated late fines for ${recalculatedCount} members:`);
      validatedContributions
        .filter(vc => vc.recalculated)
        .forEach(vc => {
          console.log(`  Member ${vc.memberId}: ₹${vc.originalLateFineAmount} → ₹${vc.lateFineAmount} (${vc.daysLate} days late)`);
        });
      
      // Update memberContributions array with corrected values
      memberContributions.forEach((mc: any, index: number) => {
        const validated = validatedContributions.find(vc => vc.memberId === mc.memberId);
        if (validated) {
          memberContributions[index] = {
            ...mc,
            lateFineAmount: validated.lateFineAmount,
            daysLate: validated.daysLate
          };
        }
      });
    } else {
      console.log('🏁 [LATE FINE VALIDATION] All late fine calculations are correct');
    }

    // Pre-fetch member data outside transaction to reduce transaction time
    console.log('Pre-fetching member data...');
    const memberIds = memberContributions.map((mc: any) => mc.memberId);
    const memberRecords = await prisma.member.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, currentLoanAmount: true }
    });
    
    const memberLoanMap = memberRecords.reduce((map, member) => {
      map[member.id] = member.currentLoanAmount || 0;
      return map;
    }, {} as Record<string, number>);

    // Calculate totals outside transaction
    const totalCollected = Object.values(actualContributions).reduce((sum: number, contrib: any) => 
      sum + (contrib.totalPaid || 0), 0
    );

    const totalLateFines = memberContributions.reduce((sum: any, contrib: any) => 
      sum + contrib.lateFineAmount, 0
    );

    const totalInterest = Object.values(actualContributions).reduce((sum: number, contrib: any) => 
      sum + (contrib.loanInterestPaid || 0), 0
    );

    // Calculate total loan assets from all members (use this for both closed and new period)
    const totalLoanAssets = Object.values(memberLoanMap).reduce((sum, loanAmount) => sum + loanAmount, 0);

    // DEBUGGING: Log detailed calculation breakdown
    console.log('=== PERIOD CLOSING CALCULATION BREAKDOWN ===');
    console.log(`Total Collected: ₹${totalCollected}`);
    console.log(`Total Late Fines: ₹${totalLateFines}`);
    console.log(`Total Interest: ₹${totalInterest}`);
    console.log(`Total Loan Assets from Member Records: ₹${totalLoanAssets}`);
    
    console.log('\nMember Loan Breakdown:');
    memberRecords.forEach(member => {
      console.log(`  Member ${member.id}: ₹${member.currentLoanAmount || 0}`);
    });
    
    console.log('\nActual Contributions Breakdown:');
    Object.entries(actualContributions).forEach(([memberId, contrib]: [string, any]) => {
      console.log(`  Member ${memberId}: Total Paid ₹${contrib.totalPaid || 0}, Loan Interest ₹${contrib.loanInterestPaid || 0}`);
    });
    
    console.log('================================================');

    // Check if this is an auto-created period before starting transactions
    // (we already have periodInfo with the same data)
    const currentPeriodInfo = periodInfo;
    
    // Improved auto-created period detection:
    // A period is considered auto-created if:
    // 1. It has totalCollectionThisPeriod = 0 AND
    // 2. Either no actual contributions have been made OR all contributions are still at ₹0
    const totalActualPayments = Object.values(actualContributions).reduce((sum: number, contrib: any) => 
      sum + (contrib.totalPaid || 0), 0
    );
    
    // Auto-created period: has no collection recorded AND no actual payments being processed
    const isAutoCreatedPeriod = currentPeriodInfo.totalCollectionThisPeriod === 0 && totalActualPayments === 0;
    console.log(`Period detection: ${isAutoCreatedPeriod ? 'Auto-created period (will update existing)' : 'Regular period (will ensure next period exists)'}`);
    console.log(`  - Current totalCollection: ₹${currentPeriodInfo.totalCollectionThisPeriod}`);
    console.log(`  - Actual payments being processed: ₹${totalActualPayments}`);

    // First, update member contributions in separate smaller transactions
    console.log(`Updating ${memberContributions.length} member contributions in separate batches...`);
    const memberUpdateStart = Date.now();
    
    const batchSize = 5; // Small batch size to avoid timeouts
    
    for (let i = 0; i < memberContributions.length; i += batchSize) {
      const batch = memberContributions.slice(i, i + batchSize);
      
      // Process this batch in a separate transaction
      await prisma.$transaction(async (tx) => {
        const updatePromises = [];
        
        for (const memberContrib of batch) {
          const actualContrib = actualContributions[memberContrib.memberId];
          
          if (actualContrib) {
            updatePromises.push(
              tx.memberContribution.update({
                where: { id: actualContrib.id },
                data: {
                  status: memberContrib.remainingAmount > 0 ? 'OVERDUE' : 'PAID',
                  remainingAmount: memberContrib.remainingAmount,
                  daysLate: memberContrib.daysLate,
                  lateFineAmount: memberContrib.lateFineAmount,
                }
              })
            );
          }
        }
        
        await Promise.all(updatePromises);
      }, {
        timeout: 10000, // 10 second timeout for smaller batches
      });
      
      console.log(`Updated batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(memberContributions.length / batchSize)}`);
    }
    
    console.log(`All member contributions updated in ${Date.now() - memberUpdateStart}ms`);

    // Start main transaction to close period and create new one (reduced workload)
    console.log('Starting main period closing transaction...');
    const transactionStart = Date.now();
    
    const result = await prisma.$transaction(async (tx) => {
      // Note: We're now returning a result object that could indicate "already closed"
      console.log('Transaction started - fetching current period...');
      const stepStart = Date.now();
      
      // Get current period data and check if it's already closed
      // Use FOR UPDATE to lock the row and prevent concurrent modifications
      const currentPeriod = await tx.groupPeriodicRecord.findUnique({
        where: { id: periodId },
        select: { 
          id: true, 
          groupId: true,
          recordSequenceNumber: true,
          totalCollectionThisPeriod: true,
          updatedAt: true,
          meetingDate: true, // Add meetingDate for next period calculation
          memberContributions: {
            select: { id: true, memberId: true }
          }
        }
      });

      console.log(`Period fetch completed in ${Date.now() - stepStart}ms`);

      if (!currentPeriod) {
        throw new Error('Period not found');
      }

      // Determine if this is an auto-created period that should be updated rather than creating new
      // Auto-created periods have totalCollectionThisPeriod as 0 and no actual collections being processed
      const isAutoCreatedPeriod = currentPeriod.totalCollectionThisPeriod === 0 && totalCollected === 0;
      
      // Check if the period has already been processed (has real collection data)
      const isPeriodAlreadyProcessed = currentPeriod.totalCollectionThisPeriod !== null && 
                                     currentPeriod.totalCollectionThisPeriod > 0;
      
      if (isPeriodAlreadyProcessed) {
        // Check if the previous attempt might have failed partway through
        // (having a value but recent update within the last hour suggests a partial update)
        const isRecentlyUpdated = currentPeriod.updatedAt && 
          (new Date().getTime() - currentPeriod.updatedAt.getTime() < 3600000); // 1 hour
        
        // If it's a recent update, we might be retrying a failed operation - allow it
        if (!isRecentlyUpdated) {
          console.log('Period already closed:', {
            periodId,
            totalCollection: currentPeriod.totalCollectionThisPeriod,
            updatedAt: currentPeriod.updatedAt
          });
          
          return {
            success: false,
            message: 'Period has already been closed',
            error: 'Period has already been closed',
            periodId: currentPeriod.id,
            alreadyClosed: true,
            closedAt: currentPeriod.updatedAt
          };
        } else {
          console.log('Period appears to be partially closed (recent update). Allowing retry:', {
            periodId,
            totalCollection: currentPeriod.totalCollectionThisPeriod,
            updatedAt: currentPeriod.updatedAt,
            timeSinceUpdate: `${(new Date().getTime() - currentPeriod.updatedAt.getTime())/1000} seconds`
          });
          // Continue with the closing process to ensure it completes fully
        }
      }

      // Additional safety check: verify no other transaction has created a newer period
      // in the last few seconds (which could indicate concurrent processing)
      const recentPeriods = await tx.groupPeriodicRecord.findMany({
        where: { 
          groupId: currentPeriod.groupId,
          recordSequenceNumber: {
            gte: currentPeriod.recordSequenceNumber || 0
          },
          createdAt: {
            gte: new Date(Date.now() - 10000) // Check last 10 seconds
          }
        },
        orderBy: { recordSequenceNumber: 'desc' }
      });

      if (recentPeriods.length > 1 || 
          (recentPeriods.length === 1 && recentPeriods[0]?.id !== currentPeriod.id)) {
        console.log('Concurrent period creation detected:', recentPeriods);
        throw new Error('A newer period already exists. This period has been closed.');
      }

      // Update the period record with closing data
      console.log('Updating period record...');
      const updateStart = Date.now();
      
      // Calculate detailed cash allocation from actual contributions
      let periodCashInHand = 0;
      let periodCashInBank = 0;
      
      // DEBUGGING: Log cash allocation calculations
      console.log('\n=== CASH ALLOCATION CALCULATION ===');
      console.log(`Starting Cash in Hand: ₹${group.cashInHand || 0}`);
      console.log(`Starting Cash in Bank: ₹${group.balanceInBank || 0}`);
      console.log('\nProcessing actual contributions for cash allocation:');
      
      Object.entries(actualContributions).forEach(([memberId, record]: [string, any]) => {
        let memberCashToHand = 0;
        let memberCashToBank = 0;
        
        if (record.cashAllocation) {
          try {
            const allocation = JSON.parse(record.cashAllocation);
            memberCashToHand = (allocation.contributionToCashInHand || 0) + (allocation.interestToCashInHand || 0);
            memberCashToBank = (allocation.contributionToCashInBank || 0) + (allocation.interestToCashInBank || 0);
            console.log(`  Member ${memberId} (custom allocation): Hand +₹${memberCashToHand}, Bank +₹${memberCashToBank}`);
          } catch (_e) {
            // If parsing fails, use default allocation
            memberCashToHand = (record.totalPaid || 0) * 0.3;
            memberCashToBank = (record.totalPaid || 0) * 0.7;
            console.log(`  Member ${memberId} (allocation parse failed, using default): Hand +₹${memberCashToHand}, Bank +₹${memberCashToBank}`);
          }
        } else {
          // Default allocation (30% to hand, 70% to bank) if no specific allocation
          memberCashToHand = (record.totalPaid || 0) * 0.3;
          memberCashToBank = (record.totalPaid || 0) * 0.7;
          console.log(`  Member ${memberId} (default 30/70 allocation): Total ₹${record.totalPaid || 0} -> Hand +₹${memberCashToHand}, Bank +₹${memberCashToBank}`);
        }
        
        periodCashInHand += memberCashToHand;
        periodCashInBank += memberCashToBank;
      });
      
      console.log(`\nTotal Period Cash to Hand: ₹${periodCashInHand}`);
      console.log(`Total Period Cash to Bank: ₹${periodCashInBank}`);
      console.log(`Total Period Cash Allocation: ₹${periodCashInHand + periodCashInBank}`);
      console.log(`Expected Total Collection: ₹${totalCollected}`);
      console.log(`Cash Allocation vs Collection Match: ${Math.abs((periodCashInHand + periodCashInBank) - totalCollected) < 0.01 ? 'YES ✓' : 'NO ✗'}`);
      
      // Calculate ending balances for the closed period
      const startingCashInHand = group.cashInHand || 0;
      const startingCashInBank = group.balanceInBank || 0;
      const endingCashInHand = startingCashInHand + periodCashInHand;
      const endingCashInBank = startingCashInBank + periodCashInBank;
      
      console.log(`\nEnding Cash in Hand: ₹${startingCashInHand} + ₹${periodCashInHand} = ₹${endingCashInHand}`);
      console.log(`Ending Cash in Bank: ₹${startingCashInBank} + ₹${periodCashInBank} = ₹${endingCashInBank}`);
      console.log('=====================================');
      
      // FIXED: Calculate total loan assets directly from active loans - this is the most accurate method
      console.log('\n🔍 DEBUGGING LOAN ASSETS CALCULATION IN PERIOD CLOSING:');
      console.log('========================================================');
      
      // Method 3: Active loans (most accurate when available)
      const activeLoans = await tx.loan.aggregate({
        where: {
          groupId: groupId,
          status: 'ACTIVE'
        },
        _sum: {
          currentBalance: true
        }
      });
      const loanAssetsFromActiveLoans = activeLoans._sum.currentBalance || 0;
      console.log(`Method 3 (active loan.currentBalance): ₹${loanAssetsFromActiveLoans}`);
      
      // Method 2: Correct method (membership.currentLoanAmount) as fallback
      const membershipLoanAssets = await tx.memberGroupMembership.aggregate({
        where: {
          groupId: groupId
        },
        _sum: {
          currentLoanAmount: true
        }
      });
      const loanAssetsFromMemberships = membershipLoanAssets._sum.currentLoanAmount || 0;
      console.log(`Method 2 (membership.currentLoanAmount): ₹${loanAssetsFromMemberships}`);
      
      // Method 1: Previous method (member.currentLoanAmount - likely wrong)
      const currentTotalLoanAssets = await tx.member.aggregate({
        where: {
          memberships: {
            some: { groupId: groupId }
          }
        },
        _sum: {
          currentLoanAmount: true
        }
      });
      const loanAssetsFromMembers = currentTotalLoanAssets._sum.currentLoanAmount || 0;
      console.log(`Method 1 (member.currentLoanAmount): ₹${loanAssetsFromMembers}`);
      
      // FIXED: Use the most reliable calculation method consistently
      // Based on analysis: membership.currentLoanAmount has the correct data
      // Priority: Membership loans > Active loans > Member loans (for backward compatibility)
      let actualTotalLoanAssets = 0;
      if (loanAssetsFromMemberships > 0) {
        actualTotalLoanAssets = loanAssetsFromMemberships;
        console.log(`✅ Using Method 2: ₹${actualTotalLoanAssets} (membership loans - most reliable)`);
      } else if (loanAssetsFromActiveLoans > 0) {
        actualTotalLoanAssets = loanAssetsFromActiveLoans;
        console.log(`✅ Using Method 3: ₹${actualTotalLoanAssets} (active loans)`);
      } else {
        actualTotalLoanAssets = loanAssetsFromMembers;
        console.log(`⚠️ Using Method 1: ₹${actualTotalLoanAssets} (member loans - fallback)`);
      }
      console.log('================================================\n');
      
      // Calculate total group standing using correct formula:
      // Total Standing = Cash in Hand + Cash in Bank + Total Loan Assets
      const endingTotalGroupStanding = endingCashInHand + endingCashInBank + actualTotalLoanAssets;
      
      // DEBUGGING: Log final standing calculation
      console.log('\n=== FINAL STANDING CALCULATION ===');
      console.log(`Ending Cash in Hand: ₹${endingCashInHand}`);
      console.log(`Ending Cash in Bank: ₹${endingCashInBank}`);
      console.log(`Total Loan Assets: ₹${actualTotalLoanAssets}`);
      console.log(`Formula: ₹${endingCashInHand} + ₹${endingCashInBank} + ₹${actualTotalLoanAssets} = ₹${endingTotalGroupStanding}`);
      console.log('==================================');
      
      // Calculate number of members present (assuming all members with contributions are present)
      const membersPresent = Object.keys(actualContributions).length;
      
      console.log(`Closed period ending balances:
        - Starting Cash in Hand: ₹${startingCashInHand}
        - Period Cash to Hand: ₹${periodCashInHand}
        - Ending Cash in Hand: ₹${endingCashInHand}
        - Starting Cash in Bank: ₹${startingCashInBank}
        - Period Cash to Bank: ₹${periodCashInBank}
        - Ending Cash in Bank: ₹${endingCashInBank}
        - Current Total Loan Assets: ₹${actualTotalLoanAssets}
        - Total Group Standing: ₹${endingTotalGroupStanding}
        - Members Present: ${membersPresent}`);
      
      // FIXED: Get the full current period details to check for unrealistic starting values
      const fullCurrentPeriod = await tx.groupPeriodicRecord.findUnique({
        where: { id: periodId },
        select: { recordSequenceNumber: true, standingAtStartOfPeriod: true }
      });
      
      // If this is the first period and the starting amount looks suspiciously high
      // (more than 10x the current total), reset it to a more realistic value
      if (fullCurrentPeriod && 
          fullCurrentPeriod.recordSequenceNumber === 1 && 
          fullCurrentPeriod.standingAtStartOfPeriod && 
          fullCurrentPeriod.standingAtStartOfPeriod > (endingTotalGroupStanding * 10)) {
        console.log(`⚠️ First period has unrealistic starting value: ₹${fullCurrentPeriod.standingAtStartOfPeriod}`);
        console.log(`   Resetting to more realistic value based on current assets`);
        
        // For first period, starting standing should typically be cash + bank balances when group was created
        // If those values are unknown, we can use the ending values as an approximation
        const moreSensibleStartingValue = endingCashInHand + endingCashInBank;
        console.log(`   New starting value: ₹${moreSensibleStartingValue}`);
        
        // Update will be included in the main update below
        await tx.groupPeriodicRecord.update({
          where: { id: periodId },
          data: {
            standingAtStartOfPeriod: moreSensibleStartingValue
          }
        });
      }
      
      const closedPeriod = await tx.groupPeriodicRecord.update({
        where: { id: periodId },
        data: {
          // Core financial data
          totalCollectionThisPeriod: totalCollected,
          interestEarnedThisPeriod: totalInterest,
          lateFinesCollectedThisPeriod: totalLateFines,
          newContributionsThisPeriod: totalCollected - totalInterest - totalLateFines,
          
          // Detailed cash allocation as per contribution page state
          cashInHandAtEndOfPeriod: endingCashInHand,
          cashInBankAtEndOfPeriod: endingCashInBank,
          totalGroupStandingAtEndOfPeriod: endingTotalGroupStanding,
          
          // Member participation data
          membersPresent: membersPresent,
          
          // Timestamp of closure
          updatedAt: new Date(),
        }
      });

      console.log(`Period update completed in ${Date.now() - updateStart}ms`);

      // Member contributions have already been updated outside the transaction
      console.log('Member contributions already updated in separate batches');

      // Only create a new period if this is NOT an auto-created period
      // Auto-created periods should just be updated with the actual data
      let newPeriod = null;
      
      if (!isAutoCreatedPeriod) {
        // This is a real period closure, ensure there's a next period for tracking
        const nextPeriodNumber = (currentPeriod.recordSequenceNumber || 0) + 1;
        
        // Look for an existing auto-created period with the next sequence number
        const existingNextPeriod = await tx.groupPeriodicRecord.findFirst({
          where: {
            groupId: currentPeriod.groupId,
            recordSequenceNumber: nextPeriodNumber
          }
        });
        
        if (existingNextPeriod) {
          // There's already a next period - check if it's auto-created and can be updated
          const existingPeriodAge = new Date().getTime() - existingNextPeriod.createdAt.getTime();
          const isExistingAutoCreated = existingNextPeriod.totalCollectionThisPeriod === 0 && existingPeriodAge < 3600000; // 1 hour
          
          if (isExistingAutoCreated) {
            console.log(`Found existing auto-created period #${nextPeriodNumber} - updating it instead of creating new`);
            
            // Calculate the correct group standing including cash, bank balance, and loan assets
            const newCashInHand = endingCashInHand;
            const newCashInBank = endingCashInBank;
            const totalGroupStanding = newCashInHand + newCashInBank + totalLoanAssets;
            
            // Update the existing auto-created period with correct starting values
            newPeriod = await tx.groupPeriodicRecord.update({
              where: { id: existingNextPeriod.id },
              data: {
                standingAtStartOfPeriod: totalGroupStanding,
                cashInBankAtEndOfPeriod: newCashInBank,
                cashInHandAtEndOfPeriod: newCashInHand,
                totalGroupStandingAtEndOfPeriod: totalGroupStanding,
                updatedAt: new Date()
              }
            });
            
            console.log(`Updated existing auto-created period #${nextPeriodNumber}`);
          } else {
            console.log(`Existing period #${nextPeriodNumber} is not auto-created or too old - skipping new period creation`);
          }
        } else {
          // No existing next period, create a new one
          const nextPeriodDate = calculateNextPeriodDate(group.collectionFrequency || 'MONTHLY', currentPeriod.meetingDate);

          console.log('Creating new period for next cycle...');
          const newPeriodStart = Date.now();
          
          // Calculate the correct group standing including cash, bank balance, and loan assets
          const newCashInHand = endingCashInHand;
          const newCashInBank = endingCashInBank;
          const totalGroupStanding = newCashInHand + newCashInBank + totalLoanAssets;
          
          console.log(`New period calculations: 
            - Cash in Hand: ₹${newCashInHand}
            - Cash in Bank: ₹${newCashInBank} (calculated from allocation)
            - Total Loan Assets: ₹${totalLoanAssets}
            - Total Group Standing: ₹${totalGroupStanding}`);
          
          newPeriod = await tx.groupPeriodicRecord.create({
            data: {
              groupId,
              meetingDate: nextPeriodDate,
              recordSequenceNumber: nextPeriodNumber,
              totalCollectionThisPeriod: null, // Mark as OPEN period for contributions
              standingAtStartOfPeriod: totalGroupStanding,
              cashInBankAtEndOfPeriod: newCashInBank,
              cashInHandAtEndOfPeriod: newCashInHand,
              totalGroupStandingAtEndOfPeriod: totalGroupStanding,
              interestEarnedThisPeriod: null, // Mark as null for open period
              lateFinesCollectedThisPeriod: null, // Mark as null for open period
              newContributionsThisPeriod: null, // Mark as null for open period
            }
          });

          console.log(`New period created in ${Date.now() - newPeriodStart}ms`);
        }
      } else {
        console.log('Auto-created period detected - updating existing record and ensuring next period exists');
        
        // Even for auto-created periods that are being updated, we need to ensure there's a next period
        const nextPeriodNumber = (currentPeriod.recordSequenceNumber || 0) + 1;
        
        const existingNextPeriod = await tx.groupPeriodicRecord.findFirst({
          where: {
            groupId: currentPeriod.groupId,
            recordSequenceNumber: nextPeriodNumber
          }
        });
        
        if (!existingNextPeriod) {
          console.log('No next period found after auto-created period update - creating one');
          
          const nextPeriodDate = calculateNextPeriodDate(group.collectionFrequency || 'MONTHLY', currentPeriod.meetingDate);
          const newCashInHand = endingCashInHand;
          const newCashInBank = endingCashInBank;
          const totalGroupStanding = newCashInHand + newCashInBank + totalLoanAssets;
          
          newPeriod = await tx.groupPeriodicRecord.create({
            data: {
              groupId,
              meetingDate: nextPeriodDate,
              recordSequenceNumber: nextPeriodNumber,
              totalCollectionThisPeriod: null, // Mark as OPEN period for contributions
              standingAtStartOfPeriod: totalGroupStanding,
              cashInBankAtEndOfPeriod: newCashInBank,
              cashInHandAtEndOfPeriod: newCashInHand,
              totalGroupStandingAtEndOfPeriod: totalGroupStanding,
              interestEarnedThisPeriod: null, // Mark as null for open period
              lateFinesCollectedThisPeriod: null, // Mark as null for open period
              newContributionsThisPeriod: null, // Mark as null for open period
            }
          });
          
          console.log(`Created new period #${nextPeriodNumber} after auto-created period update`);
        } else {
          console.log('Next period already exists after auto-created period update');
        }
      }

      // Create new member contributions if we created a new period OR updated an existing auto-created period
      if (newPeriod) {
        // Check if this period already has member contributions
        const existingContributions = await tx.memberContribution.findMany({
          where: { groupPeriodicRecordId: newPeriod.id }
        });
        
        if (existingContributions.length === 0) {
          // Calculate next period date for new contributions
          const nextPeriodDate = calculateNextPeriodDate(group.collectionFrequency || 'MONTHLY', currentPeriod.meetingDate);
          
          // Prepare batch data for new member contributions
          console.log(`Creating ${memberContributions.length} new member contributions...`);
          const memberCreateStart = Date.now();
          
          const newMemberContributions = memberContributions.map((memberContrib: any) => {
            const carryForwardAmount = memberContrib.remainingAmount;
            const baseContribution = group.monthlyContribution || 0; // Same base amount for all members
            const currentLoanBalance = memberLoanMap[memberContrib.memberId] || 0;
            const interestRateDecimal = (group.interestRate || 0) / 100;
            // Fix: Calculate period-adjusted interest instead of annual interest
            const expectedInterest = calculatePeriodInterestFromDecimal(
              currentLoanBalance, 
              interestRateDecimal, 
              group.collectionFrequency || 'MONTHLY'
            );

            return {
              groupPeriodicRecordId: newPeriod.id,
              memberId: memberContrib.memberId,
              compulsoryContributionDue: baseContribution, // Same base amount for all members
              loanInterestDue: expectedInterest,
              minimumDueAmount: baseContribution + carryForwardAmount + expectedInterest, // Total includes carry-forward
              dueDate: nextPeriodDate,
              status: 'PENDING',
              compulsoryContributionPaid: 0,
              loanInterestPaid: 0,
              lateFinePaid: 0,
              totalPaid: 0,
              remainingAmount: baseContribution + carryForwardAmount + expectedInterest, // Total remaining includes carry-forward
              daysLate: 0,
              lateFineAmount: 0,
            };
          });

          // Use createMany for batch insert
          await tx.memberContribution.createMany({
            data: newMemberContributions
          });

          console.log(`New member contributions created in ${Date.now() - memberCreateStart}ms`);
          
          // **ENHANCED**: Ensure ALL group members have contributions, not just those who had contributions in previous period
          await ensureAllMembersHaveContributions(tx, groupId, newPeriod.id, group, memberLoanMap);
        } else {
          console.log(`Period already has ${existingContributions.length} member contributions - ensuring all members are covered`);
          // Even if contributions exist, make sure all active members are included
          await ensureAllMembersHaveContributions(tx, groupId, newPeriod.id, group, memberLoanMap);
        }
      } else {
        console.log('No new period created, skipping new member contributions setup');
      }

      // Update group cash balances to reflect the closed period collections
      // Use the actual cash allocation, not the total collection
      await tx.group.update({
        where: { id: groupId },
        data: {
          balanceInBank: endingCashInBank,
          cashInHand: endingCashInHand,
        }
      });

      return {
        closedPeriod,
        newPeriod
      };
    }, {
      timeout: 10000, // Reduced timeout since member updates are done separately
    });

    const transactionEnd = Date.now();
    console.log(`Transaction completed in ${transactionEnd - transactionStart}ms`);

    // Check if the result was an "already closed" message
    if (result.alreadyClosed) {
      return NextResponse.json({
        success: false,
        message: 'Period has already been closed',
        periodId: result.periodId,
        alreadyClosed: true
      }, { status: 409 }); // 409 Conflict status for already processed
    }
    
    // **DIAGNOSTIC LOGGING** - Track successful period close
    console.log('✅ [CLOSE PERIOD API] Period close successful!');
    console.log('   - Closed Period ID:', result.closedPeriod?.id);
    console.log('   - Closed Period Sequence:', result.closedPeriod?.recordSequenceNumber);
    console.log('   - New Period ID:', result.newPeriod?.id);
    console.log('   - New Period Sequence:', result.newPeriod?.recordSequenceNumber);
    console.log('   - New Period Date:', result.newPeriod?.meetingDate);
    console.log('   - Is Auto Created:', isAutoCreatedPeriod);
    
    // **ENHANCED**: Get the current period information for better frontend handling
    let currentPeriodAfterClosure = null;
    try {
      // Find the most recent open period after closure
      currentPeriodAfterClosure = await prisma.groupPeriodicRecord.findFirst({
        where: { 
          groupId,
          OR: [
            { totalCollectionThisPeriod: null },
            { totalCollectionThisPeriod: 0 }
          ]
        },
        orderBy: [
          { recordSequenceNumber: 'desc' },
          { meetingDate: 'desc' }
        ],
        select: {
          id: true,
          meetingDate: true,
          recordSequenceNumber: true,
          totalCollectionThisPeriod: true
        }
      });
      
      console.log('🔍 [SAFETY CHECK] Current period after closure:', currentPeriodAfterClosure?.id);
      
      // **CRITICAL SAFETY**: If no open period exists, create one immediately
      if (!currentPeriodAfterClosure) {
        console.log('⚠️ [SAFETY CHECK] NO OPEN PERIOD FOUND - Creating emergency period...');
        
        // Get the latest closed period to base the new period on
        const latestPeriod = await prisma.groupPeriodicRecord.findFirst({
          where: { groupId },
          orderBy: { recordSequenceNumber: 'desc' }
        });
        
        if (latestPeriod) {
          const nextPeriodNumber = (latestPeriod.recordSequenceNumber || 0) + 1;
          const nextPeriodDate = calculateNextPeriodDate(group.collectionFrequency || 'MONTHLY', latestPeriod.meetingDate);
          
          // Create emergency open period
          const emergencyPeriod = await prisma.groupPeriodicRecord.create({
            data: {
              groupId,
              meetingDate: nextPeriodDate,
              recordSequenceNumber: nextPeriodNumber,
              totalCollectionThisPeriod: null, // Mark as OPEN
              standingAtStartOfPeriod: latestPeriod.totalGroupStandingAtEndOfPeriod || 0,
              cashInBankAtEndOfPeriod: latestPeriod.cashInBankAtEndOfPeriod || 0,
              cashInHandAtEndOfPeriod: latestPeriod.cashInHandAtEndOfPeriod || 0,
              totalGroupStandingAtEndOfPeriod: latestPeriod.totalGroupStandingAtEndOfPeriod || 0,
              interestEarnedThisPeriod: null,
              lateFinesCollectedThisPeriod: null,
              newContributionsThisPeriod: null,
            }
          });
          
          // Create member contributions for emergency period
          const groupWithMembers = await prisma.group.findUnique({
            where: { id: groupId },
            include: {
              memberships: {
                include: { member: true }
              }
            }
          });
          
          if (groupWithMembers && groupWithMembers.memberships.length > 0) {
            const emergencyContributions = groupWithMembers.memberships.map((membership: any) => ({
              groupPeriodicRecordId: emergencyPeriod.id,
              memberId: membership.memberId,
              compulsoryContributionDue: group.monthlyContribution || 500,
              loanInterestDue: 0,
              minimumDueAmount: group.monthlyContribution || 500,
              dueDate: nextPeriodDate,
              status: 'PENDING' as const,
              compulsoryContributionPaid: 0,
              loanInterestPaid: 0,
              lateFinePaid: 0,
              totalPaid: 0,
              remainingAmount: group.monthlyContribution || 500,
              daysLate: 0,
              lateFineAmount: 0,
            }));
            
            await prisma.memberContribution.createMany({
              data: emergencyContributions
            });
            
            console.log(`✅ [SAFETY CHECK] Created emergency period ${emergencyPeriod.id} with ${emergencyContributions.length} member contributions`);
          }
          
          currentPeriodAfterClosure = {
            id: emergencyPeriod.id,
            meetingDate: emergencyPeriod.meetingDate,
            recordSequenceNumber: emergencyPeriod.recordSequenceNumber,
            totalCollectionThisPeriod: null
          };
        }
      }
      
      console.log('✅ [CLOSE PERIOD API] Current period after closure:', currentPeriodAfterClosure?.id);
    } catch (error) {
      console.error('❌ [CLOSE PERIOD API] Error getting current period after closure:', error);
      // Don't fail the entire operation if this fails
    }
    
    const responseData = {
      success: true,
      message: isAutoCreatedPeriod ? 'Period updated successfully' : 'Period closed successfully',
      record: result.closedPeriod,
      newPeriod: result.newPeriod || null,
      currentPeriod: currentPeriodAfterClosure, // **NEW**: Provide current period info
      isAutoCreatedPeriod: isAutoCreatedPeriod,
      // **NEW**: Enhanced transition info
      transition: {
        closedPeriodId: result.closedPeriod?.id,
        newPeriodId: result.newPeriod?.id || currentPeriodAfterClosure?.id,
        nextContributionTracking: result.newPeriod ? 'READY' : 'NEEDS_SETUP',
        hasNewPeriod: !!result.newPeriod,
        currentPeriodAvailable: !!currentPeriodAfterClosure
      }
    };
    
    console.log('🏁 [CLOSE PERIOD API] Sending response:', responseData);
    
    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error closing period:', error);
    
    // Provide more specific error messages for common issues
    if (error instanceof Error) {
      if (error.message.includes('P2028')) {
        return NextResponse.json(
          { error: 'Operation timeout - please try again. The system may be processing a large amount of data.' },
          { status: 500 }
        );
      }
      if (error.message.includes('Period not found')) {
        return NextResponse.json(
          { error: 'The specified period was not found' },
          { status: 404 }
        );
      }
      
      if (error.message.includes('Period has already been closed')) {
        return NextResponse.json(
          { 
            error: 'This period has already been closed',
            alreadyClosed: true
          },
          { status: 409 }  // 409 Conflict for already processed resources
        );
      }
      if (error.message.includes('Period has already been closed')) {
        return NextResponse.json(
          { error: 'This period has already been closed. Please refresh the page to see the latest data.' },
          { status: 409 }
        );
      }
      if (error.message.includes('A newer period already exists')) {
        return NextResponse.json(
          { error: 'A newer period already exists. This period has been closed. Please refresh the page to see the latest data.' },
          { status: 409 }
        );
      }
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to close period' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// **NEW**: Enhanced function to ensure all members have contributions in the new period
async function ensureAllMembersHaveContributions(
  tx: any, 
  groupId: string, 
  newPeriodId: string, 
  group: any, 
  memberLoanMap: Record<string, number>
) {
  console.log('🔍 Ensuring all group members have contributions in new period...');
  
  // Get all active members of the group
  const allMembers = await tx.memberGroupMembership.findMany({
    where: { 
      groupId: groupId
    },
    include: {
      member: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  // Get existing contributions for this period
  const existingContributions = await tx.memberContribution.findMany({
    where: { groupPeriodicRecordId: newPeriodId },
    select: { memberId: true }
  });

  const existingMemberIds = new Set(existingContributions.map((c: any) => c.memberId));
  const missingMembers = allMembers.filter((membership: any) => 
    !existingMemberIds.has(membership.member.id)
  );

  if (missingMembers.length > 0) {
    console.log(`📝 Creating contributions for ${missingMembers.length} missing members...`);
    
    const nextPeriodDate = calculateNextPeriodDate(group.collectionFrequency || 'MONTHLY');
    const baseContribution = group.monthlyContribution || 0;
    const interestRateDecimal = (group.interestRate || 0) / 100;

    const newContributions = missingMembers.map((membership: any) => {
      const memberId = membership.member.id;
      const currentLoanBalance = memberLoanMap[memberId] || 0;
      const expectedInterest = calculatePeriodInterestFromDecimal(
        currentLoanBalance, 
        interestRateDecimal, 
        group.collectionFrequency || 'MONTHLY'
      );

      return {
        groupPeriodicRecordId: newPeriodId,
        memberId: memberId,
        compulsoryContributionDue: baseContribution,
        loanInterestDue: expectedInterest,
        minimumDueAmount: baseContribution + expectedInterest,
        dueDate: nextPeriodDate,
        status: 'PENDING',
        compulsoryContributionPaid: 0,
        loanInterestPaid: 0,
        lateFinePaid: 0,
        totalPaid: 0,
        remainingAmount: baseContribution + expectedInterest,
        daysLate: 0,
        lateFineAmount: 0,
      };
    });

    await tx.memberContribution.createMany({
      data: newContributions
    });

    console.log(`✅ Created contributions for ${newContributions.length} additional members`);
  } else {
    console.log('✅ All members already have contributions in the new period');
  }
}

// Helper function to calculate next period date based on frequency
function calculateNextPeriodDate(frequency: string, baseDate?: Date): Date {
  const today = baseDate || new Date();
  
  switch (frequency) {
    case 'WEEKLY':
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      return nextWeek;
      
    case 'FORTNIGHTLY':
      const nextFortnight = new Date(today);
      nextFortnight.setDate(today.getDate() + 14);
      return nextFortnight;
      
    case 'MONTHLY':
      const nextMonth = new Date(today);
      nextMonth.setMonth(today.getMonth() + 1);
      // Ensure we're always moving forward, even if base date is in the past
      if (nextMonth <= new Date()) {
        nextMonth.setMonth(new Date().getMonth() + 1);
      }
      return nextMonth;
      
    case 'YEARLY':
      const nextYear = new Date(today);
      nextYear.setFullYear(today.getFullYear() + 1);
      return nextYear;
      
    default:
      // Default to monthly
      const defaultNext = new Date(today);
      defaultNext.setMonth(today.getMonth() + 1);
      // Ensure we're always moving forward
      if (defaultNext <= new Date()) {
        defaultNext.setMonth(new Date().getMonth() + 1);
      }
      return defaultNext;
  }
}
