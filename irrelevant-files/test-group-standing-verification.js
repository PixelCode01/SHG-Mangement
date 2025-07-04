const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testGroupStandingWithLoanRepayment() {
  try {
    console.log('=== TESTING GROUP STANDING WITH LOAN REPAYMENTS ===\n');

    // Find a group with members who have loan amounts
    const group = await prisma.group.findFirst({
      where: {
        memberships: {
          some: {
            currentLoanAmount: { gt: 1000 }
          }
        }
      },
      include: {
        memberships: {
          where: {
            currentLoanAmount: { gt: 0 }
          },
          include: {
            member: { select: { name: true } }
          }
        },
        groupPeriodicRecords: {
          orderBy: { meetingDate: 'desc' },
          take: 1
        }
      }
    });

    if (!group) {
      console.log('❌ No group with loan amounts found for testing');
      return;
    }

    console.log(`✅ Found test group: ${group.name} (ID: ${group.id})`);
    
    // Show current state
    const latestRecord = group.groupPeriodicRecords[0];
    const currentStanding = latestRecord ? latestRecord.totalGroupStandingAtEndOfPeriod : 0;
    
    console.log(`\n📊 Current State:`);
    console.log(`  Latest Group Standing: ₹${(currentStanding || 0).toLocaleString()}`);
    
    const membersWithLoans = group.memberships.filter(m => m.currentLoanAmount > 0);
    console.log(`\n💰 Members with Loans (${membersWithLoans.length}):`);
    
    let totalLoans = 0;
    membersWithLoans.forEach(m => {
      totalLoans += m.currentLoanAmount;
      console.log(`  - ${m.member.name}: ₹${m.currentLoanAmount.toLocaleString()}`);
    });
    
    console.log(`  Total Outstanding Loans: ₹${totalLoans.toLocaleString()}`);

    // Pick a member with loan for test repayment
    const memberWithLoan = membersWithLoans[0];
    const repaymentAmount = Math.min(1000, memberWithLoan.currentLoanAmount);
    
    console.log(`\n🧪 SIMULATION:`);
    console.log(`If ${memberWithLoan.member.name} repays ₹${repaymentAmount.toLocaleString()}:`);
    console.log(`  EXPECTED BEHAVIOR:`);
    console.log(`  ✓ Member's loan: ₹${memberWithLoan.currentLoanAmount.toLocaleString()} → ₹${(memberWithLoan.currentLoanAmount - repaymentAmount).toLocaleString()}`);
    console.log(`  ✓ Group Cash: increases by ₹${repaymentAmount.toLocaleString()}`);
    console.log(`  ✓ Group Standing: REMAINS ₹${(currentStanding || 0).toLocaleString()} (unchanged)`);
    console.log(`  ❌ Group Standing should NOT increase to ₹${(currentStanding + repaymentAmount).toLocaleString()}`);

    // Create a test periodic record with loan repayment
    console.log(`\n🚀 CREATING TEST PERIODIC RECORD...`);
    
    const testRecordData = {
      meetingDate: new Date().toISOString(),
      newContributionsThisPeriod: 0,
      interestEarnedThisPeriod: 0,
      lateFinesCollectedThisPeriod: 0,
      loanProcessingFeesCollectedThisPeriod: 0,
      expensesThisPeriod: 0,
      memberRecords: [
        {
          memberId: memberWithLoan.memberId,
          memberName: memberWithLoan.member.name,
          compulsoryContribution: 0,
          loanRepaymentPrincipal: repaymentAmount,
          lateFinePaid: 0
        }
      ]
    };

    console.log(`Submitting to: /api/groups/${group.id}/periodic-records`);
    console.log(`Test data:`, JSON.stringify(testRecordData, null, 2));

    const response = await fetch(`http://localhost:3000/api/groups/${group.id}/periodic-records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testRecordData)
    });

    if (response.ok) {
      const newRecord = await response.json();
      
      console.log(`\n✅ RECORD CREATED SUCCESSFULLY!`);
      console.log(`  Record ID: ${newRecord.id}`);
      console.log(`  Previous Standing: ₹${(currentStanding || 0).toLocaleString()}`);
      console.log(`  New Standing: ₹${(newRecord.totalGroupStandingAtEndOfPeriod || 0).toLocaleString()}`);
      
      const standingChange = (newRecord.totalGroupStandingAtEndOfPeriod || 0) - (currentStanding || 0);
      console.log(`  Change: ${standingChange >= 0 ? '+' : ''}₹${standingChange.toLocaleString()}`);
      
      if (Math.abs(standingChange) < 1) {
        console.log(`\n🎉 ✅ SUCCESS: Group standing remained unchanged! Fix is working correctly.`);
      } else {
        console.log(`\n⚠️  ❌ ISSUE: Group standing changed by ₹${standingChange.toLocaleString()}. Fix may not be working.`);
      }

      // Verify loan amount was reduced
      const updatedMembership = await prisma.memberGroupMembership.findUnique({
        where: {
          memberId_groupId: {
            memberId: memberWithLoan.memberId,
            groupId: group.id
          }
        }
      });

      if (updatedMembership) {
        console.log(`\n💰 Loan Amount Update:`);
        console.log(`  Before: ₹${memberWithLoan.currentLoanAmount.toLocaleString()}`);
        console.log(`  After: ₹${(updatedMembership.currentLoanAmount || 0).toLocaleString()}`);
        
        const loanReduction = memberWithLoan.currentLoanAmount - (updatedMembership.currentLoanAmount || 0);
        if (Math.abs(loanReduction - repaymentAmount) < 1) {
          console.log(`  ✅ Loan reduced by ₹${loanReduction.toLocaleString()} as expected`);
        } else {
          console.log(`  ❌ Loan reduction (₹${loanReduction.toLocaleString()}) doesn't match repayment (₹${repaymentAmount.toLocaleString()})`);
        }
      }

    } else {
      const errorText = await response.text();
      console.log(`❌ FAILED TO CREATE RECORD:`);
      console.log(`  Status: ${response.status}`);
      console.log(`  Error: ${errorText}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testGroupStandingWithLoanRepayment();
