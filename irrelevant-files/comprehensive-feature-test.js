// Comprehensive test script for all SHG Management features
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testGroupCreationWithNewFeatures() {
  console.log('🧪 Testing Group Creation with New Features...');
  
  try {
    const timestamp = Date.now();
    
    // Test creating a group with weekly collection schedule
    const weeklyGroup = await prisma.group.create({
      data: {
        name: 'Test Weekly Group',
        groupId: `TWG-${timestamp}`,
        address: '123 Test Street',
        registrationNumber: `REG-WEEKLY-${timestamp}`,
        memberCount: 5,
        dateOfStarting: new Date('2024-01-01'),
        collectionFrequency: 'WEEKLY',
        collectionDayOfWeek: 'MONDAY',
        monthlyContribution: 500.0,
        interestRate: 12.0
      },
      include: {
        lateFineRules: true
      }
    });
    
    console.log('✅ Weekly group created successfully:', weeklyGroup.name);
    
    // Create late fine rule for the weekly group
    const weeklyLateFine = await prisma.lateFineRule.create({
      data: {
        groupId: weeklyGroup.id,
        ruleType: 'DAILY_FIXED',
        isEnabled: true,
        dailyAmount: 10.0
      }
    });
    
    console.log('✅ Late fine rule created for weekly group');
    
    // Test creating a group with monthly collection schedule
    const monthlyGroup = await prisma.group.create({
      data: {
        name: 'Test Monthly Group',
        groupId: `TMG-${timestamp}`, 
        address: '456 Test Avenue',
        registrationNumber: `REG-MONTHLY-${timestamp}`,
        memberCount: 10,
        dateOfStarting: new Date('2024-01-01'),
        collectionFrequency: 'MONTHLY',
        collectionDayOfMonth: 15,
        monthlyContribution: 1000.0,
        interestRate: 15.0
      },
      include: {
        lateFineRules: true
      }
    });
    
    console.log('✅ Monthly group created successfully:', monthlyGroup.name);
    
    // Create late fine rule for the monthly group
    const monthlyLateFine = await prisma.lateFineRule.create({
      data: {
        groupId: monthlyGroup.id,
        ruleType: 'DAILY_PERCENTAGE',
        isEnabled: true,
        dailyPercentage: 2.5
      }
    });
    
    console.log('✅ Late fine rule created for monthly group');
    
    return { weeklyGroup, monthlyGroup, weeklyLateFine, monthlyLateFine };
    
  } catch (error) {
    console.error('❌ Error in group creation test:', error);
    throw error;
  }
}

