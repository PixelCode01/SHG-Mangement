/**
 * Test script to verify 30-70 allocation rounding
 * This script tests that all 30% cash in hand and 70% cash in bank allocations
 * are properly rounded to 2 decimal places
 */

// Helper function for rounding (same as in currency-utils.ts)
function roundToTwoDecimals(amount) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

// Test cases with different amounts
const testAmounts = [
  100,      // Simple case
  333.33,   // Case that would create repeating decimals
  1000.01,  // Case with existing decimals
  567.896,  // Case requiring rounding
  0.01,     // Very small amount
  999999.99 // Large amount
];

console.log('🧮 Testing 30-70 Allocation Rounding');
console.log('====================================\n');

testAmounts.forEach((amount, index) => {
  console.log(`Test ${index + 1}: Amount ₹${amount}`);
  
  // Standard calculations without rounding
  const handStandard = amount * 0.3;
  const bankStandard = amount * 0.7;
  
  // Calculations with proper rounding
  const handRounded = roundToTwoDecimals(amount * 0.3);
  const bankRounded = roundToTwoDecimals(amount * 0.7);
  
  console.log(`  Without rounding: Hand ₹${handStandard}, Bank ₹${bankStandard}`);
  console.log(`  With rounding:    Hand ₹${handRounded}, Bank ₹${bankRounded}`);
  
  // Check if rounding made a difference
  const handDiff = handRounded !== handStandard;
  const bankDiff = bankRounded !== bankStandard;
  
  if (handDiff || bankDiff) {
    console.log(`  ✅ Rounding applied: Hand ${handDiff ? 'rounded' : 'unchanged'}, Bank ${bankDiff ? 'rounded' : 'unchanged'}`);
  } else {
    console.log(`  ℹ️  No rounding needed for this amount`);
  }
  
  // Verify the results have at most 2 decimal places
  const handDecimals = (handRounded.toString().split('.')[1] || '').length;
  const bankDecimals = (bankRounded.toString().split('.')[1] || '').length;
  
  if (handDecimals <= 2 && bankDecimals <= 2) {
    console.log(`  ✅ Both values have ≤ 2 decimal places`);
  } else {
    console.log(`  ❌ ERROR: Hand has ${handDecimals} decimals, Bank has ${bankDecimals} decimals`);
  }
  
  console.log('');
});

// Test edge cases
console.log('🔍 Testing Edge Cases');
console.log('=====================\n');

// Edge case 1: Very small amounts
const verySmall = 0.001;
const verySmallHand = roundToTwoDecimals(verySmall * 0.3);
const verySmallBank = roundToTwoDecimals(verySmall * 0.7);

console.log(`Very small amount: ₹${verySmall}`);
console.log(`  30% (₹${verySmall * 0.3}) → ₹${verySmallHand}`);
console.log(`  70% (₹${verySmall * 0.7}) → ₹${verySmallBank}`);
console.log('');

// Edge case 2: Amount that creates maximum rounding difference
const maxRoundingTest = 333.333333;
const maxRoundingHand = roundToTwoDecimals(maxRoundingTest * 0.3);
const maxRoundingBank = roundToTwoDecimals(maxRoundingTest * 0.7);

console.log(`Maximum rounding test: ₹${maxRoundingTest}`);
console.log(`  30% (₹${maxRoundingTest * 0.3}) → ₹${maxRoundingHand}`);
console.log(`  70% (₹${maxRoundingTest * 0.7}) → ₹${maxRoundingBank}`);
console.log('');

// Verify total consistency
console.log('🔄 Testing Total Consistency');
console.log('============================\n');

testAmounts.forEach((amount, index) => {
  const handRounded = roundToTwoDecimals(amount * 0.3);
  const bankRounded = roundToTwoDecimals(amount * 0.7);
  const totalRounded = handRounded + bankRounded;
  const totalRoundedAgain = roundToTwoDecimals(totalRounded);
  
  const difference = Math.abs(amount - totalRoundedAgain);
  
  console.log(`Test ${index + 1}: ₹${amount}`);
  console.log(`  Hand + Bank = ₹${handRounded} + ₹${bankRounded} = ₹${totalRounded}`);
  console.log(`  Difference from original: ₹${difference.toFixed(4)}`);
  
  if (difference <= 0.02) { // Allow up to 2 cents difference due to rounding
    console.log(`  ✅ Total is within acceptable range`);
  } else {
    console.log(`  ⚠️  Total difference exceeds 2 cents: ₹${difference}`);
  }
  console.log('');
});

console.log('✅ 30-70 Allocation Rounding Test Complete');
console.log('===========================================');
console.log('All monetary calculations should use roundToTwoDecimals() for consistency.');
