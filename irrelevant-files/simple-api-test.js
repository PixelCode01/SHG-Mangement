#!/usr/bin/env node

/**
 * Simple API Test Script using curl commands
 * Tests the actual API endpoints for all implemented features
 */

const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';

function runCurl(method, url, data = null, expectedStatus = 200) {
  let command = `curl -s -w "%{http_code}" -X ${method}`;
  
  if (data) {
    command += ` -H "Content-Type: application/json" -d '${JSON.stringify(data)}'`;
  }
  
  command += ` ${url}`;
  
  try {
    const output = execSync(command, { encoding: 'utf8' });
    const statusCode = output.slice(-3);
    const responseBody = output.slice(0, -3);
    
    return {
      success: statusCode.startsWith('2'),
      statusCode: parseInt(statusCode),
      data: responseBody ? JSON.parse(responseBody) : null
    };
  } catch (error) {
    return {
      success: false,
      statusCode: 0,
      error: error.message,
      data: null
    };
  }
}

async function testAPIEndpoints() {
  console.log('🌐 Starting Simple API Endpoints Test');
  console.log('=====================================\n');

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
    const getCurrentContributions = runCurl('GET', `${BASE_URL}/api/groups/${testGroup.id}/contributions/current`);
    
    if (getCurrentContributions.success) {
      console.log(`✅ Success: Retrieved contributions data`);
      console.log(`   - Status: ${getCurrentContributions.statusCode}`);
      console.log(`   - Has record: ${getCurrentContributions.data?.record ? 'Yes' : 'No'}`);
      console.log(`   - Contributions count: ${getCurrentContributions.data?.contributions?.length || 0}`);
    } else {
      console.log(`❌ Failed: Status ${getCurrentContributions.statusCode}`);
      console.log(`   - Error: ${getCurrentContributions.error || 'Unknown error'}`);
    }
    console.log();

    // Test 3: Test POST mark contribution as paid
    console.log('3. 💰 Testing POST mark contribution as paid...');
    const markPaid = runCurl('POST', `${BASE_URL}/api/groups/${testGroup.id}/contributions/${memberContribution.id}`, {
      contributionAmount: 500,
      fineAmount: 0,
      totalAmount: 500
    });
    
    if (markPaid.success) {
      console.log(`✅ Success: Marked contribution as paid`);
      console.log(`   - Status: ${markPaid.statusCode}`);
      console.log(`   - Has contribution: ${markPaid.data?.contribution ? 'Yes' : 'No'}`);
    } else {
      console.log(`❌ Failed: Status ${markPaid.statusCode}`);
      console.log(`   - Error: ${markPaid.error || 'Unknown error'}`);
    }
    console.log();

    // Test 4: Test POST cash allocation
    console.log('4. 💳 Testing POST cash allocation...');
    const createAllocation = runCurl('POST', `${BASE_URL}/api/groups/${testGroup.id}/allocations`, {
      allocationType: 'CUSTOM_SPLIT',
      amountToBankTransfer: 300,
      amountToCashInHand: 200,
      customAllocationNote: 'Test allocation via API'
    });
    
    if (createAllocation.success) {
      console.log(`✅ Success: Created cash allocation`);
      console.log(`   - Status: ${createAllocation.statusCode}`);
      console.log(`   - Has allocation: ${createAllocation.data?.allocation ? 'Yes' : 'No'}`);
    } else {
      console.log(`❌ Failed: Status ${createAllocation.statusCode}`);
      console.log(`   - Error: ${createAllocation.error || 'Unknown error'}`);
    }
    console.log();

    // Test 5: Test POST generate report
    console.log('5. 📈 Testing POST generate report...');
    const generateReport = runCurl('POST', `${BASE_URL}/api/groups/${testGroup.id}/reports`, {
      reportType: 'MONTHLY'
    });
    
    if (generateReport.success) {
      console.log(`✅ Success: Generated report`);
      console.log(`   - Status: ${generateReport.statusCode}`);
      console.log(`   - Has report: ${generateReport.data?.report ? 'Yes' : 'No'}`);
    } else {
      console.log(`❌ Failed: Status ${generateReport.statusCode}`);
      console.log(`   - Error: ${generateReport.error || 'Unknown error'}`);
    }
    console.log();

    // Test 6: Test POST bulk contributions
    console.log('6. 📦 Testing POST bulk contributions...');
    const bulkContributions = runCurl('POST', `${BASE_URL}/api/groups/${testGroup.id}/contributions/bulk`, {
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
    });
    
    if (bulkContributions.success) {
      console.log(`✅ Success: Created bulk contributions`);
      console.log(`   - Status: ${bulkContributions.statusCode}`);
      console.log(`   - Has contributions: ${bulkContributions.data?.contributions ? 'Yes' : 'No'}`);
    } else {
      console.log(`❌ Failed: Status ${bulkContributions.statusCode}`);
      console.log(`   - Error: ${bulkContributions.error || 'Unknown error'}`);
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
    console.log('✅ All API endpoints tested!');

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
