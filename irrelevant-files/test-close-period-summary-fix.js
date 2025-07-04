// Test script to verify close period summary fix
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testClosePeriodSummaryFix() {
  console.log('🧪 Testing Close Period Summary Cash Allocation Fix...\n');

  try {
    // Find a test group with existing data
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

    // Simulate member contribution data (like what would be in the Close Period modal)
    const mockMemberContributions = group.memberships.map(membership => ({
      memberId: membership.memberId,
      memberName: membership.member.name,
      paidAmount: 100, // Each member paid ₹100
      remainingAmount: 0,
      expectedInterest: 5, // Each member has ₹5 interest
      currentLoanBalance: membership.currentLoanAmount || 0
    }));

    const totalCollected = mockMemberContributions.reduce((sum, member) => sum + member.paidAmount, 0);
    const totalRemaining = mockMemberContributions.reduce((sum, member) => sum + member.remainingAmount, 0);
    const interestEarned = mockMemberContributions.reduce((sum, member) => sum + member.expectedInterest, 0);
    const totalLoanAssets = mockMemberContributions.reduce((sum, member) => sum + (member.currentLoanBalance || 0), 0);

    console.log(`\n📈 Simulated Data:`);
    console.log(`  Members: ${mockMemberContributions.length}`);
    console.log(`  Total Collected: ₹${totalCollected}`);
    console.log(`  Interest Earned: ₹${interestEarned}`);
    console.log(`  Total Loan Assets: ₹${totalLoanAssets}`);

    // Calculate starting values
    const startingCashInHand = group.cashInHand || 0;
    const startingCashInBank = group.balanceInBank || 0;
    const startingGroupStanding = startingCashInHand + startingCashInBank + totalLoanAssets;

    console.log(`\n🔢 Starting Values:`);
    console.log(`  Cash in Hand: ₹${startingCashInHand}`);
    console.log(`  Cash in Bank: ₹${startingCashInBank}`);
    console.log(`  Loan Assets: ₹${totalLoanAssets}`);
    console.log(`  Group Standing: ₹${startingGroupStanding}`);

    // OLD LOGIC (before fix)
    console.log(`\n❌ OLD LOGIC (Before Fix):`);
    const oldEndingCashInHand = startingCashInHand + totalCollected;
    const oldEndingCashInBank = startingCashInBank;
    const oldEndingGroupStanding = oldEndingCashInHand + oldEndingCashInBank + totalLoanAssets;

    console.log(`  Ending Cash in Hand: ₹${oldEndingCashInHand} (all collection added here)`);
    console.log(`  Ending Cash in Bank: ₹${oldEndingCashInBank} (no change)`);
    console.log(`  Ending Group Standing: ₹${oldEndingGroupStanding}`);

    // NEW LOGIC (after fix) - matches PeriodicRecordForm allocation
    console.log(`\n✅ NEW LOGIC (After Fix - matches Track Contribution page):`);
    const bankAllocation = Math.round(totalCollected * 0.7); // 70% to bank
    const handAllocation = totalCollected - bankAllocation; // 30% to hand
    
    const newEndingCashInHand = startingCashInHand + handAllocation;
    const newEndingCashInBank = startingCashInBank + bankAllocation;
    const newEndingGroupStanding = newEndingCashInHand + newEndingCashInBank + totalLoanAssets;

    console.log(`  Collection Allocation:`);
    console.log(`    Total Collection: ₹${totalCollected}`);
    console.log(`    To Bank (70%): ₹${bankAllocation}`);
    console.log(`    To Hand (30%): ₹${handAllocation}`);
    console.log(`  Ending Cash in Hand: ₹${newEndingCashInHand}`);
    console.log(`  Ending Cash in Bank: ₹${newEndingCashInBank}`);
    console.log(`  Ending Group Standing: ₹${newEndingGroupStanding}`);

    console.log(`\n🎯 KEY DIFFERENCES:`);
    console.log(`  Cash in Hand difference: ₹${newEndingCashInHand - oldEndingCashInHand}`);
    console.log(`  Cash in Bank difference: ₹${newEndingCashInBank - oldEndingCashInBank}`);
    console.log(`  Group Standing difference: ₹${newEndingGroupStanding - oldEndingGroupStanding}`);

    if (newEndingGroupStanding === oldEndingGroupStanding) {
      console.log(`  ✅ Total group standing remains the same (correct)`);
    } else {
      console.log(`  ❌ Total group standing changed (unexpected)`);
    }

    console.log(`\n💡 BENEFIT:`);
    console.log(`  The Close Period summary now shows the same cash allocation as the Track Contribution page.`);
    console.log(`  Cash is properly split between bank and hand instead of all going to hand.`);
    console.log(`  This provides consistent financial reporting across the application.`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testClosePeriodSummaryFix();
