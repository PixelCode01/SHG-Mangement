/**
 * Test the current late fine calculation issues
 */

// Simulate the current calculateDaysLate function
function calculateDaysLate(dueDate, paymentDate = new Date()) {
  // Convert both dates to UTC date-only for consistent comparison
  const dueDateUTC = new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate()));
  const paymentDateUTC = new Date(Date.UTC(paymentDate.getUTCFullYear(), paymentDate.getUTCMonth(), paymentDate.getUTCDate()));
  
  const timeDiff = paymentDateUTC.getTime() - dueDateUTC.getTime();
  const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  
  console.log('🔍 Days Late Calculation:');
  console.log('  Due Date UTC:', dueDateUTC.toISOString());
  console.log('  Payment Date UTC:', paymentDateUTC.toISOString());
  console.log('  Time Diff (ms):', timeDiff);
  console.log('  Days Diff (raw):', timeDiff / (1000 * 60 * 60 * 24));
  console.log('  Days Diff (floor):', daysDiff);
  
  // Only consider it late if payment is after the due date
  return Math.max(0, daysDiff);
}

// Simulate the current calculatePeriodDueDate function
function calculatePeriodDueDate(groupSchedule, periodDate) {
  const frequency = groupSchedule.collectionFrequency || 'MONTHLY';
  
  if (frequency === 'MONTHLY') {
    const targetDay = groupSchedule.collectionDayOfMonth || 1;
    const periodMonth = periodDate.getUTCMonth();
    const periodYear = periodDate.getUTCFullYear();
    
    // Create due date on the target day of the period's month using UTC
    let dueDate = new Date(Date.UTC(periodYear, periodMonth, targetDay, 0, 0, 0, 0));
    
    console.log('🔍 Due Date Calculation:');
    console.log('  Target Day:', targetDay);
    console.log('  Period Month:', periodMonth, '(0=Jan, 5=June, 6=July)');
    console.log('  Period Year:', periodYear);
    console.log('  Initial Due Date:', dueDate.toISOString());
    
    // Handle months with fewer days
    if (dueDate.getUTCMonth() !== periodMonth) {
      dueDate = new Date(Date.UTC(periodYear, periodMonth + 1, 0, 0, 0, 0, 0));
      console.log('  Adjusted for month end:', dueDate.toISOString());
    }
    
    // If the due date is before the period start, move to next month
    if (dueDate < periodDate) {
      console.log('  Due date is before period start, moving to next month');
      dueDate = new Date(Date.UTC(periodYear, periodMonth + 1, targetDay, 0, 0, 0, 0));
      
      // Handle months with fewer days for next month too
      if (dueDate.getUTCMonth() !== (periodMonth + 1) % 12) {
        dueDate = new Date(Date.UTC(periodYear, periodMonth + 2, 0, 0, 0, 0, 0));
      }
      console.log('  Next month due date:', dueDate.toISOString());
    }
    
    return dueDate;
  }
  
  return periodDate;
}

console.log('🧪 Testing Late Fine Calculation Issues');
console.log('=====================================\n');

// Test 1: June period issue
console.log('TEST 1: June Period (KN Group - Collection Day 5th)');
console.log('---------------------------------------------------');
const groupSchedule = {
  collectionFrequency: 'MONTHLY',
  collectionDayOfMonth: 5
};

const junePeriodStart = new Date('2025-06-01T00:00:00.000Z');
const todayJune12 = new Date('2025-06-12T00:00:00.000Z');

console.log('Period Start: June 1, 2025');
console.log('Today: June 12, 2025');
console.log('Collection Day: 5th of each month');
console.log('Expected Result: 7 days late (June 6, 7, 8, 9, 10, 11, 12)');
console.log('');

const juneDueDate = calculatePeriodDueDate(groupSchedule, junePeriodStart);
const juneDaysLate = calculateDaysLate(juneDueDate, todayJune12);

console.log('📊 Result:', juneDaysLate, 'days late');
console.log('✅ Expected: 7 days | ❌ Actual:', juneDaysLate);
console.log('Is Correct?', juneDaysLate === 7 ? '✅ YES' : '❌ NO - ISSUE FOUND!');

console.log('\n===============================\n');

// Test 2: July period issue
console.log('TEST 2: July Period (After Closing June)');
console.log('------------------------------------------');
const julyPeriodStart = new Date('2025-07-01T00:00:00.000Z');

console.log('Period Start: July 1, 2025');
console.log('Today: June 12, 2025 (simulating same day)');
console.log('Collection Day: 5th of each month');
console.log('Expected Result: 0 days late (July due date is July 5th, today is before that)');
console.log('');

const julyDueDate = calculatePeriodDueDate(groupSchedule, julyPeriodStart);
const julyDaysLate = calculateDaysLate(julyDueDate, todayJune12);

console.log('📊 Result:', julyDaysLate, 'days late');
console.log('✅ Expected: 0 days | ❌ Actual:', julyDaysLate);
console.log('Is Correct?', julyDaysLate === 0 ? '✅ YES' : '❌ NO - ISSUE FOUND!');

console.log('\n===============================\n');

// Test 3: What should happen on July 6th
console.log('TEST 3: July 6th (First day late for July period)');
console.log('---------------------------------------------------');
const julyDay6 = new Date('2025-07-06T00:00:00.000Z');

console.log('Period Start: July 1, 2025');
console.log('Today: July 6, 2025');
console.log('Collection Day: 5th of each month');
console.log('Expected Result: 1 day late (July 6th is 1 day after July 5th)');
console.log('');

const julyDay6DaysLate = calculateDaysLate(julyDueDate, julyDay6);

console.log('📊 Result:', julyDay6DaysLate, 'days late');
console.log('✅ Expected: 1 day | ❌ Actual:', julyDay6DaysLate);
console.log('Is Correct?', julyDay6DaysLate === 1 ? '✅ YES' : '❌ NO - ISSUE FOUND!');

console.log('\n🎯 Summary of Issues Found:');
if (juneDaysLate !== 7) {
  console.log('❌ Issue 1: June calculation wrong -', juneDaysLate, 'instead of 7');
}
if (julyDaysLate !== 0) {
  console.log('❌ Issue 2: July period showing late when it should be 0');
}
console.log('');
