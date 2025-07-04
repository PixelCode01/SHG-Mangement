const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateGroupCashBalances() {
  const groupId = '68483f7957a0ff01552c98aa';
  
  console.log('🔧 Updating Group Cash Balances...');
  console.log('===================================');

  try {
    // Get the latest closed period
    const latestClosedPeriod = await prisma.groupPeriodicRecord.findFirst({
      where: { 
        groupId: groupId,
        totalCollectionThisPeriod: { not: null },
        totalCollectionThisPeriod: { gt: 0 }
      },
      orderBy: { recordSequenceNumber: 'desc' }
    });

    if (!latestClosedPeriod) {
      console.log('❌ No closed periods found');
      return;
    }

    console.log(`\n📊 Latest Closed Period: Sequence ${latestClosedPeriod.recordSequenceNumber}`);
    console.log(`Date: ${latestClosedPeriod.meetingDate.toISOString().split('T')[0]}`);
    console.log(`Cash in Hand at End: ₹${latestClosedPeriod.cashInHandAtEndOfPeriod || 0}`);
    console.log(`Cash in Bank at End: ₹${latestClosedPeriod.cashInBankAtEndOfPeriod || 0}`);

    // Get current group values
    const group = await prisma.group.findUnique({
      where: { id: groupId }
    });

    console.log(`\n💰 Current Group Values:`);
    console.log(`Cash in Hand: ₹${group.cashInHand || 0}`);
    console.log(`Cash in Bank: ₹${group.balanceInBank || 0}`);

    // Check if they match
    const endingCashInHand = latestClosedPeriod.cashInHandAtEndOfPeriod || 0;
    const endingCashInBank = latestClosedPeriod.cashInBankAtEndOfPeriod || 0;

    const handMatches = Math.abs((group.cashInHand || 0) - endingCashInHand) < 0.01;
    const bankMatches = Math.abs((group.balanceInBank || 0) - endingCashInBank) < 0.01;

    if (handMatches && bankMatches) {
      console.log(`\n✅ Group cash balances already match the latest period`);
      console.log(`No update needed.`);
    } else {
      console.log(`\n🔄 Updating group cash balances to match latest period...`);
      
      await prisma.group.update({
        where: { id: groupId },
        data: {
          cashInHand: endingCashInHand,
          balanceInBank: endingCashInBank
        }
      });

      console.log(`✅ Updated group cash balances:`);
      console.log(`  Cash in Hand: ₹${group.cashInHand || 0} → ₹${endingCashInHand}`);
      console.log(`  Cash in Bank: ₹${group.balanceInBank || 0} → ₹${endingCashInBank}`);
    }

    // Now verify the calculation
    const membershipLoanAssets = await prisma.memberGroupMembership.aggregate({
      where: { groupId: groupId },
      _sum: { currentLoanAmount: true }
    });
    const totalLoanAssets = membershipLoanAssets._sum.currentLoanAmount || 0;

    const correctGroupStanding = endingCashInHand + endingCashInBank + totalLoanAssets;

    console.log(`\n📊 Verification - Expected Frontend Values:`);
    console.log(`Cash in Hand: ₹${endingCashInHand}`);
    console.log(`Cash in Bank: ₹${endingCashInBank}`);
    console.log(`Loan Assets: ₹${totalLoanAssets}`);
    console.log(`Total Group Standing: ₹${correctGroupStanding}`);

    console.log(`\n🎉 Group cash balances are now synchronized!`);
    console.log(`The frontend should now show the correct values for historical periods.`);

  } catch (error) {
    console.error('❌ Update failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateGroupCashBalances()
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
