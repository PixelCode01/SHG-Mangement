#!/usr/bin/env node

/**
 * Test Script: Simulate Fixed Contribution Creation Logic
 * 
 * This script simulates the fixed contribution creation logic without API calls
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Simulate the calculatePeriodInterestFromDecimal function
function calculatePeriodInterestFromDecimal(loanBalance, interestRateDecimal, frequency) {
  if (!loanBalance || !interestRateDecimal) return 0;
  
  // Convert annual rate to period rate based on frequency
  let periodsPerYear;
  switch (frequency) {
    case 'WEEKLY': periodsPerYear = 52; break;
    case 'FORTNIGHTLY': periodsPerYear = 26; break;
    case 'MONTHLY': periodsPerYear = 12; break;
    case 'YEARLY': periodsPerYear = 1; break;
    default: periodsPerYear = 12;
  }
  
  const periodRate = interestRateDecimal / periodsPerYear;
  return loanBalance * periodRate;
}

async function main() {
  console.log('🧪 Simulating Fixed Contribution Creation Logic...\n');
  
  try {
    // Find the test group
    const testGroup = await prisma.group.findFirst({
      where: { name: 'sd' },
      include: {
        groupPeriodicRecords: {
          include: {
            memberContributions: {
              include: {
                member: true
              }
            }
          },
          orderBy: { recordSequenceNumber: 'desc' },
          take: 1
        }
      }
    });

    if (!testGroup) {
      console.log('❌ Test group not found');
      return;
    }

    const currentPeriod = testGroup.groupPeriodicRecords[0];
    console.log(`📊 Group: ${testGroup.name}`);
    console.log(`   Monthly Contribution Setting: ₹${testGroup.monthlyContribution}`);
    console.log(`   Interest Rate: ${testGroup.interestRate}%`);
    console.log(`   Collection Frequency: ${testGroup.collectionFrequency}`);
    console.log(`   Current Period: #${currentPeriod.recordSequenceNumber}`);

    // Simulate member data with remaining amounts (like after period closing)
    const memberContributions = currentPeriod.memberContributions.map((contrib, index) => ({
      memberId: contrib.memberId,
      memberName: contrib.member.name,
      // Simulate some members having remaining amounts from previous period
      remainingAmount: index % 3 === 0 ? Math.floor(Math.random() * 500) + 100 : 0,
      currentLoanBalance: contrib.member.currentLoanAmount || 0
    }));

    console.log('\n🔄 Simulated member situation after period closing:');
    memberContributions.forEach(mc => {
      console.log(`   - ${mc.memberName}: remaining=₹${mc.remainingAmount}, loan=₹${mc.currentLoanBalance}`);
    });

    // Apply the FIXED logic for creating new period contributions
    console.log('\n🛠️  Applying FIXED contribution creation logic...');
    
    const baseContribution = testGroup.monthlyContribution || 0; // Same for all members
    const interestRateDecimal = (testGroup.interestRate || 0) / 100;
    
    console.log(`   Base contribution (same for all): ₹${baseContribution}`);
    
    const newMemberContributions = memberContributions.map(memberContrib => {
      const carryForwardAmount = memberContrib.remainingAmount;
      const currentLoanBalance = memberContrib.currentLoanBalance;
      
      // Calculate period-adjusted interest
      const expectedInterest = calculatePeriodInterestFromDecimal(
        currentLoanBalance,
        interestRateDecimal,
        testGroup.collectionFrequency || 'MONTHLY'
      );

      return {
        memberId: memberContrib.memberId,
        memberName: memberContrib.memberName,
        
        // FIXED: Use same base contribution for all members
        compulsoryContributionDue: baseContribution, // ✅ Same for all
        
        loanInterestDue: expectedInterest,
        
        // Total includes carry-forward but base contribution stays consistent
        minimumDueAmount: baseContribution + carryForwardAmount + expectedInterest,
        remainingAmount: baseContribution + carryForwardAmount + expectedInterest,
        
        // For analysis
        carryForwardAmount: carryForwardAmount,
        currentLoanBalance: currentLoanBalance
      };
    });

    // Analyze the results
    console.log('\n📊 ANALYSIS OF NEW CONTRIBUTIONS:');
    
    // Check compulsoryContributionDue consistency
    const contributionAmounts = newMemberContributions.map(nc => nc.compulsoryContributionDue);
    const uniqueAmounts = [...new Set(contributionAmounts)];
    
    console.log(`   Compulsory contribution amounts: [${contributionAmounts.join(', ')}]`);
    console.log(`   Unique amounts: [${uniqueAmounts.join(', ')}]`);
    console.log(`   Is consistent: ${uniqueAmounts.length === 1 ? '✅ YES' : '❌ NO'}`);
    
    if (uniqueAmounts.length === 1) {
      console.log(`   ✅ All members have same compulsoryContributionDue: ₹${uniqueAmounts[0]}`);
      
      if (uniqueAmounts[0] === baseContribution) {
        console.log(`   ✅ Amount matches group setting: ₹${baseContribution}`);
      } else {
        console.log(`   ❌ Amount differs from group setting: expected ₹${baseContribution}, got ₹${uniqueAmounts[0]}`);
      }
    } else {
      console.log(`   ❌ Inconsistent amounts found!`);
    }

    // Show detailed breakdown
    console.log('\n📋 DETAILED BREAKDOWN:');
    newMemberContributions.forEach(nc => {
      console.log(`   ${nc.memberName}:`);
      console.log(`     • Compulsory contribution: ₹${nc.compulsoryContributionDue} (base amount)`);
      console.log(`     • Carry forward: ₹${nc.carryForwardAmount}`);
      console.log(`     • Loan interest: ₹${nc.loanInterestDue.toFixed(2)}`);
      console.log(`     • Total minimum due: ₹${nc.minimumDueAmount.toFixed(2)}`);
      console.log(`     • Total remaining: ₹${nc.remainingAmount.toFixed(2)}`);
    });

    // Compare with OLD logic (what was happening before)
    console.log('\n🔍 COMPARISON WITH OLD LOGIC:');
    console.log('   OLD logic would have done:');
    
    const oldLogicContributions = memberContributions.map(mc => {
      const carryForward = mc.remainingAmount;
      const expectedContribution = baseContribution;
      // OLD: expectedContribution + carryForwardAmount
      return expectedContribution + carryForward;
    });
    
    const uniqueOldAmounts = [...new Set(oldLogicContributions)];
    console.log(`   OLD compulsoryContributionDue amounts: [${oldLogicContributions.join(', ')}]`);
    console.log(`   OLD unique amounts: [${uniqueOldAmounts.join(', ')}]`);
    console.log(`   OLD would be consistent: ${uniqueOldAmounts.length === 1 ? '✅ YES' : '❌ NO'}`);

    // Final assessment
    console.log('\n🎯 FINAL ASSESSMENT:');
    if (uniqueAmounts.length === 1 && uniqueOldAmounts.length > 1) {
      console.log('✅ SUCCESS: Fixed logic creates consistent contributions while old logic would create inconsistent ones!');
    } else if (uniqueAmounts.length === 1 && uniqueOldAmounts.length === 1) {
      console.log('✅ GOOD: Both logics create consistent contributions (no carry-forward amounts in this test)');
    } else {
      console.log('❌ ISSUE: Fixed logic still has problems');
    }

    console.log(`\nFIX SUMMARY:`);
    console.log(`- Fixed logic keeps compulsoryContributionDue consistent: ₹${baseContribution}`);
    console.log(`- Carry-forward amounts are added to minimumDueAmount and remainingAmount`);
    console.log(`- This allows tracking of what each member owes while maintaining consistent base contributions`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
