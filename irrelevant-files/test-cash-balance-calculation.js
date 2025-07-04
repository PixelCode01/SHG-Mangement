/**
 * Test script to create a periodic record and verify cash balance calculations
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testCashBalanceCalculation() {
  console.log('🧪 Testing Cash Balance Calculation with Real Data...\n');

  try {
    const groupId = '68466fdfad5c6b70fdd420d7'; // Group 'jn'
    
    // Get group data
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        memberships: {
          include: { member: true }
        },
        groupPeriodicRecords: true
      }
    });

    if (!group) {
      console.log('❌ Group not found');
      return;
    }

    console.log(`📊 Group: ${group.name}`);
    console.log(`💰 Initial Cash in Hand: ₹${group.cashInHand || 0}`);
    console.log(`🏦 Initial Balance in Bank: ₹${group.balanceInBank || 0}`);
    console.log(`👥 Members: ${group.memberships.length}`);
    console.log(`📋 Existing Records: ${group.groupPeriodicRecords.length}\n`);

    // Calculate expected initial standing
    const groupCash = (group.cashInHand || 0) + (group.balanceInBank || 0);
    let totalLoanAssets = 0;
    group.memberships.forEach(membership => {
      totalLoanAssets += membership.currentLoanAmount || 0;
    });
    const expectedInitialStanding = groupCash + totalLoanAssets;

    console.log(`📈 Expected Initial Standing: ₹${expectedInitialStanding} (Cash: ₹${groupCash} + Loans: ₹${totalLoanAssets})\n`);

    // Create sample periodic record data
    const sampleRecord = {
      collectionDate: new Date().toISOString(),
      presentMembers: Math.min(group.memberships.length, 16),
      standingAtStartOfPeriod: expectedInitialStanding,
      totalCollectionThisPeriod: 1000,
      newContributionsThisPeriod: 800,
      lateFinesCollectedThisPeriod: 50,
      interestEarnedThisPeriod: 150,
      loanProcessingFeesCollectedThisPeriod: 0,
      expensesThisPeriod: 100,
      totalGroupStandingAtEndOfPeriod: expectedInitialStanding + 1000 - 100, // +900
      cashInHandAtEndOfPeriod: 500,
      cashInBankAtEndOfPeriod: 1500, // Total should be 2000
      notes: 'Test record for cash balance debugging',
      memberRecords: group.memberships.slice(0, 16).map((membership, index) => ({
        memberId: membership.memberId,
        present: true,
        compulsoryContribution: 50,
        loanRepaymentPrincipal: index < 3 ? 100 : 0, // First 3 members pay 100 each
        lateFinePaid: index === 0 ? 50 : 0, // Only first member pays fine
        specialContribution: 0
      }))
    };

    // Calculate totals from member records
    const totalContributions = sampleRecord.memberRecords.reduce((sum, mr) => sum + mr.compulsoryContribution, 0);
    const totalLoanRepayments = sampleRecord.memberRecords.reduce((sum, mr) => sum + mr.loanRepaymentPrincipal, 0);
    const totalFines = sampleRecord.memberRecords.reduce((sum, mr) => sum + mr.lateFinePaid, 0);

    console.log(`💰 Sample Record Totals:`);
    console.log(`  Contributions: ₹${totalContributions}`);
    console.log(`  Loan Repayments: ₹${totalLoanRepayments}`);
    console.log(`  Fines: ₹${totalFines}`);
    console.log(`  Interest Earned: ₹${sampleRecord.interestEarnedThisPeriod}`);
    console.log(`  Expenses: ₹${sampleRecord.expensesThisPeriod}`);

    // Expected cash balance calculation:
    // Starting cash + all inflows + loan repayments - expenses
    const expectedCashAvailable = groupCash + totalContributions + totalFines + sampleRecord.interestEarnedThisPeriod + totalLoanRepayments - sampleRecord.expensesThisPeriod;
    const recordedCashTotal = sampleRecord.cashInHandAtEndOfPeriod + sampleRecord.cashInBankAtEndOfPeriod;

    console.log(`\n🧮 Cash Balance Analysis:`);
    console.log(`  Expected Cash Available: ₹${expectedCashAvailable}`);
    console.log(`  Recorded Cash Total: ₹${recordedCashTotal}`);
    console.log(`  Difference: ₹${expectedCashAvailable - recordedCashTotal}`);

    // Expected standing calculation:
    // Starting standing + contributions + fines + interest - expenses
    // (Loan repayments don't affect standing, just convert loan assets to cash)
    const expectedStandingEnd = expectedInitialStanding + totalContributions + totalFines + sampleRecord.interestEarnedThisPeriod - sampleRecord.expensesThisPeriod;

    console.log(`\n📈 Standing Analysis:`);
    console.log(`  Expected Standing End: ₹${expectedStandingEnd}`);
    console.log(`  Recorded Standing End: ₹${sampleRecord.totalGroupStandingAtEndOfPeriod}`);
    console.log(`  Difference: ₹${expectedStandingEnd - sampleRecord.totalGroupStandingAtEndOfPeriod}`);

    console.log(`\n🎯 Key Insight:`);
    console.log(`The cash balance after the meeting should include:`);
    console.log(`1. All contributions and fees collected: ₹${totalContributions + totalFines + sampleRecord.interestEarnedThisPeriod}`);
    console.log(`2. Loan repayments (converting loan assets to cash): ₹${totalLoanRepayments}`);
    console.log(`3. Starting cash: ₹${groupCash}`);
    console.log(`4. Minus expenses: -₹${sampleRecord.expensesThisPeriod}`);
    console.log(`= Total available cash: ₹${expectedCashAvailable}`);

    if (Math.abs(expectedCashAvailable - recordedCashTotal) > 0.01) {
      console.log(`\n⚠️ POTENTIAL CASH BALANCE ISSUE IDENTIFIED!`);
      console.log(`There's a mismatch between expected and recorded cash totals.`);
      console.log(`This could be due to:`);
      console.log(`1. Frontend calculation error in totalCashCollection`);
      console.log(`2. Backend API calculation error`);
      console.log(`3. Missing consideration of starting cash in calculations`);
    }

    // Test the frontend calculation logic
    console.log(`\n🔍 Frontend Logic Test:`);
    console.log(`Frontend totalCashCollection = totalCollectionThisPeriod + loanRepayments`);
    console.log(`= ₹${sampleRecord.totalCollectionThisPeriod} + ₹${totalLoanRepayments}`);
    console.log(`= ₹${sampleRecord.totalCollectionThisPeriod + totalLoanRepayments}`);
    
    console.log(`\nBut this doesn't include starting cash!`);
    console.log(`Actual cash available should be: starting cash + new cash`);
    console.log(`= ₹${groupCash} + ₹${sampleRecord.totalCollectionThisPeriod + totalLoanRepayments}`);
    console.log(`= ₹${groupCash + sampleRecord.totalCollectionThisPeriod + totalLoanRepayments}`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCashBalanceCalculation();
