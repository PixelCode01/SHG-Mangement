// Check your specific group's late fine configuration
const { MongoClient } = require('mongodb');

const MONGODB_URI = "mongodb+srv://shreyapixel007:BrQKnAPgM5H91jRH@cluster0.7n6q0.mongodb.net/shg-management?retryWrites=true&w=majority&appName=Cluster0";

async function checkGroupLateFineConfig() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB Atlas');
    
    const db = client.db('shg-management');
    
    // Find all groups with tier-based late fine rules
    console.log('=== SEARCHING FOR TIER-BASED GROUPS ===');
    const tierBasedGroups = await db.collection('groups').find({
      'lateFineRule.ruleType': 'TIER_BASED'
    }).toArray();
    
    console.log(`Found ${tierBasedGroups.length} groups with tier-based late fine rules:`);
    
    tierBasedGroups.forEach((group, index) => {
      console.log(`\n--- Group ${index + 1}: ${group.name} (${group._id}) ---`);
      console.log('Late Fine Rule:', JSON.stringify(group.lateFineRule, null, 2));
      
      if (group.lateFineRule && group.lateFineRule.tierRules) {
        console.log('Tier Rules:');
        group.lateFineRule.tierRules.forEach((tier, tierIndex) => {
          console.log(`  Tier ${tierIndex + 1}: Days ${tier.startDay}-${tier.endDay}: ₹${tier.amount} ${tier.isPercentage ? '(percentage)' : '(fixed)'}`);
        });
      }
    });
    
    // Look for the most recently created group (likely yours)
    console.log('\n=== MOST RECENT GROUPS ===');
    const recentGroups = await db.collection('groups').find({}).sort({ createdAt: -1 }).limit(5).toArray();
    
    recentGroups.forEach((group, index) => {
      console.log(`\n--- Recent Group ${index + 1}: ${group.name} (${group._id}) ---`);
      console.log('Created:', group.createdAt);
      if (group.lateFineRule) {
        console.log('Late Fine Rule Type:', group.lateFineRule.ruleType);
        console.log('Late Fine Rule:', JSON.stringify(group.lateFineRule, null, 2));
      } else {
        console.log('No late fine rule configured');
      }
    });
    
    // Search for groups with the specific tier amounts you mentioned
    console.log('\n=== GROUPS WITH ₹15 or ₹25 TIER AMOUNTS ===');
    const groupsWithSpecificAmounts = await db.collection('groups').find({
      $or: [
        { 'lateFineRule.tierRules.amount': 15 },
        { 'lateFineRule.tierRules.amount': 25 }
      ]
    }).toArray();
    
    groupsWithSpecificAmounts.forEach((group, index) => {
      console.log(`\n--- Group with ₹15/₹25: ${group.name} (${group._id}) ---`);
      console.log('Late Fine Rule:', JSON.stringify(group.lateFineRule, null, 2));
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkGroupLateFineConfig();
