/**
 * Update a group with collection day configuration and test late fine calculation
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateGroupAndTestLateFine() {
  try {
    console.log('🔧 Setting up group with collection day and testing late fine calculation...\n');

    // Update the first group with collection day configuration
    const group = await prisma.group.findFirst({
      where: {
        collectionFrequency: 'MONTHLY'
      }
    });

    if (!group) {
      console.log('❌ No monthly group found');
      return;
    }

    console.log(`📋 Updating group: ${group.name} (${group.id})`);

    // Update the group to have collection day of month = 15
    const updatedGroup = await prisma.group.update({
      where: { id: group.id },
      data: {
        collectionDayOfMonth: 15, // 15th of each month
        collectionFrequency: 'MONTHLY'
      },
      include: {
        lateFineRules: {
          where: { isEnabled: true },
          include: {
            tierRules: true
          }
        },
        groupPeriodicRecords: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    console.log(`✅ Updated group collection day to: ${updatedGroup.collectionDayOfMonth}th of each month\n`);

    // Import our utility functions
    const { calculatePeriodDueDate, calculateDaysLate } = require('./app/lib/due-date-utils');
    const { calculateLateFineAmount } = require('./app/lib/late-fine-utils');

    // Test different period scenarios
    const testPeriods = [
      new Date('2025-01-01'), // January 1st (due: January 15th)
      new Date('2025-02-01'), // February 1st (due: February 15th)  
      new Date('2025-03-01'), // March 1st (due: March 15th)
      new Date('2025-04-01'), // April 1st (due: April 15th)
      new Date('2025-05-01'), // May 1st (due: May 15th)
      new Date('2025-06-01'), // June 1st (due: June 15th)
    ];

    const groupSchedule = {
      collectionFrequency: updatedGroup.collectionFrequency,
      collectionDayOfMonth: updatedGroup.collectionDayOfMonth,
      collectionDayOfWeek: updatedGroup.collectionDayOfWeek,
      collectionWeekOfMonth: updatedGroup.collectionWeekOfMonth
    };

    const lateFineRule = updatedGroup.lateFineRules?.[0];
    const expectedContribution = updatedGroup.monthlyContribution || 100;

    console.log(`💰 Expected Contribution: ₹${expectedContribution}`);
    if (lateFineRule) {
      console.log(`⚖️ Late Fine Rule: ${lateFineRule.ruleType} - ${lateFineRule.dailyAmount ? '₹' + lateFineRule.dailyAmount + '/day' : lateFineRule.dailyPercentage + '%/day'}\n`);
    }

    console.log('📅 Testing Due Date Calculation for Different Periods:\n');

    testPeriods.forEach((periodStart, index) => {
      const dueDate = calculatePeriodDueDate(groupSchedule, periodStart);
      console.log(`${index + 1}. Period started: ${periodStart.toDateString()}`);
      console.log(`   Due date: ${dueDate.toDateString()}`);
      
      // Test late fine calculation for different payment dates
      const testPaymentDates = [
        new Date(dueDate.getTime() + 1 * 24 * 60 * 60 * 1000), // 1 day late
        new Date(dueDate.getTime() + 5 * 24 * 60 * 60 * 1000), // 5 days late
        new Date(dueDate.getTime() + 10 * 24 * 60 * 60 * 1000), // 10 days late
      ];

      testPaymentDates.forEach((paymentDate, pIndex) => {
        const daysLate = calculateDaysLate(dueDate, paymentDate);
        const lateFineAmount = calculateLateFineAmount(lateFineRule, daysLate, expectedContribution);
        console.log(`     Payment ${pIndex + 1}: ${paymentDate.toDateString()} (${daysLate} days late) → Fine: ₹${lateFineAmount}`);
      });
      console.log('');
    });

    // Test current date scenario
    const today = new Date();
    const currentPeriodStart = new Date(today.getFullYear(), today.getMonth(), 1); // First of current month
    const currentDueDate = calculatePeriodDueDate(groupSchedule, currentPeriodStart);
    const currentDaysLate = calculateDaysLate(currentDueDate, today);
    const currentLateFine = calculateLateFineAmount(lateFineRule, currentDaysLate, expectedContribution);

    console.log('🗓️ Current Period Analysis:');
    console.log(`   Period Start: ${currentPeriodStart.toDateString()}`);
    console.log(`   Due Date: ${currentDueDate.toDateString()}`);
    console.log(`   Today: ${today.toDateString()}`);
    console.log(`   Days Late: ${currentDaysLate}`);
    console.log(`   Late Fine: ₹${currentLateFine}`);
    console.log(`   Total Due: ₹${expectedContribution + currentLateFine}`);

    console.log('\n✅ Late fine calculation with collection day test completed successfully!');

  } catch (error) {
    console.error('❌ Error testing late fine calculation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateGroupAndTestLateFine();
