#!/usr/bin/env node

/**
 * Test Script: Period Closing with Consistent Contributions
 * 
 * This script tests that when a period is closed, the new period 
 * creates contributions with consistent compulsoryContributionDue amounts
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🧪 Testing Period Closing with Consistent Contributions...\n');
  
  try {
    // Find the group with inconsistent contributions from our previous test
    const testGroup = await prisma.group.findFirst({
      where: {
        name: 'sd' // The group we saw in the previous test
      },
      include: {
        groupPeriodicRecords: {
          include: {
            memberContributions: {
              include: {
                member: true
              }
            }
          },
          orderBy: {
            recordSequenceNumber: 'desc'
          },
          take: 1
        }
      }
    });

    if (!testGroup) {
      console.log('❌ Test group not found');
      return;
    }

    console.log(`📊 Group: ${testGroup.name} (Monthly Contribution: ₹${testGroup.monthlyContribution})`);
    
    const currentPeriod = testGroup.groupPeriodicRecords[0];
    if (!currentPeriod) {
      console.log('❌ No current period found');
      return;
    }

    console.log(`📅 Current Period #${currentPeriod.recordSequenceNumber} with ${currentPeriod.memberContributions.length} contributions`);
    
    // Show current inconsistent state
    console.log('\n🔍 Current Period Contributions:');
    const currentAmounts = currentPeriod.memberContributions.map(c => c.compulsoryContributionDue);
    const uniqueCurrentAmounts = [...new Set(currentAmounts)];
    
    console.log(`   Unique amounts: [${uniqueCurrentAmounts.join(', ')}]`);
    console.log(`   Is consistent: ${uniqueCurrentAmounts.length === 1 ? '✅ YES' : '❌ NO'}`);
    
    if (uniqueCurrentAmounts.length > 1) {
      console.log('   Sample member amounts:');
      currentPeriod.memberContributions.slice(0, 5).forEach(c => {
        console.log(`     - ${c.member.name}: ₹${c.compulsoryContributionDue}`);
      });
    }

    // Simulate period closing using our fixed API
    console.log('\n🔄 Simulating period closing with fixed API...');
    
    // Prepare member contributions data (simulate some have remaining amounts)
    const memberContributions = currentPeriod.memberContributions.map((contrib, index) => ({
      memberId: contrib.memberId,
      remainingAmount: index % 3 === 0 ? Math.floor(Math.random() * 1000) : 0, // Random remaining for every 3rd member
      lateFineAmount: 0,
      daysLate: 0
    }));

    // Prepare actual contributions data  
    const actualContributions = {};
    currentPeriod.memberContributions.forEach(contrib => {
      actualContributions[contrib.memberId] = {
        id: contrib.id,
        totalPaid: contrib.compulsoryContributionDue, // Assume all paid their full amount
        compulsoryContributionPaid: contrib.compulsoryContributionDue,
        loanInterestPaid: contrib.loanInterestDue || 0,
        lateFinePaid: 0
      };
    });

    console.log('   Member remaining amounts after period:');
    memberContributions.slice(0, 5).forEach(mc => {
      const member = currentPeriod.memberContributions.find(c => c.memberId === mc.memberId);
      console.log(`     - ${member?.member.name}: ₹${mc.remainingAmount} remaining`);
    });

    // Call the period closing API
    console.log('\n📡 Calling period closing API...');
    
    const requestData = {
      periodId: currentPeriod.id,
      memberContributions: memberContributions,
      actualContributions: actualContributions
    };

    const response = await fetch('http://localhost:3000/api/groups/' + testGroup.id + '/contributions/periods/close', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      // Check if it's already closed error (expected for testing)
      if (response.status === 409) {
        console.log('⚠️  Period already closed (expected for testing)');
        console.log('   Let\'s check if the existing next period has consistent contributions...');
        
        // Find the next period to check consistency
        const nextPeriods = await prisma.groupPeriodicRecord.findMany({
          where: {
            groupId: testGroup.id,
            recordSequenceNumber: {
              gt: currentPeriod.recordSequenceNumber
            }
          },
          include: {
            memberContributions: {
              include: {
                member: true
              }
            }
          },
          orderBy: {
            recordSequenceNumber: 'asc'
          },
          take: 1
        });

        if (nextPeriods.length > 0) {
          const nextPeriod = nextPeriods[0];
          console.log(`\n✅ Found next period #${nextPeriod.recordSequenceNumber} with ${nextPeriod.memberContributions.length} contributions`);
          
          // Check consistency of next period
          const nextAmounts = nextPeriod.memberContributions.map(c => c.compulsoryContributionDue);
          const uniqueNextAmounts = [...new Set(nextAmounts)];
          
          console.log('🔍 Next Period Contribution Analysis:');
          console.log(`   All amounts: [${nextAmounts.join(', ')}]`);
          console.log(`   Unique amounts: [${uniqueNextAmounts.join(', ')}]`);
          console.log(`   Is consistent: ${uniqueNextAmounts.length === 1 ? '✅ YES' : '❌ NO'}`);
          console.log(`   Expected amount: ₹${testGroup.monthlyContribution}`);
          
          if (uniqueNextAmounts.length === 1) {
            const actualAmount = uniqueNextAmounts[0];
            if (actualAmount === testGroup.monthlyContribution) {
              console.log(`   ✅ Amount matches group setting: ₹${actualAmount}`);
            } else {
              console.log(`   ⚠️  Amount (₹${actualAmount}) differs from group setting (₹${testGroup.monthlyContribution})`);
            }
          } else {
            console.log('   ❌ Multiple different amounts found:');
            nextPeriod.memberContributions.slice(0, 5).forEach(c => {
              console.log(`     - ${c.member.name}: ₹${c.compulsoryContributionDue} (total: ₹${c.minimumDueAmount})`);
            });
          }
        } else {
          console.log('   ❌ No next period found');
        }
        
        return;
      } else {
        console.log('❌ API call failed:', response.status, errorText);
        return;
      }
    }

    const result = await response.json();
    console.log('✅ Period closing successful!');
    console.log(`   New period ID: ${result.newPeriod?.id}`);
    
    // Check the newly created period for consistency
    if (result.newPeriod) {
      const newPeriod = await prisma.groupPeriodicRecord.findUnique({
        where: { id: result.newPeriod.id },
        include: {
          memberContributions: {
            include: {
              member: true
            }
          }
        }
      });

      if (newPeriod && newPeriod.memberContributions.length > 0) {
        console.log(`\n🎯 NEW PERIOD ANALYSIS (Period #${newPeriod.recordSequenceNumber}):`);
        
        const newAmounts = newPeriod.memberContributions.map(c => c.compulsoryContributionDue);
        const uniqueNewAmounts = [...new Set(newAmounts)];
        
        console.log(`   Total contributions: ${newPeriod.memberContributions.length}`);
        console.log(`   All amounts: [${newAmounts.join(', ')}]`);
        console.log(`   Unique amounts: [${uniqueNewAmounts.join(', ')}]`);
        console.log(`   Is consistent: ${uniqueNewAmounts.length === 1 ? '✅ YES' : '❌ NO'}`);
        
        if (uniqueNewAmounts.length === 1) {
          const newAmount = uniqueNewAmounts[0];
          console.log(`   All members have same compulsoryContributionDue: ₹${newAmount}`);
          
          if (newAmount === testGroup.monthlyContribution) {
            console.log(`   ✅ Matches group setting (₹${testGroup.monthlyContribution})`);
          } else {
            console.log(`   ⚠️  Differs from group setting (₹${testGroup.monthlyContribution})`);
          }
        } else {
          console.log('   ❌ Found inconsistent amounts:');
          newPeriod.memberContributions.slice(0, 5).forEach(c => {
            console.log(`     - ${c.member.name}: ₹${c.compulsoryContributionDue} (total: ₹${c.minimumDueAmount})`);
          });
        }
        
        // Show detailed breakdown for a few members
        console.log('\n   Sample member details:');
        newPeriod.memberContributions.slice(0, 3).forEach(c => {
          console.log(`     - ${c.member.name}:`);
          console.log(`       * Compulsory contribution: ₹${c.compulsoryContributionDue}`);
          console.log(`       * Loan interest due: ₹${c.loanInterestDue || 0}`);
          console.log(`       * Minimum due amount: ₹${c.minimumDueAmount}`);
          console.log(`       * Remaining amount: ₹${c.remainingAmount}`);
        });
        
      } else {
        console.log('⚠️  New period has no contributions yet');
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
