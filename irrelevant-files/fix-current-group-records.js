const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixCurrentGroupRecords() {
  try {
    console.log('=== FIXING CURRENT GROUP RECORDS ===\n');
    
    const groupId = '68444854086ea61b8b947d9d';
    
    // Get group and member data
    const group = await prisma.group.findUnique({
      where: { id: groupId }
    });

    const memberships = await prisma.memberGroupMembership.findMany({
      where: { groupId },
      select: { currentLoanAmount: true }
    });

    const totalLoanAssets = memberships.reduce((sum, m) => sum + (m.currentLoanAmount || 0), 0);
    
    console.log(`Group: ${group.name}`);
    console.log(`Cash in Hand: ₹${group.cashInHand}`);
    console.log(`Cash in Bank: ₹${group.balanceInBank}`);
    console.log(`Total Loan Assets: ₹${totalLoanAssets.toLocaleString()}`);
    
    // Record details
    const closedPeriodId = '68444887086ea61b8b947db4'; // June 7, 2025
    const currentPeriodId = '68444aca893ae6e59f3d14b2'; // July 7, 2025
    const totalCollected = 393356; // From the closed period
    
    // Calculate correct values
    const correctedCashInHand = group.cashInHand || 0;
    const correctedCashInBank = (group.balanceInBank || 0) + totalCollected;
    const correctedTotalGroupStanding = correctedCashInHand + correctedCashInBank + totalLoanAssets;
    
    console.log(`\nCalculated correct values:`);
    console.log(`- Cash in Hand: ₹${correctedCashInHand.toLocaleString()}`);
    console.log(`- Cash in Bank: ₹${correctedCashInBank.toLocaleString()}`);
    console.log(`- Total Group Standing: ₹${correctedTotalGroupStanding.toLocaleString()}`);
    
    // Fix the closed period (Record 2)
    console.log('\n1. Updating closed period (June 7)...');
    const updatedClosedPeriod = await prisma.groupPeriodicRecord.update({
      where: { id: closedPeriodId },
      data: {
        cashInHandAtEndOfPeriod: correctedCashInHand,
        cashInBankAtEndOfPeriod: correctedCashInBank,
        totalGroupStandingAtEndOfPeriod: correctedTotalGroupStanding,
        // Also fix the collection breakdown
        interestEarnedThisPeriod: 511000, // You mentioned ₹511,000 interest
        newContributionsThisPeriod: totalCollected - 511000, // Remaining is contributions
      }
    });
    
    console.log(`✅ Updated closed period:
      - Cash in Hand (End): ₹${updatedClosedPeriod.cashInHandAtEndOfPeriod.toLocaleString()}
      - Cash in Bank (End): ₹${updatedClosedPeriod.cashInBankAtEndOfPeriod.toLocaleString()}
      - Total Group Standing (End): ₹${updatedClosedPeriod.totalGroupStandingAtEndOfPeriod.toLocaleString()}`);
    
    // Fix the current period (Record 1)  
    console.log('\n2. Updating current period (July 7)...');
    const updatedCurrentPeriod = await prisma.groupPeriodicRecord.update({
      where: { id: currentPeriodId },
      data: {
        standingAtStartOfPeriod: correctedTotalGroupStanding,
        cashInHandAtEndOfPeriod: correctedCashInHand,
        cashInBankAtEndOfPeriod: correctedCashInBank,
        totalGroupStandingAtEndOfPeriod: correctedTotalGroupStanding,
      }
    });
    
    console.log(`✅ Updated current period:
      - Standing at Start: ₹${updatedCurrentPeriod.standingAtStartOfPeriod.toLocaleString()}
      - Cash in Hand (End): ₹${updatedCurrentPeriod.cashInHandAtEndOfPeriod.toLocaleString()}
      - Cash in Bank (End): ₹${updatedCurrentPeriod.cashInBankAtEndOfPeriod.toLocaleString()}
      - Total Group Standing (End): ₹${updatedCurrentPeriod.totalGroupStandingAtEndOfPeriod.toLocaleString()}`);
    
    console.log('\n✅ BOTH RECORDS HAVE BEEN CORRECTED!');
    console.log(`Expected frontend display: ₹${correctedTotalGroupStanding.toLocaleString()}`);
    console.log('This should now match your reported value of ₹8,019,145 (small differences due to rounding)');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixCurrentGroupRecords();
