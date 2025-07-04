/**
 * Test script to trigger late fine validation logging in period closing API
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testLateFineCalculationWithLogs() {
  try {
    console.log('🔍 Testing Late Fine Calculation with Detailed Logging...\n');

    // Find a group with collection schedule
    const group = await prisma.group.findFirst({
      where: {
        collectionFrequency: 'MONTHLY',
        collectionDayOfMonth: { not: null }
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
      console.log('❌ No suitable group found for testing');
      return;
    }

    console.log(`📋 Group: ${group.name} (${group.id})`);
    console.log(`📅 Collection Day: ${group.collectionDayOfMonth}th of month`);
    console.log(`💰 Monthly Contribution: ₹${group.monthlyContribution}`);

    const latestPeriod = group.groupPeriodicRecords?.[0];
    if (!latestPeriod || !latestPeriod.memberContributions?.length) {
      console.log('❌ No periods with member contributions found');
      return;
    }

    console.log(`📆 Period: ${latestPeriod.id}`);
    console.log(`📆 Created: ${latestPeriod.createdAt.toDateString()}`);
    console.log(`📆 Meeting Date: ${latestPeriod.meetingDate.toDateString()}`);
    console.log(`👥 Members: ${latestPeriod.memberContributions.length}`);

    // Prepare mock data with potentially incorrect late fines
    const memberContributions = latestPeriod.memberContributions.map((mc, index) => ({
      memberId: mc.memberId,
      expectedContribution: group.monthlyContribution || 100,
      remainingAmount: 25, // Some partial payment
      lateFineAmount: 8 + (index * 3), // Potentially incorrect: 8, 11, 14, etc.
      daysLate: 4 + index, // Potentially incorrect: 4, 5, 6, etc.
    }));

    const actualContributions = {};
    latestPeriod.memberContributions.forEach((mc, index) => {
      // Simulate payment made a few days after the due date
      const paymentDate = new Date();
      paymentDate.setDate(paymentDate.getDate() - 5 + index); // Varying payment dates
      
      actualContributions[mc.memberId] = {
        id: mc.id,
        totalPaid: (group.monthlyContribution || 100) - 25, // Partial payment
        loanInterestPaid: 0,
        paidDate: paymentDate.toISOString()
      };
    });

    console.log('\n🔄 Making API call to period closing endpoint...');
    console.log('This will trigger detailed late fine validation logs\n');

    // Make API call to trigger the logs
    try {
      const response = await fetch('http://localhost:3000/api/groups/' + group.id + '/contributions/periods/close', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          periodId: latestPeriod.id,
          memberContributions,
          actualContributions
        })
      });

      console.log(`API Response Status: ${response.status}`);
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ API call successful - check server logs for detailed analysis');
        console.log('Response preview:', {
          success: result.success,
          message: result.message,
          hasTransitionInfo: !!result.transitionInfo
        });
      } else {
        const errorText = await response.text();
        console.log('❌ API call failed');
        console.log('Error response:', errorText.substring(0, 500));
      }
    } catch (apiError) {
      console.log('❌ API call error:', apiError.message);
      console.log('Make sure the development server is running (npm run dev)');
    }

  } catch (error) {
    console.error('❌ Test script error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testLateFineCalculationWithLogs();
