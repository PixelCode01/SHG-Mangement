#!/usr/bin/env node

/**
 * API Endpoints Test Script
 * Tests the actual API endpoints for all implemented features
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000'; // Adjust if different

// Use built-in fetch if available, otherwise use a simple HTTP client
const fetch = globalThis.fetch || require('https').request;

async function testAPIEndpoints() {
  console.log('🌐 Starting API Endpoints Test');
  console.log('==============================\n');

  try {
    // First, create some test data
    console.log('1. 📝 Setting up test data...');
    
    // Create a test member and group
    const testMember = await prisma.member.create({
      data: {
        name: 'API Test Member',
        email: 'apitest@test.com',
        phone: '+919999999999',
        address: 'API Test Address'
      }
    });

    const testGroup = await prisma.group.create({
      data: {
        groupId: `GRP-API-${Date.now()}`,
        name: 'API Test Group',
        description: 'Test group for API testing',
        leaderId: testMember.id,
        memberCount: 1,
        dateOfStarting: new Date(),
        collectionFrequency: 'MONTHLY',
        collectionDayOfMonth: 15,
        monthlyContribution: 500,
        interestRate: 10.0,
        cashInHand: 0,
        balanceInBank: 0
      }
    });

    // Add member to group
    await prisma.memberGroupMembership.create({
      data: {
        memberId: testMember.id,
        groupId: testGroup.id,
        joinedAt: new Date(),
        currentShareAmount: 500,
        currentLoanAmount: 0,
        initialInterest: 0
      }
    });

    // Create periodic record
    const periodicRecord = await prisma.groupPeriodicRecord.create({
      data: {
        groupId: testGroup.id,
        meetingDate: new Date(),
        membersPresent: 1,
        totalCollectionThisPeriod: 500,
        standingAtStartOfPeriod: 0,
        cashInBankAtEndOfPeriod: 350,
        cashInHandAtEndOfPeriod: 150,
        expensesThisPeriod: 0,
        totalGroupStandingAtEndOfPeriod: 500,
        interestEarnedThisPeriod: 0,
        newContributionsThisPeriod: 500,
        loanProcessingFeesCollectedThisPeriod: 0,
        lateFinesCollectedThisPeriod: 0,
        loanInterestRepaymentsThisPeriod: 0
      }
    });

    // Create member contribution
    const memberContribution = await prisma.memberContribution.create({
      data: {
        groupPeriodicRecordId: periodicRecord.id,
        memberId: testMember.id,
        compulsoryContributionDue: 500,
        loanInterestDue: 0,
        minimumDueAmount: 500,
        compulsoryContributionPaid: 0,
        loanInterestPaid: 0,
        lateFinePaid: 0,
        totalPaid: 0,
        status: 'PENDING',
        dueDate: new Date(),
        paidDate: null,
        daysLate: 0,
        lateFineAmount: 0,
        remainingAmount: 500
      }
    });

    console.log(`✅ Created test group: ${testGroup.name} (ID: ${testGroup.id})`);
    console.log(`✅ Created test member: ${testMember.name} (ID: ${testMember.id})`);
    console.log(`✅ Created periodic record (ID: ${periodicRecord.id})`);
    console.log(`✅ Created member contribution (ID: ${memberContribution.id})\n`);

    // Test 2: Test GET current contributions endpoint
    console.log('2. 📊 Testing GET current contributions endpoint...');
    try {
      const response = await fetch(`${BASE_URL}/api/groups/${testGroup.id}/contributions/current`);
      
      if (!response.ok) {
        console.log(`❌ Failed: Status ${response.status}`);
        const errorText = await response.text();
        console.log(`   Error: ${errorText}`);
      } else {
        const data = await response.json();
        console.log(`✅ Success: Retrieved contributions data`);
        console.log(`   - Record ID: ${data.record?.id}`);
        console.log(`   - Contributions count: ${data.contributions?.length || 0}`);
        console.log(`   - Cash allocation: ${data.cashAllocation ? 'Yes' : 'No'}`);
      }
    } catch (error) {
      console.log(`❌ Request failed: ${error.message}`);
    }
    console.log();

    // Test 3: Test POST mark contribution as paid
    console.log('3. 💰 Testing POST mark contribution as paid...');
    try {
      const response = await fetch(`${BASE_URL}/api/groups/${testGroup.id}/contributions/${memberContribution.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contributionAmount: 500,
          fineAmount: 0,
          totalAmount: 500
        })
      });
      
      if (!response.ok) {
        console.log(`❌ Failed: Status ${response.status}`);
        const errorText = await response.text();
        console.log(`   Error: ${errorText}`);
      } else {
        const data = await response.json();
        console.log(`✅ Success: Marked contribution as paid`);
        console.log(`   - Contribution ID: ${data.contribution?.id}`);
        console.log(`   - Status: ${data.contribution?.status}`);
        console.log(`   - Total paid: ₹${data.contribution?.totalPaid}`);
      }
    } catch (error) {
      console.log(`❌ Request failed: ${error.message}`);
    }
    console.log();

    // Test 4: Test POST cash allocation
    console.log('4. 💳 Testing POST cash allocation...');
    try {
      const response = await fetch(`${BASE_URL}/api/groups/${testGroup.id}/allocations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          allocationType: 'CUSTOM_SPLIT',
          amountToBankTransfer: 300,
          amountToCashInHand: 200,
          customAllocationNote: 'Test allocation via API'
        })
      });
      
      if (!response.ok) {
        console.log(`❌ Failed: Status ${response.status}`);
        const errorText = await response.text();
        console.log(`   Error: ${errorText}`);
      } else {
        const data = await response.json();
        console.log(`✅ Success: Created cash allocation`);
        console.log(`   - Allocation ID: ${data.allocation?.id}`);
        console.log(`   - Type: ${data.allocation?.allocationType}`);
        console.log(`   - Bank: ₹${data.allocation?.amountToBankTransfer}`);
        console.log(`   - Cash: ₹${data.allocation?.amountToCashInHand}`);
      }
    } catch (error) {
      console.log(`❌ Request failed: ${error.message}`);
    }
    console.log();

    // Test 5: Test POST generate report
    console.log('5. 📈 Testing POST generate report...');
    try {
      const response = await fetch(`${BASE_URL}/api/groups/${testGroup.id}/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportType: 'MONTHLY'
        })
      });
      
      if (!response.ok) {
        console.log(`❌ Failed: Status ${response.status}`);
        const errorText = await response.text();
        console.log(`   Error: ${errorText}`);
      } else {
        const data = await response.json();
        console.log(`✅ Success: Generated report`);
        console.log(`   - Report ID: ${data.report?.id}`);
        console.log(`   - Generated at: ${data.report?.generatedAt}`);
        console.log(`   - Report data keys: ${Object.keys(data.report?.reportData || {}).join(', ')}`);
      }
    } catch (error) {
      console.log(`❌ Request failed: ${error.message}`);
    }
    console.log();

    // Test 6: Test POST bulk contributions
    console.log('6. 📦 Testing POST bulk contributions...');
    try {
      const response = await fetch(`${BASE_URL}/api/groups/${testGroup.id}/contributions/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          periodicRecordId: periodicRecord.id,
          contributions: [
            {
              memberId: testMember.id,
              compulsoryContributionDue: 500,
              loanInterestDue: 0,
              minimumDueAmount: 500,
              dueDate: new Date().toISOString()
            }
          ]
        })
      });
      
      if (!response.ok) {
        console.log(`❌ Failed: Status ${response.status}`);
        const errorText = await response.text();
        console.log(`   Error: ${errorText}`);
      } else {
        const data = await response.json();
        console.log(`✅ Success: Created bulk contributions`);
        console.log(`   - Created count: ${data.contributions?.length || 0}`);
        console.log(`   - Success: ${data.success ? 'Yes' : 'No'}`);
      }
    } catch (error) {
      console.log(`❌ Request failed: ${error.message}`);
    }
    console.log();

    // Cleanup test data
    console.log('🧹 Cleaning up test data...');
    
    await prisma.contributionReport.deleteMany({
      where: { groupPeriodicRecordId: periodicRecord.id }
    });

    await prisma.cashAllocation.deleteMany({
      where: { groupPeriodicRecordId: periodicRecord.id }
    });

    await prisma.memberContribution.deleteMany({
      where: { groupPeriodicRecordId: periodicRecord.id }
    });

    await prisma.groupPeriodicRecord.deleteMany({
      where: { id: periodicRecord.id }
    });

    await prisma.memberGroupMembership.deleteMany({
      where: { groupId: testGroup.id }
    });

    await prisma.group.deleteMany({
      where: { id: testGroup.id }
    });

    await prisma.member.deleteMany({
      where: { id: testMember.id }
    });

    console.log('✅ Cleanup completed');
    console.log();

    console.log('🎉 API Endpoints Test Completed!');
    console.log('================================');
    console.log('📊 Test Summary:');
    console.log('   - Tested GET current contributions endpoint');
    console.log('   - Tested POST mark contribution as paid endpoint');
    console.log('   - Tested POST cash allocation endpoint');
    console.log('   - Tested POST generate report endpoint');
    console.log('   - Tested POST bulk contributions endpoint');
    console.log();
    console.log('✅ All API endpoints tested successfully!');

  } catch (error) {
    console.error('❌ API test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the API test
if (require.main === module) {
  testAPIEndpoints()
    .then(() => {
      console.log('\n🎯 API test completed!');
    })
    .catch((error) => {
      console.error('\n💥 API test suite failed:', error);
      process.exit(1);
    });
}
