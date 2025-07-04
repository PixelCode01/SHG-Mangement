const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');

const prisma = new PrismaClient();

async function testPeriodClosingWithLogs() {
  console.log('🔍 Testing period closing with comprehensive logs...');
  console.log('===================================================');

  try {
    // Find a group with existing data to test with
    const group = await prisma.group.findFirst({
      where: {
        // Look for groups that have some cash and potentially loans
        OR: [
          { cashInHand: { gt: 0 } },
          { balanceInBank: { gt: 0 } }
        ]
      },
      include: {
        periodicRecords: {
          orderBy: { recordSequenceNumber: 'desc' },
          take: 1
        }
      }
    });

    if (!group) {
      console.log('❌ No suitable group found for testing');
      return;
    }

    console.log(`📋 Testing with Group: ${group.name} (ID: ${group.id})`);
    console.log(`   Current Cash in Hand: ₹${group.cashInHand || 0}`);
    console.log(`   Current Cash in Bank: ₹${group.balanceInBank || 0}`);

    // Check if there's an open period
    const openPeriod = await prisma.groupPeriodicRecord.findFirst({
      where: {
        groupId: group.id,
        totalCollectionThisPeriod: 0 // Indicates not closed yet
      },
      orderBy: { recordSequenceNumber: 'desc' }
    });

    if (!openPeriod) {
      console.log('❌ No open period found for this group');
      return;
    }

    console.log(`📊 Found open period: ${openPeriod.id} (Sequence: ${openPeriod.recordSequenceNumber})`);

    // Get member contributions for this period
    const memberContributions = await prisma.memberContribution.findMany({
      where: { groupPeriodicRecordId: openPeriod.id }
    });

    if (memberContributions.length === 0) {
      console.log('❌ No member contributions found for this period');
      return;
    }

    console.log(`👥 Found ${memberContributions.length} member contributions`);

    // Prepare mock contribution updates (simulate some payments)
    const actualContributions = {};
    const memberContribsForUpdate = [];

    memberContributions.forEach(contrib => {
      const paidAmount = Math.min(contrib.minimumDueAmount || 500, 500); // Simulate partial payment
      
      actualContributions[contrib.memberId] = {
        id: contrib.id,
        totalPaid: paidAmount,
        loanInterestPaid: contrib.loanInterestDue || 0,
        cashAllocation: null // Let it use default allocation
      };

      memberContribsForUpdate.push({
        memberId: contrib.memberId,
        remainingAmount: (contrib.minimumDueAmount || 500) - paidAmount,
        daysLate: 0,
        lateFineAmount: 0
      });
    });

    console.log('\n🧮 Simulated contribution payments ready');
    console.log('Now calling period close API...\n');

    // Make the API call to close the period
    const response = await fetch(`http://localhost:3000/api/groups/${group.id}/contributions/periods/close`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: In a real scenario, you'd need proper authentication headers
      },
      body: JSON.stringify({
        periodId: openPeriod.id,
        memberContributions: memberContribsForUpdate,
        actualContributions: actualContributions
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Period closed successfully');
      console.log('Response:', result);
    } else {
      console.log('❌ Period close failed');
      console.log('Error:', result);
    }

    // Now fetch the periodic records to see the results
    console.log('\n📊 Fetching periodic records to verify calculations...\n');
    
    const recordsResponse = await fetch(`http://localhost:3000/api/groups/${group.id}/periodic-records`);
    const recordsResult = await recordsResponse.json();
    
    if (recordsResponse.ok) {
      console.log('✅ Periodic records retrieved');
      console.log(`Found ${recordsResult.length} records`);
    } else {
      console.log('❌ Failed to retrieve periodic records');
      console.log('Error:', recordsResult);
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
runTest()
  .catch(error => {
    console.error('Test script failed:', error);
    process.exit(1);
  });

async function runTest() {
  await testPeriodClosingWithLogs();
}
