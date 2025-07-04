const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyzeStandingCalculationDiscrepancy() {
  const groupId = '68483f7957a0ff01552c98aa';
  
  console.log('🔍 Analyzing Standing Calculation Discrepancy...');
  console.log('================================================');

  try {
    // Get the specific records that show discrepancies
    const records = await prisma.groupPeriodicRecord.findMany({
      where: { groupId: groupId },
      orderBy: { recordSequenceNumber: 'asc' }
    });

    // Get loan assets using the consistent method
    const membershipLoanAssets = await prisma.memberGroupMembership.aggregate({
      where: { groupId: groupId },
      _sum: { currentLoanAmount: true }
    });
    const totalLoanAssets = membershipLoanAssets._sum.currentLoanAmount || 0;

    console.log(`\n💰 LOAN ASSETS: ₹${totalLoanAssets}`);

    records.forEach((record, index) => {
      console.log(`\n📊 RECORD ${index + 1} (${record.meetingDate.toISOString().split('T')[0]}):`);
      
      const cashInHand = record.cashInHandAtEndOfPeriod || 0;
      const cashInBank = record.cashInBankAtEndOfPeriod || 0;
      const totalCash = cashInHand + cashInBank;
      
      // What the frontend should calculate
      const frontendCalculation = totalCash + totalLoanAssets;
      
      // What's stored in database
      const storedStanding = record.totalGroupStandingAtEndOfPeriod || 0;
      
      console.log(`  Cash in Hand: ₹${cashInHand}`);
      console.log(`  Cash in Bank: ₹${cashInBank}`);
      console.log(`  Total Cash: ₹${totalCash}`);
      console.log(`  + Loan Assets: ₹${totalLoanAssets}`);
      console.log(`  = Frontend Should Show: ₹${frontendCalculation}`);
      console.log(`  Database Stored: ₹${storedStanding}`);
      console.log(`  Difference: ₹${frontendCalculation - storedStanding}`);
      
      // Check what your frontend reported
      if (index === 0) { // June
        const frontendReported = 147048.86;
        console.log(`  Your Frontend Showed: ₹${frontendReported}`);
        console.log(`  Frontend vs Expected: ₹${frontendReported - frontendCalculation}`);
      }
      if (index === 1) { // July
        const frontendReported = 147126.45;
        console.log(`  Your Frontend Showed: ₹${frontendReported}`);
        console.log(`  Frontend vs Expected: ₹${frontendReported - frontendCalculation}`);
      }
    });

    // Check if the cash values in the historical view match the stored values
    console.log(`\n🔍 POSSIBLE CAUSES OF DISCREPANCY:`);
    console.log(`1. Frontend might be using live group cash values instead of period-end values`);
    console.log(`2. Frontend might be using different loan calculation method`);
    console.log(`3. Cash allocation during period closing might not be updating group.cashInHand/balanceInBank`);
    
    // Check current group cash values
    const group = await prisma.group.findUnique({
      where: { id: groupId }
    });
    
    console.log(`\n💰 CURRENT GROUP CASH (Live values):`);
    console.log(`  Current Cash in Hand: ₹${group.cashInHand || 0}`);
    console.log(`  Current Cash in Bank: ₹${group.balanceInBank || 0}`);
    console.log(`  Current Total: ₹${(group.cashInHand || 0) + (group.balanceInBank || 0)}`);
    console.log(`  + Loan Assets: ₹${totalLoanAssets}`);
    console.log(`  = Current Group Standing: ₹${(group.cashInHand || 0) + (group.balanceInBank || 0) + totalLoanAssets}`);
    
    console.log(`\n📝 RECOMMENDATION:`);
    console.log(`If frontend shows ₹147,048.86 but we calculate ₹${records[0] ? (records[0].cashInHandAtEndOfPeriod || 0) + (records[0].cashInBankAtEndOfPeriod || 0) + totalLoanAssets : 'N/A'},`);
    console.log(`then the frontend might be using current group cash instead of period-end cash.`);

  } catch (error) {
    console.error('❌ Analysis failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeStandingCalculationDiscrepancy()
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
