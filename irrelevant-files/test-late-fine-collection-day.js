/**
 * Test script to validate late fine calculation using collection day from group form
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testLateFineCalculation() {
  try {
    console.log('🧪 Testing Late Fine Calculation with Collection Day...\n');

    // Find a group with collection schedule
    const group = await prisma.group.findFirst({
      where: {
        collectionFrequency: 'MONTHLY',
        collectionDayOfMonth: { not: null }
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
          take: 1,
          include: {
            memberContributions: true
          }
        }
      }
    });

    if (!group) {
      console.log('❌ No group found with monthly collection schedule');
      return;
    }

    console.log(`📋 Group: ${group.name}`);
    console.log(`📅 Collection Frequency: ${group.collectionFrequency}`);
    console.log(`📅 Collection Day of Month: ${group.collectionDayOfMonth}`);
    console.log(`💰 Monthly Contribution: ₹${group.monthlyContribution}`);

    // Check late fine rules
    const lateFineRule = group.lateFineRules?.[0];
    if (lateFineRule) {
      console.log(`\n⚖️ Late Fine Rule: ${lateFineRule.ruleType}`);
      console.log(`⚖️ Enabled: ${lateFineRule.isEnabled}`);
      if (lateFineRule.ruleType === 'DAILY_FIXED') {
        console.log(`⚖️ Daily Amount: ₹${lateFineRule.dailyAmount}`);
      } else if (lateFineRule.ruleType === 'DAILY_PERCENTAGE') {
        console.log(`⚖️ Daily Percentage: ${lateFineRule.dailyPercentage}%`);
      } else if (lateFineRule.ruleType === 'TIER_BASED' && lateFineRule.tierRules) {
        console.log(`⚖️ Tier Rules:`);
        lateFineRule.tierRules.forEach(tier => {
          console.log(`   Days ${tier.startDay}-${tier.endDay}: ${tier.isPercentage ? tier.amount + '%' : '₹' + tier.amount}`);
        });
      }
    } else {
      console.log('\n⚖️ No active late fine rule');
    }

    // Get the latest period
    const latestPeriod = group.groupPeriodicRecords?.[0];
    if (!latestPeriod) {
      console.log('\n❌ No periods found for this group');
      return;
    }

    console.log(`\n📆 Latest Period: ${latestPeriod.id}`);
    console.log(`📆 Period Created: ${latestPeriod.createdAt.toDateString()}`);

    // Import our utility functions
    const { calculatePeriodDueDate, calculateDaysLate } = require('./app/lib/due-date-utils');
    const { calculateLateFineAmount } = require('./app/lib/late-fine-utils');

    // Calculate due date for this period
    const groupSchedule = {
      collectionFrequency: group.collectionFrequency,
      collectionDayOfMonth: group.collectionDayOfMonth,
      collectionDayOfWeek: group.collectionDayOfWeek,
      collectionWeekOfMonth: group.collectionWeekOfMonth
    };

    const dueDate = calculatePeriodDueDate(groupSchedule, latestPeriod.createdAt);
    const today = new Date();
    const daysLate = calculateDaysLate(dueDate, today);

    console.log(`\n📅 Period Due Date: ${dueDate.toDateString()}`);
    console.log(`📅 Today: ${today.toDateString()}`);
    console.log(`📅 Days Late: ${daysLate}`);

    // Test late fine calculation for expected contribution
    const expectedContribution = group.monthlyContribution || 100;
    const lateFineAmount = calculateLateFineAmount(lateFineRule, daysLate, expectedContribution);

    console.log(`\n💰 Expected Contribution: ₹${expectedContribution}`);
    console.log(`💰 Late Fine Amount: ₹${lateFineAmount}`);
    console.log(`💰 Total Due: ₹${expectedContribution + lateFineAmount}`);

    // Test different late scenarios
    console.log('\n🔬 Testing Different Late Scenarios:');
    const testScenarios = [0, 1, 5, 10, 15, 30];
    testScenarios.forEach(days => {
      const fine = calculateLateFineAmount(lateFineRule, days, expectedContribution);
      console.log(`   ${days} days late: ₹${fine}`);
    });

    console.log('\n✅ Late fine calculation test completed successfully!');

  } catch (error) {
    console.error('❌ Error testing late fine calculation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testLateFineCalculation();
