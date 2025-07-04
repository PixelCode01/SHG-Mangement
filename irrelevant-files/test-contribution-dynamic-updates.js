/**
 * Test script to create contribution data for testing dynamic updates in the UI
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testContributionDynamicUpdates() {
  console.log('🧪 TESTING CONTRIBUTION DYNAMIC UPDATES');
  console.log('================================================\n');

  const groupId = '6842efbd5403fbbe66d97d34'; // Use the test group we just created

  try {
    // Step 1: Get the group and its members
    console.log('1. Fetching test group and members...');
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        memberships: {
          include: {
            member: true
          }
        }
      }
    });

    if (!group) {
      throw new Error('Test group not found');
    }

    console.log(`   ✅ Found group: ${group.name}`);
    console.log(`   💰 Initial Financial State:`);
    console.log(`      - Cash in Hand: ₹${group.cashInHand}`);
    console.log(`      - Cash in Bank: ₹${group.balanceInBank}`);
    console.log(`      - Monthly Contribution: ₹${group.monthlyContribution}`);
    console.log(`   👥 Members: ${group.memberships.length}`);

    // Step 2: Create a periodic record for the current period
    console.log('\n2. Creating periodic record...');
    const currentPeriod = await prisma.groupPeriodicRecord.create({
      data: {
        groupId: group.id,
        meetingDate: new Date(),
        recordSequenceNumber: 1,
        membersPresent: 4,
        standingAtStartOfPeriod: group.cashInHand + group.balanceInBank + 6000, // Total loans = ₹6000
        cashInHandAtEndOfPeriod: group.cashInHand,
        cashInBankAtEndOfPeriod: group.balanceInBank,
        totalGroupStandingAtEndOfPeriod: group.cashInHand + group.balanceInBank + 6000,
        newContributionsThisPeriod: 0, // Will add contributions later
      }
    });

    console.log(`   ✅ Created periodic record (ID: ${currentPeriod.id})`);
    console.log(`   📊 Starting Standing: ₹${currentPeriod.standingAtStartOfPeriod}`);

    // Step 3: Create contribution records for members with varied payment statuses
    console.log('\n3. Creating contribution records...');
    
    const contributionPromises = group.memberships.map(async (membership, index) => {
      const member = membership.member;
      
      // Calculate expected interest based on loan amount
      const loans = await prisma.loan.findMany({
        where: { 
          memberId: member.id,
          status: 'ACTIVE'
        }
      });
      
      const totalLoanAmount = loans.reduce((sum, loan) => sum + (loan.currentAmount || 0), 0);
      const expectedInterest = totalLoanAmount * (group.interestRate / 100);
      
      // Create different payment scenarios
      let paidAmount = 0;
      let cashAllocation = null;
      
      if (index === 0) {
        // First member: Full payment
        paidAmount = group.monthlyContribution + expectedInterest;
        cashAllocation = {
          contributionToCashInHand: group.monthlyContribution * 0.4, // 40% to hand
          contributionToCashInBank: group.monthlyContribution * 0.6,  // 60% to bank
          interestToCashInHand: Math.round((expectedInterest * 0.3 + Number.EPSILON) * 100) / 100,              // 30% to hand
          interestToCashInBank: Math.round((expectedInterest * 0.7 + Number.EPSILON) * 100) / 100               // 70% to bank
        };
      } else if (index === 1) {
        // Second member: Partial payment (contribution only)
        paidAmount = group.monthlyContribution;
        cashAllocation = {
          contributionToCashInHand: group.monthlyContribution * 0.2, // 20% to hand
          contributionToCashInBank: group.monthlyContribution * 0.8,  // 80% to bank
          interestToCashInHand: 0,
          interestToCashInBank: 0
        };
      }
      // Third member: No payment (index 2 and above)
      
      const contribution = await prisma.memberContribution.create({
        data: {
          groupPeriodicRecordId: currentPeriod.id,
          memberId: member.id,
          
          // Expected amounts
          compulsoryContributionDue: group.monthlyContribution,
          loanInterestDue: expectedInterest,
          minimumDueAmount: group.monthlyContribution + expectedInterest,
          
          // Paid amounts
          compulsoryContributionPaid: Math.min(paidAmount, group.monthlyContribution),
          loanInterestPaid: Math.max(0, paidAmount - group.monthlyContribution),
          lateFinePaid: 0,
          totalPaid: paidAmount,
          
          // Status
          status: paidAmount >= (group.monthlyContribution + expectedInterest) ? 'PAID' : 'PENDING',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          daysLate: 0,
          lateFineAmount: 0,
          remainingAmount: Math.max(0, (group.monthlyContribution + expectedInterest) - paidAmount),
          
          // Cash allocation
          cashAllocation: cashAllocation ? JSON.stringify(cashAllocation) : null
        }
      });

      console.log(`   ✅ ${member.name}: Paid ₹${paidAmount} / ₹${group.monthlyContribution + expectedInterest} (${contribution.status})`);
      
      if (cashAllocation) {
        console.log(`      💰 Cash Allocation: Hand +₹${(cashAllocation.contributionToCashInHand + cashAllocation.interestToCashInHand).toFixed(2)}, Bank +₹${(cashAllocation.contributionToCashInBank + cashAllocation.interestToCashInBank).toFixed(2)}`);
      }

      return { contribution, cashAllocation };
    });

    const contributions = await Promise.all(contributionPromises);

    // Step 4: Calculate and display dynamic totals
    console.log('\n4. DYNAMIC CALCULATION RESULTS');
    console.log('================================');
    
    const totalPaid = contributions.reduce((sum, result) => sum + result.contribution.totalPaid, 0);
    const totalCashToHand = contributions.reduce((sum, result) => {
      if (result.cashAllocation) {
        return sum + result.cashAllocation.contributionToCashInHand + result.cashAllocation.interestToCashInHand;
      }
      return sum;
    }, 0);
    const totalCashToBank = contributions.reduce((sum, result) => {
      if (result.cashAllocation) {
        return sum + result.cashAllocation.contributionToCashInBank + result.cashAllocation.interestToCashInBank;
      }
      return sum;
    }, 0);
    
    const currentCashInHand = group.cashInHand + totalCashToHand;
    const currentCashInBank = group.balanceInBank + totalCashToBank;
    const totalLoanAssets = 6000; // From our test setup
    const currentGroupStanding = currentCashInHand + currentCashInBank + totalLoanAssets;

    console.log(`Starting Values:`);
    console.log(`  - Cash in Hand: ₹${group.cashInHand}`);
    console.log(`  - Cash in Bank: ₹${group.balanceInBank}`);
    console.log(`  - Loan Assets: ₹${totalLoanAssets}`);
    console.log(`  - Group Standing: ₹${group.cashInHand + group.balanceInBank + totalLoanAssets}`);

    console.log(`\nThis Period Activity:`);
    console.log(`  - Total Collection: ₹${totalPaid}`);
    console.log(`  - Cash to Hand: ₹${totalCashToHand.toFixed(2)}`);
    console.log(`  - Cash to Bank: ₹${totalCashToBank.toFixed(2)}`);

    console.log(`\nCurrent Values (Real-time):`);
    console.log(`  - Current Cash in Hand: ₹${currentCashInHand.toFixed(2)}`);
    console.log(`  - Current Cash in Bank: ₹${currentCashInBank.toFixed(2)}`);
    console.log(`  - Current Group Standing: ₹${currentGroupStanding.toFixed(2)}`);
    console.log(`  - Share per Member: ₹${(currentGroupStanding / group.memberships.length).toFixed(2)}`);

    console.log('\n🎯 TEST COMPLETE!');
    console.log(`Navigate to: http://localhost:3002/groups/${groupId}/contributions`);
    console.log('You should see:');
    console.log('1. Dynamic Group Standing section with real-time calculations');
    console.log('2. Proper cash allocation breakdown');
    console.log('3. Updated cash in hand and bank values');
    console.log('4. Enhanced close period modal with financial summary');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testContributionDynamicUpdates();
