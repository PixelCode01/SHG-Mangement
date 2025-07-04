const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testLateFineCreation() {
  console.log('Testing late fine creation fix...');
  
  try {
    // Step 1: Check existing groups with late fine rules
    const groupsWithLateFines = await prisma.group.findMany({
      include: {
        lateFineRules: {
          include: {
            tierRules: true
          }
        }
      },
      where: {
        lateFineRules: {
          some: {}
        }
      }
    });
    
    console.log(`\nFound ${groupsWithLateFines.length} groups with late fine rules:`);
    
    groupsWithLateFines.forEach(group => {
      console.log(`\n📊 Group: ${group.name} (${group.groupId})`);
      group.lateFineRules.forEach(rule => {
        console.log(`  ➤ Late Fine Rule: ${rule.ruleType} (${rule.isEnabled ? 'Enabled' : 'Disabled'})`);
        if (rule.ruleType === 'DAILY_FIXED') {
          console.log(`    Daily Amount: ₹${rule.dailyAmount}`);
        } else if (rule.ruleType === 'DAILY_PERCENTAGE') {
          console.log(`    Daily Percentage: ${rule.dailyPercentage}%`);
        } else if (rule.ruleType === 'TIER_BASED') {
          console.log(`    Tier Rules: ${rule.tierRules.length} tiers`);
          rule.tierRules.forEach((tier, index) => {
            console.log(`      Tier ${index + 1}: Days ${tier.startDay}-${tier.endDay} = ₹${tier.amount}${tier.isPercentage ? '%' : ''}`);
          });
        }
      });
    });
    
    // Step 2: Check groups without late fine rules
    const groupsWithoutLateFines = await prisma.group.findMany({
      where: {
        lateFineRules: {
          none: {}
        }
      },
      select: {
        id: true,
        name: true,
        groupId: true,
        createdAt: true
      }
    });
    
    console.log(`\n❌ Found ${groupsWithoutLateFines.length} groups WITHOUT late fine rules:`);
    groupsWithoutLateFines.slice(0, 5).forEach(group => {
      console.log(`  - ${group.name} (${group.groupId}) - Created: ${group.createdAt.toISOString().split('T')[0]}`);
    });
    
    if (groupsWithoutLateFines.length > 5) {
      console.log(`  ... and ${groupsWithoutLateFines.length - 5} more`);
    }
    
    // Step 3: Test the API endpoint 
    console.log(`\n🧪 Testing API endpoints...`);
    
    // Pick a group to test
    if (groupsWithLateFines.length > 0) {
      const testGroup = groupsWithLateFines[0];
      console.log(`\nTesting group: ${testGroup.name}`);
      
      // Simulate API call to get group data
      const response = await fetch(`http://localhost:3001/api/groups/${testGroup.id}`);
      if (response.ok) {
        const groupData = await response.json();
        console.log(`✅ API Response includes late fine rules: ${!!groupData.lateFineRules}`);
        if (groupData.lateFineRules && groupData.lateFineRules.length > 0) {
          const rule = groupData.lateFineRules[0];
          console.log(`   Rule Type: ${rule.ruleType}, Enabled: ${rule.isEnabled}`);
        }
      } else {
        console.log(`❌ API call failed: ${response.status}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error during testing:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testLateFineCreation();
