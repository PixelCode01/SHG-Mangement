// Test tier-based calculation logic locally
function calculateLateFineAmount(lateFineRule, daysLate, expectedContribution) {
  console.log('\n=== LATE FINE CALCULATION DEBUG ===');
  console.log('Late Fine Rule:', JSON.stringify(lateFineRule, null, 2));
  console.log('Days Late:', daysLate);
  console.log('Expected Contribution:', expectedContribution);

  // No fine if no rule, rule disabled, or not late
  if (!lateFineRule || !lateFineRule.isEnabled || daysLate <= 0) {
    console.log('No fine - rule disabled or not late');
    return 0;
  }

  switch (lateFineRule.ruleType) {
    case 'TIER_BASED':
      if (!lateFineRule.tierRules || lateFineRule.tierRules.length === 0) {
        console.log('No tier rules found');
        return 0;
      }
      
      console.log('TIER_BASED calculation:');
      console.log('Available tier rules:', lateFineRule.tierRules);
      
      // Calculate cumulative fine for all days
      let totalFine = 0;
      
      for (let day = 1; day <= daysLate; day++) {
        console.log(`\nDay ${day}:`);
        
        // Find the applicable tier for this specific day
        let applicableTier = null;
        for (const tier of lateFineRule.tierRules) {
          console.log(`  Checking tier: days ${tier.startDay}-${tier.endDay}, amount: ${tier.amount}`);
          if (day >= tier.startDay && day <= tier.endDay) {
            applicableTier = tier;
            console.log(`  ✓ Day ${day} matches tier: ${tier.startDay}-${tier.endDay}`);
            break;
          }
        }
        
        if (applicableTier) {
          if (applicableTier.isPercentage) {
            const tierRate = applicableTier.amount / 100;
            const dayFine = expectedContribution * tierRate;
            console.log(`  Day ${day} fine (percentage): ${expectedContribution} * ${tierRate} = ₹${dayFine}`);
            totalFine += dayFine;
          } else {
            console.log(`  Day ${day} fine (fixed): ₹${applicableTier.amount}`);
            totalFine += applicableTier.amount;
          }
          console.log(`  Running total: ₹${totalFine}`);
        } else {
          console.log(`  ⚠️ No applicable tier found for day ${day}`);
        }
      }
      
      const finalTotal = Math.round(totalFine * 100) / 100;
      console.log(`\nFinal total fine: ₹${finalTotal}`);
      return finalTotal;
      
    default:
      console.log('Unknown rule type:', lateFineRule.ruleType);
      return 0;
  }
}

console.log('=== TESTING YOUR TIER CONFIGURATION ===');

// Test with your specific tier configuration
const testLateFineRule = {
  id: "test",
  isEnabled: true,
  ruleType: 'TIER_BASED',
  tierRules: [
    {
      id: "tier1",
      startDay: 1,
      endDay: 3,
      amount: 15,
      isPercentage: false
    },
    {
      id: "tier2", 
      startDay: 4,
      endDay: 15,
      amount: 25,
      isPercentage: false
    },
    {
      id: "tier3",
      startDay: 16,
      endDay: 999,
      amount: 50,
      isPercentage: false
    }
  ]
};

const result = calculateLateFineAmount(testLateFineRule, 9, 100);
console.log(`\nFINAL RESULT for 9 days late: ₹${result}`);
console.log('Expected: ₹195 (3×₹15 + 6×₹25 = ₹45 + ₹150)');
console.log('You reported seeing: ₹225');

// Test what could give ₹225
console.log('\n=== ANALYZING THE ₹225 DISCREPANCY ===');
const wrongCalc1 = 9 * 25; // If it used day 4-15 tier for all 9 days
console.log(`If using ₹25 for all 9 days: 9 × ₹25 = ₹${wrongCalc1}`);

const wrongCalc2 = 3 * 15 + 9 * 25; // If it counted 9 days in the 4-15 tier instead of 6
console.log(`If using 3×₹15 + 9×₹25: ₹${wrongCalc2}`);

const wrongCalc3 = 3 * 25 + 6 * 25; // If it used ₹25 for days 1-3 instead of ₹15
console.log(`If using ₹25 for days 1-3: 3×₹25 + 6×₹25 = ₹${wrongCalc3}`);

// Test different scenarios
console.log('\n=== TESTING DIFFERENT DAY SCENARIOS ===');
for (let days of [1, 2, 3, 4, 5, 9, 15, 16, 20]) {
  const fineAmount = calculateLateFineAmount(testLateFineRule, days, 100);
  console.log(`${days} days late: ₹${fineAmount}`);
}
