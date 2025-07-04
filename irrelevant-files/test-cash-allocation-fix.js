const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testCashAllocationFix() {
  console.log('🧪 TESTING CASH ALLOCATION FIX');
  console.log('==============================\n');

  try {
    const groupId = '68452639c89581172a565838'; // Group 'jbk'
    
    // Get group current state
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        name: true,
        cashInHand: true,
        balanceInBank: true
      }
    });

    console.log(`📊 Current Group State:`);
    console.log(`  Name: ${group.name}`);
    console.log(`  Cash in Hand: ₹${group.cashInHand}`);
    console.log(`  Cash in Bank: ₹${group.balanceInBank}\n`);

    // Get the most recent period
    const currentPeriod = await prisma.groupPeriodicRecord.findFirst({
      where: { groupId },
      orderBy: { meetingDate: 'desc' },
      include: {
        memberContributions: {
          select: {
            totalPaid: true,
            cashAllocation: true,
            member: { select: { name: true } }
          }
        }
      }
    });

    if (!currentPeriod) {
      console.log('❌ No periods found');
      return;
    }

    console.log(`📋 Testing Period: ${currentPeriod.meetingDate}`);
    console.log(`💰 Collection: ₹${currentPeriod.totalCollectionThisPeriod}\n`);

    // Calculate what the frontend would show
    let calculatedCashToHand = 0;
    let calculatedCashToBank = 0;

    currentPeriod.memberContributions.forEach(contrib => {
      if (contrib.totalPaid > 0 && contrib.cashAllocation) {
        try {
          const allocation = JSON.parse(contrib.cashAllocation);
          calculatedCashToHand += (allocation.contributionToCashInHand || 0) + (allocation.interestToCashInHand || 0);
          calculatedCashToBank += (allocation.contributionToCashInBank || 0) + (allocation.interestToCashInBank || 0);
        } catch (e) {
          // Default allocation with rounding
          calculatedCashToHand += Math.round((contrib.totalPaid * 0.3 + Number.EPSILON) * 100) / 100;
          calculatedCashToBank += Math.round((contrib.totalPaid * 0.7 + Number.EPSILON) * 100) / 100;
        }
      }
    });

    // Calculate expected values for period record
    const expectedCashInHand = group.cashInHand + calculatedCashToHand;
    const expectedCashInBank = group.balanceInBank + calculatedCashToBank;

    console.log(`🎯 EXPECTED VALUES (Frontend Logic):`);
    console.log(`  Starting Cash in Hand: ₹${group.cashInHand}`);
    console.log(`  + Period allocation to Hand: ₹${calculatedCashToHand.toFixed(2)}`);
    console.log(`  = Expected Cash in Hand: ₹${expectedCashInHand.toFixed(2)}`);
    console.log(``);
    console.log(`  Starting Cash in Bank: ₹${group.balanceInBank}`);
    console.log(`  + Period allocation to Bank: ₹${calculatedCashToBank.toFixed(2)}`);
    console.log(`  = Expected Cash in Bank: ₹${expectedCashInBank.toFixed(2)}\n`);

    console.log(`📋 ACTUAL PERIODIC RECORD VALUES:`);
    console.log(`  Cash in Hand (End): ₹${currentPeriod.cashInHandAtEndOfPeriod}`);
    console.log(`  Cash in Bank (End): ₹${currentPeriod.cashInBankAtEndOfPeriod}`);
    console.log(`  Total Group Standing: ₹${currentPeriod.totalGroupStandingAtEndOfPeriod}\n`);

    console.log(`🔍 COMPARISON:`);
    const handDiff = Math.abs(expectedCashInHand - currentPeriod.cashInHandAtEndOfPeriod);
    const bankDiff = Math.abs(expectedCashInBank - currentPeriod.cashInBankAtEndOfPeriod);
    
    console.log(`  Cash in Hand - Expected: ₹${expectedCashInHand.toFixed(2)}, Actual: ₹${currentPeriod.cashInHandAtEndOfPeriod}, Diff: ₹${handDiff.toFixed(2)}`);
    console.log(`  Cash in Bank - Expected: ₹${expectedCashInBank.toFixed(2)}, Actual: ₹${currentPeriod.cashInBankAtEndOfPeriod}, Diff: ₹${bankDiff.toFixed(2)}\n`);

    if (handDiff < 0.01 && bankDiff < 0.01) {
      console.log(`✅ SUCCESS: Frontend and backend calculations match!`);
    } else {
      console.log(`❌ MISMATCH: Frontend and backend calculations don't match`);
      console.log(`💡 The fix should resolve this discrepancy when the next period is closed.`);
    }

    // Show the issue that we fixed
    console.log(`\n🔧 ISSUE ANALYSIS:`);
    console.log(`  The problem was in the backend period close logic:`);
    console.log(`  - Old logic: balanceInBank = starting + totalCollected`);
    console.log(`  - New logic: balanceInBank = starting + allocatedToBank`);
    console.log(`  - This ensures frontend and backend use the same calculation`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCashAllocationFix();
