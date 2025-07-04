#!/usr/bin/env node

// Direct test of late fine calculation logic without importing TS files
// Reproducing the logic to understand the issue

console.log('=== Testing Late Fine Calculation Logic ===');

// Helper function to calculate days late
function calculateDaysLate(dueDate, paymentDate = new Date()) {
  // Convert both dates to UTC date-only for consistent comparison
  const dueDateUTC = new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate()));
  const paymentDateUTC = new Date(Date.UTC(paymentDate.getUTCFullYear(), paymentDate.getUTCMonth(), paymentDate.getUTCDate()));
  
  const timeDiff = paymentDateUTC.getTime() - dueDateUTC.getTime();
  const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  
  // Only consider it late if payment is after the due date
  return Math.max(0, daysDiff);
}

// Helper function to calculate period due date for monthly frequency
function calculatePeriodDueDate(collectionDayOfMonth, periodDate) {
  const targetDay = collectionDayOfMonth || 1;
  
  // For monthly collections, the due date is the collection day of the period's month
  const periodMonth = periodDate.getUTCMonth();
  const periodYear = periodDate.getUTCFullYear();
  
  // Create due date on the target day of the period's month using UTC
  let dueDate = new Date(Date.UTC(periodYear, periodMonth, targetDay, 0, 0, 0, 0));
  
  // Handle months with fewer days (e.g., February 30 → February 28/29)
  if (dueDate.getUTCMonth() !== periodMonth) {
    // If the target day doesn't exist in this month, use the last day of the month
    dueDate = new Date(Date.UTC(periodYear, periodMonth + 1, 0, 0, 0, 0, 0)); // Last day of the month
  }
  
  // If the due date is before the period start, move to next month
  if (dueDate < periodDate) {
    dueDate = new Date(Date.UTC(periodYear, periodMonth + 1, targetDay, 0, 0, 0, 0));
    
    // Handle months with fewer days for next month too
    if (dueDate.getUTCMonth() !== (periodMonth + 1) % 12) {
      dueDate = new Date(Date.UTC(periodYear, periodMonth + 2, 0, 0, 0, 0, 0)); // Last day of next month
    }
  }
  
  return dueDate;
}

console.log('\n=== Test Case 1: June Period with Collection Day 5th ===');

const collectionDay = 5;
const junePeriodStart = new Date('2024-06-01T00:00:00.000Z');
const today = new Date('2024-06-12T00:00:00.000Z');

console.log('Collection Day:', collectionDay);
console.log('June Period Start:', junePeriodStart.toISOString());
console.log('Today (June 12):', today.toISOString());

const juneDueDate = calculatePeriodDueDate(collectionDay, junePeriodStart);
console.log('Calculated June Due Date:', juneDueDate.toISOString());

const juneDaysLate = calculateDaysLate(juneDueDate, today);
console.log('Days Late (current logic):', juneDaysLate);

console.log('\n=== Analysis of June Calculation ===');
console.log('Expected: Due date should be June 5th');
console.log('Expected: Days late should be 7 (June 12 - June 5 = 7)');
console.log('But we need to understand: should late fine start from June 5th or June 6th?');
console.log('If collection day is 5th, late fine should start from 6th');
console.log('So days subject to late fine: June 6, 7, 8, 9, 10, 11, 12 = 7 days');

console.log('\n=== Test Case 2: July Period Before Collection Day ===');

const julyPeriodStart = new Date('2024-07-01T00:00:00.000Z');
const julyEarly = new Date('2024-07-03T00:00:00.000Z'); // Before collection day

console.log('July Period Start:', julyPeriodStart.toISOString());
console.log('Check Date (July 3):', julyEarly.toISOString());

const julyDueDate = calculatePeriodDueDate(collectionDay, julyPeriodStart);
console.log('Calculated July Due Date:', julyDueDate.toISOString());

const julyDaysLate = calculateDaysLate(julyDueDate, julyEarly);
console.log('Days Late on July 3 (current logic):', julyDaysLate);

console.log('\n=== Analysis of July Calculation ===');
console.log('Expected: Due date should be July 5th');
console.log('Expected: July 3 should NOT be late (0 days late)');
console.log('Expected: Late fines should start from July 6th');

console.log('\n=== Test Case 3: July Period After Collection Day ===');

const julyLate = new Date('2024-07-08T00:00:00.000Z'); // After collection day

console.log('Check Date (July 8):', julyLate.toISOString());

const julyLatenessDays = calculateDaysLate(julyDueDate, julyLate);
console.log('Days Late on July 8 (current logic):', julyLatenessDays);

console.log('\n=== Analysis of July 8 Calculation ===');
console.log('Expected: July 8 should be 3 days late (July 8 - July 5 = 3)');
console.log('But late fine should consider days from July 6th');
console.log('So late fine days: July 6, 7, 8 = 3 days');

console.log('\n=== Problem Identification ===');
console.log('The current calculateDaysLate function calculates the difference correctly,');
console.log('but the interpretation might be wrong:');
console.log('- Collection day 5th means payment is due BY the 5th');
console.log('- Late fine should apply starting from the 6th (next day)');
console.log('- So the days late calculation is correct, but we need to adjust');
console.log('  either the due date or the late fine calculation logic');
