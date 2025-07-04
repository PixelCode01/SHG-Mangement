/**
 * Debug script to check cash balance calculations after record creation
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugCashBalanceIssue() {
  console.log('🔍 Debugging Cash Balance Issue...\n');

  try {
    // Get the test group with recent records
    const group = await prisma.group.findUnique({
      where: { id: '683ad41a7b643449e12cd5b6' }, // Group 'gd'
      include: {
        groupPeriodicRecords: {
          orderBy: { meetingDate: 'desc' },
          take: 3,
          include: {
            memberRecords: {
              include: {
                member: true
              }
            }
          }
        },
        memberships: {
          include: {
            member: true
          }
        }
      }
    });

    if (!group) {
      console.log('❌ Group not found');
      return;
    }

    console.log(`📊 Group: ${group.name}`);
    console.log(`💰 Initial Cash in Hand: ₹${group.cashInHand || 0}`);
    console.log(`🏦 Initial Cash in Bank: ₹${group.balanceInBank || 0}`);
    console.log(`📋 Total Records: ${group.groupPeriodicRecords.length}\n`);

    if (group.groupPeriodicRecords.length === 0) {
      console.log('ℹ️ No periodic records found. This is expected for first record testing.');
      return;
    }

    // Analyze the most recent record
    const latestRecord = group.groupPeriodicRecords[0];
    console.log(`🔍 Latest Record Analysis:`);
    console.log(`📅 Date: ${latestRecord.meetingDate.toLocaleDateString()}`);
    console.log(`💰 Standing at Start: ₹${latestRecord.standingAtStartOfPeriod || 0}`);
    console.log(`💵 Total Collection: ₹${latestRecord.totalCollectionThisPeriod || 0}`);
    console.log(`💸 Expenses: ₹${latestRecord.expensesThisPeriod || 0}`);
    console.log(`📈 Standing at End: ₹${latestRecord.totalGroupStandingAtEndOfPeriod || 0}`);
    console.log(`🏦 Cash in Bank (End): ₹${latestRecord.cashInBankAtEndOfPeriod || 0}`);
    console.log(`👋 Cash in Hand (End): ₹${latestRecord.cashInHandAtEndOfPeriod || 0}`);

    // Calculate expected cash total
    const expectedCashTotal = (latestRecord.cashInBankAtEndOfPeriod || 0) + (latestRecord.cashInHandAtEndOfPeriod || 0);
    console.log(`💱 Total Cash (Bank + Hand): ₹${expectedCashTotal}`);

    // Analyze member records for loan repayments
    const memberRecords = latestRecord.memberRecords || [];
    let totalContributions = 0;
    let totalLoanRepayments = 0;
    let totalFines = 0;

    console.log(`\n👥 Member Record Analysis:`);
    memberRecords.forEach(record => {
      const contribution = record.compulsoryContribution || 0;
      const loanRepayment = record.loanRepaymentPrincipal || 0;
      const fine = record.lateFinePaid || 0;

      totalContributions += contribution;
      totalLoanRepayments += loanRepayment;
      totalFines += fine;

      if (contribution > 0 || loanRepayment > 0 || fine > 0) {
        console.log(`  📋 ${record.member.name}: Contribution ₹${contribution}, Loan Repayment ₹${loanRepayment}, Fine ₹${fine}`);
      }
    });

    console.log(`\n📊 Totals from Member Records:`);
    console.log(`  💰 Total Contributions: ₹${totalContributions}`);
    console.log(`  💳 Total Loan Repayments: ₹${totalLoanRepayments}`);
    console.log(`  💸 Total Fines: ₹${totalFines}`);

    // Check the calculation logic
    const expectedStandingEnd = (latestRecord.standingAtStartOfPeriod || 0) + 
                               totalContributions + 
                               totalFines + 
                               (latestRecord.interestEarnedThisPeriod || 0) + 
                               (latestRecord.loanProcessingFeesCollectedThisPeriod || 0) - 
                               (latestRecord.expensesThisPeriod || 0);

    const expectedCashBalance = expectedStandingEnd + totalLoanRepayments;

    console.log(`\n🧮 Expected Calculations:`);
    console.log(`  📈 Expected Standing End: ₹${expectedStandingEnd}`);
    console.log(`  💱 Expected Cash Available: ₹${expectedCashBalance}`);
    console.log(`  📊 Actual Cash Total: ₹${expectedCashTotal}`);
    console.log(`  ❓ Difference: ₹${expectedCashBalance - expectedCashTotal}`);

    // Check if there's a calculation mismatch
    if (Math.abs(expectedCashBalance - expectedCashTotal) > 0.01) {
      console.log(`\n⚠️ CASH BALANCE MISMATCH DETECTED!`);
      console.log(`Expected: ₹${expectedCashBalance}, Actual: ₹${expectedCashTotal}`);
    } else {
      console.log(`\n✅ Cash balance calculations appear correct`);
    }

    // Check loan assets
    console.log(`\n💳 Current Loan Assets:`);
    let totalLoanAssets = 0;
    group.memberships.forEach(membership => {
      const loanAmount = membership.currentLoanAmount || 0;
      if (loanAmount > 0) {
        console.log(`  📋 ${membership.member.name}: ₹${loanAmount}`);
        totalLoanAssets += loanAmount;
      }
    });
    console.log(`  📊 Total Loan Assets: ₹${totalLoanAssets}`);

    const totalGroupAssets = expectedCashTotal + totalLoanAssets;
    console.log(`\n📈 Total Group Assets: ₹${totalGroupAssets}`);
    console.log(`📊 Recorded Standing: ₹${latestRecord.totalGroupStandingAtEndOfPeriod || 0}`);

  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugCashBalanceIssue();
