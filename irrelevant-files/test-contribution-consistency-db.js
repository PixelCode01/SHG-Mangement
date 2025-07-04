#!/usr/bin/env node

/**
 * Test Script: Track Contribution Consistency (Database Direct)
 * 
 * This script checks the database directly to verify contribution consistency
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🧪 Testing Track Contribution Consistency (Database Check)...\n');
  
  try {
    // Step 1: Find groups with contributions
    console.log('1. Finding groups with contribution records...');
    const groupsWithContributions = await prisma.group.findMany({
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
          take: 2 // Get last 2 periods to compare
        }
      },
      where: {
        groupPeriodicRecords: {
          some: {
            memberContributions: {
              some: {}
            }
          }
        }
      },
      take: 3 // Check first 3 groups
    });

    if (groupsWithContributions.length === 0) {
      console.log('❌ No groups found with contribution records');
      return;
    }

    console.log(`✅ Found ${groupsWithContributions.length} groups with contribution records\n`);

    // Step 2: Analyze each group's contribution consistency
    for (const group of groupsWithContributions) {
      console.log(`📊 Analyzing Group: ${group.name}`);
      console.log(`   Group monthly contribution setting: ₹${group.monthlyContribution || 0}`);
      console.log(`   Total periods: ${group.groupPeriodicRecords.length}`);
      
      // Check each period's consistency
      for (const period of group.groupPeriodicRecords) {
        console.log(`\n   Period #${period.recordSequenceNumber || 'Unknown'} (${period.memberContributions.length} contributions):`);
        
        if (period.memberContributions.length === 0) {
          console.log('     ⚠️  No contributions in this period');
          continue;
        }

        // Analyze compulsoryContributionDue consistency
        const contributionAmounts = period.memberContributions.map(c => c.compulsoryContributionDue);
        const uniqueAmounts = [...new Set(contributionAmounts)];
        
        console.log(`     Contribution amounts: [${contributionAmounts.join(', ')}]`);
        
        if (uniqueAmounts.length === 1) {
          console.log(`     ✅ All members have same compulsoryContributionDue: ₹${uniqueAmounts[0]}`);
        } else {
          console.log(`     ❌ Members have different compulsoryContributionDue amounts:`);
          period.memberContributions.forEach(c => {
            console.log(`        - ${c.member.name}: ₹${c.compulsoryContributionDue} (total due: ₹${c.minimumDueAmount})`);
          });
        }

        // Check if amounts match group setting
        const expectedAmount = group.monthlyContribution || 0;
        if (uniqueAmounts.length === 1 && uniqueAmounts[0] === expectedAmount) {
          console.log(`     ✅ Amounts match group setting (₹${expectedAmount})`);
        } else if (uniqueAmounts.length === 1) {
          console.log(`     ⚠️  Amount (₹${uniqueAmounts[0]}) differs from group setting (₹${expectedAmount})`);
        }

        // Show detailed breakdown for each member
        if (period.memberContributions.length <= 5) {
          console.log(`     Member details:`);
          period.memberContributions.forEach(c => {
            console.log(`       - ${c.member.name}: due=₹${c.compulsoryContributionDue}, interest=₹${c.loanInterestDue || 0}, total=₹${c.minimumDueAmount}, paid=₹${c.totalPaid}, remaining=₹${c.remainingAmount}`);
          });
        }
      }
      
      console.log('\n' + '─'.repeat(60));
    }

    // Step 3: Overall summary
    console.log('\n📈 OVERALL SUMMARY:');
    
    let totalPeriods = 0;
    let consistentPeriods = 0;
    let periodsMatchingGroupSetting = 0;
    
    for (const group of groupsWithContributions) {
      for (const period of group.groupPeriodicRecords) {
        if (period.memberContributions.length === 0) continue;
        
        totalPeriods++;
        
        const contributionAmounts = period.memberContributions.map(c => c.compulsoryContributionDue);
        const uniqueAmounts = [...new Set(contributionAmounts)];
        
        if (uniqueAmounts.length === 1) {
          consistentPeriods++;
          
          if (uniqueAmounts[0] === (group.monthlyContribution || 0)) {
            periodsMatchingGroupSetting++;
          }
        }
      }
    }
    
    console.log(`Total periods analyzed: ${totalPeriods}`);
    console.log(`Periods with consistent amounts: ${consistentPeriods}/${totalPeriods} (${Math.round(consistentPeriods/totalPeriods*100)}%)`);
    console.log(`Periods matching group setting: ${periodsMatchingGroupSetting}/${totalPeriods} (${Math.round(periodsMatchingGroupSetting/totalPeriods*100)}%)`);
    
    if (consistentPeriods === totalPeriods) {
      console.log('\n✅ EXCELLENT: All periods have consistent contribution amounts!');
    } else if (consistentPeriods > totalPeriods * 0.8) {
      console.log('\n🟨 GOOD: Most periods have consistent amounts, some need attention');
    } else {
      console.log('\n❌ NEEDS ATTENTION: Many periods have inconsistent contribution amounts');
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
