#!/usr/bin/env node

/**
 * Debug the date calculation to fix the days late calculation
 */

console.log('🔍 DEBUGGING DATE CALCULATION');
console.log('=============================\n');

const today = new Date('2025-06-13');
const dueDate = new Date('2025-06-05');

console.log(`📅 Today: ${today.toDateString()}`);
console.log(`📅 Due Date: ${dueDate.toDateString()}`);

// Current calculation (what we're using)
const currentCalc = Math.max(0, Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
console.log(`\n🧮 CURRENT CALCULATION:`);
console.log(`   Time diff: ${today.getTime() - dueDate.getTime()} ms`);
console.log(`   Days: ${(today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)}`);
console.log(`   Math.ceil result: ${currentCalc} days`);

// Correct calculation (should be 8 days)
const correctCalc = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
console.log(`\n✅ CORRECT CALCULATION:`);
console.log(`   Time diff: ${today.getTime() - dueDate.getTime()} ms`);
console.log(`   Days: ${(today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)}`);
console.log(`   Math.floor result: ${correctCalc} days`);

// Manual verification
console.log(`\n📊 MANUAL VERIFICATION:`);
const dates = [];
let checkDate = new Date(dueDate);
checkDate.setDate(checkDate.getDate() + 1); // Start from day after due date

let dayCount = 0;
while (checkDate <= today) {
  dayCount++;
  dates.push(new Date(checkDate).toDateString());
  checkDate.setDate(checkDate.getDate() + 1);
}

console.log(`   Days between ${dueDate.toDateString()} and ${today.toDateString()}:`);
dates.forEach((date, index) => {
  console.log(`   Day ${index + 1}: ${date}`);
});
console.log(`   Total overdue days: ${dayCount}`);

console.log(`\n🎯 CONCLUSION:`);
console.log(`   Current (Math.ceil): ${currentCalc} days - INCORRECT`);
console.log(`   Correct (Math.floor): ${correctCalc} days - CORRECT`);
console.log(`   Manual count: ${dayCount} days - VERIFICATION`);

if (correctCalc === dayCount) {
  console.log(`   ✅ Math.floor matches manual count - this is the correct method`);
} else {
  console.log(`   ❌ Something is wrong with the calculation`);
}

console.log(`\n🔧 FIX NEEDED:`);
console.log(`   Change Math.ceil to Math.floor in the frontend calculation`);
console.log(`   8 days late × ₹10 = ₹80 (instead of 9 days × ₹10 = ₹90)`);
