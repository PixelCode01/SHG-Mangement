const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixUnrealisticStandingValues() {
  const groupId = '68481425f418d2300b2df585';
  
  try {
    // Get all periods for the group
    const periods = await prisma.groupPeriodicRecord.findMany({
      where: { groupId },
      orderBy: { recordSequenceNumber: 'asc' },
      include: { memberContributions: true }
    });
    
    if (!periods.length) {
      console.log("No periods found for this group.");
      return;
    }
    
    console.log(`Found ${periods.length} periods for group ${groupId}`);
    
    // Check for unrealistic standing values (especially for the first period)
    for (const period of periods) {
      console.log(`\nPeriod #${period.recordSequenceNumber || '?'} (${period.id})`);
      console.log(`Meeting Date: ${period.meetingDate}`);
      console.log(`Standing at Start: ₹${period.standingAtStartOfPeriod || 0}`);
      console.log(`Total Standing at End: ₹${period.totalGroupStandingAtEndOfPeriod || 0}`);
      console.log(`Cash in Hand: ₹${period.cashInHandAtEndOfPeriod || 0}`);
      console.log(`Cash in Bank: ₹${period.cashInBankAtEndOfPeriod || 0}`);
      
      // Calculate what the total standing should be
      const cashInHand = period.cashInHandAtEndOfPeriod || 0;
      const cashInBank = period.cashInBankAtEndOfPeriod || 0;
      
      // Get loans at the time of this period
      const loans = await prisma.loan.findMany({
        where: {
          groupId,
          createdAt: { lte: period.meetingDate }
        }
      });
      
      const totalLoanAssets = loans.reduce((sum, loan) => sum + (loan.currentBalance || 0), 0);
      const correctStanding = cashInHand + cashInBank + totalLoanAssets;
      
      console.log(`Active Loans: ${loans.length}`);
      console.log(`Total Loan Assets: ₹${totalLoanAssets}`);
      console.log(`Correct Standing: ₹${correctStanding}`);
      
      // Check if standing values are unrealistic
      const isFirstPeriod = period.recordSequenceNumber === 1;
      const hasUnrealisticStartingValue = isFirstPeriod && period.standingAtStartOfPeriod > correctStanding * 10;
      
      if (hasUnrealisticStartingValue) {
        console.log(`⚠️ First period has unrealistic starting value: ₹${period.standingAtStartOfPeriod}`);
        console.log(`   Should be closer to ₹${correctStanding}`);
        
        // Confirm before fixing
        console.log(`📝 Fixing unrealistic starting value...`);
        
        // Update the period with the correct starting value
        await prisma.groupPeriodicRecord.update({
          where: { id: period.id },
          data: { standingAtStartOfPeriod: correctStanding }
        });
        
        console.log(`✅ Fixed standing value for period ${period.id}`);
      }
    }
    
    console.log("\n✅ Done checking and fixing periods.");
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

fixUnrealisticStandingValues().catch(console.error);
