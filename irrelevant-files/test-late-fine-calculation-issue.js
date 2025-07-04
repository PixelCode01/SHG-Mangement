#!/usr/bin/env node

const { calculateLateFineInfo, calculateDaysLate, calculatePeriodDueDate } = require('./app/lib/due-date-utils.ts');

// Test current logic for June period with collection day 5th
// For 5th of month, late fine should start from 6th
// Today is June 12, so it should be 7 days late (12-5 = 7), not 8

console.log('=== Testing Late Fine Calculation for June 2024 ===');

const groupSchedule = {
  collectionFrequency: 'MONTHLY',
  collectionDayOfMonth: 5,
  collectionDayOfWeek: null,
  collectionWeekOfMonth: null
};

// June period start date
const junePeriodStart = new Date('2024-06-01T00:00:00.000Z');

// Today's date (June 12, 2024)
const today = new Date('2024-06-12T00:00:00.000Z');

console.log('Group Schedule:', groupSchedule);
console.log('June Period Start:', junePeriodStart.toISOString());
console.log('Today:', today.toISOString());

// Calculate due date for June period
const dueDate = calculatePeriodDueDate(groupSchedule, junePeriodStart);
console.log('Calculated Due Date for June:', dueDate.toISOString());

// Calculate days late
const daysLate = calculateDaysLate(dueDate, today);
console.log('Days Late:', daysLate);

// Calculate late fine info
const lateFineInfo = calculateLateFineInfo(groupSchedule, junePeriodStart, today);
console.log('Late Fine Info:', lateFineInfo);

console.log('\n=== Analysis ===');
console.log('Expected Due Date: June 5, 2024 (2024-06-05T00:00:00.000Z)');
console.log('Expected Days Late: 7 (June 12 - June 5 = 7 days)');
console.log('But late fine should only start from June 6th');
console.log('So actual days subject to late fine: 7 (June 6, 7, 8, 9, 10, 11, 12)');

// Test what happens after period closure for July
console.log('\n=== Testing July Period After June Closure ===');

const julyPeriodStart = new Date('2024-07-01T00:00:00.000Z');
const julyDate = new Date('2024-07-03T00:00:00.000Z'); // Before collection day

console.log('July Period Start:', julyPeriodStart.toISOString());
console.log('Check Date (July 3):', julyDate.toISOString());

const julyDueDate = calculatePeriodDueDate(groupSchedule, julyPeriodStart);
console.log('July Due Date:', julyDueDate.toISOString());

const julyDaysLate = calculateDaysLate(julyDueDate, julyDate);
console.log('July Days Late on July 3:', julyDaysLate);

const julyLateFineInfo = calculateLateFineInfo(groupSchedule, julyPeriodStart, julyDate);
console.log('July Late Fine Info on July 3:', julyLateFineInfo);

console.log('\n=== Expected Behavior ===');
console.log('July 3 should NOT show as late (days late = 0)');
console.log('Late fines should only start from July 6th');
