const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function addLateFineRuleTiers() {
  try {
    console.log('Adding late fine rule tiers...');

    const lateFineRules = await prisma.lateFineRule.findMany();
    
    for (const rule of lateFineRules) {
      console.log(`Adding tiers for late fine rule: ${rule.id}`);
      
      // Add a simple tier: 1-30 days = ₹50 flat fine
      const tier1 = await prisma.lateFineRuleTier.create({
        data: {
          lateFineRuleId: rule.id,
          startDay: 1,
          endDay: 30,
          amount: 50,
          isPercentage: false
        }
      });
      
      console.log(`Created tier 1: Days 1-30 = ₹50 flat`);
      
      // Add a second tier: 31-60 days = ₹100 flat fine  
      const tier2 = await prisma.lateFineRuleTier.create({
        data: {
          lateFineRuleId: rule.id,
          startDay: 31,
          endDay: 60,
          amount: 100,
          isPercentage: false
        }
      });
      
      console.log(`Created tier 2: Days 31-60 = ₹100 flat`);
    }
    
    console.log('\nTiers added successfully!');

  } catch (error) {
    console.error('Error adding late fine rule tiers:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addLateFineRuleTiers();
