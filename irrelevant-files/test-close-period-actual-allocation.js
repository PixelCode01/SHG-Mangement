const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testClosePeriodActualAllocation() {
  console.log('🧪 Testing Close Period Summary with Actual User Allocation...\n');

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

    // Simulate member contribution data with specific cash allocation
    const mockMemberContributions = group.memberships.map(membership => ({
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

    // Simulate actual contributions with specific cash allocation
    const mockActualContributions = {};
    group.memberships.forEach((membership, index) => {
      // Create different allocation patterns for testing
      let cashAllocation;
      if (index === 0) {
        // First member: 50% bank, 50% hand
        cashAllocation = JSON.stringify({
          contributionToCashInBank: 250,
          contributionToCashInHand: 250,
          interestToCashInBank: 12.5,
          interestToCashInHand: 12.5
        });
      } else if (index === 1) {
        // Second member: 80% bank, 20% hand
        cashAllocation = JSON.stringify({
          contributionToCashInBank: 400,
          contributionToCashInHand: 100,
          interestToCashInBank: 20,
          interestToCashInHand: 5
        });
      } else {
        // Other members: 60% bank, 40% hand
        cashAllocation = JSON.stringify({
          contributionToCashInBank: 300,
          contributionToCashInHand: 200,
          interestToCashInBank: 15,
          interestToCashInHand: 10
        });
      }

      mockActualContributions[membership.memberId] = {
        memberId: membership.memberId,
        totalPaid: 525,
        cashAllocation: cashAllocation,
        paidDate: new Date().toISOString()
      };
    });

    // Calculate totals
    const totalCollected = mockMemberContributions.reduce((sum, member) => sum + member.paidAmount, 0);
    const totalLoanAssets = mockMemberContributions.reduce((sum, member) => sum + (member.currentLoanBalance || 0), 0);
    const interestEarned = mockMemberContributions.reduce((sum, member) => sum + member.expectedInterest, 0);

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

    // Test NEW LOGIC - Use actual user allocation
    console.log(`\n✅ NEW LOGIC (Actual User Allocation):`);

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
    console.log(`  Total User Allocation: ₹${userAllocatedCashInHand + userAllocatedCashInBank}`);

    const newEndingCashInHand = startingCashInHand + userAllocatedCashInHand;
    const newEndingCashInBank = startingCashInBank + userAllocatedCashInBank;
    const newEndingGroupStanding = newEndingCashInHand + newEndingCashInBank + totalLoanAssets;

    console.log(`  Ending Cash in Hand: ₹${newEndingCashInHand}`);
    console.log(`  Ending Cash in Bank: ₹${newEndingCashInBank}`);
    console.log(`  Ending Group Standing: ₹${newEndingGroupStanding}`);

    // Compare with old 70/30 logic
    console.log(`\n❌ OLD LOGIC (70/30 Split for comparison):`);
    const oldBankAllocation = Math.round(totalCollected * 0.7);
    const oldHandAllocation = totalCollected - oldBankAllocation;
    const oldEndingCashInHand = startingCashInHand + oldHandAllocation;
    const oldEndingCashInBank = startingCashInBank + oldBankAllocation;
    const oldEndingGroupStanding = oldEndingCashInHand + oldEndingCashInBank + totalLoanAssets;

    console.log(`  70/30 Bank Allocation: ₹${oldBankAllocation}`);
    console.log(`  70/30 Hand Allocation: ₹${oldHandAllocation}`);
    console.log(`  Ending Cash in Hand: ₹${oldEndingCashInHand}`);
    console.log(`  Ending Cash in Bank: ₹${oldEndingCashInBank}`);
    console.log(`  Ending Group Standing: ₹${oldEndingGroupStanding}`);

    console.log(`\n🎯 KEY DIFFERENCES:`);
    console.log(`  Cash in Hand difference: ₹${newEndingCashInHand - oldEndingCashInHand}`);
    console.log(`  Cash in Bank difference: ₹${newEndingCashInBank - oldEndingCashInBank}`);
    console.log(`  Group Standing difference: ₹${newEndingGroupStanding - oldEndingGroupStanding}`);

    // Show individual member allocations
    console.log(`\n👥 INDIVIDUAL MEMBER ALLOCATIONS:`);
    Object.values(mockActualContributions).forEach((record, index) => {
      const allocation = JSON.parse(record.cashAllocation);
      const totalToBank = (allocation.contributionToCashInBank || 0) + (allocation.interestToCashInBank || 0);
      const totalToHand = (allocation.contributionToCashInHand || 0) + (allocation.interestToCashInHand || 0);
      const bankPercent = ((totalToBank / (totalToBank + totalToHand)) * 100).toFixed(1);
      const handPercent = ((totalToHand / (totalToBank + totalToHand)) * 100).toFixed(1);
      
      console.log(`  Member ${index + 1}: Bank: ₹${totalToBank} (${bankPercent}%), Hand: ₹${totalToHand} (${handPercent}%)`);
    });

    console.log(`\n💡 BENEFIT:`);
    console.log(`  The Close Period summary now reflects the actual allocation chosen by users`);
    console.log(`  on the Track Contribution page, providing accurate financial reporting.`);
    console.log(`  When no specific allocation exists, it falls back to the 70/30 default.`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testClosePeriodActualAllocation();
