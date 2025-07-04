const { MongoClient } = require('mongodb');

const MONGODB_URI = "mongodb+srv://shreyapixel007:BrQKnAPgM5H91jRH@cluster0.7n6q0.mongodb.net/shg-management?retryWrites=true&w=majority&appName=Cluster0";

// Test tier-based calculation logic
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
    case 'DAILY_FIXED':
      const dailyFixed = (lateFineRule.dailyAmount || 0) * daysLate;
      console.log('DAILY_FIXED calculation:', lateFineRule.dailyAmount, '*', daysLate, '=', dailyFixed);
      return dailyFixed;
      
    case 'DAILY_PERCENTAGE':
      const dailyRate = (lateFineRule.dailyPercentage || 0) / 100;
      const percentageTotal = Math.round((expectedContribution * dailyRate * daysLate) * 100) / 100;
      console.log('DAILY_PERCENTAGE calculation:', expectedContribution, '*', dailyRate, '*', daysLate, '=', percentageTotal);
      return percentageTotal;
      
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

async function testLateFineCalculation() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB Atlas');
    
    const db = client.db('shg-management');
    
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
    
    console.log('=== TESTING YOUR TIER CONFIGURATION ===');
    const result = calculateLateFineAmount(testLateFineRule, 9, 100);
    console.log(`\nResult for 9 days late: ₹${result}`);
    console.log('Expected: ₹195 (3×₹15 + 6×₹25)');
    console.log('You reported seeing: ₹225');
    
    // Test what would give ₹225
    console.log('\n=== TESTING WHAT COULD GIVE ₹225 ===');
    const wrongResult1 = 9 * 25; // If it used day 4-15 tier for all days
    console.log(`9 × ₹25 = ₹${wrongResult1}`);
    
    const wrongResult2 = 3 * 15 + 9 * 25; // If it counted 9 days in the 4-15 tier instead of 6
    console.log(`3 × ₹15 + 9 × ₹25 = ₹${wrongResult2}`);
    
    // Now let's check actual groups in your database
    console.log('\n=== CHECKING ACTUAL GROUPS WITH TIER RULES ===');
    const groups = await db.collection('groups').find({
      'lateFineRule.ruleType': 'TIER_BASED'
    }).toArray();
    
    console.log(`Found ${groups.length} groups with tier-based late fine rules`);
    
    for (const group of groups.slice(0, 3)) { // Check first 3 groups
      console.log(`\nGroup: ${group.name} (${group._id})`);
      console.log('Late Fine Rule:', JSON.stringify(group.lateFineRule, null, 2));
      
      if (group.lateFineRule && group.lateFineRule.tierRules) {
        const testResult = calculateLateFineAmount(group.lateFineRule, 9, 100);
        console.log(`Test calculation for 9 days late: ₹${testResult}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

testLateFineCalculation();
