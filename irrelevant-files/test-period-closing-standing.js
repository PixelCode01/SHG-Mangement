const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');

const prisma = new PrismaClient();

async function testPeriodClosingStanding() {
  console.log('🧪 Testing Period Closing - Total Standing Calculation...\n');

  try {
    const groupId = '684805fbe1e16d8057f414ad'; // Test group
    
    // Step 1: Get current group state
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        groupPeriodicRecords: {
          orderBy: { meetingDate: 'desc' },
          take: 2
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

    const latestRecord = group.groupPeriodicRecords[0];
    console.log(`📊 Current State:`);
    console.log(`  Group Cash: ₹${(group.cashInHand || 0) + (group.balanceInBank || 0)}`);
    console.log(`  Latest Record Standing: ₹${latestRecord?.totalGroupStandingAtEndOfPeriod || 0}`);
    console.log(`  Latest Record Date: ${latestRecord?.meetingDate?.toISOString()?.split('T')[0] || 'None'}`);

    // Calculate current loan assets
    let totalLoanAssets = 0;
    group.memberships.forEach(membership => {
      const activeLoans = membership.member.loans.reduce((sum, loan) => sum + loan.currentBalance, 0);
      const membershipLoan = membership.currentLoanAmount || 0;
      totalLoanAssets += activeLoans > 0 ? activeLoans : membershipLoan;
    });
    console.log(`  Current Loan Assets: ₹${totalLoanAssets}`);
    console.log(`  Expected Total Standing: ₹${(group.cashInHand || 0) + (group.balanceInBank || 0) + totalLoanAssets}`);

    // Step 2: Simulate a period closing operation
    console.log(`\n🔄 Simulating Period Closing Operation...`);
    
    const periodClosingData = {
      meetingDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      newContributionsThisPeriod: 2000, // Some contributions
      interestEarnedThisPeriod: 500,
      lateFinesCollectedThisPeriod: 100,
      loanProcessingFeesCollectedThisPeriod: 0,
      expensesThisPeriod: 300,
      memberRecords: [
        {
          memberId: group.memberships[0].memberId,
          memberName: group.memberships[0].member.name,
          compulsoryContribution: 500,
          loanRepaymentPrincipal: 1000, // Important: loan repayment
          lateFinePaid: 100
        }
      ]
    };

    console.log(`📤 Period Closing Data:`, JSON.stringify({
      contributions: periodClosingData.newContributionsThisPeriod,
      interest: periodClosingData.interestEarnedThisPeriod,
      expenses: periodClosingData.expensesThisPeriod,
      loanRepayment: periodClosingData.memberRecords[0].loanRepaymentPrincipal
    }, null, 2));

    // Step 3: Make API call and analyze result
    const response = await fetch(`http://localhost:3001/api/groups/${groupId}/periodic-records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(periodClosingData)
    });

    if (response.ok) {
      const result = await response.json();
      
      console.log(`\n✅ Period Closing Result:`);
      console.log(`  New Record ID: ${result.id}`);
      console.log(`  Standing at Start: ₹${result.standingAtStartOfPeriod}`);
      console.log(`  Total Group Standing at End: ₹${result.totalGroupStandingAtEndOfPeriod}`);
      console.log(`  Cash in Bank: ₹${result.cashInBankAtEndOfPeriod}`);
      console.log(`  Cash in Hand: ₹${result.cashInHandAtEndOfPeriod}`);
      
      // Calculate expected values
      const expectedCash = (group.cashInHand || 0) + (group.balanceInBank || 0) + 
                          periodClosingData.newContributionsThisPeriod + 
                          periodClosingData.interestEarnedThisPeriod + 
                          periodClosingData.lateFinesCollectedThisPeriod + 
                          periodClosingData.memberRecords[0].loanRepaymentPrincipal -
                          periodClosingData.expensesThisPeriod;
      
      const expectedLoanAssets = totalLoanAssets - periodClosingData.memberRecords[0].loanRepaymentPrincipal;
      const expectedTotalStanding = expectedCash + expectedLoanAssets;
      
      console.log(`\n📊 Analysis:`);
      console.log(`  Expected Cash: ₹${expectedCash}`);
      console.log(`  Expected Loan Assets: ₹${expectedLoanAssets}`);
      console.log(`  Expected Total Standing: ₹${expectedTotalStanding}`);
      console.log(`  Actual Total Standing: ₹${result.totalGroupStandingAtEndOfPeriod}`);
      console.log(`  Difference: ₹${Math.abs(expectedTotalStanding - result.totalGroupStandingAtEndOfPeriod)}`);
      
      if (Math.abs(expectedTotalStanding - result.totalGroupStandingAtEndOfPeriod) < 10) {
        console.log(`\n🎉 ✅ PERIOD CLOSING FIX IS WORKING!`);
      } else {
        console.log(`\n⚠️ ❌ PERIOD CLOSING ISSUE DETECTED - Need to investigate logs`);
      }

    } else {
      const errorText = await response.text();
      console.log(`❌ API Error: ${response.status}`);
      console.log(`Error details: ${errorText.substring(0, 500)}...`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testPeriodClosingStanding();
