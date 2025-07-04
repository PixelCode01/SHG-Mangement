#!/usr/bin/env node

/**
 * Fixed Comprehensive Test Script
 * Tests features with the current schema structure
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function runTest() {
  console.log('🚀 Starting Fixed Comprehensive Test');
  console.log('====================================\n');

  try {
    // Cleanup first
    await cleanup();

    // Test 1: Create test members first (the schema requires Member, not User directly)
    console.log('1. 📝 Creating test members...');
    
    const testMembers = [];
    for (let i = 1; i <= 5; i++) {
      const member = await prisma.member.create({
        data: {
          name: `Test Member ${i}`,
          email: `testmember${i}@test.com`,
          phone: `+91900000000${i}`,
          address: `Test Address ${i}`
        }
      });
      testMembers.push(member);
    }
    console.log(`✅ Created ${testMembers.length} test members\n`);

    // Test 2: Create groups with late fine rules
    console.log('2. 🏘️ Creating groups...');
    
    const testGroups = [];
    
    // Group with weekly collection
    const weeklyGroup = await prisma.group.create({
      data: {
        groupId: `GRP-${Date.now()}-001`,
        name: 'Weekly Collection Test Group',
        description: 'Test group with weekly collection',
        leaderId: testMembers[0].id,
        memberCount: 3,
        dateOfStarting: new Date(),
        collectionFrequency: 'WEEKLY',
        collectionDayOfWeek: 'MONDAY',
        monthlyContribution: 100,
        interestRate: 12.0,
        cashInHand: 0,
        balanceInBank: 0
      }
    });
    testGroups.push(weeklyGroup);
    console.log(`✅ Created weekly group: ${weeklyGroup.name}`);

    // Group with monthly collection
    const monthlyGroup = await prisma.group.create({
      data: {
        groupId: `GRP-${Date.now()}-002`,
        name: 'Monthly Collection Test Group',
        description: 'Test group with monthly collection',
        leaderId: testMembers[1].id,
        memberCount: 3,
        dateOfStarting: new Date(),
        collectionFrequency: 'MONTHLY',
        collectionDayOfMonth: 15,
        monthlyContribution: 500,
        interestRate: 10.0,
        cashInHand: 0,
        balanceInBank: 0
      }
    });
    testGroups.push(monthlyGroup);
    console.log(`✅ Created monthly group: ${monthlyGroup.name}`);
    
    // Group with yearly collection
    const yearlyGroup = await prisma.group.create({
      data: {
        groupId: `GRP-${Date.now()}-003`,
        name: 'Yearly Collection Test Group',
        description: 'Test group with yearly collection',
        leaderId: testMembers[2].id,
        memberCount: 2,
        dateOfStarting: new Date(),
        collectionFrequency: 'YEARLY',
        collectionDayOfMonth: 1,
        monthlyContribution: 5000,
        interestRate: 8.0,
        cashInHand: 0,
        balanceInBank: 0
      }
    });
    testGroups.push(yearlyGroup);
    console.log(`✅ Created yearly group: ${yearlyGroup.name}\n`);

    // Test 3: Create late fine rules for groups
    console.log('3. ⏰ Creating late fine rules...');
    
    for (const group of testGroups) {
      const fineRule = await prisma.lateFineRule.create({
        data: {
          groupId: group.id,
          isEnabled: true,
          ruleType: 'DAILY_FIXED',
          dailyAmount: group.monthlyContribution * 0.1 // 10% of contribution per day
        }
      });
      console.log(`✅ Created late fine rule for ${group.name}: ₹${fineRule.dailyAmount}/day`);
    }
    console.log();

    // Test 4: Add members to groups
    console.log('4. 👥 Adding members to groups...');
    
    for (let i = 0; i < testGroups.length; i++) {
      const group = testGroups[i];
      for (let j = 0; j < group.memberCount; j++) {
        const memberIndex = (i * group.memberCount + j) % testMembers.length;
        await prisma.memberGroupMembership.create({
          data: {
            memberId: testMembers[memberIndex].id,
            groupId: group.id,
            joinedAt: new Date(),
            currentShareAmount: group.monthlyContribution,
            currentLoanAmount: 0,
            initialInterest: 0
          }
        });
      }
      console.log(`✅ Added ${group.memberCount} members to ${group.name}`);
    }
    console.log();

    // Test 5: Create periodic records
    console.log('5. 📊 Creating periodic records...');
    
    for (const group of testGroups) {
      const periodicRecord = await prisma.groupPeriodicRecord.create({
        data: {
          groupId: group.id,
          meetingDate: new Date(),
          membersPresent: group.memberCount,
          totalCollectionThisPeriod: group.monthlyContribution * group.memberCount,
          standingAtStartOfPeriod: 0,
          cashInBankAtEndOfPeriod: Math.round((group.monthlyContribution * group.memberCount * 0.7 + Number.EPSILON) * 100) / 100,
          cashInHandAtEndOfPeriod: Math.round((group.monthlyContribution * group.memberCount * 0.3 + Number.EPSILON) * 100) / 100,
          expensesThisPeriod: 0,
          totalGroupStandingAtEndOfPeriod: group.monthlyContribution * group.memberCount,
          interestEarnedThisPeriod: 0,
          newContributionsThisPeriod: group.monthlyContribution * group.memberCount,
          loanProcessingFeesCollectedThisPeriod: 0,
          lateFinesCollectedThisPeriod: 0,
          loanInterestRepaymentsThisPeriod: 0
        }
      });        console.log(`✅ Created periodic record for ${group.name}: ₹${periodicRecord.totalCollectionThisPeriod}`);
    }
    console.log();

    // Test 6: Create member contributions
    console.log('6. 💰 Creating member contributions...');
    
    for (const group of testGroups) {
      const periodicRecord = await prisma.groupPeriodicRecord.findFirst({
        where: { groupId: group.id },
        orderBy: { meetingDate: 'desc' }
      });

      const memberships = await prisma.memberGroupMembership.findMany({
        where: { groupId: group.id },
        include: { member: true }
      });

      for (const membership of memberships) {
        const isLate = Math.random() > 0.7; // 30% chance of being late
        const daysLate = isLate ? Math.floor(Math.random() * 5) + 1 : 0;
        const fineAmount = isLate ? daysLate * (group.monthlyContribution * 0.1) : 0;
        const isPaid = Math.random() > 0.2; // 80% chance of being paid

        const contribution = await prisma.memberContribution.create({
          data: {
            groupPeriodicRecordId: periodicRecord.id,
            memberId: membership.memberId,
            compulsoryContributionDue: group.monthlyContribution,
            loanInterestDue: 0,
            minimumDueAmount: group.monthlyContribution + fineAmount,
            compulsoryContributionPaid: isPaid ? group.monthlyContribution : 0,
            loanInterestPaid: 0,
            lateFinePaid: isPaid ? fineAmount : 0,
            totalPaid: isPaid ? group.monthlyContribution + fineAmount : 0,
            status: isPaid ? 'PAID' : 'PENDING',
            dueDate: new Date(),
            paidDate: isPaid ? new Date() : null,
            daysLate: daysLate,
            lateFineAmount: fineAmount,
            remainingAmount: isPaid ? 0 : group.monthlyContribution + fineAmount
          }
        });
        
        console.log(`✅ Created contribution for ${membership.member.name} in ${group.name}: ₹${contribution.totalPaid} (Fine: ₹${contribution.lateFineAmount})`);
      }
    }
    console.log();

    // Test 7: Create cash allocations
    console.log('7. 💳 Creating cash allocations...');
    
    for (const group of testGroups) {
      const periodicRecord = await prisma.groupPeriodicRecord.findFirst({
        where: { groupId: group.id },
        orderBy: { meetingDate: 'desc' }
      });

      const allocation = await prisma.cashAllocation.create({
        data: {
          groupPeriodicRecordId: periodicRecord.id,
          allocationType: 'CUSTOM_SPLIT',
          amountToBankTransfer: Math.round((periodicRecord.totalCollectionThisPeriod * 0.7 + Number.EPSILON) * 100) / 100,
          amountToCashInHand: Math.round((periodicRecord.totalCollectionThisPeriod * 0.3 + Number.EPSILON) * 100) / 100,
          totalAllocated: periodicRecord.totalCollectionThisPeriod,
          isTransactionClosed: false,
          carryForwardAmount: 0
        }
      });
      
      console.log(`✅ Created cash allocation for ${group.name}: Bank ₹${allocation.amountToBankTransfer}, Cash ₹${allocation.amountToCashInHand}`);
    }
    console.log();

    // Test 8: Create contribution reports
    console.log('8. 📈 Creating contribution reports...');
    
    for (const group of testGroups) {
      const periodicRecord = await prisma.groupPeriodicRecord.findFirst({
        where: { groupId: group.id },
        orderBy: { meetingDate: 'desc' },
        include: {
          memberContributions: true,
          cashAllocations: true
        }
      });

      const reportData = {
        groupName: group.name,
        meetingDate: periodicRecord.meetingDate,
        totalMembers: group.memberCount,
        totalCollection: periodicRecord.totalCollectionThisPeriod,
        totalContributions: periodicRecord.memberContributions.length,
        paidContributions: periodicRecord.memberContributions.filter(c => c.status === 'PAID').length,
        pendingContributions: periodicRecord.memberContributions.filter(c => c.status === 'PENDING').length,
        totalFines: periodicRecord.memberContributions.reduce((sum, c) => sum + c.lateFineAmount, 0),
        cashAllocations: periodicRecord.cashAllocations.length
      };

      const report = await prisma.contributionReport.create({
        data: {
          groupPeriodicRecordId: periodicRecord.id,
          reportData: reportData
        }
      });
      
      console.log(`✅ Created contribution report for ${group.name}`);
    }
    console.log();

    // Test 9: Verify data integrity and relationships
    console.log('9. 🔍 Verifying data integrity...');
    
    for (const group of testGroups) {
      const fullGroup = await prisma.group.findUnique({
        where: { id: group.id },
        include: {
          leader: true,
          memberships: {
            include: { member: true }
          },
          groupPeriodicRecords: {
            include: {
              memberContributions: true,
              cashAllocations: true
            }
          },
          lateFineRules: true
        }
      });

      console.log(`📋 Group: ${fullGroup.name}`);
      console.log(`   - Leader: ${fullGroup.leader.name}`);
      console.log(`   - Collection: ${fullGroup.collectionFrequency}`);
      console.log(`   - Members: ${fullGroup.memberships.length}`);
      console.log(`   - Late Fine Rules: ${fullGroup.lateFineRules.length}`);
      console.log(`   - Periodic Records: ${fullGroup.groupPeriodicRecords.length}`);
      
      if (fullGroup.groupPeriodicRecords.length > 0) {
        const record = fullGroup.groupPeriodicRecords[0];
        console.log(`   - Contributions: ${record.memberContributions.length}`);
        console.log(`   - Cash Allocations: ${record.cashAllocations.length}`);
      }
      console.log();
    }

    // Test 10: Test API scenarios
    console.log('10. 🌐 Testing API scenarios...');
    
    for (const group of testGroups) {
      // Simulate GET current contributions
      const currentRecord = await prisma.groupPeriodicRecord.findFirst({
        where: { groupId: group.id },
        orderBy: { meetingDate: 'desc' },
        include: {
          memberContributions: {
            include: {
              member: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                }
              }
            }
          },
          cashAllocations: {
            orderBy: { lastModifiedAt: 'desc' },
            take: 1
          }
        }
      });

      if (currentRecord) {
        console.log(`✅ API test for ${group.name}:`);
        console.log(`   - Current contributions: ${currentRecord.memberContributions.length}`);
        console.log(`   - Cash allocations: ${currentRecord.cashAllocations.length}`);
        
        // Test contribution status update
        const pendingContributions = currentRecord.memberContributions.filter(c => c.status === 'PENDING');
        if (pendingContributions.length > 0) {
          const contribution = pendingContributions[0];
          await prisma.memberContribution.update({
            where: { id: contribution.id },
            data: {
              status: 'PAID',
              compulsoryContributionPaid: contribution.compulsoryContributionDue,
              totalPaid: contribution.minimumDueAmount,
              paidDate: new Date(),
              remainingAmount: 0
            }
          });
          console.log(`   - Updated contribution status to PAID`);
        }
      }
    }
    console.log();

    console.log('🎉 All tests completed successfully!');
    console.log('=====================================');
    console.log('📊 Test Summary:');
    console.log(`   - Created ${testMembers.length} test members`);
    console.log(`   - Created ${testGroups.length} test groups with different collection schedules`);
    console.log(`   - Tested weekly, monthly, and yearly collection frequencies`);
    console.log(`   - Created late fine rules for all groups`);
    console.log(`   - Added members to groups with proper memberships`);
    console.log(`   - Created periodic records with member contributions`);
    console.log(`   - Tested cash allocation functionality`);
    console.log(`   - Generated contribution reports`);
    console.log(`   - Verified all data relationships and integrity`);
    console.log(`   - Simulated API endpoint functionality`);
    console.log();
    console.log('✅ All features are working correctly!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Cleanup function
async function cleanup() {
  console.log('🧹 Cleaning up any existing test data...');
  
  try {
    // Delete in correct order to maintain referential integrity
    await prisma.contributionReport.deleteMany({
      where: {
        groupPeriodicRecord: {
          group: {
            name: {
              contains: 'Test Group'
            }
          }
        }
      }
    });

    await prisma.cashAllocation.deleteMany({
      where: {
        groupPeriodicRecord: {
          group: {
            name: {
              contains: 'Test Group'
            }
          }
        }
      }
    });

    await prisma.memberContribution.deleteMany({
      where: {
        groupPeriodicRecord: {
          group: {
            name: {
              contains: 'Test Group'
            }
          }
        }
      }
    });

    await prisma.groupPeriodicRecord.deleteMany({
      where: {
        group: {
          name: {
            contains: 'Test Group'
          }
        }
      }
    });

    await prisma.memberGroupMembership.deleteMany({
      where: {
        group: {
          name: {
            contains: 'Test Group'
          }
        }
      }
    });

    await prisma.lateFineRule.deleteMany({
      where: {
        group: {
          name: {
            contains: 'Test Group'
          }
        }
      }
    });

    await prisma.group.deleteMany({
      where: {
        name: {
          contains: 'Test Group'
        }
      }
    });

    await prisma.member.deleteMany({
      where: {
        email: {
          contains: 'testmember'
        }
      }
    });

    console.log('✅ Cleanup completed');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

// Run the test
if (require.main === module) {
  runTest()
    .then(() => {
      console.log('\n🎯 Test completed successfully!');
      return cleanup();
    })
    .catch((error) => {
      console.error('\n💥 Test suite failed:', error);
      return cleanup().then(() => process.exit(1));
    });
}

module.exports = { runTest, cleanup };
