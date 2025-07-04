const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyzeStandingCalculationDirectly() {
  console.log('🔍 Analyzing Group Standing Calculation Directly from Database...');
  console.log('================================================================');

  try {
    // Find groups with existing periodic records
    const groupsWithRecords = await prisma.group.findMany({
      where: {
        groupPeriodicRecords: {
          some: {}
        }
      },
      include: {
        groupPeriodicRecords: {
          orderBy: { recordSequenceNumber: 'desc' },
          take: 3
        }
      },
      take: 3
    });

    if (groupsWithRecords.length === 0) {
      console.log('❌ No groups with periodic records found');
      return;
    }

    for (const group of groupsWithRecords) {
      console.log(`\n📊 ANALYZING GROUP: ${group.name} (ID: ${group.id})`);
      console.log('='.repeat(60));
      
      console.log(`Current Group Data:`);
      console.log(`  Cash in Hand: ₹${group.cashInHand || 0}`);
      console.log(`  Cash in Bank: ₹${group.balanceInBank || 0}`);
      console.log(`  Total Current Cash: ₹${(group.cashInHand || 0) + (group.balanceInBank || 0)}`);

      // Get all active loans for this group
      const activeLoans = await prisma.loan.findMany({
        where: {
          groupId: group.id,
          status: 'ACTIVE'
        },
        select: {
          id: true,
          originalAmount: true,
          currentBalance: true,
          memberId: true,
          createdAt: true,
          status: true
        }
      });

      console.log(`\nActive Loans Analysis:`);
      console.log(`  Total Active Loans: ${activeLoans.length}`);
      let totalLoanAssetsFromActiveLoans = 0;
      activeLoans.forEach(loan => {
        totalLoanAssetsFromActiveLoans += (loan.currentBalance || 0);
        console.log(`    Loan ${loan.id}: ₹${loan.currentBalance || 0} (Original: ₹${loan.originalAmount || 0})`);
      });
      console.log(`  Total Loan Assets from Active Loans: ₹${totalLoanAssetsFromActiveLoans}`);

      // Alternative calculation methods
      console.log(`\nAlternative Loan Asset Calculations:`);
      
      // Method 1: From member.currentLoanAmount
      const memberLoanAssets = await prisma.member.aggregate({
        where: {
          memberships: {
            some: { groupId: group.id }
          }
        },
        _sum: {
          currentLoanAmount: true
        }
      });
      const loanAssetsFromMembers = memberLoanAssets._sum.currentLoanAmount || 0;
      console.log(`  Method 1 (member.currentLoanAmount): ₹${loanAssetsFromMembers}`);

      // Method 2: From membership.currentLoanAmount
      const membershipLoanAssets = await prisma.memberGroupMembership.aggregate({
        where: {
          groupId: group.id
        },
        _sum: {
          currentLoanAmount: true
        }
      });
      const loanAssetsFromMemberships = membershipLoanAssets._sum.currentLoanAmount || 0;
      console.log(`  Method 2 (membership.currentLoanAmount): ₹${loanAssetsFromMemberships}`);

      console.log(`  Method 3 (active loan.currentBalance): ₹${totalLoanAssetsFromActiveLoans}`);

      // Calculate expected standing using different methods
      const currentCash = (group.cashInHand || 0) + (group.balanceInBank || 0);
      
      console.log(`\nExpected Group Standing Calculations:`);
      console.log(`  Method 1: ₹${currentCash} + ₹${loanAssetsFromMembers} = ₹${currentCash + loanAssetsFromMembers}`);
      console.log(`  Method 2: ₹${currentCash} + ₹${loanAssetsFromMemberships} = ₹${currentCash + loanAssetsFromMemberships}`);
      console.log(`  Method 3: ₹${currentCash} + ₹${totalLoanAssetsFromActiveLoans} = ₹${currentCash + totalLoanAssetsFromActiveLoans}`);

      // Analyze periodic records
      console.log(`\nPeriodic Records Analysis:`);
      console.log(`  Found ${group.groupPeriodicRecords.length} recent records`);
      
      for (const record of group.groupPeriodicRecords) {
        console.log(`\n  Record ${record.recordSequenceNumber} (${record.meetingDate.toISOString().split('T')[0]}):`);
        console.log(`    Cash in Hand at End: ₹${record.cashInHandAtEndOfPeriod || 0}`);
        console.log(`    Cash in Bank at End: ₹${record.cashInBankAtEndOfPeriod || 0}`);
        console.log(`    Stored Total Standing: ₹${record.totalGroupStandingAtEndOfPeriod || 0}`);
        console.log(`    Standing at Start: ₹${record.standingAtStartOfPeriod || 0}`);
        console.log(`    Collection This Period: ₹${record.totalCollectionThisPeriod || 0}`);
        console.log(`    Interest This Period: ₹${record.interestEarnedThisPeriod || 0}`);
        
        // Calculate what the standing should be based on the record's cash values
        const recordCash = (record.cashInHandAtEndOfPeriod || 0) + (record.cashInBankAtEndOfPeriod || 0);
        const expectedStandingMethod1 = recordCash + loanAssetsFromMembers;
        const expectedStandingMethod2 = recordCash + loanAssetsFromMemberships;
        const expectedStandingMethod3 = recordCash + totalLoanAssetsFromActiveLoans;
        
        console.log(`    Expected Standing (Method 1): ₹${expectedStandingMethod1}`);
        console.log(`    Expected Standing (Method 2): ₹${expectedStandingMethod2}`);
        console.log(`    Expected Standing (Method 3): ₹${expectedStandingMethod3}`);
        
        const storedStanding = record.totalGroupStandingAtEndOfPeriod || 0;
        console.log(`    Matches Method 1?: ${storedStanding === expectedStandingMethod1 ? 'YES ✓' : 'NO ✗'}`);
        console.log(`    Matches Method 2?: ${storedStanding === expectedStandingMethod2 ? 'YES ✓' : 'NO ✗'}`);
        console.log(`    Matches Method 3?: ${storedStanding === expectedStandingMethod3 ? 'YES ✓' : 'NO ✗'}`);
        
        // Check for the specific values mentioned in the user's data
        if (storedStanding === 140974) {
          console.log(`    🎯 FOUND PROBLEM VALUE: ₹140,974 - This is the discrepant value!`);
        }
        if (recordCash + totalLoanAssetsFromActiveLoans === 127700) {
          console.log(`    🎯 FOUND EXPECTED VALUE: ₹127,700 - This should be the correct calculation!`);
        }
      }
    }

    console.log(`\n📋 SUMMARY OF FINDINGS:`);
    console.log(`=====================================`);
    console.log(`This analysis shows:`);
    console.log(`1. Which loan calculation method each group is using`);
    console.log(`2. Whether stored standing values match expected calculations`);
    console.log(`3. Where the ₹140,974 vs ₹127,700 discrepancy might be coming from`);
    console.log(`4. The exact differences between calculation methods`);

  } catch (error) {
    console.error('❌ Analysis failed with error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the analysis
analyzeStandingCalculationDirectly()
  .catch(error => {
    console.error('Analysis script failed:', error);
    process.exit(1);
  });
