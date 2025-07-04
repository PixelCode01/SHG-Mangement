#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testContributionDiscrepancyFix() {
  try {
    console.log('🧪 TESTING CONTRIBUTION DISCREPANCY FIX');
    console.log('=========================================\n');

    // Find a group with members and loan data
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
        },
        groupPeriodicRecords: {
          orderBy: { meetingDate: 'desc' },
          take: 1
        }
      }
    });

    if (!group) {
      console.log('❌ No group found with loan data');
      return;
    }

    console.log(`📋 Testing Group: ${group.name} (ID: ${group.id})`);
    console.log(`   Members: ${group.memberships.length}`);
    console.log(`   Interest Rate: ${group.interestRate || 0}%`);
    console.log(`   Collection Frequency: ${group.collectionFrequency || 'MONTHLY'}`);
    console.log(`   Monthly Contribution: ₹${group.monthlyContribution || 0}`);

    // Calculate member loan amounts and expected interest (frontend style)
    console.log('\n💰 MEMBER LOAN ANALYSIS:');
    let totalExpectedContributions = 0;
    let totalExpectedInterest = 0;
    let frontendTotalExpected = 0;

    const memberData = [];
    const monthlyContribution = group.monthlyContribution || 0;
    const interestRate = (group.interestRate || 0) / 100;

    // Calculate period interest rate
    let periodsPerYear = 12;
    switch (group.collectionFrequency) {
      case 'WEEKLY': periodsPerYear = 52; break;
      case 'FORTNIGHTLY': periodsPerYear = 26; break;
      case 'MONTHLY': periodsPerYear = 12; break;
      case 'YEARLY': periodsPerYear = 1; break;
    }
    const periodInterestRate = interestRate / periodsPerYear;

    for (const membership of group.memberships) {
      const member = membership.member;
      
      // Calculate current loan balance (same as API logic)
      const activeLoanBalance = member.loans?.reduce((total, loan) => total + loan.currentBalance, 0) || 0;
      const currentLoanBalance = activeLoanBalance > 0 ? activeLoanBalance : (membership.currentLoanAmount || 0);
      
      // Calculate expected interest for this member
      const expectedInterest = currentLoanBalance * periodInterestRate;
      const memberTotalExpected = monthlyContribution + expectedInterest;

      memberData.push({
        memberId: member.id,
        memberName: member.name,
        currentLoanBalance,
        expectedContribution: monthlyContribution,
        expectedInterest,
        totalExpected: memberTotalExpected
      });

      totalExpectedContributions += monthlyContribution;
      totalExpectedInterest += expectedInterest;
      frontendTotalExpected += memberTotalExpected;

      console.log(`   ${member.name}: Loan ₹${currentLoanBalance.toLocaleString()}, Interest ₹${expectedInterest.toFixed(2)}, Total ₹${memberTotalExpected.toFixed(2)}`);
    }

    console.log(`\n📊 FRONTEND CALCULATION (BEFORE FIX):`);
    console.log(`   Total Expected Contributions: ₹${totalExpectedContributions.toFixed(2)}`);
    console.log(`   Total Expected Interest: ₹${totalExpectedInterest.toFixed(2)}`);
    console.log(`   Frontend Total Expected: ₹${frontendTotalExpected.toFixed(2)}`);

    // Create a test periodic record to test our fix
    console.log('\n🚀 CREATING TEST PERIODIC RECORD...');
    
    const memberRecords = memberData.map(member => ({
      memberId: member.memberId,
      memberName: member.memberName,
      compulsoryContribution: member.expectedContribution,
      loanRepaymentPrincipal: 0,
      lateFinePaid: 0
    }));

    const testData = {
      meetingDate: new Date().toISOString(),
      newContributionsThisPeriod: totalExpectedContributions,
      interestEarnedThisPeriod: totalExpectedInterest,
      lateFinesCollectedThisPeriod: 0,
      loanProcessingFeesCollectedThisPeriod: 0,
      expensesThisPeriod: 0,
      memberRecords: memberRecords
    };

    console.log(`   Creating periodic record with ${memberRecords.length} member records...`);

    // Call the API to create the periodic record (this will now create MemberContribution records)
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

    // Check if MemberContribution records were created
    console.log('\n🔍 VERIFYING MEMBER CONTRIBUTION RECORDS...');
    
    const memberContributions = await prisma.memberContribution.findMany({
      where: { groupPeriodicRecordId: createdRecord.id },
      include: { member: true }
    });

    console.log(`   Found ${memberContributions.length} MemberContribution records`);

    let backendTotalExpected = 0;
    let backendTotalContributions = 0;
    let backendTotalInterest = 0;

    memberContributions.forEach(contribution => {
      const expectedTotal = contribution.compulsoryContributionDue + (contribution.loanInterestDue || 0);
      backendTotalExpected += expectedTotal;
      backendTotalContributions += contribution.compulsoryContributionDue;
      backendTotalInterest += contribution.loanInterestDue || 0;

      console.log(`   ${contribution.member.name}: Contribution ₹${contribution.compulsoryContributionDue}, Interest ₹${(contribution.loanInterestDue || 0).toFixed(2)}, Total ₹${expectedTotal.toFixed(2)}`);
    });

    console.log(`\n📊 BACKEND CALCULATION (AFTER FIX):`);
    console.log(`   Total Expected Contributions: ₹${backendTotalContributions.toFixed(2)}`);
    console.log(`   Total Expected Interest: ₹${backendTotalInterest.toFixed(2)}`);
    console.log(`   Backend Total Expected: ₹${backendTotalExpected.toFixed(2)}`);

    // Compare frontend and backend calculations
    console.log(`\n🎯 COMPARISON:`);
    console.log(`   Frontend Total Expected: ₹${frontendTotalExpected.toFixed(2)}`);
    console.log(`   Backend Total Expected: ₹${backendTotalExpected.toFixed(2)}`);
    
    const difference = Math.abs(frontendTotalExpected - backendTotalExpected);
    console.log(`   Difference: ₹${difference.toFixed(2)}`);

    if (difference < 0.01) {
      console.log(`   ✅ SUCCESS: Frontend and backend calculations match!`);
    } else {
      console.log(`   ❌ DISCREPANCY: Frontend and backend calculations don't match`);
    }

    // Clean up the test record
    console.log(`\n🧹 Cleaning up test record...`);
    await prisma.memberContribution.deleteMany({
      where: { groupPeriodicRecordId: createdRecord.id }
    });
    await prisma.groupMemberPeriodicRecord.deleteMany({
      where: { groupPeriodicRecordId: createdRecord.id }
    });
    await prisma.groupPeriodicRecord.delete({
      where: { id: createdRecord.id }
    });
    console.log(`   ✅ Cleanup completed`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testContributionDiscrepancyFix();
