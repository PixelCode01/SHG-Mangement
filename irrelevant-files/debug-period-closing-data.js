const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Debug script to identify data discrepancies when closing periods
 * This will help identify differences between frontend display and stored data
 */

async function debugPeriodClosing(groupId) {
  try {
    console.log('=== DEBUGGING PERIOD CLOSING DATA DISCREPANCY ===\n');
    
    // 1. Get group info
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          select: {
            id: true,
            name: true,
            currentLoanAmount: true,
            currentLoanBalance: true
          }
        }
      }
    });

    if (!group) {
      console.log('Group not found');
      return;
    }

    console.log('GROUP INFO:');
    console.log(`- Name: ${group.name}`);
    console.log(`- Monthly Contribution: ${group.monthlyContribution}`);
    console.log(`- Interest Rate: ${group.interestRate}%`);
    console.log(`- Members: ${group.members.length}`);
    console.log();

    // 2. Get current period
    const currentPeriod = await prisma.groupPeriodicRecord.findFirst({
      where: {
        groupId: groupId,
        OR: [
          { totalCollectionThisPeriod: null },
          { totalCollectionThisPeriod: undefined }
        ]
      },
      orderBy: { recordSequenceNumber: 'desc' }
    });

    if (!currentPeriod) {
      console.log('No open period found');
      return;
    }

    console.log('CURRENT PERIOD:');
    console.log(`- Period ID: ${currentPeriod.id}`);
    console.log(`- Sequence: ${currentPeriod.recordSequenceNumber}`);
    console.log(`- Meeting Date: ${currentPeriod.meetingDate}`);
    console.log(`- Is Closed: ${currentPeriod.totalCollectionThisPeriod !== null}`);
    console.log();

    // 3. Get current member contributions
    const memberContributions = await prisma.memberContribution.findMany({
      where: { groupPeriodicRecordId: currentPeriod.id },
      include: {
        member: {
          select: { id: true, name: true }
        }
      }
    });

    console.log('CURRENT MEMBER CONTRIBUTIONS FROM DATABASE:');
    console.log(`- Total records: ${memberContributions.length}`);
    
    // Calculate totals from DB
    let totalExpectedFromDB = 0;
    let totalPaidFromDB = 0;
    let totalRemainingFromDB = 0;
    
    memberContributions.forEach(contrib => {
      const expected = contrib.compulsoryContributionDue + (contrib.loanInterestDue || 0) + contrib.lateFineAmount;
      const remaining = contrib.remainingAmount || 0;
      
      totalExpectedFromDB += expected;
      totalPaidFromDB += contrib.totalPaid;
      totalRemainingFromDB += remaining;
      
      console.log(`  ${contrib.member.name}:`);
      console.log(`    - Contribution Due: ${contrib.compulsoryContributionDue}`);
      console.log(`    - Interest Due: ${contrib.loanInterestDue || 0}`);
      console.log(`    - Late Fine: ${contrib.lateFineAmount}`);
      console.log(`    - Total Expected: ${expected}`);
      console.log(`    - Total Paid: ${contrib.totalPaid}`);
      console.log(`    - Remaining: ${remaining}`);
      console.log(`    - Status: ${contrib.status}`);
      console.log();
    });

    console.log('DATABASE TOTALS:');
    console.log(`- Total Expected: ${totalExpectedFromDB}`);
    console.log(`- Total Paid: ${totalPaidFromDB}`);
    console.log(`- Total Remaining: ${totalRemainingFromDB}`);
    console.log();

    // 4. Simulate frontend calculation
    console.log('SIMULATING FRONTEND CALCULATION:');
    const expectedContribution = group.monthlyContribution || 0;
    const interestRate = (group.interestRate || 0) / 100;
    
    let frontendTotalExpected = 0;
    let frontendTotalRemaining = 0;
    
    group.members.forEach(member => {
      const currentLoanBalance = member.currentLoanBalance || 0;
      const expectedInterest = currentLoanBalance * interestRate;
      
      // Find the actual contribution record for this member
      const actualContrib = memberContributions.find(mc => mc.memberId === member.id);
      
      // Calculate what frontend would show
      const lateFineAmount = 0; // Simplified for now
      const totalExpected = expectedContribution + expectedInterest + lateFineAmount;
      const paidAmount = actualContrib ? actualContrib.totalPaid : 0;
      const remainingAmount = Math.max(0, totalExpected - paidAmount);
      
      frontendTotalExpected += totalExpected;
      frontendTotalRemaining += remainingAmount;
      
      console.log(`  ${member.name}:`);
      console.log(`    - Current Loan Balance: ${currentLoanBalance}`);
      console.log(`    - Expected Contribution: ${expectedContribution}`);
      console.log(`    - Expected Interest: ${expectedInterest}`);
      console.log(`    - Frontend Total Expected: ${totalExpected}`);
      console.log(`    - Frontend Remaining: ${remainingAmount}`);
      
      // Compare with DB values
      if (actualContrib) {
        const dbExpected = actualContrib.compulsoryContributionDue + (actualContrib.loanInterestDue || 0) + actualContrib.lateFineAmount;
        const dbRemaining = actualContrib.remainingAmount || 0;
        
        if (Math.abs(totalExpected - dbExpected) > 0.01) {
          console.log(`    ⚠️  MISMATCH: Frontend expected ${totalExpected}, DB has ${dbExpected}`);
        }
        if (Math.abs(remainingAmount - dbRemaining) > 0.01) {
          console.log(`    ⚠️  MISMATCH: Frontend remaining ${remainingAmount}, DB has ${dbRemaining}`);
        }
      }
      console.log();
    });

    console.log('FRONTEND TOTALS:');
    console.log(`- Total Expected: ${frontendTotalExpected}`);
    console.log(`- Total Remaining: ${frontendTotalRemaining}`);
    console.log();

    // 5. Show what would happen when closing
    console.log('WHAT WOULD HAPPEN WHEN CLOSING PERIOD:');
    
    group.members.forEach(member => {
      const actualContrib = memberContributions.find(mc => mc.memberId === member.id);
      const carryForwardAmount = actualContrib ? (actualContrib.remainingAmount || 0) : 0;
      const currentLoanBalance = member.currentLoanBalance || 0;
      const expectedInterest = currentLoanBalance * interestRate;
      
      const newCompulsoryDue = expectedContribution + carryForwardAmount;
      const newTotalDue = newCompulsoryDue + expectedInterest;
      
      console.log(`  ${member.name} - New Period:`);
      console.log(`    - Carry Forward: ${carryForwardAmount}`);
      console.log(`    - New Compulsory Due: ${newCompulsoryDue}`);
      console.log(`    - New Interest Due: ${expectedInterest}`);
      console.log(`    - New Total Due: ${newTotalDue}`);
      console.log();
    });

  } catch (error) {
    console.error('Error debugging period closing:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Usage: node debug-period-closing-data.js <groupId>
const groupId = process.argv[2];

if (!groupId) {
  console.log('Usage: node debug-period-closing-data.js <groupId>');
  process.exit(1);
}

debugPeriodClosing(groupId);
