/**
 * Direct test of late fine calculation utilities with detailed logging
 * This bypasses the API and tests the core logic directly
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Mock implementations to test the logic
function calculatePeriodDueDate(groupSchedule, periodStartDate) {
  console.log(`📅 [DUE DATE CALC] Input:`, {
    frequency: groupSchedule.collectionFrequency,
    dayOfMonth: groupSchedule.collectionDayOfMonth,
    dayOfWeek: groupSchedule.collectionDayOfWeek,
    periodStart: periodStartDate.toISOString()
  });

  const frequency = groupSchedule.collectionFrequency || 'MONTHLY';
  
  if (frequency === 'MONTHLY') {
    const targetDay = groupSchedule.collectionDayOfMonth || 1;
    const periodMonth = periodStartDate.getMonth();
    const periodYear = periodStartDate.getFullYear();
    
    console.log(`📅 [DUE DATE CALC] Monthly calculation:`, {
      targetDay,
      periodMonth,
      periodYear,
      periodStartDay: periodStartDate.getDate()
    });
    
    let dueDate = new Date(periodYear, periodMonth, targetDay);
    
    console.log(`📅 [DUE DATE CALC] Initial due date: ${dueDate.toISOString()}`);
    
    // Handle months with fewer days
    if (dueDate.getMonth() !== periodMonth) {
      dueDate = new Date(periodYear, periodMonth + 1, 0); // Last day of the month
      console.log(`📅 [DUE DATE CALC] Adjusted for month boundary: ${dueDate.toISOString()}`);
    }
    
    // Check if due date is before period start (shouldn't happen for normal periods)
    if (dueDate < periodStartDate) {
      console.log(`⚠️ [DUE DATE CALC] Due date is before period start, moving to next month`);
      dueDate = new Date(periodYear, periodMonth + 1, targetDay);
      // Handle month boundary again
      if (dueDate.getMonth() !== (periodMonth + 1) % 12) {
        dueDate = new Date(periodYear, periodMonth + 2, 0);
      }
      console.log(`📅 [DUE DATE CALC] Next month due date: ${dueDate.toISOString()}`);
    }
    
    return dueDate;
  }
  
  console.log(`⚠️ [DUE DATE CALC] Unsupported frequency: ${frequency}, returning period start`);
  return periodStartDate;
}

function calculateDaysLate(dueDate, paymentDate) {
  console.log(`📊 [DAYS LATE CALC] Input:`, {
    dueDate: dueDate.toISOString(),
    paymentDate: paymentDate.toISOString()
  });

  const timeDiff = paymentDate.getTime() - dueDate.getTime();
  const daysDiffRaw = timeDiff / (1000 * 60 * 60 * 24);
  const daysDiffCeil = Math.ceil(daysDiffRaw);
  const daysLate = Math.max(0, daysDiffCeil);
  
  console.log(`📊 [DAYS LATE CALC] Calculation:`, {
    timeDiffMs: timeDiff,
    daysDiffRaw: daysDiffRaw,
    daysDiffCeil: daysDiffCeil,
    daysLate: daysLate,
    isLate: daysLate > 0
  });

  return daysLate;
}

function calculateLateFineAmount(lateFineRule, daysLate, expectedContribution) {
  console.log(`💰 [LATE FINE CALC] Input:`, {
    ruleType: lateFineRule?.ruleType,
    isEnabled: lateFineRule?.isEnabled,
    daysLate,
    expectedContribution,
    dailyAmount: lateFineRule?.dailyAmount,
    dailyPercentage: lateFineRule?.dailyPercentage
  });

  if (!lateFineRule || !lateFineRule.isEnabled || daysLate <= 0) {
    console.log(`💰 [LATE FINE CALC] No fine applied (rule: ${!lateFineRule ? 'none' : !lateFineRule.isEnabled ? 'disabled' : 'not late'})`);
    return 0;
  }

  let fineAmount = 0;

  switch (lateFineRule.ruleType) {
    case 'DAILY_FIXED':
      fineAmount = (lateFineRule.dailyAmount || 0) * daysLate;
      console.log(`💰 [LATE FINE CALC] DAILY_FIXED: ₹${lateFineRule.dailyAmount} × ${daysLate} days = ₹${fineAmount}`);
      break;
      
    case 'DAILY_PERCENTAGE':
      const dailyRate = (lateFineRule.dailyPercentage || 0) / 100;
      fineAmount = Math.round((expectedContribution * dailyRate * daysLate) * 100) / 100;
      console.log(`💰 [LATE FINE CALC] DAILY_PERCENTAGE: ₹${expectedContribution} × ${dailyRate} × ${daysLate} days = ₹${fineAmount}`);
      break;
      
    default:
      console.log(`💰 [LATE FINE CALC] Unsupported rule type: ${lateFineRule.ruleType}`);
      return 0;
  }

  return fineAmount;
}

async function testLateFineCalculationDirectly() {
  try {
    console.log('🔍 Direct Late Fine Calculation Test with Detailed Logging\n');

    // Get a group with late fine rules
    const group = await prisma.group.findFirst({
      where: {
        collectionFrequency: 'MONTHLY',
        collectionDayOfMonth: { not: null }
      },
      include: {
        lateFineRules: {
          where: { isEnabled: true }
        }
      }
    });

    if (!group) {
      console.log('❌ No suitable group found');
      return;
    }

    console.log(`📋 Group: ${group.name} (${group.id})`);
    console.log(`📅 Collection: ${group.collectionFrequency} on ${group.collectionDayOfMonth}th`);
    console.log(`💰 Monthly Contribution: ₹${group.monthlyContribution}`);

    const lateFineRule = group.lateFineRules?.[0];
    if (!lateFineRule) {
      console.log('❌ No late fine rule found');
      return;
    }

    console.log(`⚖️ Late Fine Rule: ${lateFineRule.ruleType} (${lateFineRule.isEnabled ? 'enabled' : 'disabled'})`);
    if (lateFineRule.dailyAmount) console.log(`⚖️ Daily Amount: ₹${lateFineRule.dailyAmount}`);
    if (lateFineRule.dailyPercentage) console.log(`⚖️ Daily Percentage: ${lateFineRule.dailyPercentage}%`);

    // Test scenarios
    console.log('\n🧪 Testing Different Scenarios:\n');

    const testScenarios = [
      {
        name: 'Period starts June 1, due June 10, paid June 15 (5 days late)',
        periodStart: new Date('2025-06-01T00:00:00Z'),
        paymentDate: new Date('2025-06-15T00:00:00Z')
      },
      {
        name: 'Period starts June 1, due June 10, paid June 10 (on time)',
        periodStart: new Date('2025-06-01T00:00:00Z'),
        paymentDate: new Date('2025-06-10T00:00:00Z')
      },
      {
        name: 'Period starts June 1, due June 10, paid June 20 (10 days late)',
        periodStart: new Date('2025-06-01T00:00:00Z'),
        paymentDate: new Date('2025-06-20T00:00:00Z')
      },
      {
        name: 'Current scenario: Period starts today, paid today',
        periodStart: new Date(),
        paymentDate: new Date()
      }
    ];

    const groupSchedule = {
      collectionFrequency: group.collectionFrequency,
      collectionDayOfMonth: group.collectionDayOfMonth,
      collectionDayOfWeek: group.collectionDayOfWeek,
      collectionWeekOfMonth: group.collectionWeekOfMonth
    };

    const expectedContribution = group.monthlyContribution || 100;

    testScenarios.forEach((scenario, index) => {
      console.log(`\n${index + 1}. ${scenario.name}`);
      console.log('=' .repeat(60));
      
      const dueDate = calculatePeriodDueDate(groupSchedule, scenario.periodStart);
      const daysLate = calculateDaysLate(dueDate, scenario.paymentDate);
      const lateFine = calculateLateFineAmount(lateFineRule, daysLate, expectedContribution);

      console.log(`📋 SUMMARY for scenario ${index + 1}:`);
      console.log(`   Period Start: ${scenario.periodStart.toDateString()}`);
      console.log(`   Due Date: ${dueDate.toDateString()}`);
      console.log(`   Payment Date: ${scenario.paymentDate.toDateString()}`);
      console.log(`   Days Late: ${daysLate}`);
      console.log(`   Late Fine: ₹${lateFine}`);
      console.log(`   Total Due: ₹${expectedContribution + lateFine}`);
    });

    console.log('\n✅ Direct test completed - analyze logs above for issues');

  } catch (error) {
    console.error('❌ Direct test error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testLateFineCalculationDirectly();