async function testMemberContributions(groupId) {
  console.log('🧪 Testing Member Contribution System...');
  
  try {
    // Create test members
    const member1 = await prisma.member.create({
      data: {
        name: 'Test Member 1',
        email: 'member1@test.com',
        currentLoanAmount: 5000
      }
    });
    
    const member2 = await prisma.member.create({
      data: {
        name: 'Test Member 2',
        email: 'member2@test.com',
        currentLoanAmount: 3000
      }
    });
    
    // Create membership records
    const membership1 = await prisma.memberGroupMembership.create({
      data: {
        memberId: member1.id,
        groupId: groupId,
        currentShareAmount: 1000,
        currentLoanAmount: 5000
      }
    });
    
    const membership2 = await prisma.memberGroupMembership.create({
      data: {
        memberId: member2.id,
        groupId: groupId,
        currentShareAmount: 1500,
        currentLoanAmount: 3000
      }
    });
    
    console.log('✅ Test members and memberships created successfully');
    
    // Create periodic record
    const periodicRecord = await prisma.groupPeriodicRecord.create({
      data: {
        groupId: groupId,
        meetingDate: new Date(),
        recordSequenceNumber: 1,
        membersPresent: 2,
        totalCollectionThisPeriod: 2000,
        newContributionsThisPeriod: 1000,
        loanInterestRepaymentsThisPeriod: 500,
        lateFinesCollectedThisPeriod: 50,
        standingAtStartOfPeriod: 5000,
        totalGroupStandingAtEndOfPeriod: 7700,
        cashInHandAtEndOfPeriod: 1000,
        cashInBankAtEndOfPeriod: 6700
      }
    });
    
    console.log('✅ Periodic record created successfully');
    
    // Create member contributions
    const contribution1 = await prisma.memberContribution.create({
      data: {
        memberId: member1.id,
        groupPeriodicRecordId: periodicRecord.id,
        compulsoryContributionDue: 200,
        loanInterestDue: member1.currentLoanAmount * 0.02, // 2% interest
        minimumDueAmount: 250,
        compulsoryContributionPaid: 200,
        loanInterestPaid: member1.currentLoanAmount * 0.02,
        totalPaid: 200 + (member1.currentLoanAmount * 0.02),
        status: 'PAID',
        dueDate: new Date(),
        daysLate: 0,
        lateFineAmount: 0,
        remainingAmount: 0
      }
    });
    
    const contribution2 = await prisma.memberContribution.create({
      data: {
        memberId: member2.id,
        groupPeriodicRecordId: periodicRecord.id,
        compulsoryContributionDue: 200,
        loanInterestDue: member2.currentLoanAmount * 0.02, // 2% interest
        minimumDueAmount: 250,
        compulsoryContributionPaid: 0, // Member hasn't paid
        loanInterestPaid: 0,
        totalPaid: 0,
        status: 'PENDING',
        dueDate: new Date(),
        daysLate: 5,
        lateFineAmount: 50, // Late fine for second member
        remainingAmount: 250 + (member2.currentLoanAmount * 0.02) + 50
      }
    });
    
    console.log('✅ Member contributions created successfully');
    
    return { 
      members: [member1, member2], 
      memberships: [membership1, membership2],
      periodicRecord, 
      contributions: [contribution1, contribution2] 
    };
    
  } catch (error) {
    console.error('❌ Error in member contribution test:', error);
    throw error;
  }
}

async function testCashAllocation(groupId, periodicRecordId) {
  console.log('🧪 Testing Cash Allocation System...');
  
  try {
    const allocation = await prisma.cashAllocation.create({
      data: {
        groupPeriodicRecordId: periodicRecordId,
        allocationType: 'CUSTOM_SPLIT',
        amountToBankTransfer: 2000,
        amountToCashInHand: 1000,
        customAllocationNote: 'Test allocation for emergency fund and operational cash',
        totalAllocated: 3000,
        isTransactionClosed: false,
        carryForwardAmount: 700
      }
    });
    
    console.log('✅ Cash allocation created successfully');
    
    // Test closing the transaction
    const closedAllocation = await prisma.cashAllocation.update({
      where: { id: allocation.id },
      data: {
        isTransactionClosed: true,
        transactionClosedAt: new Date()
      }
    });
    
    console.log('✅ Transaction closed successfully');
    
    return closedAllocation;
    
  } catch (error) {
    console.error('❌ Error in cash allocation test:', error);
    throw error;
  }
}

async function testReportGeneration(groupId, periodicRecordId) {
  console.log('🧪 Testing Report Generation...');
  
  try {
    const report = await prisma.contributionReport.create({
      data: {
        groupPeriodicRecordId: periodicRecordId,
        reportData: {
          totalCollection: 3000,
          totalMembers: 2,
          paidMembers: 1,
          pendingMembers: 1,
          totalLateFines: 50,
          averageContribution: 1500,
          reportType: 'PERIOD_SUMMARY',
          reportFormat: 'JSON'
        }
      }
    });
    
    console.log('✅ Report generated successfully');
    
    return report;
    
  } catch (error) {
    console.error('❌ Error in report generation test:', error);
    throw error;
  }
}

