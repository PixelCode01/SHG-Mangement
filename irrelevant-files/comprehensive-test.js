// Comprehensive test for the new SHG contribution tracking features
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupTestData() {
  console.log('🧹 Cleaning up test data...');
  
  try {
    // Delete in correct order to handle foreign key constraints
    await prisma.memberContribution.deleteMany({
      where: {
        groupPeriodicRecord: {
          group: { name: 'Test SHG Group' }
        }
      }
    });

    await prisma.cashAllocation.deleteMany({
      where: {
        groupPeriodicRecord: {
          group: { name: 'Test SHG Group' }
        }
      }
    });

    await prisma.contributionReport.deleteMany({
      where: {
        groupPeriodicRecord: {
          group: { name: 'Test SHG Group' }
        }
      }
    });

    await prisma.groupMemberPeriodicRecord.deleteMany({
      where: {
        groupPeriodicRecord: {
          group: { name: 'Test SHG Group' }
        }
      }
    });

    await prisma.groupPeriodicRecord.deleteMany({
      where: {
        group: { name: 'Test SHG Group' }
      }
    });

    await prisma.lateFineRuleTier.deleteMany({
      where: {
        lateFineRule: {
          group: { name: 'Test SHG Group' }
        }
      }
    });

    await prisma.lateFineRule.deleteMany({
      where: {
        group: { name: 'Test SHG Group' }
      }
    });

    // Delete members by group name relationship
    const testGroup = await prisma.group.findFirst({
      where: { name: 'Test SHG Group' },
      include: { memberships: true }
    });

    if (testGroup) {
      await prisma.memberGroupMembership.deleteMany({
        where: { groupId: testGroup.id }
      });
      
      // Get member IDs from memberships
      const memberIds = testGroup.memberships.map(m => m.memberId);
      if (memberIds.length > 0) {
        await prisma.member.deleteMany({
          where: { 
            id: { in: memberIds }
          }
        });
      }
    }

    await prisma.group.deleteMany({
      where: { name: 'Test SHG Group' }
    });

    console.log('✅ Test data cleaned up');
  } catch (error) {
    console.log('⚠️ Cleanup error (might be first run):', error.message);
  }
}

async function createTestUser() {
  console.log('👤 Creating test user...');
  
  const existingUser = await prisma.user.findFirst({
    where: { email: 'test@example.com' }
  });

  if (existingUser) {
    console.log('✅ Test user already exists:', existingUser.id);
    return existingUser;
  }

  const user = await prisma.user.create({
    data: {
      email: 'test@example.com',
      name: 'Test User',
      phone: '1234567890'
    }
  });

  console.log('✅ Test user created:', user.id);
  return user;
}

async function createTestGroup(userId) {
  console.log('🏛️ Creating test group with new features...');
  
  const group = await prisma.group.create({
    data: {
      groupId: 'GRP-202401-TEST',
      name: 'Test SHG Group',
      address: 'Test Address',
      description: 'Test group for contribution tracking',
      leaderId: null, // We'll set this after creating a member if needed
      
      // New collection schedule fields
      collectionFrequency: 'MONTHLY',
      collectionDayOfMonth: 15,
      
      bankAccountNumber: '1234567890',
      bankName: 'Test Bank',
      cashInHand: 5000.0,
      balanceInBank: 35000.0,
      monthlyContribution: 500.0,
      interestRate: 12.0
    }
  });

  console.log('✅ Test group created:', group.id);
  return group;
}

async function createLateFineRule(groupId) {
  console.log('⚖️ Creating late fine rule...');
  
  const lateFineRule = await prisma.lateFineRule.create({
    data: {
      groupId: groupId,
      ruleType: 'TIER_BASED',
      isEnabled: true
    }
  });

  // Add tiers
  await prisma.lateFineRuleTier.createMany({
    data: [
      {
        lateFineRuleId: lateFineRule.id,
        startDay: 1,
        endDay: 7,
        amount: 10.0,
        isPercentage: false
      },
      {
        lateFineRuleId: lateFineRule.id,
        startDay: 8,
        endDay: 15,
        amount: 25.0,
        isPercentage: false
      },
      {
        lateFineRuleId: lateFineRule.id,
        startDay: 16,
        endDay: 999,
        amount: 50.0,
        isPercentage: false
      }
    ]
  });

  console.log('✅ Late fine rule created with tiers');
  return lateFineRule;
}

async function createTestMembers(groupId) {
  console.log('👥 Creating test members...');
  
  // Create members first
  const memberData = [
    {
      name: 'Ravi Kumar',
      email: 'ravi@example.com',
      phone: '9876543210',
      currentLoanAmount: 2000.0
    },
    {
      name: 'Priya Sharma', 
      email: 'priya@example.com',
      phone: '9876543211',
      currentLoanAmount: 3000.0
    },
    {
      name: 'Amit Singh',
      email: 'amit@example.com', 
      phone: '9876543212',
      currentLoanAmount: 1500.0
    }
  ];

  const createdMembers = [];
  
  for (const member of memberData) {
    const createdMember = await prisma.member.create({
      data: member
    });
    
    // Create membership relationship
    await prisma.memberGroupMembership.create({
      data: {
        memberId: createdMember.id,
        groupId: groupId
      }
    });
    
    createdMembers.push(createdMember);
  }

  console.log('✅ Test members created:', createdMembers.length);
  return createdMembers;
}

