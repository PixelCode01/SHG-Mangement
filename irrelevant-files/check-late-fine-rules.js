const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLateFineRules() {
  try {
    console.log('Checking late fine rules...');
    
    // Check if LateFineRule model exists and has data
    const lateFineRules = await prisma.lateFineRule.findMany({
      include: {
        group: {
          select: { id: true, name: true }
        },
        tierRules: true
      }
    });
    
    console.log(`Found ${lateFineRules.length} late fine rules`);
    
    if (lateFineRules.length > 0) {
      lateFineRules.forEach(rule => {
        console.log(`\nRule ID: ${rule.id}`);
        console.log(`Group: ${rule.group.name} (${rule.group.id})`);
        console.log(`Type: ${rule.ruleType}`);
        console.log(`Enabled: ${rule.isEnabled}`);
        if (rule.dailyAmount) console.log(`Daily Amount: ${rule.dailyAmount}`);
        if (rule.dailyPercentage) console.log(`Daily Percentage: ${rule.dailyPercentage}`);
        if (rule.tierRules.length > 0) {
          console.log(`Tier Rules: ${rule.tierRules.length}`);
          rule.tierRules.forEach((tier, index) => {
            console.log(`  Tier ${index + 1}: Days ${tier.startDay}-${tier.endDay}, Amount: ${tier.amount}${tier.isPercentage ? '%' : ''}`);
          });
        }
      });
    } else {
      console.log('No late fine rules found in database');
      
      // Let's also check all groups
      const groups = await prisma.group.findMany({
        select: { id: true, name: true }
      });
      console.log(`\nFound ${groups.length} groups total:`);
      groups.forEach(group => {
        console.log(`- ${group.name} (${group.id})`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLateFineRules();
