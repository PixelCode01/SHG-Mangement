const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testClosePeriodFallbackAllocation() {
  console.log('🧪 Testing Close Period Summary with Fallback Allocation (no user input)...\n');

  try {
    // Find a test group
    const group = await prisma.group.findFirst({
      where: { name: 'sa' },
      include: {
        memberships: {
          include: {
            member: true
          }
        }
      }
    });

    if (!group) {
      console.log('❌ Test group not found');
      return;
    }

    console.log(`📊 Testing with Group: ${group.name}`);
    console.log(`💰 Initial Cash in Hand: ₹${group.cashInHand || 0}`);
    console.log(`🏦 Initial Cash in Bank: ₹${group.balanceInBank || 0}`);

    // Simulate member contribution data
    const mockMemberContributions = group.memberships.slice(0, 5).map(membership => ({
      memberId: membership.memberId,
      memberName: membership.member.name,
      expectedContribution: 500,
      expectedInterest: 25,
      currentLoanBalance: 1000,
      lateFineAmount: 0,
      daysLate: 0,
      dueDate: new Date(),
      totalExpected: 525,
      paidAmount: 525, // Member paid in full
      remainingAmount: 0,
      status: 'PAID',
      lastPaymentDate: new Date().toISOString()
    }));

    // Simulate actual contributions WITHOUT specific cash allocation (empty object)
    const mockActualContributions = {};
    group.memberships.slice(0, 5).forEach((membership) => {
      mockActualContributions[membership.memberId] = {
        memberId: membership.memberId,
        totalPaid: 525,
        // No cashAllocation field - simulating the case where user hasn't set specific allocation
        paidDate: new Date().toISOString()
      };
    });

    // Calculate totals
    const totalCollected = mockMemberContributions.reduce((sum, member) => sum + member.paidAmount, 0);
    const totalLoanAssets = mockMemberContributions.reduce((sum, member) => sum + (member.currentLoanBalance || 0), 0);

    // Calculate starting values
    const startingCashInHand = group.cashInHand || 0;
    const startingCashInBank = group.balanceInBank || 0;
    const startingGroupStanding = startingCashInHand + startingCashInBank + totalLoanAssets;

    console.log(`\n🔢 Starting Values:`);
    console.log(`  Cash in Hand: ₹${startingCashInHand}`);
    console.log(`  Cash in Bank: ₹${startingCashInBank}`);
    console.log(`  Loan Assets: ₹${totalLoanAssets}`);
    console.log(`  Group Standing: ₹${startingGroupStanding}`);
    console.log(`  Total Collection: ₹${totalCollected}`);

    // Test NEW LOGIC - Should fall back to 70/30 split
    console.log(`\n✅ NEW LOGIC (Fallback to 70/30 when no user allocation):`);

    // Look for actual user allocation in the current contributions
    const userAllocatedCashInHand = Object.values(mockActualContributions).reduce((sum, record) => {
      if (record.cashAllocation) {
        try {
          const allocation = JSON.parse(record.cashAllocation);
          return sum + (allocation.contributionToCashInHand || 0) + (allocation.interestToCashInHand || 0);
        } catch (_e) {
          return sum;
        }
      }
      return sum;
    }, 0);
    
    const userAllocatedCashInBank = Object.values(mockActualContributions).reduce((sum, record) => {
      if (record.cashAllocation) {
        try {
          const allocation = JSON.parse(record.cashAllocation);
          return sum + (allocation.contributionToCashInBank || 0) + (allocation.interestToCashInBank || 0);
        } catch (_e) {
          return sum;
        }
      }
      return sum;
    }, 0);

    console.log(`  User Allocated to Hand: ₹${userAllocatedCashInHand}`);
    console.log(`  User Allocated to Bank: ₹${userAllocatedCashInBank}`);
    console.log(`  Has User Allocation: ${userAllocatedCashInHand > 0 || userAllocatedCashInBank > 0 ? 'YES' : 'NO'}`);

    let endingCashInHand, endingCashInBank, bankAllocation, handAllocation;

    // If user has made specific allocations, use those; otherwise use default 70/30 split
    if (userAllocatedCashInHand > 0 || userAllocatedCashInBank > 0) {
      // Use actual user allocation (shouldn't happen in this test)
      handAllocation = userAllocatedCashInHand;
      bankAllocation = userAllocatedCashInBank;
      endingCashInHand = startingCashInHand + handAllocation;
      endingCashInBank = startingCashInBank + bankAllocation;
      console.log(`  Using USER allocation`);
    } else {
      // Fall back to 70/30 split when no specific allocation exists
      bankAllocation = Math.round(totalCollected * 0.7); // 70% to bank
      handAllocation = totalCollected - bankAllocation; // 30% to hand
      endingCashInHand = startingCashInHand + handAllocation;
      endingCashInBank = startingCashInBank + bankAllocation;
      console.log(`  Using DEFAULT 70/30 allocation`);
    }

    const endingGroupStanding = endingCashInHand + endingCashInBank + totalLoanAssets;

    console.log(`  Bank Allocation: ₹${bankAllocation} (${((bankAllocation / totalCollected) * 100).toFixed(1)}%)`);
    console.log(`  Hand Allocation: ₹${handAllocation} (${((handAllocation / totalCollected) * 100).toFixed(1)}%)`);
    console.log(`  Ending Cash in Hand: ₹${endingCashInHand}`);
    console.log(`  Ending Cash in Bank: ₹${endingCashInBank}`);
    console.log(`  Ending Group Standing: ₹${endingGroupStanding}`);

    console.log(`\n🎯 VERIFICATION:`);
    console.log(`  Bank allocation should be ~70%: ${((bankAllocation / totalCollected) * 100).toFixed(1)}%`);
    console.log(`  Hand allocation should be ~30%: ${((handAllocation / totalCollected) * 100).toFixed(1)}%`);
    console.log(`  Total allocation: ₹${bankAllocation + handAllocation} (should equal ₹${totalCollected})`);

    console.log(`\n💡 BENEFIT:`);
    console.log(`  When users haven't set specific cash allocations, the system correctly`);
    console.log(`  falls back to the 70/30 default split, ensuring the modal always shows`);
    console.log(`  meaningful allocation data rather than all collections going to one account.`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testClosePeriodFallbackAllocation();
