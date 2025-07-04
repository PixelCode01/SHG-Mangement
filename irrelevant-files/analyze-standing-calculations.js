const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function analyzeStandingCalculations() {
  console.log('🔍 Analyzing Group Standing Calculations Across Different Operations...\n');

  try {
    const groupId = '684805fbe1e16d8057f414ad'; // Test group
    
    // Get group with recent records
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        groupPeriodicRecords: {
          orderBy: { meetingDate: 'desc' },
          take: 5
        },
        memberships: {
          include: {
            member: {
              include: {
                loans: { where: { status: 'ACTIVE' } }
              }
            }
          }
        }
      }
    });

    if (!group) {
      console.log('❌ Group not found');
      return;
    }

    console.log(`📊 Group: ${group.name}`);
    console.log(`💰 Current Group Cash: ₹${(group.cashInHand || 0) + (group.balanceInBank || 0)}`);

    // Calculate current loan assets
    let totalActiveLoanAssets = 0;
    let totalMembershipLoanAssets = 0;
    
    group.memberships.forEach(membership => {
      const activeLoans = membership.member.loans.reduce((sum, loan) => sum + loan.currentBalance, 0);
      const membershipLoan = membership.currentLoanAmount || 0;
      
      totalActiveLoanAssets += activeLoans;
      totalMembershipLoanAssets += membershipLoan;
    });

    console.log(`💳 Loan Assets:`);
    console.log(`   - From active loans: ₹${totalActiveLoanAssets}`);
    console.log(`   - From membership records: ₹${totalMembershipLoanAssets}`);
    console.log(`   - Used for calculation: ₹${Math.max(totalActiveLoanAssets, totalMembershipLoanAssets)}`);

    const expectedTotalStanding = (group.cashInHand || 0) + (group.balanceInBank || 0) + Math.max(totalActiveLoanAssets, totalMembershipLoanAssets);
    console.log(`📈 Expected Total Standing: ₹${expectedTotalStanding}`);

    console.log(`\n📋 Recent Periodic Records:`);
    group.groupPeriodicRecords.forEach((record, index) => {
      const standingDiff = expectedTotalStanding - (record.totalGroupStandingAtEndOfPeriod || 0);
      console.log(`  ${index + 1}. ${record.meetingDate.toISOString().split('T')[0]}:`);
      console.log(`     Standing: ₹${record.totalGroupStandingAtEndOfPeriod || 0}`);
      console.log(`     Expected: ₹${expectedTotalStanding}`);
      console.log(`     Difference: ₹${standingDiff} ${Math.abs(standingDiff) < 100 ? '✅' : '❌'}`);
      console.log(`     Cash: ₹${(record.cashInHandAtEndOfPeriod || 0) + (record.cashInBankAtEndOfPeriod || 0)}`);
    });

    // Check if the issue is specific to certain types of operations
    console.log(`\n🎯 Analysis Results:`);
    
    const recentRecord = group.groupPeriodicRecords[0];
    if (recentRecord) {
      const recordCash = (recentRecord.cashInHandAtEndOfPeriod || 0) + (recentRecord.cashInBankAtEndOfPeriod || 0);
      const recordLoans = (recentRecord.totalGroupStandingAtEndOfPeriod || 0) - recordCash;
      
      console.log(`Latest record breakdown:`);
      console.log(`  Cash in record: ₹${recordCash}`);
      console.log(`  Implied loans in record: ₹${recordLoans}`);
      console.log(`  Actual loan assets: ₹${Math.max(totalActiveLoanAssets, totalMembershipLoanAssets)}`);
      
      if (Math.abs(recordLoans - Math.max(totalActiveLoanAssets, totalMembershipLoanAssets)) < 100) {
        console.log(`  🎉 ✅ Loan assets are correctly included in total standing!`);
      } else {
        console.log(`  ⚠️ ❌ Loan assets mismatch detected`);
        console.log(`  💡 This suggests the issue might be:`);
        console.log(`     1. Using old calculation formula`);
        console.log(`     2. Loan assets not being updated properly`);
        console.log(`     3. Different API endpoint being used`);
      }
    }

  } catch (error) {
    console.error('❌ Analysis failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeStandingCalculations();
