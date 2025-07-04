const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkLateFineStatus() {
  try {
    console.log('Checking late fine status...');

    const groups = await prisma.group.findMany({
      include: {
        lateFineRules: {
          include: {
            tierRules: true
          }
        }
      }
    });

    console.log(`Found ${groups.length} groups:`);
    
    for (const group of groups) {
      console.log(`\nGroup: ${group.name}`);
      console.log(`Late Fine Rules: ${group.lateFineRules.length}`);
      
      for (const rule of group.lateFineRules) {
        console.log(`  Rule ID: ${rule.id}`);
        console.log(`  Enabled: ${rule.isEnabled}`);
        console.log(`  Calculation Method: ${rule.calculationMethod}`);
        console.log(`  Tiers: ${rule.tierRules.length}`);
        
        for (const tier of rule.tierRules) {
          console.log(`    Days ${tier.startDay}-${tier.endDay}: ${tier.amount}${tier.isPercentage ? '%' : ' flat'}`);
        }
      }
    }

  } catch (error) {
    console.error('Error checking late fine status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLateFineStatus();
