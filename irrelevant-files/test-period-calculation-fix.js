const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testNewPeriodCalculations() {
  try {
    console.log('=== TESTING NEW PERIOD CALCULATION FIX ===\n');
    
    const groupId = '68443ebe0c7da4954917bf8f';
    
    // 1. Get group info
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        cashInHand: true,
        balanceInBank: true,
        monthlyContribution: true,
        interestRate: true
      }
    });

    // 2. Get member loan amounts
    const memberships = await prisma.memberGroupMembership.findMany({
      where: { groupId: groupId },
      select: {
        memberId: true,
        currentLoanAmount: true
      }
    });

    // 3. Get the closed period (Period 2) 
    const closedPeriod = await prisma.groupPeriodicRecord.findUnique({
      where: { id: '68443ef20c7da4954917bfa8' },
      select: {
        id: true,
        recordSequenceNumber: true,
        totalCollectionThisPeriod: true,
        interestEarnedThisPeriod: true,
        lateFinesCollectedThisPeriod: true,
        newContributionsThisPeriod: true,
        cashInHandAtEndOfPeriod: true,
        cashInBankAtEndOfPeriod: true,
        totalGroupStandingAtEndOfPeriod: true
      }
    });

    console.log('CURRENT STATE:');
    console.log(`Group: ${group.name}`);
    console.log(`Cash in Hand: ₹${group.cashInHand}`);
    console.log(`Balance in Bank: ₹${group.balanceInBank}`);
    console.log(`Members: ${memberships.length}`);
    
    // Calculate total loan assets
    const totalLoanAssets = memberships.reduce((sum, membership) => {
      return sum + (membership.currentLoanAmount || 0);
    }, 0);
    
    console.log(`Total Loan Assets: ₹${totalLoanAssets.toLocaleString()}`);
    
    console.log('\nCLOSED PERIOD (Current values):');
    console.log(`Total Collection: ₹${closedPeriod.totalCollectionThisPeriod.toLocaleString()}`);
    console.log(`Interest Earned: ₹${closedPeriod.interestEarnedThisPeriod.toLocaleString()}`);
    console.log(`New Contributions: ₹${closedPeriod.newContributionsThisPeriod.toLocaleString()}`);
    console.log(`Cash in Hand (End): ₹${closedPeriod.cashInHandAtEndOfPeriod || 0}`);
    console.log(`Cash in Bank (End): ₹${closedPeriod.cashInBankAtEndOfPeriod || 0}`);
    console.log(`Total Group Standing (End): ₹${closedPeriod.totalGroupStandingAtEndOfPeriod || 0}`);
    
    // Calculate what the CORRECTED values should be
    console.log('\nCORRECTED CALCULATIONS:');
    
    const totalCollected = closedPeriod.totalCollectionThisPeriod;
    const totalInterest = closedPeriod.interestEarnedThisPeriod;
    const totalLateFines = closedPeriod.lateFinesCollectedThisPeriod;
    
    // For closed period
    const correctedEndingCashInHand = group.cashInHand || 0;
    const correctedEndingCashInBank = (group.balanceInBank || 0) + totalCollected;
    const correctedEndingTotalGroupStanding = correctedEndingCashInHand + correctedEndingCashInBank + totalLoanAssets;
    
    console.log('Closed Period (What it SHOULD be):');
    console.log(`Cash in Hand (End): ₹${correctedEndingCashInHand.toLocaleString()}`);
    console.log(`Cash in Bank (End): ₹${correctedEndingCashInBank.toLocaleString()}`);
    console.log(`Total Group Standing (End): ₹${correctedEndingTotalGroupStanding.toLocaleString()}`);
    
    // For new period  
    const newCashInHand = group.cashInHand || 0;
    const newCashInBank = (group.balanceInBank || 0) + totalCollected;
    const newTotalGroupStanding = newCashInHand + newCashInBank + totalLoanAssets;
    
    console.log('\nNew Period (What it SHOULD be):');
    console.log(`Cash in Hand: ₹${newCashInHand.toLocaleString()}`);
    console.log(`Cash in Bank: ₹${newCashInBank.toLocaleString()}`);
    console.log(`Total Group Standing: ₹${newTotalGroupStanding.toLocaleString()}`);
    
    // Show the difference
    const currentNewPeriod = await prisma.groupPeriodicRecord.findUnique({
      where: { id: '68443fa50c7da4954917bfc0' }
    });
    
    console.log('\nCOMPARISON:');
    console.log(`Current New Period Standing: ₹${currentNewPeriod.totalGroupStandingAtEndOfPeriod.toLocaleString()}`);
    console.log(`Fixed New Period Standing: ₹${newTotalGroupStanding.toLocaleString()}`);
    console.log(`Difference: ₹${(newTotalGroupStanding - currentNewPeriod.totalGroupStandingAtEndOfPeriod).toLocaleString()}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testNewPeriodCalculations();
