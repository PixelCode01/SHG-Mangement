/**
 * Direct test of late fine validation logic
 */

// Simple standalone test functions (no imports needed)

// Mock due date calculation
function calculatePeriodDueDate(groupSchedule, periodStartDate) {
  const frequency = groupSchedule.collectionFrequency || 'MONTHLY';
  
  if (frequency === 'MONTHLY') {
    const targetDay = groupSchedule.collectionDayOfMonth || 1;
    const periodMonth = periodStartDate.getMonth();
    const periodYear = periodStartDate.getFullYear();
    
    let dueDate = new Date(periodYear, periodMonth, targetDay);
    
    // Handle months with fewer days
    if (dueDate.getMonth() !== periodMonth) {
      dueDate = new Date(periodYear, periodMonth + 1, 0); // Last day of the month
    }
    
    return dueDate;
  }
  
  return periodStartDate; // Fallback
}

function calculateDaysLate(dueDate, paymentDate) {
  const timeDiff = paymentDate.getTime() - dueDate.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
  return Math.max(0, daysDiff);
}

function calculateLateFineAmount(lateFineRule, daysLate, expectedContribution) {
  if (!lateFineRule || !lateFineRule.isEnabled || daysLate <= 0) {
    return 0;
  }

  switch (lateFineRule.ruleType) {
    case 'DAILY_FIXED':
      return (lateFineRule.dailyAmount || 0) * daysLate;
      
    case 'DAILY_PERCENTAGE':
      const dailyRate = (lateFineRule.dailyPercentage || 0) / 100;
      return Math.round((expectedContribution * dailyRate * daysLate) * 100) / 100;
      
    default:
      return 0;
  }
}

async function testLateFineLogic() {
  try {
    console.log('🧪 Testing Late Fine Logic with Collection Day...\n');

    // Mock group configuration
    const groupSchedule = {
      collectionFrequency: 'MONTHLY',
      collectionDayOfMonth: 15, // 15th of each month
      collectionDayOfWeek: null,
      collectionWeekOfMonth: null
    };

    const lateFineRule = {
      id: 'test-rule',
      isEnabled: true,
      ruleType: 'DAILY_FIXED',
      dailyAmount: 2,
      dailyPercentage: null
    };

    const expectedContribution = 100;

    console.log('📋 Test Configuration:');
    console.log(`   Collection: ${groupSchedule.collectionFrequency} on ${groupSchedule.collectionDayOfMonth}th`);
    console.log(`   Late Fine: ${lateFineRule.ruleType} - ₹${lateFineRule.dailyAmount}/day`);
    console.log(`   Expected Contribution: ₹${expectedContribution}\n`);

    // Test scenarios
    const testScenarios = [
      { name: 'January Period', periodStart: new Date('2025-01-01') },
      { name: 'February Period', periodStart: new Date('2025-02-01') },
      { name: 'March Period', periodStart: new Date('2025-03-01') },
      { name: 'Current Month', periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
    ];

    testScenarios.forEach((scenario, index) => {
      console.log(`${index + 1}. ${scenario.name}:`);
      console.log(`   Period Start: ${scenario.periodStart.toDateString()}`);
      
      const dueDate = calculatePeriodDueDate(groupSchedule, scenario.periodStart);
      console.log(`   Due Date: ${dueDate.toDateString()}`);
      
      // Test different payment dates
      const paymentTests = [
        { name: 'On Time', date: dueDate },
        { name: '1 Day Late', date: new Date(dueDate.getTime() + 1 * 24 * 60 * 60 * 1000) },
        { name: '5 Days Late', date: new Date(dueDate.getTime() + 5 * 24 * 60 * 60 * 1000) },
        { name: '10 Days Late', date: new Date(dueDate.getTime() + 10 * 24 * 60 * 60 * 1000) }
      ];

      paymentTests.forEach(test => {
        const daysLate = calculateDaysLate(dueDate, test.date);
        const lateFine = calculateLateFineAmount(lateFineRule, daysLate, expectedContribution);
        console.log(`     ${test.name}: ${test.date.toDateString()} → ${daysLate} days late → ₹${lateFine} fine`);
      });
      console.log('');
    });

    // Test validation function
    console.log('🔍 Testing Validation Function:');
    
    const memberContributions = [
      { memberId: 'member1', expectedContribution: 100, lateFineAmount: 15, daysLate: 5 }, // Incorrect fine
      { memberId: 'member2', expectedContribution: 100, lateFineAmount: 10, daysLate: 5 }, // Correct fine
    ];

    const periodStartDate = new Date('2025-06-01');
    const paymentDate = new Date('2025-06-20'); // 5 days after due (15th)

    console.log(`   Period Start: ${periodStartDate.toDateString()}`);
    console.log(`   Payment Date: ${paymentDate.toDateString()}`);
    
    memberContributions.forEach(mc => {
      const dueDate = calculatePeriodDueDate(groupSchedule, periodStartDate);
      const actualDaysLate = calculateDaysLate(dueDate, paymentDate);
      const correctLateFine = calculateLateFineAmount(lateFineRule, actualDaysLate, mc.expectedContribution);
      
      const needsCorrection = Math.abs(correctLateFine - mc.lateFineAmount) > 0.01 || actualDaysLate !== mc.daysLate;
      
      console.log(`   ${mc.memberId}: ₹${mc.lateFineAmount} → ₹${correctLateFine} (${needsCorrection ? 'CORRECTED' : 'OK'})`);
    });

    console.log('\n✅ Late fine logic test completed successfully!');

  } catch (error) {
    console.error('❌ Error testing late fine logic:', error);
  }
}

testLateFineLogic();