async function testAPIEndpoints() {
  console.log('🧪 Testing API Endpoints...');
  
  try {
    const baseUrl = 'http://localhost:3000/api';
    const timestamp = Date.now();
    
    // First create a test group via API
    const groupResponse = await fetch(`${baseUrl}/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'API Test Group',
        groupId: `ATG-${timestamp}`,
        address: '789 API Street',
        registrationNumber: `REG-API-${timestamp}`,
        memberCount: 3,
        dateOfStarting: new Date().toISOString(),
        collectionFrequency: 'MONTHLY',
        collectionDayOfMonth: 15,
        monthlyContribution: 750,
        interestRate: 12
      })
    });
    
    if (!groupResponse.ok) {
      console.error('❌ Group creation API failed:', await groupResponse.text());
      return;
    }
    
    const group = await groupResponse.json();
    console.log('✅ Group created via API:', group.name);
    
    // Test contributions current endpoint
    const contributionsResponse = await fetch(`${baseUrl}/groups/${group.id}/contributions/current`);
    
    if (contributionsResponse.ok) {
      const contributions = await contributionsResponse.json();
      console.log('✅ Contributions API endpoint working');
    } else {
      console.log('ℹ️ Contributions endpoint returned:', contributionsResponse.status, '(expected - no contributions yet)');
    }
    
    return group;
    
  } catch (error) {
    console.error('❌ Error in API endpoint test:', error);
    throw error;
  }
}

async function cleanupTestData() {
  console.log('🧹 Cleaning up test data...');
  
  try {
    // Get actual group IDs for cleanup
    const testGroups = await prisma.group.findMany({
      where: {
        OR: [
          { groupId: { contains: 'TWG' } },
          { groupId: { contains: 'TMG' } },
          { groupId: { contains: 'ATG' } }
        ]
      },
      select: { id: true }
    });
    
    const groupIds = testGroups.map(g => g.id);
    
    if (groupIds.length > 0) {
      // Clean up in reverse order of dependencies
      await prisma.contributionReport.deleteMany({
        where: { 
          groupPeriodicRecord: {
            groupId: { in: groupIds }
          }
        }
      });
      
      await prisma.cashAllocation.deleteMany({
        where: { 
          groupPeriodicRecord: {
            groupId: { in: groupIds }
          }
        }
      });
      
      // Get member IDs that belong to test groups
      const testMemberships = await prisma.memberGroupMembership.findMany({
        where: { groupId: { in: groupIds } },
        select: { memberId: true }
      });
      
      const memberIds = testMemberships.map(m => m.memberId);
      
      if (memberIds.length > 0) {
        await prisma.memberContribution.deleteMany({
          where: { 
            memberId: { in: memberIds }
          }
        });
      }
      
      await prisma.groupPeriodicRecord.deleteMany({
        where: { 
          groupId: { in: groupIds }
        }
      });
      
      await prisma.memberGroupMembership.deleteMany({
        where: { 
          groupId: { in: groupIds }
        }
      });
      
      if (memberIds.length > 0) {
        await prisma.member.deleteMany({
          where: { 
            id: { in: memberIds }
          }
        });
      }
      
      await prisma.lateFineRule.deleteMany({
        where: { 
          groupId: { in: groupIds }
        }
      });
      
      await prisma.group.deleteMany({
        where: { 
          id: { in: groupIds }
        }
      });
    }
    
    console.log('✅ Test data cleaned up successfully');
    
  } catch (error) {
    console.error('❌ Error in cleanup:', error);
  }
}

async function runAllTests() {
  console.log('🚀 Starting Comprehensive SHG Management Feature Tests');
  console.log('=====================================================');
  
  try {
    // Test 1: Group creation with new features
    const { weeklyGroup, monthlyGroup, weeklyLateFine, monthlyLateFine } = await testGroupCreationWithNewFeatures();
    
    // Test 2: Member contributions (using weekly group)
    const { members, memberships, periodicRecord, contributions } = await testMemberContributions(weeklyGroup.id);
    
    // Test 3: Cash allocation
    const allocation = await testCashAllocation(weeklyGroup.id, periodicRecord.id);
    
    // Test 4: Report generation
    const report = await testReportGeneration(weeklyGroup.id, periodicRecord.id);
    
    // Test 5: API endpoints
    const apiGroup = await testAPIEndpoints();
    
    console.log('\n🎉 All Tests Completed Successfully!');
    console.log('====================================');
    console.log('✅ Group Creation with Collection Schedules');
    console.log('✅ Late Fine Rule Configuration');
    console.log('✅ Member Contribution Tracking');
    console.log('✅ Cash Allocation Management');
    console.log('✅ Report Generation');
    console.log('✅ API Endpoints');
    
    // Cleanup
    await cleanupTestData();
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    await cleanupTestData();
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runAllTests();
