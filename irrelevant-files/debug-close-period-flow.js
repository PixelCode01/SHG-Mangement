const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Comprehensive debug script to trace data flow during period closing
 * This simulates exactly what the frontend sends to the backend
 */

async function debugClosePeriodFlow(groupId) {
  try {
    console.log('=== DEBUGGING CLOSE PERIOD DATA FLOW ===\n');
    
    // 1. Get the exact data that the frontend would fetch
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          select: {
            id: true,
            memberId: true,
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

    // 2. Get current period (what frontend fetches)
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

    // 3. Get current contributions (actualContributions in frontend)
    const currentContributions = await prisma.memberContribution.findMany({
      where: { groupPeriodicRecordId: currentPeriod.id },
      include: {
        member: {
          select: { id: true, name: true }
        }
      }
    });

    // Convert to frontend format (actualContributions)
    const actualContributions = {};
    currentContributions.forEach(contrib => {
      actualContributions[contrib.memberId] = {
        id: contrib.id,
        groupPeriodicRecordId: contrib.groupPeriodicRecordId,
        memberId: contrib.memberId,
        member: contrib.member,
        compulsoryContributionDue: contrib.compulsoryContributionDue,
        loanInterestDue: contrib.loanInterestDue || 0,
        minimumDueAmount: contrib.minimumDueAmount,
        compulsoryContributionPaid: contrib.compulsoryContributionPaid,
        loanInterestPaid: contrib.loanInterestPaid,
        lateFinePaid: contrib.lateFinePaid,
        totalPaid: contrib.totalPaid,
        status: contrib.status,
        dueDate: contrib.dueDate.toISOString(),
        paidDate: contrib.paidDate?.toISOString(),
        daysLate: contrib.daysLate,
        lateFineAmount: contrib.lateFineAmount,
        remainingAmount: contrib.remainingAmount
      };
    });

    // 4. Simulate frontend calculateMemberContributions function
    const expectedContribution = group.monthlyContribution || 0;
    const interestRate = (group.interestRate || 0) / 100;
    const today = new Date();
    const dueDate = new Date(); // Simplified for debugging
    
    const memberContributions = group.members.map(member => {
      const currentLoanBalance = member.currentLoanBalance || 0;
      const expectedInterest = currentLoanBalance * interestRate;
      
      // Calculate days late (simplified)
      const daysLate = 0; // Simplified for debugging
      
      // Calculate late fine (simplified)
      const lateFineAmount = 0; // Simplified for debugging
      
      const totalExpected = expectedContribution + expectedInterest + lateFineAmount;
      
      // Use actual payment data from MemberContribution records if available
      const actualContribution = actualContributions[member.id];
      let paidAmount = 0;
      let status = 'PENDING';
      let lastPaymentDate;

      if (actualContribution) {
        paidAmount = actualContribution.totalPaid || 0;
        lastPaymentDate = actualContribution.paidDate;
        
        // Determine status
        if (paidAmount >= totalExpected) {
          status = 'PAID';
        } else if (paidAmount > 0) {
          status = daysLate > 0 ? 'OVERDUE' : 'PARTIAL';
        } else if (daysLate > 0) {
          status = 'OVERDUE';
        }
      }
      
      const remainingAmount = Math.max(0, totalExpected - paidAmount);
      
      return {
        memberId: member.id,
        memberName: member.name,
        expectedContribution,
        expectedInterest,
        currentLoanBalance,
        lateFineAmount,
        daysLate,
        dueDate: dueDate.toISOString(),
        totalExpected,
        paidAmount,
        remainingAmount,
        status,
        lastPaymentDate,
      };
    });

    console.log('=== DATA THAT WOULD BE SENT TO CLOSE PERIOD API ===\n');
    
    console.log('Request payload:');
    console.log('- periodId:', currentPeriod.id);
    console.log('- memberContributions length:', memberContributions.length);
    console.log('- actualContributions keys:', Object.keys(actualContributions).length);
    console.log();

    console.log('MEMBER CONTRIBUTIONS (frontend calculated):');
    memberContributions.forEach(contrib => {
      console.log(`  ${contrib.memberName}:`);
      console.log(`    - Expected Contribution: ${contrib.expectedContribution}`);
      console.log(`    - Expected Interest: ${contrib.expectedInterest}`);
      console.log(`    - Current Loan Balance: ${contrib.currentLoanBalance}`);
      console.log(`    - Late Fine: ${contrib.lateFineAmount}`);
      console.log(`    - Total Expected: ${contrib.totalExpected}`);
      console.log(`    - Paid Amount: ${contrib.paidAmount}`);
      console.log(`    - Remaining Amount: ${contrib.remainingAmount}`);
      console.log(`    - Status: ${contrib.status}`);
      console.log();
    });

    console.log('ACTUAL CONTRIBUTIONS (database records):');
    Object.entries(actualContributions).forEach(([memberId, contrib]) => {
      console.log(`  ${contrib.member.name} (${memberId}):`);
      console.log(`    - DB Record ID: ${contrib.id}`);
      console.log(`    - Compulsory Due: ${contrib.compulsoryContributionDue}`);
      console.log(`    - Interest Due: ${contrib.loanInterestDue}`);
      console.log(`    - Late Fine: ${contrib.lateFineAmount}`);
      console.log(`    - Total Paid: ${contrib.totalPaid}`);
      console.log(`    - Remaining: ${contrib.remainingAmount}`);
      console.log(`    - Status: ${contrib.status}`);
      console.log();
    });

    // 5. Simulate what backend would do
    console.log('=== WHAT BACKEND WOULD DO ===\n');
    
    // Simulate backend processing
    const memberLoanMap = {};
    group.members.forEach(member => {
      memberLoanMap[member.id] = member.currentLoanBalance || 0;
    });

    const totalCollected = Object.values(actualContributions).reduce((sum, contrib) => 
      sum + (contrib.totalPaid || 0), 0
    );

    const totalLateFines = memberContributions.reduce((sum, contrib) => 
      sum + contrib.lateFineAmount, 0
    );

    const totalInterest = Object.values(actualContributions).reduce((sum, contrib) => 
      sum + (contrib.loanInterestPaid || 0), 0
    );

    console.log('Period update values:');
    console.log(`- totalCollectionThisPeriod: ${totalCollected}`);
    console.log(`- interestEarnedThisPeriod: ${totalInterest}`);
    console.log(`- lateFinesCollectedThisPeriod: ${totalLateFines}`);
    console.log(`- newContributionsThisPeriod: ${totalCollected - totalInterest - totalLateFines}`);
    console.log();

    console.log('NEW MEMBER CONTRIBUTIONS FOR NEXT PERIOD:');
    const nextPeriodNumber = (currentPeriod.recordSequenceNumber || 0) + 1;
    console.log(`Next period sequence: ${nextPeriodNumber}`);
    console.log();

    memberContributions.forEach(memberContrib => {
      const carryForwardAmount = memberContrib.remainingAmount;
      const currentLoanBalance = memberLoanMap[memberContrib.memberId] || 0;
      const expectedInterest = currentLoanBalance * interestRate;

      const newRecord = {
        memberId: memberContrib.memberId,
        compulsoryContributionDue: expectedContribution + carryForwardAmount,
        loanInterestDue: expectedInterest,
        minimumDueAmount: expectedContribution + carryForwardAmount + expectedInterest,
        status: 'PENDING',
        compulsoryContributionPaid: 0,
        loanInterestPaid: 0,
        lateFinePaid: 0,
        totalPaid: 0,
        remainingAmount: expectedContribution + carryForwardAmount + expectedInterest,
        daysLate: 0,
        lateFineAmount: 0,
      };

      console.log(`  ${memberContrib.memberName}:`);
      console.log(`    - Carry Forward: ${carryForwardAmount}`);
      console.log(`    - Base Contribution: ${expectedContribution}`);
      console.log(`    - New Compulsory Due: ${newRecord.compulsoryContributionDue}`);
      console.log(`    - New Interest Due: ${newRecord.loanInterestDue}`);
      console.log(`    - New Total Due: ${newRecord.minimumDueAmount}`);
      console.log(`    - New Remaining: ${newRecord.remainingAmount}`);
      console.log();
    });

    // 6. Check for data consistency issues
    console.log('=== POTENTIAL DATA CONSISTENCY ISSUES ===\n');
    
    let issuesFound = false;

    memberContributions.forEach(frontendContrib => {
      const dbContrib = actualContributions[frontendContrib.memberId];
      
      if (dbContrib) {
        const dbTotalExpected = dbContrib.compulsoryContributionDue + dbContrib.loanInterestDue + dbContrib.lateFineAmount;
        
        if (Math.abs(frontendContrib.totalExpected - dbTotalExpected) > 0.01) {
          console.log(`❌ ${frontendContrib.memberName}:`);
          console.log(`   Frontend total expected: ${frontendContrib.totalExpected}`);
          console.log(`   Database total expected: ${dbTotalExpected}`);
          console.log(`   Difference: ${frontendContrib.totalExpected - dbTotalExpected}`);
          issuesFound = true;
        }
        
        if (Math.abs(frontendContrib.remainingAmount - (dbContrib.remainingAmount || 0)) > 0.01) {
          console.log(`❌ ${frontendContrib.memberName}:`);
          console.log(`   Frontend remaining: ${frontendContrib.remainingAmount}`);
          console.log(`   Database remaining: ${dbContrib.remainingAmount || 0}`);
          console.log(`   Difference: ${frontendContrib.remainingAmount - (dbContrib.remainingAmount || 0)}`);
          issuesFound = true;
        }
      } else {
        console.log(`❌ ${frontendContrib.memberName}: No database record found`);
        issuesFound = true;
      }
    });

    if (!issuesFound) {
      console.log('✅ No data consistency issues found');
    }

  } catch (error) {
    console.error('Error debugging close period flow:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Usage: node debug-close-period-flow.js <groupId>
const groupId = process.argv[2];

if (!groupId) {
  console.log('Usage: node debug-close-period-flow.js <groupId>');
  process.exit(1);
}

debugClosePeriodFlow(groupId);
