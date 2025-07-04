// Sample script showing how to create late fine rules for a group
// This would typically be done through an admin interface or during group setup

// Example 1: Daily Fixed Amount Late Fine
const dailyFixedLateFineRule = {
  groupId: "group_id_here",
  ruleType: "DAILY_FIXED",
  isEnabled: true,
  dailyAmount: 5.0,  // ₹5 per day late
  dailyPercentage: null,
  tierRules: []
};

// Example 2: Daily Percentage Late Fine
const dailyPercentageLateFineRule = {
  groupId: "group_id_here",
  ruleType: "DAILY_PERCENTAGE", 
  isEnabled: true,
  dailyAmount: null,
  dailyPercentage: 0.5,  // 0.5% of contribution per day late
  tierRules: []
};

// Example 3: Tier-Based Late Fine (Progressive penalty)
const tierBasedLateFineRule = {
  groupId: "group_id_here",
  ruleType: "TIER_BASED",
  isEnabled: true,
  dailyAmount: null,
  dailyPercentage: null,
  tierRules: [
    {
      startDay: 1,
      endDay: 7,
      amount: 2.0,
      isPercentage: false  // ₹2 per day for first week
    },
    {
      startDay: 8,
      endDay: 14, 
      amount: 5.0,
      isPercentage: false  // ₹5 per day for second week
    },
    {
      startDay: 15,
      endDay: 30,
      amount: 1.0,
      isPercentage: true   // 1% per day after 2 weeks
    }
  ]
};

// Collection schedule examples:

// Monthly collection on 8th of every month
const monthlyCollection = {
  collectionFrequency: "MONTHLY",
  collectionDayOfMonth: 8
};

// Weekly collection every Monday
const weeklyCollection = {
  collectionFrequency: "WEEKLY", 
  collectionDayOfWeek: "MONDAY"
};

// Fortnightly collection every second Tuesday
const fortnightlyCollection = {
  collectionFrequency: "FORTNIGHTLY",
  collectionDayOfWeek: "TUESDAY",
  collectionWeekOfMonth: 2  // Second week of month
};

// Yearly collection on January 1st
const yearlyCollection = {
  collectionFrequency: "YEARLY",
  collectionDayOfMonth: 1
};

console.log("Sample Late Fine Rule Configurations:");
console.log("====================================");
console.log("1. Daily Fixed:", JSON.stringify(dailyFixedLateFineRule, null, 2));
console.log("2. Daily Percentage:", JSON.stringify(dailyPercentageLateFineRule, null, 2));
console.log("3. Tier-Based:", JSON.stringify(tierBasedLateFineRule, null, 2));
console.log("4. Collection Schedules:", {
  monthlyCollection,
  weeklyCollection, 
  fortnightlyCollection,
  yearlyCollection
});
