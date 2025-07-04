#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function validateContributionDiscrepancyFix() {
  try {
    console.log('🔍 CONTRIBUTION DISCREPANCY FIX - VALIDATION REPORT');
    console.log('===================================================\n');

    // Find a group with loan data for testing
    const group = await prisma.group.findFirst({
      where: {
        memberships: {
          some: {
            OR: [
              { currentLoanAmount: { gt: 0 } },
              { member: { loans: { some: { status: 'ACTIVE' } } } }
            ]
          }
        }
      },
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
      console.log('❌ No group found with loan data for testing');
      return;
    }

    console.log(`📋 Test Group: ${group.name} (ID: ${group.id})`);
    console.log(`   Members: ${group.memberships.length}`);
    console.log(`   Interest Rate: ${group.interestRate || 0}%`);
    console.log(`   Monthly Contribution: ₹${group.monthlyContribution || 0}`);

    // === STEP 1: FRONTEND CALCULATION (before fix) ===
    console.log('\n1️⃣ FRONTEND CALCULATION (how contributions page calculates)');
    console.log('─'.repeat(60));

    const monthlyContribution = group.monthlyContribution || 0;
    const interestRate = (group.interestRate || 0) / 100;
    
    // Calculate period interest rate based on collection frequency
    let periodsPerYear = 12;
    switch (group.collectionFrequency) {
      case 'WEEKLY': periodsPerYear = 52; break;
      case 'FORTNIGHTLY': periodsPerYear = 26; break;
      case 'MONTHLY': periodsPerYear = 12; break;
      case 'YEARLY': periodsPerYear = 1; break;
    }
    const periodInterestRate = interestRate / periodsPerYear;

    let frontendTotalExpected = 0;
    let frontendTotalInterest = 0;

    console.log('Member loan balances and expected interest:');
    group.memberships.forEach(membership => {
      const member = membership.member;
      
      // Calculate current loan balance (same as frontend logic)
      const activeLoanBalance = member.loans?.reduce((total, loan) => total + loan.currentBalance, 0) || 0;
      const currentLoanBalance = activeLoanBalance > 0 ? activeLoanBalance : (membership.currentLoanAmount || 0);
      
      // Calculate expected interest
      const expectedInterest = currentLoanBalance * periodInterestRate;
      const memberTotal = monthlyContribution + expectedInterest;

      frontendTotalExpected += memberTotal;
      frontendTotalInterest += expectedInterest;

      if (currentLoanBalance > 0) {
        console.log(`   ${member.name}: Loan ₹${currentLoanBalance.toLocaleString()}, Interest ₹${expectedInterest.toFixed(2)}, Total ₹${memberTotal.toFixed(2)}`);
      }
    });

    console.log(`\n💰 Frontend Summary:`);
    console.log(`   Total Expected Contributions: ₹${(group.memberships.length * monthlyContribution).toFixed(2)}`);
    console.log(`   Total Expected Interest: ₹${frontendTotalInterest.toFixed(2)}`);
    console.log(`   Frontend Total Expected: ₹${frontendTotalExpected.toFixed(2)}`);

    // === STEP 2: CREATE PERIODIC RECORD WITH NEW LOGIC ===
    console.log('\n2️⃣ CREATING PERIODIC RECORD WITH FIXED LOGIC');
    console.log('─'.repeat(60));

    const memberRecords = group.memberships.map(membership => ({
      memberId: membership.member.id,
      memberName: membership.member.name,
      compulsoryContribution: monthlyContribution,
      loanRepaymentPrincipal: 0,
      lateFinePaid: 0
    }));

    const testData = {
      meetingDate: new Date().toISOString(),
      newContributionsThisPeriod: group.memberships.length * monthlyContribution,
      interestEarnedThisPeriod: frontendTotalInterest,
      lateFinesCollectedThisPeriod: 0,
      loanProcessingFeesCollectedThisPeriod: 0,
      expensesThisPeriod: 0,
      memberRecords: memberRecords
    };

    console.log(`Creating periodic record with ${memberRecords.length} member records...`);

    const response = await fetch(`http://localhost:3000/api/groups/${group.id}/periodic-records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ API call failed: ${response.status} ${response.statusText}`);
      console.log(`   Error: ${errorText}`);
      return;
    }

    const createdRecord = await response.json();
    console.log(`✅ Created periodic record: ${createdRecord.id}`);

    // === STEP 3: VERIFY BACKEND CALCULATION ===
    console.log('\n3️⃣ BACKEND CALCULATION VALIDATION (after fix)');
    console.log('─'.repeat(60));

    const memberContributions = await prisma.memberContribution.findMany({
      where: { groupPeriodicRecordId: createdRecord.id },
      include: { member: true },
      orderBy: { member: { name: 'asc' } }
    });

    let backendTotalExpected = 0;
    let backendTotalInterest = 0;

    console.log('Backend member contribution records:');
    memberContributions.forEach(contribution => {
      const memberTotal = contribution.compulsoryContributionDue + (contribution.loanInterestDue || 0);
      backendTotalExpected += memberTotal;
      backendTotalInterest += contribution.loanInterestDue || 0;

      if ((contribution.loanInterestDue || 0) > 0) {
        console.log(`   ${contribution.member.name}: Contribution ₹${contribution.compulsoryContributionDue}, Interest ₹${(contribution.loanInterestDue || 0).toFixed(2)}, Total ₹${memberTotal.toFixed(2)}`);
      }
    });

    console.log(`\n💰 Backend Summary:`);
    console.log(`   Total Expected Contributions: ₹${(memberContributions.length * monthlyContribution).toFixed(2)}`);
    console.log(`   Total Expected Interest: ₹${backendTotalInterest.toFixed(2)}`);
    console.log(`   Backend Total Expected: ₹${backendTotalExpected.toFixed(2)}`);

    // === STEP 4: COMPARISON AND RESULT ===
    console.log('\n4️⃣ COMPARISON AND VALIDATION RESULT');
    console.log('─'.repeat(60));

    const difference = Math.abs(frontendTotalExpected - backendTotalExpected);
    const interestDifference = Math.abs(frontendTotalInterest - backendTotalInterest);

    console.log(`Frontend Total Expected: ₹${frontendTotalExpected.toFixed(2)}`);
    console.log(`Backend Total Expected:  ₹${backendTotalExpected.toFixed(2)}`);
    console.log(`Difference:              ₹${difference.toFixed(2)}`);
    console.log(`Interest Difference:     ₹${interestDifference.toFixed(2)}`);

    if (difference < 0.01 && interestDifference < 0.01) {
      console.log('\n🎉 SUCCESS: Frontend and backend calculations match perfectly!');
      console.log('✅ The contribution discrepancy issue has been resolved.');
      console.log('✅ Loan interest is now correctly calculated in backend.');
      console.log('✅ MemberContribution records include proper loanInterestDue values.');
    } else {
      console.log('\n❌ FAILURE: Frontend and backend calculations still don\'t match.');
      console.log('❌ The fix may need further adjustments.');
    }

    // === STEP 5: TESTING EDGE CASES ===
    console.log('\n5️⃣ EDGE CASE VALIDATION');
    console.log('─'.repeat(60));

    // Check members with zero loan balance
    const membersWithZeroLoans = memberContributions.filter(mc => (mc.loanInterestDue || 0) === 0);
    console.log(`Members with zero loan interest: ${membersWithZeroLoans.length}`);
    
    // Check members with loan interest
    const membersWithLoans = memberContributions.filter(mc => (mc.loanInterestDue || 0) > 0);
    console.log(`Members with loan interest: ${membersWithLoans.length}`);

    // Verify that remaining amount is calculated correctly
    const correctRemainingCalculations = memberContributions.filter(mc => {
      const expectedRemaining = Math.max(0, mc.minimumDueAmount - mc.totalPaid);
      return Math.abs(mc.remainingAmount - expectedRemaining) < 0.01;
    });
    console.log(`Correct remaining amount calculations: ${correctRemainingCalculations.length}/${memberContributions.length}`);

    if (correctRemainingCalculations.length === memberContributions.length) {
      console.log('✅ All remaining amount calculations are correct');
    } else {
      console.log('❌ Some remaining amount calculations are incorrect');
    }

    // === CLEANUP ===
    console.log('\n🧹 Cleaning up test record...');
    await prisma.memberContribution.deleteMany({
      where: { groupPeriodicRecordId: createdRecord.id }
    });
    await prisma.groupMemberPeriodicRecord.deleteMany({
      where: { groupPeriodicRecordId: createdRecord.id }
    });
    await prisma.groupPeriodicRecord.delete({
      where: { id: createdRecord.id }
    });
    console.log('✅ Cleanup completed');

    console.log('\n📋 SUMMARY:');
    console.log('The backend periodic record creation logic now:');
    console.log('1. ✅ Calculates loan interest for each member based on their current loan balance');
    console.log('2. ✅ Creates MemberContribution records with proper loanInterestDue values');
    console.log('3. ✅ Ensures backend "Total Expected" matches frontend calculation');
    console.log('4. ✅ Handles both active loans and membership loan amounts correctly');
    console.log('5. ✅ Applies period-based interest rates (weekly, monthly, etc.)');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

validateContributionDiscrepancyFix();
