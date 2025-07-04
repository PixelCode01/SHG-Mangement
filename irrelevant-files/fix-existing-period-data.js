const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixExistingPeriodData() {
  try {
    console.log('=== FIXING EXISTING PERIOD DATA ===\n');
    
    const groupId = '68443ebe0c7da4954917bf8f';
    
    // 1. Get group and member data
    const group = await prisma.group.findUnique({
      where: { id: groupId }
    });

    const memberships = await prisma.memberGroupMembership.findMany({
      where: { groupId: groupId },
      select: { currentLoanAmount: true }
    });

    const totalLoanAssets = memberships.reduce((sum, m) => sum + (m.currentLoanAmount || 0), 0);
    
    console.log(`Group: ${group.name}`);
    console.log(`Total Loan Assets: ₹${totalLoanAssets.toLocaleString()}`);
    
    // 2. Fix the closed period (Period 2)
    const closedPeriodId = '68443ef20c7da4954917bfa8';
    const totalCollected = 100500; // From the period data
    
    const correctedEndingCashInHand = group.cashInHand || 0;
    const correctedEndingCashInBank = (group.balanceInBank || 0) + totalCollected;
    const correctedEndingTotalGroupStanding = correctedEndingCashInHand + correctedEndingCashInBank + totalLoanAssets;
    
    console.log('\nUpdating closed period...');
    const updatedClosedPeriod = await prisma.groupPeriodicRecord.update({
      where: { id: closedPeriodId },
      data: {
        cashInHandAtEndOfPeriod: correctedEndingCashInHand,
        cashInBankAtEndOfPeriod: correctedEndingCashInBank,
        totalGroupStandingAtEndOfPeriod: correctedEndingTotalGroupStanding,
      }
    });
    
    console.log(`✅ Updated closed period:
      - Cash in Hand (End): ₹${updatedClosedPeriod.cashInHandAtEndOfPeriod.toLocaleString()}
      - Cash in Bank (End): ₹${updatedClosedPeriod.cashInBankAtEndOfPeriod.toLocaleString()}
      - Total Group Standing (End): ₹${updatedClosedPeriod.totalGroupStandingAtEndOfPeriod.toLocaleString()}`);
    
    // 3. Fix the current period (Period 1)
    const currentPeriodId = '68443fa50c7da4954917bfc0';
    
    const newCashInHand = group.cashInHand || 0;
    const newCashInBank = (group.balanceInBank || 0) + totalCollected;
    const newTotalGroupStanding = newCashInHand + newCashInBank + totalLoanAssets;
    
    console.log('\nUpdating current period...');
    const updatedCurrentPeriod = await prisma.groupPeriodicRecord.update({
      where: { id: currentPeriodId },
      data: {
        standingAtStartOfPeriod: newTotalGroupStanding,
        cashInHandAtEndOfPeriod: newCashInHand,
        cashInBankAtEndOfPeriod: newCashInBank,
        totalGroupStandingAtEndOfPeriod: newTotalGroupStanding,
      }
    });
    
    console.log(`✅ Updated current period:
      - Standing at Start: ₹${updatedCurrentPeriod.standingAtStartOfPeriod.toLocaleString()}
      - Cash in Hand (End): ₹${updatedCurrentPeriod.cashInHandAtEndOfPeriod.toLocaleString()}
      - Cash in Bank (End): ₹${updatedCurrentPeriod.cashInBankAtEndOfPeriod.toLocaleString()}
      - Total Group Standing (End): ₹${updatedCurrentPeriod.totalGroupStandingAtEndOfPeriod.toLocaleString()}`);
    
    console.log('\n✅ BOTH PERIODS HAVE BEEN CORRECTED!');
    console.log('The frontend should now show the correct values.');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixExistingPeriodData();
