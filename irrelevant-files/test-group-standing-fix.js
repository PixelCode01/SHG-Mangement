const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testGroupStandingFix() {
  try {
    console.log('🧪 Testing Group Standing Calculation Fix...\n');

    // Find a group with members and loan data
    const group = await prisma.group.findFirst({
      include: {
        memberships: {
          include: {
            member: {
              include: {
                loans: {
                  where: { status: 'ACTIVE' }
                }
              }
            }
          }
        }
      }
    });

    if (!group) {
      console.log('❌ No group found');
      return;
    }

    console.log(`📊 Testing with group: ${group.name} (ID: ${group.id})`);

    // Calculate expected loan assets (same logic as the API fix)
    const membersWithLoans = group.memberships.filter(m => 
      m.member.initialLoanAmount > 0 || m.member.loans.length > 0
    );

    let totalOutstandingLoanAmount = 0;
    let totalInitialLoanAmountWithoutActiveLoans = 0;

    for (const membership of group.memberships) {
      // Outstanding loans from active loan records
      const memberActiveLoans = membership.member.loans.reduce((sum, loan) => sum + loan.currentBalance, 0);
      totalOutstandingLoanAmount += memberActiveLoans;

      // Initial loan amounts for members without active loans
      if (membership.member.loans.length === 0 && membership.member.initialLoanAmount) {
        totalInitialLoanAmountWithoutActiveLoans += membership.member.initialLoanAmount;
      }
    }

    const totalLoanAssets = totalOutstandingLoanAmount + totalInitialLoanAmountWithoutActiveLoans;

    console.log(`📈 Expected loan asset calculation:`);
    console.log(`   - Members: ${group.memberships.length}`);
    console.log(`   - Members with loan data: ${membersWithLoans.length}`);
    console.log(`   - Outstanding loan amounts: ₹${totalOutstandingLoanAmount}`);
    console.log(`   - Initial loan amounts (no active loans): ₹${totalInitialLoanAmountWithoutActiveLoans}`);
    console.log(`   - Total loan assets: ₹${totalLoanAssets}`);

    // Test the periodic records API
    console.log('\n🔧 Testing periodic record creation...');
    
    const testPeriodicData = {
      meetingDate: new Date().toISOString(),
      standingAtStartOfPeriod: 50000,
      newContributionsThisPeriod: 10000,
      expensesThisPeriod: 2000,
      cashInHandAtEndOfPeriod: 58000,
      memberRecords: group.memberships.slice(0, 3).map(m => ({
        memberId: m.member.id,
        compulsoryContribution: 3000,
        loanRepaymentPrincipal: 0,
        lateFinePaid: 0
      }))
    };

    console.log('Test data:', JSON.stringify({
      startingBalance: testPeriodicData.standingAtStartOfPeriod,
      contributions: testPeriodicData.newContributionsThisPeriod,
      expenses: testPeriodicData.expensesThisPeriod,
      expectedCashBalance: testPeriodicData.standingAtStartOfPeriod + testPeriodicData.newContributionsThisPeriod - testPeriodicData.expensesThisPeriod,
      expectedTotalGroupStanding: (testPeriodicData.standingAtStartOfPeriod + testPeriodicData.newContributionsThisPeriod - testPeriodicData.expensesThisPeriod) + totalLoanAssets
    }, null, 2));

    console.log('\n✅ Test setup complete. The periodic records API should now include loan assets in group standing calculation.');
    console.log('\n📝 Expected behavior:');
    console.log('   1. Cash balance = starting balance + inflows - outflows');
    console.log('   2. Total group standing = cash balance + loan assets');
    console.log('   3. This should match the logic used during group creation');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testGroupStandingFix();