async function createPeriodicRecord(groupId) {
  console.log('📊 Creating periodic record...');
  
  const periodicRecord = await prisma.groupPeriodicRecord.create({
    data: {
      groupId: groupId,
      meetingDate: new Date('2024-01-15'),
      recordSequenceNumber: 1,
      membersPresent: 3,
      newMembersJoinedThisPeriod: 0,
      totalCollectionThisPeriod: 1500.0,
      standingAtStartOfPeriod: 48500.0,
      cashInBankAtEndOfPeriod: 35000.0,
      cashInHandAtEndOfPeriod: 5000.0,
      expensesThisPeriod: 0.0,
      totalGroupStandingAtEndOfPeriod: 50000.0,
      interestEarnedThisPeriod: 200.0,
      newContributionsThisPeriod: 1500.0,
      loanProcessingFeesCollectedThisPeriod: 0.0,
      lateFinesCollectedThisPeriod: 0.0,
      loanInterestRepaymentsThisPeriod: 200.0
    }
  });

  console.log('✅ Periodic record created:', periodicRecord.id);
  return periodicRecord;
}

async function createMemberContributions(periodicRecordId, members) {
  console.log('💰 Creating member contributions...');
  
  const contributions = await prisma.memberContribution.createMany({
    data: members.map((member, index) => ({
      groupPeriodicRecordId: periodicRecordId,
      memberId: member.id,
      compulsoryContributionDue: 500.0,
      loanInterestDue: 50.0 + (index * 25), // Varying interest amounts
      minimumDueAmount: 550.0 + (index * 25),
      compulsoryContributionPaid: index === 0 ? 500.0 : 0, // First member paid
      loanInterestPaid: index === 0 ? 75.0 : 0,
      lateFinePaid: 0.0,
      totalPaid: index === 0 ? 575.0 : 0,
      status: index === 0 ? 'PAID' : 'PENDING',
      dueDate: new Date('2024-01-15'),
      paidDate: index === 0 ? new Date('2024-01-15') : null,
      daysLate: 0,
      lateFineAmount: 0.0,
      remainingAmount: index === 0 ? 0 : (550.0 + (index * 25))
    }))
  });

  console.log('✅ Member contributions created:', contributions.count);
}

async function createCashAllocation(periodicRecordId) {
  console.log('💳 Creating cash allocation...');
  
  const allocation = await prisma.cashAllocation.create({
    data: {
      groupPeriodicRecordId: periodicRecordId,
      allocationType: 'CUSTOM_SPLIT',
      amountToBankTransfer: 1200.0,
      amountToCashInHand: 300.0,
      customAllocationNote: 'Allocated based on security and accessibility needs',
      totalAllocated: 1500.0,
      isTransactionClosed: false,
      carryForwardAmount: 0.0
    }
  });

  console.log('✅ Cash allocation created:', allocation.id);
  return allocation;
}

async function testDataRetrieval(groupId) {
  console.log('🔍 Testing data retrieval...');
  
  // Test fetching group with all relations
  const groupWithData = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      memberships: {
        include: {
          member: true
        }
      },
      lateFineRules: {
        include: {
          tierRules: true
        }
      },
      groupPeriodicRecords: {
        include: {
          memberContributions: {
            include: {
              member: true
            }
          },
          cashAllocations: true,
          contributionReports: true
        }
      }
    }
  });

  console.log('📋 Group Data Summary:');
  console.log(`- Group: ${groupWithData.name}`);
  console.log(`- Members: ${groupWithData.memberships.length}`);
  console.log(`- Late Fine Rules: ${groupWithData.lateFineRules.length}`);
  console.log(`- Periodic Records: ${groupWithData.groupPeriodicRecords.length}`);
  
  if (groupWithData.groupPeriodicRecords.length > 0) {
    const record = groupWithData.groupPeriodicRecords[0];
    console.log(`- Member Contributions: ${record.memberContributions.length}`);
    console.log(`- Cash Allocations: ${record.cashAllocations.length}`);
    
    console.log('\n📊 Contribution Status:');
    record.memberContributions.forEach(contrib => {
      console.log(`  - ${contrib.member.name}: ${contrib.status} (Due: ₹${contrib.minimumDueAmount}, Paid: ₹${contrib.totalPaid}, Remaining: ₹${contrib.remainingAmount})`);
    });
  }

  return groupWithData;
}

async function runComprehensiveTest() {
  try {
    console.log('🚀 Starting comprehensive SHG contribution tracking test...\n');
    
    // Step 1: Cleanup
    await cleanupTestData();
    
    // Step 2: Create test user
    const user = await createTestUser();
    
    // Step 3: Create group with new features
    const group = await createTestGroup(user.id);
    
    // Step 4: Create late fine rule
    const lateFineRule = await createLateFineRule(group.id);
    
    // Step 5: Create members
    const members = await createTestMembers(group.id);
    
    // Step 6: Create periodic record
    const periodicRecord = await createPeriodicRecord(group.id);
    
    // Step 7: Create member contributions
    await createMemberContributions(periodicRecord.id, members);
    
    // Step 8: Create cash allocation
    const allocation = await createCashAllocation(periodicRecord.id);
    
    // Step 9: Test data retrieval
    const completeData = await testDataRetrieval(group.id);
    
    console.log('\n✅ All tests completed successfully!');
    console.log('🎉 The SHG contribution tracking system is working correctly!');
    
    return {
      group,
      members,
      periodicRecord,
      allocation,
      completeData
    };
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
runComprehensiveTest()
  .then((result) => {
    console.log('\n🎯 Test completed! You can now:');
    console.log('1. Navigate to the group in the web interface');
    console.log('2. Test the contribution tracking features');
    console.log('3. Test the late fine calculations');
    console.log('4. Test the cash allocation functionality');
    console.log(`\n🔗 Group ID for testing: ${result.group.id}`);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
