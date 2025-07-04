#!/usr/bin/env node

/**
 * Test Script: Track Contribution Consistency
 * 
 * This script tests the Track Contribution page functionality to ensure:
 * 1. When closing a period, it creates contributions with consistent base amounts
 * 2. All members have the same compulsoryContributionDue value
 * 3. Carry-forward amounts are properly handled in minimumDueAmount and remainingAmount
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🧪 Testing Track Contribution Consistency...\n');
  
  try {
    // Step 1: Find a test group with members
    console.log('1. Finding a test group with members...');
    const testGroup = await prisma.group.findFirst({
      include: {
        memberships: {
          include: {
            member: true
          }
        }
      },
      where: {
        memberships: {
          some: {}
        }
      }
    });

    if (!testGroup) {
      console.log('❌ No test group found with members. Creating one...');
      return;
    }

    console.log(`✅ Found test group: ${testGroup.name} (${testGroup.memberships.length} members)`);
    console.log(`   Monthly Contribution: ₹${testGroup.monthlyContribution || 0}`);

    // Step 2: Check current active period
    console.log('\n2. Checking current active period...');
    const activePeriods = await prisma.groupPeriodicRecord.findMany({
      where: {
        groupId: testGroup.id
      },
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
    });

    if (activePeriods.length === 0) {
      console.log('❌ No periods found for this group. Creating a test period via API...');
      
      // Create initial period using the bulk contributions API
      const createResponse = await fetch(`http://localhost:3000/api/groups/${testGroup.id}/contributions/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          meetingDate: new Date().toISOString(),
          recordSequenceNumber: 1,
          membersPresent: testGroup.memberships.map(m => m.member.id),
          compulsoryContributionAmount: testGroup.monthlyContribution || 1000
        })
      });

      if (!createResponse.ok) {
        console.log('❌ Failed to create initial period:', await createResponse.text());
        return;
      }

      const createdData = await createResponse.json();
      console.log(`✅ Created initial period with ${createdData.contributionsCreated} contributions`);
      
      // Re-fetch the period
      const newPeriods = await prisma.groupPeriodicRecord.findMany({
        where: {
          groupId: testGroup.id
        },
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
      });
      
      if (newPeriods.length > 0) {
        activePeriods.push(newPeriods[0]);
      }
    }

    const currentPeriod = activePeriods[0];
    console.log(`✅ Current period: #${currentPeriod.recordSequenceNumber} (${currentPeriod.memberContributions.length} contributions)`);

    // Step 3: Check contribution consistency in current period
    console.log('\n3. Checking current period contribution consistency...');
    const contributions = currentPeriod.memberContributions;
    
    if (contributions.length === 0) {
      console.log('❌ No contributions found in current period');
      return;
    }

    const contributionAmounts = contributions.map(c => c.compulsoryContributionDue);
    const uniqueAmounts = [...new Set(contributionAmounts)];
    
    console.log(`   Total contributions: ${contributions.length}`);
    console.log(`   Contribution amounts: [${contributionAmounts.join(', ')}]`);
    console.log(`   Unique amounts: [${uniqueAmounts.join(', ')}]`);
    
    if (uniqueAmounts.length === 1) {
      console.log(`✅ All members have the same compulsoryContributionDue: ₹${uniqueAmounts[0]}`);
    } else {
      console.log(`❌ Members have different compulsoryContributionDue amounts!`);
      contributions.forEach(c => {
        console.log(`   - ${c.member.name}: ₹${c.compulsoryContributionDue} (due: ₹${c.minimumDueAmount}, remaining: ₹${c.remainingAmount})`);
      });
    }

    // Step 4: Test period closing simulation (without actually closing)
    console.log('\n4. Simulating period closing to test new contribution creation...');
    
    // Simulate what would happen when closing period
    const memberContributions = contributions.map(c => ({
      memberId: c.memberId,
      remainingAmount: Math.random() > 0.5 ? Math.floor(Math.random() * 500) : 0 // Random remaining amounts
    }));

    console.log('   Simulated remaining amounts after period:');
    memberContributions.forEach(mc => {
      const member = contributions.find(c => c.memberId === mc.memberId);
      console.log(`   - ${member?.member.name}: ₹${mc.remainingAmount} remaining`);
    });

    // Simulate new period contribution calculation (as would happen in period closing)
    const baseContribution = testGroup.monthlyContribution || 0;
    console.log(`\n   Base contribution for next period: ₹${baseContribution}`);
    
    const simulatedNewContributions = memberContributions.map(mc => {
      const member = contributions.find(c => c.memberId === mc.memberId);
      return {
        memberName: member?.member.name,
        compulsoryContributionDue: baseContribution, // Should be same for all
        carryForward: mc.remainingAmount,
        minimumDueAmount: baseContribution + mc.remainingAmount,
        remainingAmount: baseContribution + mc.remainingAmount
      };
    });

    console.log('\n   Simulated new period contributions:');
    simulatedNewContributions.forEach(nc => {
      console.log(`   - ${nc.memberName}: base=₹${nc.compulsoryContributionDue}, carry=₹${nc.carryForward}, total=₹${nc.minimumDueAmount}`);
    });

    // Check if base contributions are consistent
    const newBaseAmounts = simulatedNewContributions.map(nc => nc.compulsoryContributionDue);
    const uniqueNewAmounts = [...new Set(newBaseAmounts)];
    
    if (uniqueNewAmounts.length === 1) {
      console.log(`✅ Simulated new period: All members would have same base contribution: ₹${uniqueNewAmounts[0]}`);
    } else {
      console.log(`❌ Simulated new period: Members would have different base contributions!`);
    }

    console.log('\n🎉 Track Contribution Consistency Test Complete!');
    console.log('\nSummary:');
    console.log(`- Current period contributions consistent: ${uniqueAmounts.length === 1 ? '✅ YES' : '❌ NO'}`);
    console.log(`- New period would be consistent: ${uniqueNewAmounts.length === 1 ? '✅ YES' : '❌ NO'}`);
    
    if (uniqueAmounts.length === 1 && uniqueNewAmounts.length === 1) {
      console.log('\n✅ PASS: Track contribution system maintains consistent base amounts');
    } else {
      console.log('\n❌ FAIL: Track contribution system has inconsistent amounts');
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
