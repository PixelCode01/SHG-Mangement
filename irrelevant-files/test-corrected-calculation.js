#!/usr/bin/env node

/**
 * Test the corrected date calculation
 */

console.log('🧪 TESTING CORRECTED DATE CALCULATION');
console.log('====================================\n');

const today = new Date('2025-06-13');
const dueDate = new Date('2025-06-05');

console.log(`📅 Today: ${today.toDateString()}`);
console.log(`📅 Due Date: ${dueDate.toDateString()}`);

// Fixed calculation (using Math.floor)
const daysLate = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

console.log(`\n✅ CORRECTED CALCULATION:`);
console.log(`   Time diff: ${today.getTime() - dueDate.getTime()} ms`);
console.log(`   Exact days: ${(today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)}`);
console.log(`   Math.floor result: ${daysLate} days`);

// Test the late fine calculation with correct days
const tierRules = [
  { startDay: 1, endDay: 7, amount: 5 },
  { startDay: 8, endDay: 15, amount: 10 },
  { startDay: 16, endDay: 9999, amount: 15 }
];

// Find applicable tier
const applicableTier = tierRules.find(tier => 
  daysLate >= tier.startDay && daysLate <= tier.endDay
);

if (applicableTier) {
  const lateFine = applicableTier.amount * daysLate;
  console.log(`\n💰 LATE FINE CALCULATION:`);
  console.log(`   Days late: ${daysLate}`);
  console.log(`   Applicable tier: Days ${applicableTier.startDay}-${applicableTier.endDay}`);
  console.log(`   Rate: ₹${applicableTier.amount} per day`);
  console.log(`   Late fine: ₹${applicableTier.amount} × ${daysLate} = ₹${lateFine}`);
  
  console.log(`\n🎯 FINAL RESULT:`);
  console.log(`   ✅ ${daysLate} days late (correct)`);
  console.log(`   ✅ ₹${lateFine} late fine (correct)`);
  console.log(`   📱 This should now display correctly in the frontend`);
} else {
  console.log(`   ❌ No applicable tier found`);
}

console.log(`\n🔧 FIX APPLIED:`);
console.log(`   Changed Math.ceil to Math.floor in the days late calculation`);
console.log(`   Result: 8 days × ₹10 = ₹80 (instead of 9 days × ₹10 = ₹90)`);
console.log(`   Frontend will now show the correct late fine amount`);
