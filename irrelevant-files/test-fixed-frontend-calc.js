// Test the fixed frontend late fine calculation
function roundToTwoDecimals(value) {
  return Math.round(value * 100) / 100;
}

function calculateLateFine(groupData, daysLate, expectedContribution) {
  const lateFineRule = groupData.lateFineRules?.[0];
  
  if (!lateFineRule || !lateFineRule.isEnabled || daysLate <= 0) {
    return 0;
  }

  switch (lateFineRule.ruleType) {
    case 'DAILY_FIXED':
      return roundToTwoDecimals((lateFineRule.dailyAmount || 0) * daysLate);
    
    case 'DAILY_PERCENTAGE':
      return roundToTwoDecimals(expectedContribution * (lateFineRule.dailyPercentage || 0) / 100 * daysLate);
    
    case 'TIER_BASED':
      const tierRules = lateFineRule.tierRules || [];
      
      if (tierRules.length === 0) {
        return 0;
      }
      
      // Calculate cumulative fine for all days (tier-based is per day, not total)
      let totalFine = 0;
      
      for (let day = 1; day <= daysLate; day++) {
        // Find the applicable tier for this specific day
        const applicableTier = tierRules.find(tier => 
          day >= tier.startDay && day <= tier.endDay
        );
        
        if (applicableTier) {
          // Add the daily fine for this day based on its tier
          if (applicableTier.isPercentage) {
            const tierRate = applicableTier.amount / 100;
            totalFine += expectedContribution * tierRate; // Daily percentage fine
          } else {
            totalFine += applicableTier.amount; // Daily fixed fine
          }
        }
      }
      
      return roundToTwoDecimals(totalFine);
    
    default:
      return 0;
  }
}

// Test with your specific configuration
const testGroupData = {
  lateFineRules: [{
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
  }]
};

console.log('=== TESTING FIXED FRONTEND CALCULATION ===');

const result9Days = calculateLateFine(testGroupData, 9, 100);
console.log(`9 days late: ₹${result9Days}`);
console.log('Expected: ₹195 (3×₹15 + 6×₹25)');
console.log('Previously showing: ₹225');
console.log(`Fix successful: ${result9Days === 195 ? '✅ YES' : '❌ NO'}`);

console.log('\n=== TESTING OTHER SCENARIOS ===');
for (let days of [1, 3, 4, 5, 9, 15, 16, 20]) {
  const fineAmount = calculateLateFine(testGroupData, days, 100);
  console.log(`${days} days late: ₹${fineAmount}`);
}
