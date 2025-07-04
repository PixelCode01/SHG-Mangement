#!/usr/bin/env node

/**
 * Debug the calculateCurrentPeriodDueDate logic specifically
 */

console.log('🔍 DEBUGGING calculateCurrentPeriodDueDate LOGIC');
console.log('===============================================\n');

const today = new Date('2025-06-13');
console.log(`📅 Today: ${today.toDateString()}`);

// Simulate the MONTHLY case from the frontend
const targetDay = 5; // collectionDayOfMonth
const currentMonth = today.getMonth(); // June = 5 (0-indexed)
const currentYear = today.getFullYear(); // 2025

console.log(`🎯 Target Collection Day: ${targetDay}th of month`);
console.log(`📊 Current Month: ${currentMonth} (${today.toLocaleString('default', { month: 'long' })})`);
console.log(`📊 Current Year: ${currentYear}`);

// Frontend logic for MONTHLY
let dueDate = new Date(currentYear, currentMonth, targetDay);
console.log(`\n🧮 FRONTEND MONTHLY LOGIC:`);
console.log(`   new Date(${currentYear}, ${currentMonth}, ${targetDay})`);
console.log(`   Result: ${dueDate.toDateString()}`);

// Handle months with fewer days check
if (dueDate.getMonth() !== currentMonth) {
  console.log(`   Month adjustment needed (${dueDate.getMonth()} !== ${currentMonth})`);
  dueDate = new Date(currentYear, currentMonth + 1, 0); // Last day of current month
  console.log(`   Adjusted: ${dueDate.toDateString()}`);
} else {
  console.log(`   No month adjustment needed`);
}

console.log(`\n📋 FINAL DUE DATE: ${dueDate.toDateString()}`);

// Calculate days late with different methods
const timeDiff = today.getTime() - dueDate.getTime();
const exactDays = timeDiff / (1000 * 60 * 60 * 24);
const ceilDays = Math.ceil(exactDays);
const floorDays = Math.floor(exactDays);

console.log(`\n🧮 DAYS LATE CALCULATION:`);
console.log(`   Time difference: ${timeDiff} ms`);
console.log(`   Exact days: ${exactDays}`);
console.log(`   Math.ceil: ${ceilDays} days`);
console.log(`   Math.floor: ${floorDays} days`);

// Manual count verification
let count = 0;
let checkDate = new Date(dueDate);
checkDate.setDate(checkDate.getDate() + 1);

console.log(`\n📊 MANUAL COUNT FROM ${dueDate.toDateString()} TO ${today.toDateString()}:`);
while (checkDate <= today) {
  count++;
  console.log(`   Day ${count}: ${checkDate.toDateString()}`);
  checkDate.setDate(checkDate.getDate() + 1);
}

console.log(`\n🎯 CONCLUSION:`);
console.log(`   Frontend due date: ${dueDate.toDateString()}`);
console.log(`   Manual count: ${count} days overdue`);
console.log(`   Current frontend (Math.ceil): ${ceilDays} days`);
console.log(`   Correct should be: ${count} days`);

if (ceilDays === count) {
  console.log(`   ✅ Math.ceil is correct`);
} else if (floorDays === count) {
  console.log(`   ✅ Math.floor is correct`);
  console.log(`   🔧 Need to change Math.ceil to Math.floor`);
} else {
  console.log(`   ❌ Neither Math.ceil nor Math.floor matches - logic issue`);
}

console.log(`\n💰 LATE FINE IMPACT:`);
console.log(`   With ${count} days: ${count} × ₹10 = ₹${count * 10}`);
console.log(`   With ${ceilDays} days: ${ceilDays} × ₹10 = ₹${ceilDays * 10}`);
console.log(`   With ${floorDays} days: ${floorDays} × ₹10 = ₹${floorDays * 10}`);
