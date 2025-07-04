/**
 * Test late fine calculation directly in the period closing API
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testPeriodClosingWithLateFineValidation() {
  try {
    console.log('🧪 Testing Period Closing with Late Fine Validation based on Collection Day...\n');

    // Find a group with monthly collection
    const group = await prisma.group.findFirst({
      where: {
        collectionFrequency: 'MONTHLY'
      },
      include: {
        lateFineRules: {
          where: { isEnabled: true }
        },
        groupPeriodicRecords: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            memberContributions: {
              include: {
                member: true
              }
            }
          }
        }
      }
    });

    if (!group) {
      console.log('❌ No monthly group found');
      return;
    }

    console.log(`📋 Group: ${group.name} (${group.id})`);
    console.log(`📅 Collection Frequency: ${group.collectionFrequency}`);
    console.log(`📅 Collection Day: ${group.collectionDayOfMonth || 'Not set'}`);
    console.log(`💰 Monthly Contribution: ₹${group.monthlyContribution}`);

    // Check if group has collection day set, if not, set it
    if (!group.collectionDayOfMonth) {
      console.log('🔧 Setting collection day to 15th of month...');
      await prisma.group.update({
        where: { id: group.id },
        data: { collectionDayOfMonth: 15 }
      });
      console.log('✅ Collection day updated');
    }

    const latestPeriod = group.groupPeriodicRecords?.[0];
    if (!latestPeriod) {
      console.log('❌ No periods found for this group');
      return;
    }

    console.log(`\n📆 Latest Period: ${latestPeriod.id}`);
    console.log(`📆 Created: ${latestPeriod.createdAt.toDateString()}`);
    console.log(`📆 Members: ${latestPeriod.memberContributions?.length || 0}`);

    if (!latestPeriod.memberContributions || latestPeriod.memberContributions.length === 0) {
      console.log('❌ No member contributions found in this period');
      return;
    }

    // Test the period closing API with mock data
    console.log('\n🔄 Simulating Period Closing API Call...');

    // Prepare member contributions data as it would come from frontend
    const memberContributions = latestPeriod.memberContributions.map(mc => ({
      memberId: mc.memberId,
      expectedContribution: group.monthlyContribution || 100,
      remainingAmount: 50, // Simulate partial payment
      lateFineAmount: 10, // This should be recalculated by backend
      daysLate: 5, // This should be recalculated by backend
    }));

    const actualContributions = {};
    latestPeriod.memberContributions.forEach(mc => {
      actualContributions[mc.memberId] = {
        id: mc.id,
        totalPaid: (group.monthlyContribution || 100) - 50, // Partial payment
        loanInterestPaid: 0,
        paidDate: new Date().toISOString()
      };
    });

    // Make API call to period closing endpoint
    const apiResponse = await fetch('http://localhost:3000/api/groups/' + group.id + '/contributions/periods/close', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'test-session=true' // Mock authentication
      },
      body: JSON.stringify({
        periodId: latestPeriod.id,
        memberContributions,
        actualContributions
      })
    });

    if (apiResponse.ok) {
      const result = await apiResponse.json();
      console.log('✅ Period closing API call successful');
      console.log('📊 Response:', JSON.stringify(result, null, 2));
    } else {
      console.log('❌ Period closing API call failed:', apiResponse.status);
      const errorText = await apiResponse.text();
      console.log('Error details:', errorText);
    }

  } catch (error) {
    console.error('❌ Error testing period closing:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPeriodClosingWithLateFineValidation();
